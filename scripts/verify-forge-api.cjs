'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Forge API preserves balances across concurrent retries and restart',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pg-forge-api-'));
  let child;
  async function start(){
    child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:dir,MYSQL_URL:'',DATABASE_URL:'',TASKMALL_SQLITE:'',TASKMALL_TEST_WALLET:'1',TASKMALL_EARN_ENABLED:'1',PORTGAINY_FORGE_ENABLED:'1',TASKMALL_SPOT_ENABLED:'1',TASKMALL_MAINTENANCE_ENABLED:'0',TASKMALL_ADMIN_EMAILS:'forge-admin@example.test',TRON_DEPOSITS_ENABLED:'0',TRON_AUTO_WALLET:'0',TRON_AUTOMATIC_WITHDRAWALS_ENABLED:'0',TRON_AUTOMATIC_COLLECTIONS_ENABLED:'0'}});
    return new Promise((resolve,reject)=>{let errors='';const timer=setTimeout(()=>reject(new Error('startup timeout: '+errors)),10000);child.stderr.on('data',data=>{errors+=String(data);});child.stdout.on('data',data=>{const m=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('server exited: '+errors));});});
  }
  async function stop(){if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}}
  let base=await start(),cookie='';
  async function request(url,body){const response=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {response,data};}
  try{
    let result=await request('/api/auth/signup',{email:'forge-admin@example.test',name:'Forge admin',password:'ForgeTestPassword2026'});assert.equal(result.response.status,201);
    result=await request('/api/wallet/deposit',{amount:9.99,network:'trc20'});assert.equal(result.response.status,400);
    result=await request('/api/wallet/deposit',{amount:100,network:'trc20'});assert.equal(result.data.user.withdrawBalance,100);assert.equal(result.data.user.lockedBalance,0);assert.equal(result.data.user.walletModel,'unified');
    const parallel=await Promise.all(Array.from({length:8},()=>request('/api/forge/buy',{sku:'spark',requestKey:'purchase-api-request-0001'})));
    assert.ok(parallel.every(row=>row.response.status===200));assert.equal(new Set(parallel.map(row=>row.data.receipt.coreId)).size,1);
    result=await request('/api/me');assert.equal(result.data.user.withdrawBalance,90);
    result=await request('/api/forge');assert.equal(result.data.cores.length,1);
    const core=result.data.cores[0];
    result=await request('/api/forge/upgrade',{coreId:core.id,kind:'power',value:1000,revision:core.revision,requestKey:'upgrade-api-request-0001'});assert.equal(result.response.status,200);assert.equal(result.data.user.withdrawBalance,80.5);
    result=await request('/api/earn/claim',{requestKey:'legacy-claim-request-0001'});assert.equal(result.response.status,410);
    result=await request('/api/wallet/transfer',{amount:1});assert.equal(result.response.status,410);
    await stop();base=await start();cookie='';
    result=await request('/api/auth/login',{email:'forge-admin@example.test',password:'ForgeTestPassword2026'});assert.equal(result.response.status,200);
    result=await request('/api/forge');assert.equal(result.data.cores.length,1);assert.equal(result.data.cores[0].powerMilliTh,2000);
    result=await request('/api/me');assert.equal(result.data.user.withdrawBalance,80.5);assert.equal(result.data.user.lockedBalance,0);
  }finally{await stop();assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('pg-forge-api-'));await fs.rm(dir,{recursive:true,force:true});}
});

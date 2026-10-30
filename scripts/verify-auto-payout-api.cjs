'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { HDNodeWallet } = require('ethers');
const { BRANCH_PATH, USDT_CONTRACT, TRANSFER_TOPIC, addressHex, deriveAddress, proofMessage } = require('../payments/tron');
const { connect } = require('../database/mysql');
const { MysqlPaymentStore } = require('../payments/mysql-store');
const { vipPlans, tasks } = require('../platform-catalog');
const root = path.resolve(__dirname,'..');
async function writeFixture(file, fixture) {
  const staged=file+'.test-'+crypto.randomUUID();
  await fs.writeFile(staged,JSON.stringify(fixture));
  await fs.rename(staged,file);
}
// Public fixture keys; never fund these addresses.
const branch = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk','',BRANCH_PATH);
const xpub = branch.neuter().extendedKey, treasury = deriveAddress(xpub,9), destination = deriveAddress(xpub,7);

test('automatic payout API reserves funds, signs without TronLink, and settles only the confirmed matching transfer', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-auto-api-'));
  const chain = path.join(dir,'chain.json'), walletFile = path.join(dir,'wallet.json');
  const password = 'FixturePassword2026', salt = crypto.randomBytes(16).toString('hex');
  const user = {id:'fixture-user',email:'user@example.invalid',name:'Fixture',passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex'),
    lockedBalance:0,withdrawBalance:100,reservedBalance:0,earnedTotal:0,withdrawnTotal:0,withdrawFeeTotal:0,activities:[],vipId:'free',createdAt:new Date().toISOString(),
    vipStartedAt:new Date().toISOString(),vipExpiresAt:new Date(Date.now()+86_400_000).toISOString(),inviteCode:'TMFIXTURE01'};
  const admin = {...user,id:'fixture-admin',email:'admin@example.invalid',withdrawBalance:0,inviteCode:'TMFIXTURE02'};
  const mysqlMode=process.env.TASKMALL_MYSQL_INTEGRATION==='1';
  let adminDb, fixtureDatabase, mysqlUrl;
  if(mysqlMode){
    adminDb=await connect();fixtureDatabase='taskmall_test_'+crypto.randomBytes(10).toString('hex');
    await adminDb.query(`CREATE DATABASE \`${fixtureDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    const url=new URL(process.env.MYSQL_URL || process.env.DATABASE_URL);url.pathname='/'+fixtureDatabase;mysqlUrl=url.toString();
    const store=await MysqlPaymentStore.open({MYSQL_URL:mysqlUrl});
    try{await store.catalog(vipPlans,tasks);await store.save({users:[user,admin],tasks},'isolated-fixture-opening');}finally{await store.close();}
  } else await fs.writeFile(path.join(dir,'db.json'),JSON.stringify({users:[user,admin]}));
  await fs.writeFile(walletFile,JSON.stringify({version:1,network:'tron-mainnet',branchPath:BRANCH_PATH,xpub,treasuryAddress:treasury,
    firstAddress:deriveAddress(xpub,0),proof:await branch.deriveChild(0).signMessage(proofMessage(xpub,treasury))}));
  await fs.writeFile(chain,JSON.stringify({history:{},receipts:{},payouts:{usdt:'100000000',trx:50000000}}));
  const env = {...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:dir,TASKMALL_LOCAL_LIVE_PROXY:'0',
    TASKMALL_MAINTENANCE_ENABLED:'0',TASKMALL_SQLITE:mysqlMode?'':'1',TASKMALL_MYSQL_TEST:mysqlMode?'1':'',MYSQL_URL:mysqlUrl||'',DATABASE_URL:'',TASKMALL_TEST_WALLET:'',
    TRON_DEPOSITS_ENABLED:'1',TRON_AUTO_WALLET:'0',TRON_MANUAL_WITHDRAWALS_ENABLED:'0',TRON_AUTOMATIC_WITHDRAWALS_ENABLED:'1',
    TRON_AUTOMATIC_COLLECTIONS_ENABLED:'0',TRON_TREASURY_ADDRESS:treasury,TRON_WALLET_PUBLIC_JSON:'',TRON_WALLET_PUBLIC_FILE:walletFile,
    TRON_WORKING_WALLET_PRIVATE_KEY:branch.deriveChild(9).privateKey,TRON_OWNER_TREASURY_ADDRESS:deriveAddress(xpub,8),TRON_WORKING_PAYOUT_FEE_LIMIT_SUN:'2500000',
    TRONGRID_API_KEY:'fixture-only',TASKMALL_TRON_FIXTURE:chain,TRON_TEST_POLL_MS:'100',TASKMALL_OPERATOR_ENABLED:'0',TASKMALL_ADMIN_EMAILS:admin.email};
  const child = spawn(process.execPath,['--require','./scripts/tron-fixture-preload.cjs','server.js'],{cwd:root,env,windowsHide:true,stdio:'pipe'});
  let errors='';child.stderr.on('data',data=>{errors+=String(data).slice(0,500)});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await exited;}
    if(adminDb){assert.match(fixtureDatabase,/^taskmall_test_[a-f0-9]{20}$/);await adminDb.query(`DROP DATABASE \`${fixtureDatabase}\``);await adminDb.end();}
    const real=await fs.realpath(dir),temp=await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(real).toLowerCase(),temp.toLowerCase());assert.ok(path.basename(real).startsWith('portgainy-auto-api-'));await fs.rm(real,{recursive:true,force:true});});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture startup failed: '+errors)),12000);
    child.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
    exited.then(()=>{clearTimeout(timer);reject(new Error('Fixture exited: '+errors));});});
  const request=async(route,body,cookie)=>{const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,headers:r.headers,body:await r.json()};};
  for(let i=0;i<150;i++){if((await request('/api/payment-config')).body.withdrawalsAvailable)break;await new Promise(r=>setTimeout(r,50));}
  const config=(await request('/api/payment-config')).body;assert.equal(config.withdrawalsAvailable,true);assert.equal(config.automaticWithdrawals,true);
  const login=await request('/api/auth/login',{email:user.email,password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const response=await request('/api/wallet/withdraw',{amount:'10',network:'trc20',wallet:destination,password,requestKey:crypto.randomUUID()},cookie);
  assert.equal(response.status,201);assert.equal(response.body.user.reservedBalance,10);const id=response.body.withdrawal.id;
  const adminLoginEarly=await request('/api/auth/login',{email:admin.email,password});assert.equal(adminLoginEarly.status,200);
  const adminCookie=adminLoginEarly.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(`/api/admin/withdrawals/${id}/confirm`,{},adminCookie)).status,409);
  assert.equal((await request(`/api/admin/withdrawals/${id}/reject`,{},adminCookie)).status,409);
  const overview=await request('/api/admin/overview',undefined,adminCookie);
  assert.equal(overview.body.withdrawals.find(row=>row.id===id).automatic,true);
  let fixture;
  for(let i=0;i<240;i++){fixture=JSON.parse(await fs.readFile(chain,'utf8'));if(fixture.broadcasts?.length)break;await new Promise(r=>setTimeout(r,50));}
  assert.ok(fixture.broadcasts?.length,'signed transfer was broadcast');
  const tx=fixture.broadcasts[0];assert.equal(addressHex(treasury),tx.raw_data.contract[0].parameter.value.owner_address);
  let current=(await request('/api/wallet/withdrawals',undefined,cookie)).body.withdrawals.find(w=>w.id===id);
  assert.equal(current.status,'submitted');assert.equal(current.netAmount,9.8);assert.equal(current.txid,tx.txID);
  const me=await request('/api/me',undefined,cookie);assert.equal(me.body.user.reservedBalance,10);
  fixture.receipts[tx.txID]={id:tx.txID,blockNumber:999,blockTimeStamp:Date.now(),receipt:{result:'SUCCESS'},log:[{
    address:addressHex(USDT_CONTRACT).slice(2),topics:[TRANSFER_TOPIC,addressHex(treasury).slice(2).padStart(64,'0'),addressHex(destination).slice(2).padStart(64,'0')],
    data:BigInt(9800000).toString(16).padStart(64,'0')}]};
  await writeFixture(chain,fixture);
  for(let i=0;i<240;i++){current=(await request('/api/wallet/withdrawals',undefined,cookie)).body.withdrawals.find(w=>w.id===id);if(current.status==='confirmed')break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(current.status,'confirmed');assert.equal((await request('/api/me',undefined,cookie)).body.user.reservedBalance,0);
  assert.equal((await request('/api/admin/working-wallet',undefined,cookie)).status,403);
  const wallet=await request('/api/admin/working-wallet',undefined,adminCookie);
  assert.equal(wallet.body.address,treasury);assert.equal(wallet.body.destination,deriveAddress(xpub,8));assert.equal(wallet.body.pending,null);
  const ownerKey=crypto.randomUUID();
  assert.equal((await request('/api/admin/working-wallet/sweep',{amount:'12',password:'wrong',requestKey:ownerKey},adminCookie)).status,403);
  assert.equal((await request('/api/admin/working-wallet/sweep',{amount:'12',password,requestKey:ownerKey},cookie)).status,403);
  assert.equal((await request('/api/admin/working-wallet/sweep',{amount:'12',password,requestKey:ownerKey},adminCookie)).status,201);
  let sweep;
  for(let i=0;i<240;i++){sweep=(await request('/api/admin/working-wallet',undefined,adminCookie)).body.pending;if(sweep?.status==='submitted')break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(sweep.status,'submitted');assert.match(sweep.txid,/^[a-f0-9]{64}$/);
  let ownerTx;
  for(let i=0;i<120;i++){fixture=JSON.parse(await fs.readFile(chain,'utf8'));ownerTx=fixture.broadcasts.find(item=>item.txID===sweep.txid);if(ownerTx)break;await new Promise(r=>setTimeout(r,50));}
  assert.ok(ownerTx);
  fixture.receipts[sweep.txid]={id:sweep.txid,blockNumber:999,blockTimeStamp:Date.now(),receipt:{result:'SUCCESS'},log:[{
    address:addressHex(USDT_CONTRACT).slice(2),topics:[TRANSFER_TOPIC,addressHex(treasury).slice(2).padStart(64,'0'),addressHex(deriveAddress(xpub,8)).slice(2).padStart(64,'0')],
    data:BigInt(12000000).toString(16).padStart(64,'0')}]};
  await writeFixture(chain,fixture);
  for(let i=0;i<240;i++){sweep=(await request('/api/admin/working-wallet',undefined,adminCookie)).body.pending;if(!sweep)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(sweep,null);
});

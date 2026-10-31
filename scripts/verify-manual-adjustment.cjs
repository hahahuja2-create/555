'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const {prepare,displayedEarned}=require('../payments/manual-adjustment');
const {connect}=require('../database/mysql'),{MysqlPaymentStore}=require('../payments/mysql-store');
const {vipPlans,tasks}=require('../platform-catalog');

test('isolated operator adjustment is authorized once, journaled, and leaves actual earnings intact',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-adjust-'));
  const password='AdjustmentFixture2026',salt='adjustment-test-salt',userId=crypto.randomUUID(),operationId=crypto.randomUUID(),operatorToken=crypto.randomBytes(32).toString('base64url');
  const input={userId,expectedEarn:'0',expectedEarned:'0',targetEarn:'406.20',targetDisplayEarned:'709.5',operationId};
  const digest=crypto.createHash('sha256').update(JSON.stringify(Object.values(input))).digest('hex');
  const now=new Date().toISOString(),user={id:userId,email:'fixture@example.invalid',name:'Fixture',passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex'),
    createdAt:now,vipStartedAt:now,vipExpiresAt:new Date(Date.now()+86_400_000).toISOString(),vipId:'free',inviteCode:'FIXTURE010',lockedBalance:0,withdrawBalance:0,reservedBalance:0,earnedTotal:0,activities:[]};
  const mysqlMode=process.env.TASKMALL_MYSQL_INTEGRATION==='1';let adminDb,fixtureDatabase,mysqlUrl;
  if(mysqlMode){
    adminDb=await connect();fixtureDatabase='taskmall_test_'+crypto.randomBytes(10).toString('hex');
    await adminDb.query(`CREATE DATABASE \`${fixtureDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    const url=new URL(process.env.MYSQL_URL||process.env.DATABASE_URL);url.pathname='/'+fixtureDatabase;mysqlUrl=url.toString();
    const store=await MysqlPaymentStore.open({MYSQL_URL:mysqlUrl});try{await store.catalog(vipPlans,tasks);await store.save({users:[user]},'fixture-opening');}finally{await store.close();}
  }else await fs.writeFile(path.join(directory,'db.json'),JSON.stringify({users:[user]}));
  const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:directory,TASKMALL_LOCAL_LIVE_PROXY:'0',
    TASKMALL_MAINTENANCE_ENABLED:'0',TASKMALL_SQLITE:mysqlMode?'':'1',TASKMALL_MYSQL_TEST:mysqlMode?'1':'',TASKMALL_TEST_WALLET:'',TASKMALL_EARN_ENABLED:'1',TASKMALL_DESIGN_PREVIEW:'0',MYSQL_URL:mysqlUrl||'',DATABASE_URL:'',
    TRON_DEPOSITS_ENABLED:'0',TRON_AUTOMATIC_WITHDRAWALS_ENABLED:'0',TRON_AUTOMATIC_COLLECTIONS_ENABLED:'0',TASKMALL_OPERATOR_ENABLED:'1',
    TASKMALL_OPERATOR_TOKEN:operatorToken,TASKMALL_TEST_ADJUSTMENT_DIGEST:digest};
  const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:'pipe',env});let errors='';child.stderr.on('data',v=>errors+=String(v));
  const exited=new Promise(resolve=>child.once('exit',resolve));
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await exited;}
    if(adminDb){assert.match(fixtureDatabase,/^taskmall_test_[a-f0-9]{20}$/);await adminDb.query(`DROP DATABASE \`${fixtureDatabase}\``);await adminDb.end();}
    const real=await fs.realpath(directory),temp=await fs.realpath(os.tmpdir());assert.equal(path.dirname(real).toLowerCase(),temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('portgainy-adjust-'));await fs.rm(real,{recursive:true,force:true});});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('STARTUP_FAILED '+errors)),12000);
    child.stdout.on('data',v=>{const m=String(v).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
    exited.then(()=>{clearTimeout(timer);reject(Error('STARTUP_EXITED '+errors));});});
  const post=async(body,token=operatorToken)=>{const r=await fetch(base+'/api/operator/one-time-adjustment',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
  assert.equal((await post(input,'incorrect')).status,403);
  assert.equal((await post({...input,targetEarn:'999'})).status,403);
  assert.deepEqual(await post(input),{status:200,body:{ok:true,alreadyApplied:false,creditUnits:'406200000',offsetUnits:'709500000'}});
  assert.equal((await post(input)).body.alreadyApplied,true);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password})});
  assert.equal(login.status,200);const view=(await login.json()).user;
  assert.equal(view.earningBalance,406.2);assert.equal(view.earnedTotal,0);assert.equal(view.displayedEarnedTotal,709.5);assert.equal(view.spotBalance,0);
  let entries,auditCount;
  if(mysqlMode){
    const db=await connect({MYSQL_URL:mysqlUrl});try{[entries]=await db.execute('SELECT account,delta_units FROM journal WHERE reason=?',['operator-earn-adjustment:'+operationId]);
      const [[count]]=await db.execute('SELECT COUNT(*) n FROM payment_audit WHERE job_id=?',[operationId]);auditCount=Number(count.n);
    }finally{await db.end();}
  }else{
    const db=new DatabaseSync(path.join(directory,'payments.sqlite'),{readOnly:true});try{entries=db.prepare('SELECT account,delta_units FROM journal WHERE reason=?').all('operator-earn-adjustment:'+operationId);
      auditCount=db.prepare('SELECT COUNT(*) n FROM payment_audit WHERE job_id=?').get(operationId).n;
    }finally{db.close();}
  }
  assert.deepEqual(new Map(entries.map(e=>[e.account,Number(e.delta_units)])),new Map([[userId+':lockedBalance',406200000],['platform:counterparty',-406200000]]));
  assert.equal(auditCount,1);
  assert.throws(()=>prepare({users:[{...user,lockedBalance:1}]},{...input,at:now}),/ACCOUNT_CHANGED/);
  assert.equal(displayedEarned({earnedTotal:10,manualEarnedDisplay:{offsetUnits:'709500000'}}),719.5);
});

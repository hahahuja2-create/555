'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { PaymentStore } = require('../payments/store');

test('promotion backfills the verified ledger, credits 15%, and persists one announcement per account', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'taskmall-referral-api-'));
  const now = Date.now(), password = 'ReferralApi2026', salt = 'isolated-referral-fixture';
  const make = (id, ref = null) => ({ id, name:'Referral account', email:id+'@referral.test', inviteCode:'CODE'+id.toUpperCase(),
    referredBy:ref, passwordSalt:salt, passwordHash:crypto.scryptSync(password,salt,64).toString('hex'),
    createdAt:new Date(now-2*86400000).toISOString(), vipId:'free', lockedBalance:id==='owner'?100:0,
    withdrawBalance:0, earnedTotal:0, activities:[] });
  const owner = make('owner'), friends = Array.from({length:10},(_,i)=>make('friend'+i,owner.inviteCode));
  const store = new PaymentStore(directory);
  store.save({users:[owner,...friends]},'isolated-promotion-fixture');
  for(const [i,friend] of friends.entries())store.sql.prepare('INSERT INTO deposits VALUES (?,?,?,?,?,?,?)').run(
    crypto.createHash('sha256').update(friend.id).digest('hex'),0,friend.id,'isolated-fixture-address','50000000',100,now-86400000+i);
  store.close();
  let child, base;
  async function stop(){if(child&&child.exitCode===null&&child.signalCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}child=null;}
  t.after(async()=>{await stop();assert.equal(path.dirname(await fs.realpath(directory)).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase());assert.ok(path.basename(directory).startsWith('taskmall-referral-api-'));await fs.rm(directory,{recursive:true,force:true});});
  async function start(){
    child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:'pipe',env:{...process.env,
      NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:directory,TASKMALL_DESIGN_PREVIEW:'0',
      TASKMALL_EARN_ENABLED:'1',TASKMALL_SPOT_ENABLED:'1',MYSQL_URL:'',DATABASE_URL:'',TASKMALL_SQLITE:'1',
      TRON_DEPOSITS_ENABLED:'0',TRON_AUTO_WALLET:'0',TASKMALL_OPERATOR_ENABLED:'0',TRON_MANUAL_WITHDRAWALS_ENABLED:'0'}});
    base=await new Promise((resolve,reject)=>{let errors='';const timer=setTimeout(()=>reject(new Error('Referral fixture startup failed')),10000);
      child.stderr.on('data',d=>{errors+=d;});child.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('Referral fixture exited: '+errors));});});
  }
  const request = (route,body,cookie,extra={}) => fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const login = async email => {const r=await request('/api/auth/login',{email,password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  await start();
  assert.equal((await request('/api/earn/promotion/announcement',{})).status,401);
  const cookie=await login(owner.email);
  const account=(await(await request('/api/me',undefined,cookie)).json()).user;
  assert.equal(account.earnRate,.15);assert.equal(account.nextEarnReward,15);
  assert.equal(account.referralPromotion.qualifyingReferrals,10);assert.equal(account.referralPromotion.announcementPending,true);
  const launchedAt=account.referralPromotion.startsAt;
  assert.equal((await request('/api/earn/promotion/announcement',{},cookie,{Origin:'https://untrusted.invalid'})).status,403);
  const shown=await Promise.all([request('/api/earn/promotion/announcement',{},cookie),request('/api/earn/promotion/announcement',{},cookie)]);
  const receipts=await Promise.all(shown.map(r=>r.json()));assert.deepEqual(receipts.map(r=>r.show).sort(),[false,true]);
  const claim=await(await request('/api/earn/claim',{requestKey:crypto.randomUUID(),rate:.99},cookie)).json();
  assert.equal(claim.receipt.amount,15);assert.equal(claim.receipt.rate,.15);assert.equal(claim.user.lockedBalance,100);assert.equal(claim.user.spotBalance,15);
  const signup=await request('/api/auth/signup',{name:'New referral',email:'new@referral.test',password,referral:owner.inviteCode});assert.equal(signup.status,201);
  const registered=(await signup.json()).user;const nextCookie=signup.headers.get('set-cookie').split(';')[0];
  assert.equal(registered.referralPromotion.startsAt,Date.parse(registered.createdAt));
  assert.equal(registered.referralPromotion.expiresAt,Date.parse(registered.createdAt)+10*86400000);
  assert.equal(registered.referralPromotion.status,'active');assert.equal(registered.earnRate,.1);
  assert.equal((await(await request('/api/earn/promotion/announcement',{},nextCookie)).json()).show,true);
  await stop();await start();
  const after=await login(owner.email);const persisted=(await(await request('/api/me',undefined,after)).json()).user;
  assert.equal(persisted.referralPromotion.startsAt,launchedAt);assert.equal(persisted.earnRate,.15);assert.equal(persisted.spotBalance,15);
  assert.equal((await(await request('/api/earn/promotion/announcement',{},after)).json()).show,false);
  const fresh=await login(registered.email);assert.equal((await(await request('/api/earn/promotion/announcement',{},fresh)).json()).show,false);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {HDNodeWallet}=require('ethers'),{utils}=require('tronweb');
const {connect}=require('../database/mysql'),{MysqlPaymentStore}=require('../payments/mysql-store');
const {OutgoingLedger}=require('../payments/outgoing'),{AutomaticCollections}=require('../payments/automatic-collections');
const {BRANCH_PATH,addressHex,tronAddress,deriveAddress,proofMessage,validateWallet}=require('../payments/tron');
const {unsignedToken}=require('./tron-test-helpers.cjs');
const {vipPlans,tasks}=require('../platform-catalog');
// Public fixture mnemonic; never fund its derived addresses.
const mnemonic='test test test test test test test test test test test junk',branch=HDNodeWallet.fromPhrase(mnemonic,'',BRANCH_PATH),xpub=branch.neuter().extendedKey;
const treasury=deriveAddress(xpub,9),fuel=tronAddress(HDNodeWallet.fromPhrase(mnemonic,'',"m/44'/195'/1'/0/0").address.slice(2));
function unsignedTrx(from,to,value){const tx={visible:false,raw_data:{ref_block_bytes:'1234',ref_block_hash:'0011223344556677',timestamp:Date.now(),expiration:Date.now()+60000,
  contract:[{type:'TransferContract',parameter:{type_url:'type.googleapis.com/protocol.TransferContract',value:{owner_address:addressHex(from),to_address:addressHex(to),amount:value}}}]}};
  const pb=utils.transaction.txJsonToPb(tx);tx.raw_data_hex=utils.transaction.txPbToRawDataHex(pb);tx.txID=utils.transaction.txPbToTxID(pb).replace(/^0x/,'');return tx;}

test('MySQL collection survives signer restart without funding or collecting twice', {skip:process.env.TASKMALL_MYSQL_INTEGRATION!=='1',timeout:60000}, async t=>{
  const admin=await connect(),database='taskmall_test_'+crypto.randomBytes(10).toString('hex');
  const url=new URL(process.env.MYSQL_URL||process.env.DATABASE_URL);assert.notEqual(url.pathname.slice(1),database);url.pathname='/'+database;
  let store;
  t.after(async()=>{await store?.close();assert.match(database,/^taskmall_test_[a-f0-9]{20}$/);await admin.query(`DROP DATABASE \`${database}\``);await admin.end();});
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  const env={MYSQL_URL:url.toString()};store=await MysqlPaymentStore.open(env);await store.catalog(vipPlans,tasks);
  const now=new Date().toISOString();let app={users:[{id:'fixture',email:'fixture@example.invalid',name:'Fixture',passwordSalt:'a'.repeat(32),passwordHash:'b'.repeat(128),
    inviteCode:'TMFIXTURE09',vipId:'free',createdAt:now,vipStartedAt:now,vipExpiresAt:new Date(Date.parse(now)+86_400_000).toISOString(),lockedBalance:0,withdrawBalance:0,reservedBalance:0,
    earnedTotal:0,withdrawnTotal:0,withdrawFeeTotal:0,activities:[]}],tasks};
  await store.save(app,'fixture-opening');
  const wallet=validateWallet({version:1,network:'tron-mainnet',branchPath:BRANCH_PATH,xpub,treasuryAddress:treasury,firstAddress:deriveAddress(xpub,0),
    proof:await branch.deriveChild(0).signMessage(proofMessage(xpub,treasury))},treasury);
  await store.registerWallet(wallet);const allocated=await store.allocate('fixture',index=>deriveAddress(xpub,index),Date.now());
  await store.credit({txid:'7'.repeat(64),logIndex:0,to:allocated.address,units:'10000000',blockNumber:999,timestamp:Date.now()},app,
    state=>{state.users[0].lockedBalance=10});
  let ledger=new OutgoingLedger(store,treasury),confirmed=false,broadcasts=[],worker,queue=Promise.resolve();
  const exclusive=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p};
  const client={request:async(route,body)=>{
    if(route==='/walletsolidity/triggerconstantcontract')return {result:{result:true},constant_result:['a'.repeat(64)]};
    if(route==='/walletsolidity/getaccount')return {balance:body.address===addressHex(fuel)?100_000_000:confirmed?2_000_000:0};
    if(route==='/wallet/createtransaction')return unsignedTrx(fuel,allocated.address,body.amount);
    if(route==='/walletsolidity/gettransactionbyid')return confirmed?{txID:body.value,ret:[{contractRet:'SUCCESS'}]}:{};
    if(route==='/wallet/triggersmartcontract')return {result:{result:true},transaction:unsignedToken({from:allocated.address,to:treasury,value:10_000_000n,feeLimit:1_000_000})};
    if(route==='/wallet/broadcasttransaction'){
      const job=(await ledger.collections())[0];
      if(body.raw_data.contract[0].type==='TransferContract')assert.equal((await worker.journal.funding(job.id)).txid,body.txID);
      else assert.equal(job.txid,body.txID);
      broadcasts.push(body.txID);return {result:true};
    }throw Error('unexpected fixture request');}};
  const make=()=>new AutomaticCollections({treasury,mnemonic,fuelAddress:fuel,wallet,store,ledger,client,exclusive,
    feeLimit:1_000_000,feeDailyLimit:'2000000',gasDailyLimit:'4000000',isEnabled:()=>true});
  worker=make();assert.equal((await worker.cycle())[0].status,'awaiting-gas-confirmation');const gasTx=broadcasts[0];
  await store.close();store=await MysqlPaymentStore.open(env);ledger=new OutgoingLedger(store,treasury);worker=make();
  assert.equal((await worker.cycle())[0].status,'awaiting-gas-confirmation');assert.equal(broadcasts[1],gasTx);
  confirmed=true;assert.equal((await worker.cycle())[0].status,'awaiting-confirmation');
  const signed=(await ledger.collections())[0];assert.equal(signed.treasury,treasury);assert.equal((await store.state()).users[0].lockedBalance,10);
  assert.equal(new Set(broadcasts).size,2);
});

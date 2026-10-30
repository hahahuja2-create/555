'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {HDNodeWallet}=require('ethers');
const {PaymentStore}=require('../payments/store'),{OutgoingLedger}=require('../payments/outgoing'),{OwnerSweeps}=require('../payments/owner-sweeps');
const {BRANCH_PATH,USDT_CONTRACT,TRANSFER_TOPIC,addressHex,deriveAddress,tronAddress}=require('../payments/tron');
const {unsignedToken}=require('./tron-test-helpers.cjs');
// Public test mnemonic; never send real funds to these addresses.
const branch=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk','',BRANCH_PATH),xpub=branch.neuter().extendedKey;
const source=deriveAddress(xpub,9),destination=deriveAddress(xpub,8),feeLimit=2_500_000;

test('only a manually requested sweep sends the fixed destination, with restart-safe identity and verified settlement',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-owner-sweep-')),store=new PaymentStore(dir),ledger=new OutgoingLedger(store,source);
  t.after(async()=>{store.close();const real=await fs.realpath(dir),temp=await fs.realpath(os.tmpdir());assert.equal(path.dirname(real).toLowerCase(),temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('portgainy-owner-sweep-'));await fs.rm(real,{recursive:true,force:true});});
  let queue=Promise.resolve(),walletQueue=Promise.resolve(),sent=[],builds=0,receipt={},balance=100_000_000n,enabled=true;
  const exclusive=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p};
  const signer={enqueue:fn=>{const p=walletQueue.then(fn);walletQueue=p.catch(()=>{});return p}};
  const client={solidHeight:async()=>1000,receipt:async()=>receipt,request:async(route,body)=>{
    if(route==='/walletsolidity/triggerconstantcontract')return {result:{result:true},constant_result:[balance.toString(16).padStart(64,'0')]};
    if(route==='/walletsolidity/getaccount')return {address:addressHex(source),balance:50_000_000};
    if(route==='/wallet/triggersmartcontract'){builds++;return {result:{result:true},transaction:unsignedToken({from:tronAddress(body.owner_address),to:destination,value:BigInt('0x'+body.parameter.slice(64)),feeLimit:body.fee_limit})};}
    if(route==='/wallet/broadcasttransaction'){const job=await exclusive(()=>sweeps.pendingInside());assert.equal(job.txid,body.txID);assert.equal(job.status,'submitted');sent.push(body);return {result:true};}
    throw new Error('unexpected fixture request');}};
  const options={store,ledger,exclusive,signer,client,source,destination,privateKey:branch.deriveChild(9).privateKey,feeLimit,isEnabled:()=>enabled};
  let sweeps=new OwnerSweeps(options);
  await sweeps.cycle();assert.equal(sent.length,0);
  const key=crypto.randomUUID(),job=await exclusive(()=>sweeps.requestInside({key,amount:'12.5'},'admin'));
  assert.equal(job.status,'planned');
  assert.equal((await exclusive(()=>sweeps.requestInside({key,amount:'12.5'},'admin'))).id,job.id);
  await assert.rejects(exclusive(()=>sweeps.requestInside({key,amount:'13'},'admin')),/CONFLICT/);
  await assert.rejects(exclusive(()=>sweeps.requestInside({key:crypto.randomUUID(),amount:'1'},'admin')),/IN_PROGRESS/);
  balance=0n;await assert.rejects(sweeps.cycle(),/INSUFFICIENT/);assert.equal(sent.length,0);
  balance=100_000_000n;await sweeps.cycle();assert.equal(sent.length,1);assert.equal(builds,1);
  await assert.rejects(exclusive(()=>sweeps.cancelInside(job.id,'admin')),/ALREADY_SIGNED/);
  sweeps=new OwnerSweeps(options);await sweeps.cycle();assert.equal(builds,1);assert.deepEqual(sent[1],sent[0]);
  receipt={id:sent[0].txID,blockNumber:999,blockTimeStamp:Date.now(),receipt:{result:'SUCCESS'},log:[{address:addressHex(USDT_CONTRACT).slice(2),
    topics:[TRANSFER_TOPIC,addressHex(source).slice(2).padStart(64,'0'),addressHex(destination).slice(2).padStart(64,'0')],data:BigInt(12_500_000).toString(16).padStart(64,'0')}]};
  await sweeps.cycle();assert.equal((await exclusive(()=>sweeps.getInside(job.id))).status,'confirmed');assert.equal(sent.length,2);
  const next=await exclusive(()=>sweeps.requestInside({key:crypto.randomUUID(),amount:'1'},'admin'));
  assert.equal((await exclusive(()=>sweeps.cancelInside(next.id,'admin'))).status,'cancelled');
  enabled=false;await sweeps.cycle();assert.equal(sent.length,2);
});

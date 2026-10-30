'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { HDNodeWallet } = require('ethers');
const { PaymentStore } = require('../payments/store');
const { OutgoingLedger } = require('../payments/outgoing');
const { TronLinkPayouts } = require('../payments/payouts');
const { AutomaticPayouts } = require('../payments/automatic-payouts');
const { BRANCH_PATH, deriveAddress, addressHex, tronAddress } = require('../payments/tron');
const { unsignedToken } = require('./tron-test-helpers.cjs');

// Public fixture: never use with real funds.
const branch = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', '', BRANCH_PATH);
const xpub = branch.neuter().extendedKey, treasury = deriveAddress(xpub, 9), destination = deriveAddress(xpub, 7), feeLimit = 2_500_000;

test('automatic payouts authorize only eligible requests and persist exact signed bytes before retryable broadcasts', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portgainy-auto-payout-'));
  const f = { store: new PaymentStore(directory), state: { users: [{id:'a',withdrawBalance:100,lockedBalance:0,reservedBalance:0,activities:[]}] },
    usdt: 100_000_000n, broadcasts: [], builds: 0, lostAck: true, enabled: true };
  f.ledger = new OutgoingLedger(f.store, treasury); f.store.save(f.state);
  t.after(async () => {
    f.store.close();
    const real = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(real).toLowerCase(), temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('portgainy-auto-payout-'));
    await fs.rm(real, {recursive:true,force:true});
  });
  let queue = Promise.resolve();
  const exclusive = operation => { const next = queue.then(operation); queue = next.catch(() => {}); return next; };
  const client = { request: async (route, body) => {
    if (route === '/walletsolidity/triggerconstantcontract') return {result:{result:true},constant_result:[f.usdt.toString(16).padStart(64,'0')]};
    if (route === '/walletsolidity/getaccount') return {address:addressHex(treasury),balance:50_000_000};
    if (route === '/wallet/triggersmartcontract') { f.builds++; return {result:{result:true},transaction:unsignedToken({from:tronAddress(body.owner_address),to:destination,value:BigInt('0x'+body.parameter.slice(64)),feeLimit:body.fee_limit})}; }
    if (route === '/wallet/broadcasttransaction') {
      assert.deepEqual(await f.ledger.signedWithdrawal(f.currentId), body);
      assert.equal((await f.ledger.withdrawal(f.currentId)).status, 'submitted');
      f.broadcasts.push(structuredClone(body));
      if (f.lostAck) throw new Error('network acknowledgement lost');
      return {result:true};
    }
    throw new Error('unexpected fixture request');
  } };
  const payouts = new TronLinkPayouts({treasury,exclusive,getLedger:()=>f.ledger,getClient:()=>client,
    getState:()=>f.state,commitState:next=>{f.state=next},isHealthy:()=>true,isSendingEnabled:()=>f.enabled});
  const worker = new AutomaticPayouts({treasury,privateKey:branch.deriveChild(9).privateKey,feeLimit,payouts,ledger:f.ledger,exclusive,
    getState:()=>f.state,commitState:next=>{f.state=next},isEligible:row=>f.ledger.automaticEligible(row.id),isEnabled:()=>f.enabled});
  assert.throws(() => new AutomaticPayouts({treasury,privateKey:branch.deriveChild(8).privateKey,feeLimit,payouts,ledger:f.ledger,exclusive,
    getState:()=>f.state,commitState:next=>{f.state=next},isEligible:()=>true,isEnabled:()=>true}), /ADDRESS_MISMATCH/);
  const previous = (await f.ledger.request(f.state,'a',{key:crypto.randomUUID(),destination,gross:'10'})).record;
  await assert.rejects(worker.process(previous.id), /NOT_ELIGIBLE/);
  assert.equal(await worker.cycle(), undefined);
  assert.equal((await f.ledger.withdrawal(previous.id)).status, 'requested');
  await assert.rejects(f.ledger.request(structuredClone(f.state),'a',{key:crypto.randomUUID(),destination:treasury,gross:'10',automatic:true}),/DESTINATION_IS_PLATFORM_ADDRESS/);
  const allocated=f.store.allocate('a',index=>deriveAddress(xpub,index));
  await assert.rejects(f.ledger.request(structuredClone(f.state),'a',{key:crypto.randomUUID(),destination:allocated.address,gross:'10',automatic:true}),/DESTINATION_IS_PLATFORM_ADDRESS/);
  const row = (await f.ledger.request(f.state,'a',{key:crypto.randomUUID(),destination,gross:'20',automatic:true})).record;
  assert.equal(await f.ledger.automaticEligible(row.id), true);
  await assert.rejects(f.ledger.confirmManual(structuredClone(f.state), row.id), /AUTOMATIC_PAYOUT_IN_PROGRESS/);
  await assert.rejects(f.ledger.decide(structuredClone(f.state), row.id, 'reject'), /AUTOMATIC_PAYOUT_IN_PROGRESS/);
  f.currentId = row.id; f.usdt = 0n;
  worker.hasPendingFuel = async () => true;
  await assert.rejects(worker.process(row.id), /WORKING_WALLET_BUSY/);
  assert.equal((await f.ledger.withdrawal(row.id)).status, 'requested');
  worker.hasPendingFuel = async () => false;
  await assert.rejects(worker.cycle(), /TREASURY_USDT_INSUFFICIENT/);
  assert.equal((await f.ledger.withdrawal(row.id)).status, 'approved');
  assert.equal(f.broadcasts.length, 0);
  f.usdt = 100_000_000n;
  const first = await worker.process(row.id);
  assert.equal(first.broadcastAcknowledged, false);
  assert.equal(f.state.users[0].reservedBalance, 30);
  f.lostAck = false;
  const second = await worker.process(row.id);
  assert.equal(second.broadcastAcknowledged, true);
  assert.equal(f.builds, 1);
  assert.equal(f.store.sql.prepare("SELECT actor FROM payment_audit WHERE action='withdrawal-signed-before-broadcast' AND job_id=?").get(row.id).actor,'automatic-signer');
  assert.deepEqual(f.broadcasts[0], f.broadcasts[1]);
  assert.equal(f.state.users[0].reservedBalance, 30, 'reservation remains until confirmed on-chain');
  const following = (await f.ledger.request(f.state,'a',{key:crypto.randomUUID(),destination,gross:'10',automatic:true})).record;
  await assert.rejects(worker.process(following.id), /WORKING_WALLET_BUSY/);
  assert.equal((await f.ledger.withdrawal(following.id)).status, 'requested');
  f.enabled = false;
  await assert.rejects(worker.process(row.id), /DISABLED/);
  assert.equal(f.broadcasts.length, 2);
});

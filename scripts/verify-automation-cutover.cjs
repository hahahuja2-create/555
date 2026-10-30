'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {PaymentStore}=require('../payments/store'),{OutgoingLedger}=require('../payments/outgoing');
const {assertAutomationCutover}=require('../payments/automation-cutover');

test('migration refuses unresolved legacy withdrawals or collections but permits automatic jobs after restart',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-cutover-')),store=new PaymentStore(dir);
  const old='TZBZHkdrwv6xrGzRR9a1WqStf3oEmtjDvw',next='TKUp2Adbs5X1pvbxv6hoBAtbxYaTyc1856',ledger=new OutgoingLedger(store,old);
  t.after(async()=>{store.close();const real=await fs.realpath(dir),temp=await fs.realpath(os.tmpdir());assert.equal(path.dirname(real).toLowerCase(),temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('portgainy-cutover-'));await fs.rm(real,{recursive:true,force:true});});
  const state={users:[{id:'a',lockedBalance:0,withdrawBalance:100,reservedBalance:0,activities:[]}]};store.save(state);
  await assertAutomationCutover(store,next);
  const legacy=(await ledger.request(state,'a',{key:crypto.randomUUID(),destination:next,gross:'10'})).record;
  await assert.rejects(assertAutomationCutover(store,next),/LEGACY_WITHDRAWAL/);
  await ledger.decide(state,legacy.id,'reject');await assertAutomationCutover(store,next);
  const modern=(await ledger.request(state,'a',{key:crypto.randomUUID(),destination:next,gross:'10',automatic:true})).record;
  await assertAutomationCutover(store,next);
  await ledger.decide(state,modern.id,'approve','automatic-payout');await assertAutomationCutover(store,next);
  store.sql.prepare('INSERT INTO collections(id,address,address_index,treasury,amount_units,status,created_at,txid,issue) VALUES (?,?,?,?,?,?,?,NULL,NULL)')
    .run(crypto.randomUUID(),old,1,old,'10000000','planned',Date.now());
  await assert.rejects(assertAutomationCutover(store,next),/LEGACY_COLLECTION/);
});

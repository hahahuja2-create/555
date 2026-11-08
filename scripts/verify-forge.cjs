'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const forge=require('../markets/forge');
const wallet=require('../markets/forge-wallet');
const {units}=require('../payments/tron');
const START=Date.UTC(2026,10,8,8),DAY=forge.DAY;
function fixture(){const state={users:[{id:'owner',inviteCode:'OWNER',withdrawBalance:10000,lockedBalance:0,reservedBalance:0,earnedTotal:0,activities:[]}]};forge.ensure(state,START);return state;}
test('legacy wallet conversion preserves funds and pending withdrawals exactly, once',()=>{
  const state={users:[{id:'a',lockedBalance:406.200001,withdrawBalance:1.000005,reservedBalance:12.12,earnedTotal:709.5}]};
  const prior=units(state.users[0].lockedBalance)+units(state.users[0].withdrawBalance)+units(state.users[0].reservedBalance);
  const rows=wallet.unifyWallet(state,START);assert.equal(rows[0].available,407.200006);assert.equal(state.users[0].lockedBalance,0);assert.equal(state.users[0].reservedBalance,12.12);assert.equal(state.users[0].earnedTotal,709.5);
  assert.equal(units(state.users[0].withdrawBalance)+units(state.users[0].reservedBalance),prior);assert.deepEqual(wallet.unifyWallet(state,START+1),[]);
});
test('wallet conversion preflights the entire batch before mutation',()=>{const state={users:[{id:'a',lockedBalance:1,withdrawBalance:2},{id:'b',lockedBalance:-1,withdrawBalance:0}]},before=structuredClone(state);assert.throws(()=>wallet.unifyWallet(state));assert.deepEqual(state,before);});
test('sub-minimum confirmed deposits accumulate without losing micro-USDT',()=>{
  const user={withdrawBalance:0};assert.deepEqual(wallet.creditDeposit(user,{units:'4999999'}),{credited:0,held:4.999999,releasedPrior:0});
  assert.equal(wallet.creditDeposit(user,{units:'5000000'}).held,9.999999);assert.equal(user.withdrawBalance,0);
  assert.deepEqual(wallet.creditDeposit(user,{units:'1'}),{credited:10,held:0,releasedPrior:9.999999});assert.equal(user.withdrawBalance,10);assert.equal(user.forgeHeldDepositUnits,'0');
  assert.equal(wallet.creditDeposit(user,{units:'10000000'}).credited,10);assert.equal(user.withdrawBalance,20);
});
test('purchases debit only the unified wallet and replay safely',()=>{
  const state=fixture(),first=forge.buy(state,'owner','spark','purchase-request-0001',START),balance=state.users[0].withdrawBalance;
  assert.equal(balance,9990);assert.equal(state.forge.cores.length,1);assert.equal(forge.buy(state,'owner','spark','purchase-request-0001',START+1).replayed,true);assert.equal(state.users[0].withdrawBalance,balance);
  assert.throws(()=>forge.buy(state,'owner','bolt','purchase-request-0001',START),/REQUEST_KEY_REUSED/);assert.equal(state.forge.cores[0].id,first.receipt.coreId);
});
test('ownership and affordability are enforced',()=>{
  const state=fixture();state.users[0].withdrawBalance=9.999999;assert.throws(()=>forge.buy(state,'owner','spark','purchase-request-0001',START),/INSUFFICIENT/);assert.equal(state.forge.cores.length,0);
  state.users[0].withdrawBalance=100;const purchase=forge.buy(state,'owner','spark','purchase-request-0001',START);assert.throws(()=>forge.quoteUpgrade(state,'other',purchase.receipt.coreId,'power',1000,START),/CORE_NOT_FOUND/);
});
test('rewards are based on virtual power and efficiency, not wallet balance',()=>{
  const state=fixture();forge.buy(state,'owner','spark','purchase-request-0001',START);
  forge.settle(state,START+DAY);assert.equal(forge.snapshot(state,'owner',START+DAY).pending,0.27);
  const result=forge.claim(state,'owner','claim-request-key-0001',START+DAY);assert.equal(result.receipt.amount,0.27);assert.equal(state.users[0].withdrawBalance,9990.27);
  assert.equal(forge.claim(state,'owner','claim-request-key-0001',START+DAY).replayed,true);assert.equal(state.users[0].earnedTotal,0.27);assert.throws(()=>forge.claim(state,'owner','claim-request-key-0002',START+DAY),/NO_FORGE_REWARD/);
});
test('time before purchase does not earn; upgrades split a day using the old and new attributes',()=>{
  const state=fixture(),purchase=forge.buy(state,'owner','spark','purchase-request-0001',START+DAY/4);
  const quote=forge.quoteUpgrade(state,'owner',purchase.receipt.coreId,'power',1000,START+DAY/2);
  forge.upgrade(state,'owner',{coreId:purchase.receipt.coreId,kind:'power',value:1000,revision:quote.revision},'upgrade-request-0001',START+DAY/2);
  forge.settle(state,START+DAY);assert.equal(forge.snapshot(state,'owner',START+DAY).pending,0.3375);
  assert.throws(()=>forge.upgrade(state,'owner',{coreId:purchase.receipt.coreId,kind:'power',value:1000,revision:quote.revision},'upgrade-request-0002',START+DAY/2),/UPGRADE_QUOTE_EXPIRED/);
});
test('efficiency upgrades reduce the simulated adjustment without pretending it is a utility bill',()=>{
  const state=fixture(),purchase=forge.buy(state,'owner','spark','purchase-request-0001',START),q=forge.quoteUpgrade(state,'owner',purchase.receipt.coreId,'efficiency',20,START);
  assert.equal(q.cost,1);assert.equal(q.before.daily,0.27);assert.equal(q.after.daily,0.3);
  forge.upgrade(state,'owner',{coreId:purchase.receipt.coreId,kind:'efficiency',value:20,revision:1},'upgrade-request-0001',START);assert.equal(state.users[0].withdrawBalance,9989);
  assert.throws(()=>forge.quoteUpgrade(state,'owner',purchase.receipt.coreId,'efficiency',11,START),/INVALID_UPGRADE/);
});
test('Core and referral credits settle once using the existing virtual balance model',()=>{
  const state=fixture();state.users.push({id:'friend',inviteCode:'FRIEND',referredBy:'OWNER',withdrawBalance:100,earnedTotal:0,activities:[]});
  forge.buy(state,'owner','spark','purchase-request-0001',START);forge.buy(state,'friend','spark','purchase-request-0002',START);
  const rows=forge.settle(state,START+DAY);assert.equal(rows[0].payoutModel,'platform-credit');assert.equal(state.forge.allocatedUnits,'567000');
  const pending=state.forge.cores.reduce((sum,c)=>sum+BigInt(c.pendingUnits),0n)+state.users.reduce((sum,u)=>sum+BigInt(u.forgeReferralPendingUnits||'0'),0n);assert.equal(pending,567000n);
  for(const u of state.users)if(forge.snapshot(state,u.id).pending)forge.claim(state,u.id,'claim-request-key-'+u.id,START+DAY);
  assert.equal(state.forge.claimedUnits,'567000');assert.equal(state.users[0].earnedTotal,0.297);assert.deepEqual(forge.settle(state,START+DAY),[]);
});
test('new Core purchases and rewards do not rewrite pending withdrawals',()=>{
  const state=fixture();state.users[0].reservedBalance=13.37;state.withdrawals=[{id:'pending-fixture',amount:13.37,status:'submitted',txid:'fixture-only'}];const before=structuredClone(state.withdrawals);
  forge.buy(state,'owner','spark','purchase-request-0001',START);forge.claim(state,'owner','claim-request-key-0001',START+DAY);
  assert.equal(state.users[0].reservedBalance,13.37);assert.deepEqual(state.withdrawals,before);
});

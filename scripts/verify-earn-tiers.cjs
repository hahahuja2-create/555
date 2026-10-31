'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const earn=require('../markets/earn'),{units}=require('../payments/tron');
const at=Date.parse('2026-10-31T12:00:00Z');
function fixture(balance){const u={id:'user',inviteCode:'ONE',createdAt:'2026-01-01T00:00:00Z',lockedBalance:balance,withdrawBalance:0,reservedBalance:0,earnedTotal:0,activities:[]},state={users:[u]};earn.pool(state,at);return{u,state};}
test('tier boundaries use exact USDT micro-units and apply to the whole principal',()=>{
 for(const [balance,rate]of [[199.999999,.08],[200,.08],[499.999999,.08],[500,.09],[999.999999,.09],[1000,.10],[1699.999999,.10],[1700,.11],[2499.999999,.11],[2500,.12],[3999.999999,.12],[4000,.13],[1000000,.13]]){
  const {u,state}=fixture(balance),view=earn.snapshot(state,u,at,true);assert.equal(view.rate,rate,String(balance));
  if(balance<200){assert.equal(view.nextReward,0);assert.throws(()=>earn.claim(state,u.id,crypto.randomUUID(),at),/MINIMUM/);continue;}
  const expected=units(balance)*BigInt(Math.round(rate*10000))/10000n,result=earn.claim(state,u.id,crypto.randomUUID(),at);
  assert.equal(units(result.receipt.amount),expected);assert.equal(units(u.withdrawBalance),expected);assert.equal(u.lockedBalance,balance);assert.equal(result.receipt.rate,rate);
 }
});
test('old receipts preserve their original amount and rate after a balance changes tier',()=>{
 const {u,state}=fixture(500),key=crypto.randomUUID(),original=earn.claim(state,u.id,key,at).receipt;
 u.lockedBalance=4000;const before=JSON.stringify(state);
 assert.deepEqual(earn.claim(state,u.id,key,at+earn.DAY).receipt,original);assert.equal(JSON.stringify(state),before);
 const next=earn.claim(state,u.id,crypto.randomUUID(),at+earn.DAY);assert.equal(next.receipt.amount,520);assert.equal(next.receipt.rate,.13);assert.equal(u.withdrawBalance,565);
});
test('tier policy does not retroactively change historical claims or resurrect the referral offer',()=>{
 const {u,state}=fixture(2456);u.earnedTotal=4650;u.earnClaimTotal=4650;u.activities=[{id:'old',type:'earn',amount:100,rate:10,at:'2026-10-29T12:00:00Z'}];
 const before=JSON.stringify(state);const view=earn.snapshot(state,u,at,true);assert.equal(view.rate,.11);assert.equal(view.nextReward,270.16);assert.equal(view.promotion,null);assert.equal(JSON.stringify(state),before);
 assert.deepEqual(view.tiers.map(t=>t.rate),[.08,.09,.10,.11,.12,.13]);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const earn=require('../markets/earn');
const reset=Date.parse('2026-10-31T08:00:00Z'),key=()=>crypto.randomUUID();
function fixture(createdAt=reset-1000){const u={id:'one',createdAt:new Date(createdAt).toISOString(),inviteCode:'ONE',lockedBalance:200,withdrawBalance:0,reservedBalance:0,earnedTotal:0,activities:[]},state={users:[u]};earn.pool(state,reset);return{u,state};}
test('first claim before reset and the following daily claim are separate windows',()=>{
 const {u,state}=fixture(reset-60_000);
 assert.equal(earn.snapshot(state,u,reset-1,true).canClaim,true);
 assert.equal(earn.claim(state,u.id,key(),reset-1).receipt.amount,16);
 assert.throws(()=>earn.claim(state,u.id,key(),reset-1),/COOLDOWN/);
 assert.equal(earn.claim(state,u.id,key(),reset).receipt.amount,16);
 assert.throws(()=>earn.claim(state,u.id,key(),reset+1),/COOLDOWN/);
 assert.equal(u.withdrawBalance,32);assert.equal(u.lockedBalance,200);
 assert.equal(earn.snapshot(state,u,reset,true).nextClaimAt,reset+earn.DAY);
});
test('starting at or after reset permits the first claim immediately, then waits for the next day',()=>{
 for(const first of [reset,reset+1,reset+6*3600000]){
  const {u,state}=fixture(first);assert.equal(earn.snapshot(state,u,first,true).canClaim,true);
  earn.claim(state,u.id,key(),first);assert.throws(()=>earn.claim(state,u.id,key(),reset+earn.DAY-1),/COOLDOWN/);
  assert.equal(earn.claim(state,u.id,key(),reset+earn.DAY).receipt.amount,16);
 }
});
test('the first claim cannot be earned below the minimum; referral income is not a personal claim',()=>{
 const {u,state}=fixture();u.lockedBalance=199;u.activities=[{type:'referral',amount:10,at:new Date(reset-100).toISOString()}];
 assert.equal(earn.snapshot(state,u,reset+1,true).canClaim,false);assert.throws(()=>earn.claim(state,u.id,key(),reset+1),/MINIMUM/);
 u.lockedBalance=200;assert.equal(earn.claim(state,u.id,key(),reset+1).receipt.amount,16);
});
test('claim history and persisted receipts prevent a second first-claim exception after restart',()=>{
 const {u,state}=fixture();u.earnLastReceipt={at:new Date(reset+1).toISOString(),amount:16};
 const restored=JSON.parse(JSON.stringify(state));assert.throws(()=>earn.claim(restored,u.id,key(),reset+2),/COOLDOWN/);
 delete restored.users[0].earnLastReceipt;restored.users[0].earnReceipts={old:{at:new Date(reset+1).toISOString(),amount:16}};
 assert.throws(()=>earn.claim(restored,u.id,key(),reset+2),/COOLDOWN/);
});
test('a failed or retried first claim cannot create duplicate rewards or referrals',()=>{
 const {u,state}=fixture();const id=key();const first=earn.claim(state,u.id,id,reset-1),before=JSON.stringify(state);
 assert.equal(earn.claim(state,u.id,id,reset).replayed,true);assert.equal(JSON.stringify(state),before);
 assert.equal(first.receipt.nextClaimAt,reset);assert.equal(earn.snapshot(state,u,reset,true).canClaim,true);
});
test('public earning copy and response metadata do not announce a reset time or location',()=>{
 for(const file of ['public/pg-more.js','public/pg-notice.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/00:00|08:00|12:00|Tbilisi|Georgia|per UTC day|UTC reset/i,file);
 const {u,state}=fixture(),view=earn.snapshot(state,u,reset,true);assert.equal(view.resetHourUtc,undefined);assert.equal(view.timeZone,undefined);
});

'use strict';
const crypto=require('node:crypto');
const {units,amount}=require('../payments/tron');
const promotion=require('./referral-promotion');
const DAY=86_400_000;
const minimum=state=>promotion.minimumUnits(state);
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const nextReset=time=>(Math.floor(time/DAY)+1)*DAY;
function claimSchedule(state,user,now){
  const registered=Date.parse(user.createdAt)||state.earn?.startedAt||now;
  let nextClaimAt=nextReset(registered);
  const legacyDate=/^\d{4}-\d{2}-\d{2}$/.test(user.lastCompletionDate||'')?Date.parse(user.lastCompletionDate+'T00:00:00Z'):0;
  const latestActivity=(user.activities||[]).filter(row=>row.type==='task'||row.type==='earn').reduce((latest,row)=>Math.max(latest,Date.parse(row.at)||0),0);
  const lastPaid=Math.max(Number(user.earnLastClaimAt)||0,legacyDate||0,latestActivity);
  if(lastPaid)nextClaimAt=Math.max(nextClaimAt,nextReset(lastPaid));
  return{nextClaimAt,nextResetAt:nextReset(now),resetHourUtc:0,timeZone:'UTC'};
}
function pool(state,now=Date.now()){
  const previous=state.earn;
  if(previous?.version&&! [1,2].includes(previous.version))throw fail('INVALID_EARN_STATE',503);
  if(!previous||previous.version!==2||previous.payoutModel!=='manual-withdrawal'){
    // Preserve historical funding records; a Claim is an account credit, not an external payout.
    state.earn={...previous,version:2,startedAt:previous?.startedAt||now,payoutModel:'manual-withdrawal',
      totalAccruedUnits:previous?.totalAccruedUnits||previous?.totalPaidUnits||'0',preview:previous?.preview||false};
  }
  if(!/^\d+$/.test(state.earn.totalAccruedUnits))throw fail('INVALID_EARN_STATE',503);
  return state.earn;
}
function snapshot(state,user,now=Date.now(),enabled=false){
  const reward=promotion.rewardUnits(state,user,now);
  const schedule=claimSchedule(state,user,now),{nextClaimAt}=schedule;
  const MINIMUM=minimum(state),balance=units(user.lockedBalance),shortfall=balance<MINIMUM?MINIMUM-balance:0n;
  return {enabled,minimum:amount(MINIMUM),shortfall:amount(shortfall),mode:'accrued',payoutModel:'manual-withdrawal',fundingRequired:false,rate:promotion.rateBps(state,user,now)/10000,promotion:promotion.snapshot(state,user,now),referralRates:[0.1,0.05],cycleHours:24,
    earningBalance:amount(units(user.lockedBalance)),withdrawalBalance:amount(units(user.withdrawBalance)),spotBalance:amount(units(user.withdrawBalance)),
    nextReward:amount(reward),...schedule,serverTime:now,canClaim:enabled&&reward>0n&&now>=nextClaimAt,
    lastClaimAt:user.earnLastClaimAt||null,earned:amount(units(user.earnClaimTotal||0)),referralEarned:amount(units(user.earnReferralTotal||0)),
    legacyPrincipal:user.earnMigration?.principalRestored||0,
    history:(user.activities||[]).filter(item=>['earn','referral'].includes(item.type)).slice(0,50)};
}
function claim(state,userId,key,now=Date.now()){
  if(!/^[a-f0-9-]{36}$/.test(key))throw fail('INVALID_REQUEST_KEY',400);
  const user=state.users.find(user=>user.id===userId);if(!user)throw fail('AUTH_REQUIRED',401);
  if(user.earnReceipts?.[key])return{receipt:user.earnReceipts[key],replayed:true};
  if(user.earnLastReceipt?.requestKey===key)return{receipt:user.earnLastReceipt,replayed:true};
  if(!state.earn)throw fail('EARN_UNAVAILABLE',503);
  const book=pool(state,now);
  const next=claimSchedule(state,user,now).nextClaimAt;
  if(now<next)throw fail('EARN_COOLDOWN');
  if(units(user.lockedBalance)<minimum(state))throw fail('EARN_MINIMUM_REQUIRED',400);
  const reward=promotion.rewardUnits(state,user,now);if(!reward)throw fail('NO_EARNING_BALANCE',400);
  const rate=promotion.rateBps(state,user,now)/100;
  const credits=[{user,units:reward,type:'earn',level:0,rate}];
  let code=user.referredBy;const seen=new Set([user.id]);
  for(const [level,rate]of[[1,10n],[2,5n]]){
    const parent=state.users.find(item=>item.inviteCode===code);
    if(!parent||seen.has(parent.id))break;seen.add(parent.id);
    const commission=reward*rate/100n;if(commission)credits.push({user:parent,units:commission,type:'referral',level,rate:Number(rate)});
    code=parent.referredBy;
  }
  const total=credits.reduce((sum,row)=>sum+row.units,0n);
  const claimId=crypto.randomUUID(),at=new Date(now).toISOString();
  for(const row of credits){
    row.user.withdrawBalance=amount(units(row.user.withdrawBalance)+row.units);
    row.user.earnedTotal=amount(units(row.user.earnedTotal||0)+row.units);
    const field=row.type==='earn'?'earnClaimTotal':'earnReferralTotal';row.user[field]=amount(units(row.user[field]||0)+row.units);
    row.user.activities.unshift({id:crypto.randomUUID(),at,type:row.type,amount:amount(row.units),claimId,level:row.level,rate:row.rate,mode:'accrued'});
  }
  book.totalAccruedUnits=(BigInt(book.totalAccruedUnits)+total).toString();
  user.earnLastClaimAt=now;user.earnLastReceipt={id:claimId,requestKey:key,amount:amount(reward),rate:rate/100,status:'credited',at,nextClaimAt:nextReset(now)};
  user.earnReceipts||={};user.earnReceipts[key]=user.earnLastReceipt;
  return{receipt:user.earnLastReceipt,replayed:false};
}
function migrate(state,plans,now=Date.now()){
  const report=[];
  for(const user of state.users){
    if(user.earnMigration?.version===1)continue;
    const plan=plans.find(plan=>plan.id===user.vipId);
    const active=Boolean(plan?.price&&Date.parse(user.vipExpiresAt)>now);
    const principal=active?units(plan.price):0n;
    if(active && !(user.activities||[]).some(activity=>activity.type==='vip'))throw fail('VIP_PURCHASE_EVIDENCE_MISSING',409);
    const before=units(user.lockedBalance);
    user.lockedBalance=amount(before+principal);
    user.earnMigration={version:1,at:new Date(now).toISOString(),principalRestored:amount(principal),previousBalance:amount(before),previousVipId:user.vipId};
    report.push({userId:user.id,previous:amount(before),principal:amount(principal),earningBalance:user.lockedBalance,withdrawalBalance:user.withdrawBalance});
  }
  return report;
}
// One-time: every account that existed before the 200 USDT minimum is brought up to it. Later accounts are never topped up.
function topUp(state,now=Date.now()){
  state.earn||={};
  if(state.earn.minimumTopUp?.version===1)return[];
  const report=[],MINIMUM=minimum(state);
  for(const user of state.users){
    const before=units(user.lockedBalance);
    if(before>=MINIMUM)continue;
    const credit=MINIMUM-before;
    user.lockedBalance=amount(MINIMUM);
    user.earnMinimum={version:1,at:new Date(now).toISOString(),previous:amount(before),credited:amount(credit)};
    (user.activities||=[]).unshift({id:crypto.randomUUID(),at:new Date(now).toISOString(),type:'topup',amount:amount(credit)});
    report.push({userId:user.id,previous:amount(before),credited:amount(credit)});
  }
  state.earn.minimumTopUp={version:1,at:new Date(now).toISOString(),accounts:report.length,totalUnits:report.reduce((s,r)=>s+units(r.credited),0n).toString()};
  return report;
}
module.exports={DAY,topUp,pool,snapshot,claim,migrate,nextReset,claimSchedule};

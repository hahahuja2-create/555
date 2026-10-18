'use strict';
const crypto=require('node:crypto');
const {units,amount}=require('../payments/tron');
const DAY=86_400_000;
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
function pool(state,now=Date.now(),preview=false){
  if(!state.earn)state.earn={version:1,startedAt:now,availableUnits:preview?'100000000000':'0',funding:[],totalPaidUnits:'0',preview};
  return state.earn;
}
function snapshot(state,user,now=Date.now(),enabled=false){
  const fund=state.earn;
  const reward=units(user.lockedBalance)/10n;
  let required=reward,code=user.referredBy;const seen=new Set([user.id]);
  for(const rate of[10n,5n]){const parent=state.users.find(item=>item.inviteCode===code);if(!parent||seen.has(parent.id))break;seen.add(parent.id);required+=reward*rate/100n;code=parent.referredBy;}
  const schedule=claimSchedule(state,user,now),{nextClaimAt}=schedule;
  return {enabled,mode:fund?.preview?'preview':'funded',rate:0.1,referralRates:[0.1,0.05],cycleHours:24,
    earningBalance:amount(units(user.lockedBalance)),withdrawalBalance:amount(units(user.withdrawBalance)),spotBalance:amount(units(user.withdrawBalance)),
    nextReward:amount(reward),...schedule,serverTime:now,canClaim:enabled&&reward>0n&&now>=nextClaimAt&&BigInt(fund?.availableUnits||'0')>=required,
    fundingAvailable:BigInt(fund?.availableUnits||'0')>=required,
    lastClaimAt:user.earnLastClaimAt||null,earned:amount(units(user.earnClaimTotal||0)),referralEarned:amount(units(user.earnReferralTotal||0)),
    legacyPrincipal:user.earnMigration?.principalRestored||0,
    history:(user.activities||[]).filter(item=>['earn','referral'].includes(item.type)).slice(0,50)};
}
function claim(state,userId,key,now=Date.now()){
  if(!/^[a-f0-9-]{36}$/.test(key))throw fail('INVALID_REQUEST_KEY',400);
  const user=state.users.find(user=>user.id===userId);if(!user)throw fail('AUTH_REQUIRED',401);
  if(user.earnReceipts?.[key])return{receipt:user.earnReceipts[key],replayed:true};
  if(user.earnLastReceipt?.requestKey===key)return{receipt:user.earnLastReceipt,replayed:true};
  const fund=state.earn;if(!fund)throw fail('EARN_UNAVAILABLE',503);
  const next=claimSchedule(state,user,now).nextClaimAt;
  if(now<next)throw fail('EARN_COOLDOWN');
  const reward=units(user.lockedBalance)/10n;if(!reward)throw fail('NO_EARNING_BALANCE',400);
  const credits=[{user,units:reward,type:'earn',level:0,rate:10}];
  let code=user.referredBy;const seen=new Set([user.id]);
  for(const [level,rate]of[[1,10n],[2,5n]]){
    const parent=state.users.find(item=>item.inviteCode===code);
    if(!parent||seen.has(parent.id))break;seen.add(parent.id);
    const commission=reward*rate/100n;if(commission)credits.push({user:parent,units:commission,type:'referral',level,rate:Number(rate)});
    code=parent.referredBy;
  }
  const total=credits.reduce((sum,row)=>sum+row.units,0n);
  if(BigInt(fund.availableUnits)<total)throw fail('EARN_FUND_UNAVAILABLE',503);
  const claimId=crypto.randomUUID(),at=new Date(now).toISOString();
  for(const row of credits){
    row.user.withdrawBalance=amount(units(row.user.withdrawBalance)+row.units);
    row.user.earnedTotal=amount(units(row.user.earnedTotal||0)+row.units);
    const field=row.type==='earn'?'earnClaimTotal':'earnReferralTotal';row.user[field]=amount(units(row.user[field]||0)+row.units);
    row.user.activities.unshift({id:crypto.randomUUID(),at,type:row.type,amount:amount(row.units),claimId,level:row.level,rate:row.rate,mode:fund.preview?'preview':'funded'});
  }
  fund.availableUnits=(BigInt(fund.availableUnits)-total).toString();fund.totalPaidUnits=(BigInt(fund.totalPaidUnits||'0')+total).toString();
  user.earnLastClaimAt=now;user.earnLastReceipt={id:claimId,requestKey:key,amount:amount(reward),at,nextClaimAt:nextReset(now)};
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
function addFunding(state,event,actor){
  const fund=state.earn;if(!fund||fund.preview)throw fail('EARN_FUND_UNAVAILABLE',503);
  const id=event.txid+':'+event.logIndex;
  if(fund.funding.some(row=>row.id===id))return false;
  const value=BigInt(event.units);if(value<=0n)throw fail('INVALID_FUNDING',400);
  fund.funding.push({id,txid:event.txid,logIndex:event.logIndex,units:value.toString(),at:new Date().toISOString(),actor});
  fund.availableUnits=(BigInt(fund.availableUnits)+value).toString();return true;
}
module.exports={DAY,pool,snapshot,claim,migrate,addFunding,nextReset,claimSchedule};

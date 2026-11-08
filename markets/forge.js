'use strict';

// Virtual collectibles and platform-account credits, not physical mining or NFTs.
const crypto=require('node:crypto');
const {units,amount}=require('../payments/tron');
const designs=require('../public/forge-designs.json');
const DAY=86_400_000, RESET_OFFSET=8*60*60_000, DENOMINATOR=BigInt(DAY)*1000n;
const POLICY=Object.freeze({version:1,currency:'USDT',grossPerThUnits:'360000',efficiencyAdjustmentPerWUnits:'3000',powerUpgradePerThUnits:'9500000',efficiencyUpgradePerThPerWUnits:'100000',minimumEfficiency:12,maximumPowerMilliTh:5_000_000,minimumDeposit:10,referralRates:[10,5]});
const CATALOG=Object.freeze([
  ['spark','Spark','spark','Origin',1,30],['bolt','Bolt','spark','Origin',2,28],
  ['pulse','Pulse','pulse','Rare',5,26],['flux','Flux','pulse','Rare',10,24],
  ['alloy','Alloy','titan','Epic',20,22],['titan','Titan','titan','Epic',40,20],
  ['nova','Nova','pulse','Legendary',75,18],['helix','Helix','spark','Legendary',125,16],['apex','Apex','titan','Mythic',250,14]
].map(([id,_name,_family,rarity,power,efficiency])=>Object.freeze({id,name:designs[id].name,model:id,form:designs[id].form,rarity,powerMilliTh:power*1000,efficiency,priceUnits:units(power*10).toString()})));
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const boundary=time=>Math.floor((time-RESET_OFFSET)/DAY)*DAY+RESET_OFFSET;
function key(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{16,96}$/.test(value))throw fail('INVALID_REQUEST_KEY',400);return value;}
function userFor(state,id){const user=state.users.find(row=>row.id===id);if(!user)throw fail('AUTH_REQUIRED',401);return user;}
function ensure(state,now=Date.now()){
  if(state.forge){if(state.forge.version!==1||state.forge.policy?.version!==1)throw fail('INVALID_FORGE_STATE',503);return state.forge;}
  return state.forge={version:1,model:'virtual-collectible',payoutModel:'platform-credit',startedAt:now,settledThroughAt:boundary(now),policy:{...POLICY,referralRates:[...POLICY.referralRates]},cores:[],allocatedUnits:'0',claimedUnits:'0',rounds:[]};
}
function dailyNumerator(core,policy=POLICY){const net=BigInt(policy.grossPerThUnits)-BigInt(core.efficiency)*BigInt(policy.efficiencyAdjustmentPerWUnits);return BigInt(core.powerMilliTh)*(net>0n?net:0n);}
function estimate(core,policy=POLICY){const daily=dailyNumerator(core,policy)/1000n;return {daily:amount(daily),thirtyDays:amount(daily*30n),recoveryDays:daily?Number((BigInt(core.priceUnits||core.purchasePriceUnits||0)+daily-1n)/daily):null};}

function parents(state,user){const out=[],seen=new Set([user.id]);let code=user.referredBy;for(const rate of [10,5]){const parent=state.users.find(row=>row.inviteCode===code);if(!parent||seen.has(parent.id))break;seen.add(parent.id);out.push({user:parent,rate});code=parent.referredBy;}return out;}
function settle(state,now=Date.now()){
  const book=ensure(state,now),through=boundary(now),rounds=[];
  if(through<book.settledThroughAt)throw fail('FORGE_CLOCK_REVERSED',503);
  const windows=(through-book.settledThroughAt)/DAY;
  if(windows>366)throw fail('FORGE_CATCHUP_REQUIRES_REVIEW',503);
  while(book.settledThroughAt<through){
    const start=book.settledThroughAt,end=start+DAY,rows=[];
    for(const core of book.cores){
      let numerator=BigInt(core.remainder||'0');
      const segments=core.segments||[{fromAt:core.createdAt,powerMilliTh:core.powerMilliTh,efficiency:core.efficiency}];
      for(let i=0;i<segments.length;i++){
        const segment=segments[i],from=Math.max(start,core.createdAt,segment.fromAt),to=Math.min(end,segments[i+1]?.fromAt??end);
        if(to>from)numerator+=dailyNumerator(segment,book.policy)*BigInt(to-from);
      }
      const requested=numerator/DENOMINATOR;core.remainder=(numerator%DENOMINATOR).toString();
      if(requested){const owner=userFor(state,core.ownerId);rows.push({userId:owner.id,coreId:core.id,type:'core',requested});for(const parent of parents(state,owner))rows.push({userId:parent.user.id,coreId:core.id,type:'referral',requested:requested*BigInt(parent.rate)/100n});}
      const current=segments.filter(segment=>segment.fromAt<=end).at(-1),future=segments.filter(segment=>segment.fromAt>end);
      core.segments=current?[current,...future]:future;
    }
    const requested=rows.reduce((sum,row)=>sum+row.requested,0n);
    for(const row of rows){
      if(!row.requested)continue;
      if(row.type==='core'){const core=book.cores.find(item=>item.id===row.coreId);core.pendingUnits=(BigInt(core.pendingUnits||'0')+row.requested).toString();core.totalAllocatedUnits=(BigInt(core.totalAllocatedUnits||'0')+row.requested).toString();}
      else {const user=userFor(state,row.userId);user.forgeReferralPendingUnits=(BigInt(user.forgeReferralPendingUnits||'0')+row.requested).toString();}
    }
    book.allocatedUnits=(BigInt(book.allocatedUnits)+requested).toString();book.settledThroughAt=end;
    const round={at:end,allocatedUnits:requested.toString(),payoutModel:'platform-credit'};
    rounds.push(round);book.rounds.unshift(round);book.rounds=book.rounds.slice(0,90);
  }
  return rounds;
}
function fingerprint(command){return crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex');}
function replay(user,requestKey,command){key(requestKey);const prior=user.forgeReceipts?.[requestKey];if(!prior)return null;if(prior.fingerprint!==fingerprint(command))throw fail('REQUEST_KEY_REUSED',409);return {receipt:prior,replayed:true};}
function receipt(user,requestKey,command,details,now){const row={id:crypto.randomUUID(),requestKey,fingerprint:fingerprint(command),...details,at:new Date(now).toISOString()};user.forgeReceipts||={};user.forgeReceipts[requestKey]=row;return {receipt:row,replayed:false};}
function activity(user,type,value,details,now){user.activities||=[];user.activities.unshift({id:crypto.randomUUID(),type,amount:amount(value),at:new Date(now).toISOString(),...details});}
function buy(state,userId,sku,requestKey,now=Date.now()){
  const user=userFor(state,userId),command={type:'buy',sku},prior=replay(user,requestKey,command);if(prior)return prior;
  const book=ensure(state,now),item=CATALOG.find(row=>row.id===sku);if(!item)throw fail('CORE_NOT_FOUND',404);
  const price=BigInt(item.priceUnits);if(units(user.withdrawBalance)<price)throw fail('INSUFFICIENT_WALLET_BALANCE',400);
  if(book.cores.filter(core=>core.ownerId===userId).length>=1000)throw fail('CORE_LIMIT_REACHED',400);
  settle(state,now);
  const core={id:crypto.randomUUID(),ownerId:userId,sku:item.id,model:item.model,name:item.name,rarity:item.rarity,powerMilliTh:item.powerMilliTh,efficiency:item.efficiency,purchasePriceUnits:item.priceUnits,totalInvestedUnits:item.priceUnits,createdAt:now,pendingUnits:'0',totalAllocatedUnits:'0',claimedUnits:'0',remainder:'0',segments:[{fromAt:now,powerMilliTh:item.powerMilliTh,efficiency:item.efficiency}],revision:1};
  book.cores.push(core);user.withdrawBalance=amount(units(user.withdrawBalance)-price);
  activity(user,'forge_purchase',price,{coreId:core.id,name:core.name,mode:'virtual'},now);
  return receipt(user,requestKey,command,{type:'purchase',coreId:core.id,amount:amount(price)},now);
}
function quoteUpgrade(state,userId,coreId,kind,value,now=Date.now()){
  const book=ensure(state,now),core=book.cores.find(row=>row.id===coreId&&row.ownerId===userId);if(!core)throw fail('CORE_NOT_FOUND',404);
  if(!Number.isSafeInteger(value))throw fail('INVALID_UPGRADE',400);
  let nextPower=core.powerMilliTh,nextEfficiency=core.efficiency,cost;
  if(kind==='power'){
    if(value<=0||value%100!==0||value>book.policy.maximumPowerMilliTh-core.powerMilliTh)throw fail('INVALID_UPGRADE',400);
    nextPower+=value;cost=BigInt(value)*BigInt(book.policy.powerUpgradePerThUnits)/1000n;
  }else if(kind==='efficiency'){
    if(value<book.policy.minimumEfficiency||value>=core.efficiency)throw fail('INVALID_UPGRADE',400);
    nextEfficiency=value;cost=BigInt(core.powerMilliTh)*BigInt(core.efficiency-value)*BigInt(book.policy.efficiencyUpgradePerThPerWUnits)/1000n;
  }else throw fail('INVALID_UPGRADE',400);
  return {coreId,revision:core.revision,kind,value,cost:amount(cost),costUnits:cost.toString(),powerMilliTh:nextPower,efficiency:nextEfficiency,before:estimate(core,book.policy),after:estimate({...core,powerMilliTh:nextPower,efficiency:nextEfficiency},book.policy)};
}
function upgrade(state,userId,input,requestKey,now=Date.now()){
  const user=userFor(state,userId),command={type:'upgrade',coreId:input.coreId,kind:input.kind,value:input.value,revision:input.revision},prior=replay(user,requestKey,command);if(prior)return prior;
  const quote=quoteUpgrade(state,userId,input.coreId,input.kind,input.value,now);
  if(input.revision!==quote.revision)throw fail('UPGRADE_QUOTE_EXPIRED',409);
  const cost=BigInt(quote.costUnits);if(units(user.withdrawBalance)<cost)throw fail('INSUFFICIENT_WALLET_BALANCE',400);
  settle(state,now);const core=state.forge.cores.find(row=>row.id===input.coreId);
  core.powerMilliTh=quote.powerMilliTh;core.efficiency=quote.efficiency;core.revision++;
  core.segments.push({fromAt:now,powerMilliTh:core.powerMilliTh,efficiency:core.efficiency});
  core.totalInvestedUnits=(BigInt(core.totalInvestedUnits)+cost).toString();user.withdrawBalance=amount(units(user.withdrawBalance)-cost);
  activity(user,'forge_upgrade',cost,{coreId:core.id,name:core.name,kind:input.kind,mode:'virtual'},now);
  return receipt(user,requestKey,command,{type:'upgrade',coreId:core.id,amount:amount(cost)},now);
}
function claim(state,userId,requestKey,now=Date.now()){
  const user=userFor(state,userId),command={type:'claim'},prior=replay(user,requestKey,command);if(prior)return prior;
  const book=ensure(state,now);settle(state,now);
  const cores=book.cores.filter(core=>core.ownerId===userId),coreReward=cores.reduce((sum,core)=>sum+BigInt(core.pendingUnits||'0'),0n),referralReward=BigInt(user.forgeReferralPendingUnits||'0'),total=coreReward+referralReward;
  if(!total)throw fail('NO_FORGE_REWARD',400);
  user.withdrawBalance=amount(units(user.withdrawBalance)+total);user.earnedTotal=amount(units(user.earnedTotal||0)+total);
  user.earnClaimTotal=amount(units(user.earnClaimTotal||0)+coreReward);user.earnReferralTotal=amount(units(user.earnReferralTotal||0)+referralReward);
  for(const core of cores){core.claimedUnits=(BigInt(core.claimedUnits||'0')+BigInt(core.pendingUnits||'0')).toString();core.pendingUnits='0';}
  user.forgeReferralPendingUnits='0';book.claimedUnits=(BigInt(book.claimedUnits)+total).toString();
  if(coreReward)activity(user,'forge_reward',coreReward,{mode:'virtual'},now);if(referralReward)activity(user,'referral',referralReward,{source:'forge',mode:'virtual'},now);
  return receipt(user,requestKey,command,{type:'claim',amount:amount(total),coreReward:amount(coreReward),referralReward:amount(referralReward)},now);
}
function snapshot(state,userId,now=Date.now()){
  const book=state.forge;if(!book)return {enabled:false,model:'virtual-collectible'};
  const user=userFor(state,userId),cores=book.cores.filter(core=>core.ownerId===userId);
  const publicCore=core=>({...Object.fromEntries(['id','sku','model','name','rarity','powerMilliTh','efficiency','createdAt','revision'].map(k=>[k,core[k]])),purchasePrice:amount(BigInt(core.purchasePriceUnits)),invested:amount(BigInt(core.totalInvestedUnits)),pending:amount(BigInt(core.pendingUnits||'0')),claimed:amount(BigInt(core.claimedUnits||'0')),estimate:estimate(core,book.policy)});
  return {enabled:true,model:'virtual-collectible',payoutModel:'platform-credit',currency:'USDT',policyVersion:book.policy.version,minimumDeposit:10,rewardTerms:'Virtual platform rewards. Estimates are not guaranteed. TH/s and W/TH are simulated. Withdrawals use the existing working wallet.',catalog:CATALOG.map(item=>({...item,price:amount(BigInt(item.priceUnits)),estimate:estimate(item,book.policy)})),cores:cores.map(publicCore),powerMilliTh:cores.reduce((sum,c)=>sum+c.powerMilliTh,0),pending:amount(cores.reduce((sum,c)=>sum+BigInt(c.pendingUnits||'0'),BigInt(user.forgeReferralPendingUnits||'0'))),estimatedDaily:cores.reduce((sum,c)=>sum+estimate(c,book.policy).daily,0),nextSettlementAt:boundary(now)+DAY,serverTime:now};
}
module.exports={DAY,POLICY,CATALOG,ensure,boundary,estimate,settle,buy,quoteUpgrade,upgrade,claim,snapshot};

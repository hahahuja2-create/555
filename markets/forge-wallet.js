'use strict';
const {units,amount}=require('../payments/tron');
const MINIMUM_DEPOSIT_UNITS=10_000_000n;

function unifyWallet(state,now=Date.now()){
  const report=[];
  // Validate the entire plan before changing any user.
  const plan=(state.users||[]).filter(user=>user.forgeWalletMigration?.version!==1).map(user=>{
    const earn=units(user.lockedBalance||0),available=units(user.withdrawBalance||0),pending=units(user.reservedBalance||0);
    return {user,earn,available,pending,total:amount(earn+available)};
  });
  for(const row of plan){
    const {user,earn,available,pending}=row;
    user.withdrawBalance=row.total;user.lockedBalance=0;
    user.forgeWalletMigration={version:1,at:new Date(now).toISOString(),fromEarn:amount(earn),fromSpot:amount(available),pendingWithdrawals:amount(pending)};
    report.push({userId:user.id,fromEarn:amount(earn),fromSpot:amount(available),available:row.total,pendingWithdrawals:amount(pending)});
  }
  return report;
}
function creditDeposit(user,transfer){
  const value=BigInt(transfer.units);if(value<=0n)throw new Error('Invalid deposit units.');
  const previous=BigInt(user.forgeHeldDepositUnits||'0'),total=previous+value;
  amount(total);
  if(total<MINIMUM_DEPOSIT_UNITS){user.forgeHeldDepositUnits=total.toString();return {credited:0,held:amount(total),releasedPrior:0};}
  const balance=amount(units(user.withdrawBalance||0)+total);
  user.withdrawBalance=balance;user.forgeHeldDepositUnits='0';
  return {credited:amount(total),held:0,releasedPrior:amount(previous)};
}
module.exports={MINIMUM_DEPOSIT_UNITS,unifyWallet,creditDeposit};

'use strict';
// Read-only, aggregate-only production inspection. No state export or database copy.
const crypto=require('node:crypto');
const {connect}=require('../database/mysql');
const {units,amount}=require('../payments/tron');
(async()=>{
 const connection=await connect(process.env);
 try{
  const [[row]]=await connection.query('SELECT payload FROM state WHERE id=1');
  const state=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  const totals={earn:0n,available:0n,pendingWithdrawals:0n,heldDeposits:0n};
  const fingerprints=[];
  for(const user of state.users){const earn=units(user.lockedBalance||0),available=units(user.withdrawBalance||0),reserved=units(user.reservedBalance||0),held=BigInt(user.forgeHeldDepositUnits||'0');totals.earn+=earn;totals.available+=available;totals.pendingWithdrawals+=reserved;totals.heldDeposits+=held;fingerprints.push(`${user.id}:${earn+available}:${reserved}:${held}`);}
  console.log(JSON.stringify({users:state.users.length,forgeConfigured:process.env.PORTGAINY_FORGE_ENABLED==='1',forgeState:Boolean(state.forge),cores:state.forge?.cores?.length||0,earn:amount(totals.earn),available:amount(totals.available),pendingWithdrawals:amount(totals.pendingWithdrawals),heldDeposits:amount(totals.heldDeposits),totalAccountUsdt:amount(totals.earn+totals.available+totals.pendingWithdrawals),balanceChecksum:crypto.createHash('sha256').update(fingerprints.sort().join('\n')).digest('hex'),automaticWithdrawals:process.env.TRON_AUTOMATIC_WITHDRAWALS_ENABLED==='1',automaticCollections:process.env.TRON_AUTOMATIC_COLLECTIONS_ENABLED==='1',workingWalletConfigured:Boolean(process.env.TRON_WORKING_WALLET_PRIVATE_KEY)},null,2));
 }finally{await connection.end();}
})().catch(error=>{console.error('Read-only Forge inspection failed:',error.code||'DATABASE_UNAVAILABLE');process.exitCode=1;});

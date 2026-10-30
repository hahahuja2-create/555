'use strict';
const { units } = require('./tron');

function format(value) {
  const n=BigInt(value);
  if(n<0n)throw new Error('ACCOUNTING_NEGATIVE_AMOUNT');
  return `${n/1_000_000n}.${(n%1_000_000n).toString().padStart(6,'0')}`;
}
function blank(){return {count:0,gross:0n,net:0n,fee:0n};}
function output(row){return {count:row.count,gross:format(row.gross),net:format(row.net),fee:format(row.fee)};}
function add(group,row){group.count+=Number(row.count);group.gross+=BigInt(row.gross);group.net+=BigInt(row.net);group.fee+=BigInt(row.fee);}

// All ledger amounts are summed as integer micro-USDT, including on SQLite.
async function grouped(store, table) {
  if(!['withdrawals','collections','automation_sweeps'].includes(table))throw new Error('INVALID_ACCOUNTING_TABLE');
  if(table==='automation_sweeps' && store.dialect!=='mysql' && !await store.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='automation_sweeps'").get())return [];
  const isWithdrawal=table==='withdrawals', gross=isWithdrawal?'gross_units':'amount_units', net=isWithdrawal?'net_units':'amount_units', fee=isWithdrawal?'fee_units':'0';
  if(store.dialect==='mysql')return store.sql.prepare(`SELECT status, ${isWithdrawal?'CASE WHEN txid IS NULL THEN 0 ELSE 1 END':'0'} AS has_txid,
    COUNT(*) AS count, COALESCE(SUM(${gross}),0) AS gross, COALESCE(SUM(${net}),0) AS net, COALESCE(SUM(${fee}),0) AS fee
    FROM ${table} GROUP BY status${isWithdrawal?', has_txid':''}`).all();
  const rows=await store.sql.prepare(`SELECT status,${isWithdrawal?'txid':'NULL AS txid'},${gross} AS gross,${net} AS net,${fee} AS fee FROM ${table}`).all();
  return rows.map(row=>({...row,has_txid:row.txid?1:0,count:1}));
}

async function accountingReport(store,state){
  if(!store||!Array.isArray(state?.users))throw Object.assign(new Error('ACCOUNTING_UNAVAILABLE'),{status:503});
  let depositCount,depositTotal=0n;
  if(store.dialect==='mysql'){
    const row=await store.sql.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(amount_units),0) AS total FROM deposits').get();
    depositCount=Number(row.count);depositTotal=BigInt(row.total);
  } else {
    const rows=await store.sql.prepare('SELECT amount_units FROM deposits').all();depositCount=rows.length;
    depositTotal=rows.reduce((sum,row)=>sum+BigInt(row.amount_units),0n);
  }
  const totals={earn:0n,spot:0n,reserved:0n,earned:0n,claimRewards:0n,referralRewards:0n,manualEarnCredits:0n,positionCost:0n,positions:0};
  for(const user of state.users){
    totals.earn+=units(user.lockedBalance||0);totals.spot+=units(user.withdrawBalance||0);totals.reserved+=units(user.reservedBalance||0);
    totals.earned+=units(user.earnedTotal||0);totals.claimRewards+=units(user.earnClaimTotal||0);totals.referralRewards+=units(user.earnReferralTotal||0);
    for(const item of user.activities||[])if(item.type==='adjustment'&&item.source==='operator-manual-earn-credit')totals.manualEarnCredits+=units(item.amount||0);
    for(const item of Object.values(user.spotHoldings||{}))if(BigInt(item.quantityUnits||0)>0n){totals.positions++;totals.positionCost+=BigInt(item.costUnits||0);}
  }
  const withdrawalGroups={chainConfirmed:blank(),manualConfirmed:blank(),pending:blank(),rejected:blank()};
  for(const row of await grouped(store,'withdrawals')){
    const key=row.status==='confirmed'?(Number(row.has_txid)?'chainConfirmed':'manualConfirmed'):
      ['requested','approved','submitted'].includes(row.status)?'pending':row.status==='rejected'?'rejected':null;
    if(key)add(withdrawalGroups[key],row);
  }
  const collectionGroups={confirmed:blank(),pending:blank(),cancelled:blank()};
  for(const row of await grouped(store,'collections')){
    const key=row.status==='confirmed'?'confirmed':['planned','signed'].includes(row.status)?'pending':row.status==='cancelled'?'cancelled':null;
    if(key)add(collectionGroups[key],row);
  }
  const sweepGroups={confirmed:blank(),pending:blank(),failed:blank()};
  for(const row of await grouped(store,'automation_sweeps')){
    const key=row.status==='confirmed'?'confirmed':['planned','signed','submitted'].includes(row.status)?'pending':row.status==='failed'?'failed':null;
    if(key)add(sweepGroups[key],row);
  }
  const uncollected=depositTotal-collectionGroups.confirmed.gross;
  return {asOf:new Date().toISOString(),accounts:state.users.length,
    balances:{earn:format(totals.earn),spot:format(totals.spot),reserved:format(totals.reserved),totalUsdt:format(totals.earn+totals.spot+totals.reserved),
      positionCount:totals.positions,positionCost:format(totals.positionCost)},
    earnings:{totalEarned:format(totals.earned),earnClaims:format(totals.claimRewards),referralRewards:format(totals.referralRewards),manualEarnCredits:format(totals.manualEarnCredits)},
    deposits:{count:depositCount,total:format(depositTotal),uncollected:uncollected<0n?null:format(uncollected)},
    collections:Object.fromEntries(Object.entries(collectionGroups).map(([key,value])=>[key,output(value)])),
    withdrawals:Object.fromEntries(Object.entries(withdrawalGroups).map(([key,value])=>[key,output(value)])),
    ownerSweeps:Object.fromEntries(Object.entries(sweepGroups).map(([key,value])=>[key,output(value)]))};
}

async function accountingJournal(store,users,offset=0){
  if(!store)throw Object.assign(new Error('ACCOUNTING_UNAVAILABLE'),{status:503});
  if(!Number.isSafeInteger(offset)||offset<0||offset>100_000_000)throw Object.assign(new Error('INVALID_OFFSET'),{status:400});
  const summary=await store.sql.prepare('SELECT COUNT(*) AS count FROM journal').get();
  const count=Number(summary.count),limit=25;
  if(!Number.isSafeInteger(count)||count<0)throw Error('INVALID_ACCOUNTING_COUNT');
  const records=await store.sql.prepare('SELECT batch,account,delta_units,reason,created_at AS occurred_at FROM journal ORDER BY created_at DESC,batch DESC,account ASC LIMIT 25 OFFSET ?').all(offset);
  const names=new Map(users.map(user=>[user.id,user.email]));
  const labels={lockedBalance:'Earn',withdrawBalance:'Spot',reservedBalance:'Reserved'};
  return {count,offset,limit,hasMore:offset+records.length<count,entries:records.map(row=>{
    const split=row.account.lastIndexOf(':'),id=row.account.slice(0,split),field=row.account.slice(split+1),delta=BigInt(row.delta_units);
    return {batch:row.batch,account:id==='platform'?'Platform counterparty':names.get(id)||'Account unavailable',balance:labels[field]||'Counterparty',
      amount:format(delta<0n?-delta:delta),direction:delta<0n?'debit':'credit',reason:row.reason,at:row.occurred_at};
  })};
}
module.exports={accountingReport,accountingJournal,format};

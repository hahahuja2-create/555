'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {PaymentStore}=require('../payments/store'),{OutgoingLedger}=require('../payments/outgoing'),{accountingReport,accountingJournal}=require('../payments/accounting');

test('accounting separates actual deposits, internal balances, confirmed and manually marked payouts, and owner transfers',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-accounting-')),store=new PaymentStore(dir),ledger=new OutgoingLedger(store,'TZBZHkdrwv6xrGzRR9a1WqStf3oEmtjDvw');
 t.after(async()=>{store.close();const real=await fs.realpath(dir),tmp=await fs.realpath(os.tmpdir());assert.equal(path.dirname(real).toLowerCase(),tmp.toLowerCase());assert.ok(path.basename(real).startsWith('portgainy-accounting-'));await fs.rm(real,{recursive:true,force:true});});
 const state={users:[{id:'a',email:'a@example.invalid',lockedBalance:2456,withdrawBalance:5.123456,reservedBalance:2,earnedTotal:7,earnClaimTotal:5,earnReferralTotal:2,
  activities:[{type:'adjustment',source:'operator-manual-earn-credit',amount:2453.3864}],spotHoldings:{BTC:{quantityUnits:'1000000000000000000',costUnits:'12000000'}}},
  {id:'b',email:'b@example.invalid',lockedBalance:1,withdrawBalance:0,reservedBalance:0,earnedTotal:0,activities:[]}]};
 const dep=store.sql.prepare('INSERT INTO deposits(txid,log_index,user_id,address,amount_units,block_number,timestamp) VALUES (?,?,?,?,?,?,?)');
 dep.run('a'.repeat(64),0,'a','fictional','10000000000000001',1,1);dep.run('b'.repeat(64),0,'b','fictional','7',1,2);
 const coll=store.sql.prepare('INSERT INTO collections(id,address,address_index,treasury,amount_units,status,created_at,txid,issue) VALUES (?,?,?,?,?,?,?,NULL,NULL)');
 coll.run('c1','fictional',0,ledger.treasury,'1000000','confirmed',1);coll.run('c2','fictional2',1,ledger.treasury,'2000000','planned',2);
 const withdrawal=store.sql.prepare('INSERT INTO withdrawals(id,user_id,request_key,destination,gross_units,fee_units,net_units,status,created_at,updated_at,txid,issue) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)');
 withdrawal.run('w1','a','r1',ledger.treasury,'10000000','200000','9800000','confirmed',1,1,'c'.repeat(64));
 withdrawal.run('w2','a','r2',ledger.treasury,'20000000','400000','19600000','confirmed',1,1,null);
 withdrawal.run('w3','a','r3',ledger.treasury,'30000000','600000','29400000','requested',1,1,null);
 store.sql.exec("CREATE TABLE automation_sweeps(id TEXT PRIMARY KEY,amount_units TEXT NOT NULL,status TEXT NOT NULL)");
 store.sql.prepare('INSERT INTO automation_sweeps VALUES (?,?,?)').run('s1','12500000','confirmed');
 const report=await accountingReport(store,state);
 assert.equal(report.deposits.total,'10000000000.000008');assert.equal(report.deposits.count,2);
 assert.equal(report.deposits.uncollected,'9999999999.000008');
 assert.equal(report.collections.confirmed.gross,'1.000000');assert.equal(report.collections.pending.gross,'2.000000');
 assert.equal(report.balances.earn,'2457.000000');assert.equal(report.balances.spot,'5.123456');assert.equal(report.balances.reserved,'2.000000');
 assert.equal(report.balances.totalUsdt,'2464.123456');assert.equal(report.balances.positionCost,'12.000000');assert.equal(report.balances.positionCount,1);
 assert.equal(report.earnings.manualEarnCredits,'2453.386400');assert.equal(report.earnings.earnClaims,'5.000000');assert.equal(report.earnings.referralRewards,'2.000000');
 assert.equal(report.withdrawals.chainConfirmed.net,'9.800000');assert.equal(report.withdrawals.manualConfirmed.net,'19.600000');
 assert.equal(report.withdrawals.pending.gross,'30.000000');assert.equal(report.ownerSweeps.confirmed.gross,'12.500000');
 store.save(state,'fixture-opening');
 const journal=await accountingJournal(store,state.users,0);
 assert.ok(journal.count>=5);assert.ok(journal.entries.some(entry=>entry.account==='a@example.invalid'&&entry.balance==='Earn'&&entry.direction==='credit'));
 assert.ok(journal.entries.some(entry=>entry.account==='Platform counterparty'&&entry.direction==='debit'));
 await assert.rejects(accountingJournal(store,state.users,-1),/INVALID_OFFSET/);
});

'use strict';
const crypto = require('node:crypto');
const { addressHex, units, decodeTransfers } = require('./tron');
const { boundedSun, tokenBalance, trxBalance, buildTokenTransfer, signTransfer, validateTransfer, broadcast } = require('./transactions');
const { failure } = require('./outgoing');

// Requests are manually created by the administrator. This worker cannot choose
// a destination: every transfer is pinned to the configured owner address.
class OwnerSweeps {
  constructor({store, ledger, exclusive, signer, client, source, destination, privateKey, feeLimit, isEnabled}) {
    addressHex(source); addressHex(destination);
    if (source === destination) throw new Error('SWEEP_DESTINATION_EQUALS_SOURCE');
    Object.assign(this,{store,ledger,exclusive,signer,client,source,destination,privateKey,feeLimit:boundedSun(feeLimit,'sweep fee limit'),isEnabled});
    this.sql=store.sql; this.transaction=(store.transactionAsync||store.transaction).bind(store); this.stopped=false;
    if (store.dialect !== 'mysql') this.sql.exec(`CREATE TABLE IF NOT EXISTS automation_sweeps (
      id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, destination TEXT NOT NULL, amount_units TEXT NOT NULL,
      status TEXT NOT NULL, txid TEXT UNIQUE, payload TEXT, fee_limit INTEGER NOT NULL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, issue TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_sweep ON automation_sweeps((1)) WHERE status IN ('planned','signed','submitted');`);
  }
  async pendingInside() { return this.sql.prepare("SELECT * FROM automation_sweeps WHERE status IN ('planned','signed','submitted') ORDER BY created_at LIMIT 1").get(); }
  async latestInside() { return this.sql.prepare('SELECT * FROM automation_sweeps ORDER BY created_at DESC LIMIT 1').get(); }
  async getInside(id) { return this.sql.prepare('SELECT * FROM automation_sweeps WHERE id=?').get(id); }
  async requestInside({key,amount}, actor) {
    if (!this.isEnabled() || this.stopped) throw failure('OWNER_SWEEP_DISABLED',503);
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw failure('INVALID_REQUEST_KEY',400);
    const value=units(amount); if (value <= 0n) throw failure('INVALID_AMOUNT',400);
    return this.transaction(async()=>{
      const existing=await this.sql.prepare('SELECT * FROM automation_sweeps WHERE request_key=?').get(key);
      if(existing){if(BigInt(existing.amount_units)!==value || existing.destination!==this.destination) throw failure('REQUEST_KEY_CONFLICT');return existing;}
      if(await this.pendingInside()) throw failure('OWNER_SWEEP_IN_PROGRESS');
      const id=crypto.randomUUID(),now=Date.now();
      await this.sql.prepare('INSERT INTO automation_sweeps(id,request_key,destination,amount_units,status,txid,payload,fee_limit,created_at,updated_at,issue) VALUES (?,?,?,?,?,NULL,NULL,?,?,?,NULL)').run(id,key,this.destination,value.toString(),'planned',this.feeLimit,now,now);
      await this.ledger.audit(actor,'owner-sweep-requested',id); return this.getInside(id);
    });
  }
  async cancelInside(id, actor) {
    return this.transaction(async()=>{
      const row=await this.getInside(id); if(!row)throw failure('OWNER_SWEEP_NOT_FOUND',404);
      if(row.status==='cancelled')return row;
      if(row.status!=='planned')throw failure('OWNER_SWEEP_ALREADY_SIGNED');
      await this.sql.prepare("UPDATE automation_sweeps SET status='cancelled',updated_at=? WHERE id=? AND status='planned'").run(Date.now(),id);
      await this.ledger.audit(actor,'owner-sweep-cancelled',id);return this.getInside(id);
    });
  }
  async processInside() {
    if(this.stopped || !this.isEnabled()) return;
    let job=await this.exclusive(async()=>{
      const row=await this.pendingInside(); if(!row)return;
      if((await this.ledger.pending()).some(item=>item.kind==='withdrawal')) throw new Error('WORKING_WALLET_BUSY');
      return row;
    });
    if(!job)return;
    if(job.destination!==this.destination || job.fee_limit!==this.feeLimit) throw new Error('OWNER_SWEEP_CONFIGURATION_MISMATCH');
    const expected={from:this.source,to:this.destination,value:job.amount_units,feeLimit:this.feeLimit};
    if(job.status==='planned'){
      if(await tokenBalance(this.client,this.source)<BigInt(job.amount_units)) throw new Error('TREASURY_USDT_INSUFFICIENT');
      if(await trxBalance(this.client,this.source)<BigInt(this.feeLimit)+1_000_000n) throw new Error('TREASURY_TRX_RESERVE_REQUIRED');
      const unsigned=await buildTokenTransfer(this.client,{address:this.source,treasury:this.destination,amount_units:job.amount_units},this.feeLimit);
      const signed=await signTransfer(unsigned,this.privateKey.slice(2),expected);
      if(this.stopped || !this.isEnabled()) return;
      job=await this.exclusive(()=>this.transaction(async()=>{
        const fresh=await this.getInside(job.id); if(fresh.status!=='planned')throw new Error('OWNER_SWEEP_STATE_CHANGED');
        await this.sql.prepare("UPDATE automation_sweeps SET status='signed',txid=?,payload=?,updated_at=? WHERE id=? AND status='planned'").run(signed.txID,JSON.stringify(signed),Date.now(),job.id);
        await this.ledger.audit('automatic-signer','owner-sweep-signed',job.id);return this.getInside(job.id);
      }));
    }
    const signed=JSON.parse(job.payload); validateTransfer(signed,expected);
    if(signed.txID!==job.txid)throw new Error('OWNER_SWEEP_IDENTITY_MISMATCH');
    if(job.status==='signed') job=await this.exclusive(()=>this.transaction(async()=>{
      const result=await this.sql.prepare("UPDATE automation_sweeps SET status='submitted',updated_at=? WHERE id=? AND status='signed'").run(Date.now(),job.id);
      if(!result.changes)throw new Error('OWNER_SWEEP_STATE_CHANGED');
      await this.ledger.audit('automatic-signer','owner-sweep-submitted',job.id);return this.getInside(job.id);
    }));
    if(this.stopped || !this.isEnabled())return;
    const info=await this.client.receipt(job.txid), height=await this.client.solidHeight();
    if(info.id===job.txid && Number.isSafeInteger(info.blockNumber) && info.blockNumber<=height){
      const events=decodeTransfers(info,job.txid,height);
      if(info.receipt?.result!=='SUCCESS'){
        const failures=['REVERT','OUT_OF_ENERGY','OUT_OF_TIME','BAD_JUMP_DESTINATION','OUT_OF_MEMORY','TRANSFER_FAILED','STACK_TOO_SMALL','STACK_TOO_LARGE','ILLEGAL_OPERATION','JVM_STACK_OVER_FLOW'];
        if(!failures.includes(info.receipt?.result))throw new Error('OWNER_SWEEP_RECEIPT_MISMATCH');
        await this.exclusive(()=>this.transaction(async()=>{
          const result=await this.sql.prepare("UPDATE automation_sweeps SET status='failed',issue='CHAIN_TRANSACTION_FAILED',updated_at=? WHERE id=? AND status='submitted' AND txid=?").run(Date.now(),job.id,job.txid);
          if(result.changes)await this.ledger.audit('chain-monitor','owner-sweep-failed',job.id);
        }));
        return;
      }
      const transfers=events.filter(e=>e.from===this.source && e.to===this.destination && e.units===String(job.amount_units) && e.timestamp>=job.created_at-60_000);
      if(transfers.length!==1)throw new Error('OWNER_SWEEP_RECEIPT_MISMATCH');
      await this.exclusive(()=>this.transaction(async()=>{
        const result=await this.sql.prepare("UPDATE automation_sweeps SET status='confirmed',updated_at=? WHERE id=? AND status='submitted' AND txid=?").run(Date.now(),job.id,job.txid);
        if(result.changes)await this.ledger.audit('chain-monitor','owner-sweep-confirmed',job.id);
      }));
      return;
    }
    if(signed.raw_data.expiration<=Date.now())throw new Error('SIGNED_TRANSACTION_EXPIRED');
    await broadcast(this.client,signed);
  }
  async cycle(){
    if(this.stopped || !this.isEnabled())return;
    try { this.balanceUnits=(await tokenBalance(this.client,this.source)).toString(); this.balanceAt=Date.now(); }
    catch { this.balanceUnits=null; this.balanceAt=null; }
    return this.signer.enqueue(()=>this.processInside());
  }
  start(interval=30_000){const loop=async()=>{try{await this.cycle();this.lastIssue=null;}catch(error){
    const safe=['TREASURY_USDT_INSUFFICIENT','TREASURY_TRX_RESERVE_REQUIRED','WORKING_WALLET_BUSY','SIGNED_TRANSACTION_EXPIRED','OWNER_SWEEP_RECEIPT_MISMATCH'];
    this.lastIssue=safe.includes(error.message)?error.message:'NETWORK_OR_STORAGE_UNAVAILABLE';
  }if(!this.stopped){this.timer=setTimeout(loop,interval);this.timer.unref();}};this.running=loop();}
  stop(){this.stopped=true;clearTimeout(this.timer);}
}
module.exports={OwnerSweeps};

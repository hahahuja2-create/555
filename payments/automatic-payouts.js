'use strict';

const { Wallet } = require('ethers');
const { tronAddress } = require('./tron');
const { signTransfer, boundedSun } = require('./transactions');

// The caller must use a durable, transactionally recorded eligibility marker:
// requests created before activation may already have been paid manually.
class AutomaticPayouts {
  constructor({ treasury, privateKey, feeLimit, payouts, ledger, exclusive, getState, commitState, isEligible, isEnabled, hasPendingSweep = async () => false }) {
    if (typeof privateKey !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('WORKING_WALLET_KEY_INVALID');
    if (tronAddress(new Wallet(privateKey).address.slice(2)) !== treasury) throw new Error('WORKING_WALLET_ADDRESS_MISMATCH');
    if (typeof isEligible !== 'function' || typeof isEnabled !== 'function') throw new Error('AUTOMATIC_PAYOUT_POLICY_REQUIRED');
    Object.assign(this, { treasury, privateKey, feeLimit: boundedSun(feeLimit, 'payout fee limit'), payouts, ledger, exclusive, getState, commitState, isEligible, isEnabled, hasPendingSweep });
    this.queue = Promise.resolve();
    this.stopped = false;
  }

  async cycle() {
    if (this.stopped || !this.isEnabled()) return;
    const job = await this.exclusive(() => this.ledger.sql.prepare(`SELECT w.id FROM withdrawals w
      WHERE w.status IN ('requested','approved','submitted') AND EXISTS
      (SELECT 1 FROM payment_audit a WHERE a.job_id=w.id AND a.action='automatic-payout-eligible')
      ORDER BY CASE WHEN w.status='submitted' THEN 0 ELSE 1 END, w.created_at LIMIT 1`).get());
    if (job) return this.process(job.id);
  }

  start(interval = 30_000) {
    const loop = async () => {
      try {
        const result = await this.cycle();
        this.lastIssue = result?.broadcastAcknowledged === false ? 'BROADCAST_NOT_ACKNOWLEDGED' : null;
      } catch (error) {
        const safe = ['TREASURY_USDT_INSUFFICIENT', 'TREASURY_TRX_RESERVE_REQUIRED', 'WORKING_WALLET_BUSY', 'SIGNED_TRANSACTION_EXPIRED', 'PAYOUT_INTENT_EXPIRED_REVIEW_REQUIRED'];
        this.lastIssue = safe.includes(error.message) ? error.message : 'NETWORK_OR_STORAGE_UNAVAILABLE';
      }
      if (!this.stopped) { this.timer = setTimeout(loop, interval); this.timer.unref(); }
    };
    this.running = loop();
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }

  process(id) {
    return this.enqueue(() => this.processInside(id));
  }

  enqueue(operation) {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => {});
    return next;
  }

  async processInside(id) {
    if (this.stopped || !this.isEnabled()) throw new Error('AUTOMATIC_PAYOUTS_DISABLED');
    const job = await this.exclusive(async () => {
      const row = await this.ledger.withdrawal(id);
      if (!row || !await this.isEligible(row)) throw new Error('AUTOMATIC_PAYOUT_NOT_ELIGIBLE');
      // A solidified balance does not include an outgoing transaction that is
      // still being mined. Serialize payouts until its result is reconciled.
      const pending = await this.ledger.pending();
      if (pending.some(item => item.kind === 'withdrawal' && item.id !== id)) throw new Error('WORKING_WALLET_BUSY');
      if (row.status !== 'submitted' && await this.hasPendingSweep()) throw new Error('WORKING_WALLET_BUSY');
      if (row.status === 'requested') {
        const state = structuredClone(this.getState());
        const approved = await this.ledger.decide(state, id, 'approve', 'automatic-payout');
        if (approved.changed) this.commitState(state);
        return approved.record;
      }
      return row;
    });
    if (job.status === 'confirmed') return { status: 'confirmed', txid: job.txid };
    if (job.status === 'submitted') {
      if (!await this.exclusive(() => this.ledger.signedWithdrawal(id))) throw new Error('AUTOMATIC_PAYOUT_SIGNATURE_MISSING');
      return this.payouts.send(id);
    }
    if (job.status !== 'approved') throw new Error('AUTOMATIC_PAYOUT_INVALID_STATUS');
    const prepared = await this.payouts.prepare(id, this.feeLimit);
    if (this.stopped || !this.isEnabled()) throw new Error('AUTOMATIC_PAYOUTS_DISABLED');
    const signed = await signTransfer(prepared.transaction, this.privateKey.slice(2), {
      from: this.treasury, to: job.destination, value: job.net_units, feeLimit: this.feeLimit
    });
    // Signed bytes and their request identity are committed before broadcast.
    await this.payouts.record(id, signed, {actor:'automatic-signer'});
    if (this.stopped || !this.isEnabled()) throw new Error('AUTOMATIC_PAYOUTS_DISABLED');
    return this.payouts.send(id);
  }
}

module.exports = { AutomaticPayouts };

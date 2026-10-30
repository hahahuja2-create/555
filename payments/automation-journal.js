'use strict';

// Unlike a local worker's SQLite file, these records must survive a Railway
// restart and be stored alongside the existing financial ledger.
class AutomationJournal {
  constructor(store, exclusive, { now = () => new Date() } = {}) {
    this.store = store; this.sql = store.sql; this.exclusive = exclusive; this.now = now;
    this.transaction = (store.transactionAsync || store.transaction).bind(store);
    if (store.dialect !== 'mysql') this.sql.exec(`CREATE TABLE IF NOT EXISTS automation_spend (
      kind TEXT NOT NULL, job_id TEXT NOT NULL, day TEXT NOT NULL, amount_sun TEXT NOT NULL,
      PRIMARY KEY(kind,job_id,day));
      CREATE INDEX IF NOT EXISTS automation_spend_day ON automation_spend(kind,day);
      CREATE TABLE IF NOT EXISTS automation_funding (job_id TEXT PRIMARY KEY, txid TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0);`);
  }

  reserve(kind, job, value, limit) {
    return this.exclusive(() => this.transaction(async () => {
      const amount = BigInt(value), maximum = BigInt(limit);
      if (amount < 0n || maximum < 0n) throw new Error('INVALID_AUTOMATION_RESERVATION');
      const existing = await this.sql.prepare('SELECT amount_sun FROM automation_spend WHERE kind=? AND job_id=? LIMIT 1').get(kind, job);
      if (existing && BigInt(existing.amount_sun) !== amount) throw new Error('A reserved spending limit cannot be changed.');
      const day = this.now().toISOString().slice(0, 10);
      if (await this.sql.prepare('SELECT 1 FROM automation_spend WHERE kind=? AND job_id=? AND day=?').get(kind, job, day)) return;
      const entries = await this.sql.prepare('SELECT amount_sun FROM automation_spend WHERE kind=? AND day=?').all(kind, day);
      if (entries.reduce((sum, row) => sum + BigInt(row.amount_sun), 0n) + amount > maximum) throw new Error('DAILY_SPENDING_LIMIT_REACHED');
      await this.sql.prepare('INSERT INTO automation_spend(kind,job_id,day,amount_sun) VALUES (?,?,?,?)').run(kind, job, day, amount.toString());
    }));
  }

  funding(id) { return this.exclusive(() => this.sql.prepare('SELECT * FROM automation_funding WHERE job_id=?').get(id)); }
  reservedCost(kind, id) {
    return this.exclusive(async () => BigInt((await this.sql.prepare('SELECT amount_sun FROM automation_spend WHERE kind=? AND job_id=? LIMIT 1').get(kind, id))?.amount_sun || 0));
  }
  saveFunding(id, transaction) {
    return this.exclusive(() => this.transaction(async () => {
      const existing = await this.sql.prepare('SELECT * FROM automation_funding WHERE job_id=?').get(id);
      if (existing) {
        if (existing.txid !== transaction.txID || existing.payload !== JSON.stringify(transaction)) throw new Error('FUNDING_IDENTITY_CONFLICT');
        return;
      }
      await this.sql.prepare('INSERT INTO automation_funding(job_id,txid,payload,confirmed) VALUES (?,?,?,0)').run(id, transaction.txID, JSON.stringify(transaction));
    }));
  }
  confirmFunding(id) {
    return this.exclusive(() => this.transaction(async () => {
      const result = await this.sql.prepare('UPDATE automation_funding SET confirmed=1 WHERE job_id=?').run(id);
      if (!result.changes) throw new Error('FUNDING_NOT_FOUND');
    }));
  }
}

module.exports = { AutomationJournal };

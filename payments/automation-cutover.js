'use strict';

// Run while the application owns the database's single-writer lock. Legacy
// transfers may already have been signed or paid outside the application.
async function assertAutomationCutover(store, treasury) {
  const sql=store.sql;
  const collection=await sql.prepare("SELECT id FROM collections WHERE status NOT IN ('confirmed','cancelled') AND treasury<>? LIMIT 1").get(treasury);
  if(collection)throw new Error('LEGACY_COLLECTION_REQUIRES_SETTLEMENT');
  const withdrawal=await sql.prepare(`SELECT w.id FROM withdrawals w WHERE w.status IN ('requested','approved','submitted')
    AND NOT EXISTS (SELECT 1 FROM payment_audit a WHERE a.job_id=w.id AND a.action='automatic-payout-eligible') LIMIT 1`).get();
  if(withdrawal)throw new Error('LEGACY_WITHDRAWAL_REQUIRES_SETTLEMENT');
}
module.exports={assertAutomationCutover};

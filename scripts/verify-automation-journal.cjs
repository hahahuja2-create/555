'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { PaymentStore } = require('../payments/store');
const { AutomationJournal } = require('../payments/automation-journal');

test('Railway signer journal persists funding identity and enforces daily TRX reservations across restarts', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portgainy-signer-journal-'));
  let store = new PaymentStore(directory), queue = Promise.resolve(), now = new Date('2026-10-30T12:00:00Z');
  const exclusive = operation => { const next = queue.then(operation); queue = next.catch(() => {}); return next; };
  let journal = new AutomationJournal(store, exclusive, {now:()=>now});
  t.after(async () => {
    store.close(); const real = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(real).toLowerCase(), temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('portgainy-signer-journal-'));
    await fs.rm(real,{recursive:true,force:true});
  });
  await journal.reserve('gas','job-1',7n,10n);
  await journal.reserve('gas','job-1',7n,10n);
  await assert.rejects(journal.reserve('gas','job-1',8n,10n), /cannot be changed/);
  await assert.rejects(journal.reserve('gas','job-2',4n,10n), /DAILY_SPENDING_LIMIT_REACHED/);
  const tx = {txID:'a'.repeat(64),raw_data:{timestamp:123}};
  await journal.saveFunding('job-1',tx);
  await journal.saveFunding('job-1',tx);
  await assert.rejects(journal.saveFunding('job-1',{...tx,txID:'b'.repeat(64)}), /FUNDING_IDENTITY_CONFLICT/);
  store.close(); store = new PaymentStore(directory); journal = new AutomationJournal(store, exclusive, {now:()=>now});
  assert.equal((await journal.funding('job-1')).txid,tx.txID);
  assert.equal(await journal.reservedCost('gas','job-1'),7n);
  await journal.confirmFunding('job-1');
  assert.equal(Number((await journal.funding('job-1')).confirmed),1);
  now = new Date('2026-10-31T00:01:00Z');
  await journal.reserve('gas','job-1',7n,10n);
  await assert.rejects(journal.reserve('gas','job-2',4n,10n), /DAILY_SPENDING_LIMIT_REACHED/);
});

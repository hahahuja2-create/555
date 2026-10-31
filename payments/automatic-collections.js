'use strict';
const { HDNodeWallet, Wallet } = require('ethers');
const { BRANCH_PATH, tronAddress, deriveAddress } = require('./tron');
const { validateTransfer } = require('./transactions');
const { CollectionWorker } = require('./collector');
const { AutomationJournal } = require('./automation-journal');

class AutomaticCollections {
  constructor({ treasury, mnemonic, fuelAddress, wallet, store, ledger, client, exclusive, feeLimit, feeDailyLimit, gasDailyLimit, isEnabled, fuelMode = 'legacy', workingPrivateKey, signer }) {
    if (typeof mnemonic !== 'string' || typeof isEnabled !== 'function') throw new Error('COLLECTION_SIGNER_CONFIGURATION_REQUIRED');
    let branch, gasKey;
    try {
      branch = HDNodeWallet.fromPhrase(mnemonic, '', BRANCH_PATH);
      if (fuelMode === 'legacy') gasKey = HDNodeWallet.fromPhrase(mnemonic, '', "m/44'/195'/1'/0/0");
      else if (fuelMode === 'working-wallet' && /^0x[0-9a-fA-F]{64}$/.test(workingPrivateKey || '') && signer) gasKey = new Wallet(workingPrivateKey);
      else throw new Error('INVALID_FUEL_MODE');
    } catch { throw new Error('COLLECTION_SIGNER_CONFIGURATION_INVALID'); }
    if (branch.neuter().extendedKey !== wallet.xpub || wallet.treasuryAddress !== treasury) throw new Error('COLLECTION_SIGNER_WALLET_MISMATCH');
    const gasWallet = { address: tronAddress(gasKey.address.slice(2)), privateKey: gasKey.privateKey.slice(2) };
    if (gasWallet.address !== fuelAddress) throw new Error('COLLECTION_FUEL_ADDRESS_MISMATCH');
    if (fuelMode === 'working-wallet' && gasWallet.address !== treasury) throw new Error('COLLECTION_FUEL_ADDRESS_MISMATCH');
    Object.assign(this, { treasury, ledger, exclusive, isEnabled, feeLimit, signer, fuelMode });
    this.stopped = false;
    this.journal = new AutomationJournal(store, exclusive);
    const operator = async (route, body) => {
      if (this.stopped || !this.isEnabled()) throw new Error('AUTOMATIC_COLLECTIONS_DISABLED');
      if (route === 'collections/plan') return exclusive(async () => ({treasury, feeLimitSun:feeLimit, collections:await ledger.planCollections()}));
      if (route === 'collections') return exclusive(async () => ({treasury, feeLimitSun:feeLimit, collections:await ledger.collections()}));
      const match = /^collections\/([a-f0-9-]{36})\/record$/.exec(route);
      if (!match) throw new Error('INVALID_COLLECTION_OPERATION');
      return exclusive(async () => ({collection:await ledger.recordCollection(match[1], body.transaction, (transaction, job) => {
        if (job.treasury !== treasury || job.address !== deriveAddress(wallet.xpub, job.address_index)) throw new Error('COLLECTION_IDENTITY_MISMATCH');
        validateTransfer(transaction, {from:job.address,to:treasury,value:job.amount_units,feeLimit});
      })}));
    };
    const fundingGuard = fuelMode === 'working-wallet' ? job => exclusive(async () => {
      const pendingGas = await store.sql.prepare('SELECT job_id FROM automation_funding WHERE confirmed=0 LIMIT 1').get();
      if (pendingGas && pendingGas.job_id !== job.id) throw new Error('WORKING_WALLET_BUSY');
      if (!pendingGas) {
        if ((await ledger.pending()).some(item => item.kind === 'withdrawal')) throw new Error('WORKING_WALLET_BUSY');
        if (await store.sql.prepare("SELECT id FROM automation_sweeps WHERE status IN ('signed','submitted') LIMIT 1").get()) throw new Error('WORKING_WALLET_BUSY');
      }
    }) : async () => {};
    this.worker = new CollectionWorker({operator,client,wallet,treasury,branch,gasWallet,journal:this.journal,feeLimit,
      feeDailyLimit,gasDailyLimit,gasEnabled:true,fundingGuard,
      shouldStop:()=>this.stopped || !this.isEnabled()});
  }
  async cycle() { if (!this.stopped && this.isEnabled()) return this.fuelMode === 'working-wallet' ? this.signer.enqueue(() => this.worker.cycle()) : this.worker.cycle(); }
  start(interval = 30_000) {
    const loop = async () => {
      try {
        const results = await this.cycle();
        this.lastIssue = results?.find(row => !['awaiting-confirmation','awaiting-gas-confirmation'].includes(row.status))?.status || null;
      } catch { this.lastIssue = 'NETWORK_OR_STORAGE_UNAVAILABLE'; }
      if (!this.stopped) { this.timer = setTimeout(loop, interval); this.timer.unref(); }
    };
    this.running = loop();
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }
}

module.exports = { AutomaticCollections };

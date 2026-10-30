'use strict';
const { HDNodeWallet } = require('ethers');
const { BRANCH_PATH, tronAddress, deriveAddress } = require('./tron');
const { validateTransfer } = require('./transactions');
const { CollectionWorker } = require('./collector');
const { AutomationJournal } = require('./automation-journal');

class AutomaticCollections {
  constructor({ treasury, mnemonic, fuelAddress, wallet, store, ledger, client, exclusive, feeLimit, feeDailyLimit, gasDailyLimit, isEnabled }) {
    if (typeof mnemonic !== 'string' || typeof isEnabled !== 'function') throw new Error('COLLECTION_SIGNER_CONFIGURATION_REQUIRED');
    let branch, gasKey;
    try {
      branch = HDNodeWallet.fromPhrase(mnemonic, '', BRANCH_PATH);
      gasKey = HDNodeWallet.fromPhrase(mnemonic, '', "m/44'/195'/1'/0/0");
    } catch { throw new Error('COLLECTION_SIGNER_CONFIGURATION_INVALID'); }
    if (branch.neuter().extendedKey !== wallet.xpub || wallet.treasuryAddress !== treasury) throw new Error('COLLECTION_SIGNER_WALLET_MISMATCH');
    const gasWallet = { address: tronAddress(gasKey.address.slice(2)), privateKey: gasKey.privateKey.slice(2) };
    if (gasWallet.address !== fuelAddress) throw new Error('COLLECTION_FUEL_ADDRESS_MISMATCH');
    Object.assign(this, { treasury, ledger, exclusive, isEnabled, feeLimit });
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
    this.worker = new CollectionWorker({operator,client,wallet,treasury,branch,gasWallet,journal:this.journal,feeLimit,
      feeDailyLimit,gasDailyLimit,gasEnabled:true,shouldStop:()=>this.stopped || !this.isEnabled()});
  }
  async cycle() { if (!this.stopped && this.isEnabled()) return this.worker.cycle(); }
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

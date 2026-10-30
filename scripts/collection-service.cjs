'use strict';

const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { HDNodeWallet } = require('ethers');
const { BRANCH_PATH, tronAddress, validateWallet, TronGrid } = require('../payments/tron');
const { defaultVaultFile, readVault } = require('../payments/vault');
const { CollectionWorker, SignerJournal } = require('../payments/collector');
const { railwayOperatorClient } = require('../payments/railway-operator');
const { trxBalance } = require('../payments/transactions');
const { maskedBackupPassword } = require('../payments/private-terminal');
const { readEncryptedBackup, prepareIphoneExport, findIphoneReturn } = require('../payments/iphone-backup');
const { pendingEncryptedBackup, replaceEncryptedBackup, backupDigest } = require('../payments/backup-rotation');
const { validateCollectionLimits, verifyPortableRecovery, workerStatusFile, writeWorkerStatus } = require('../payments/collection-activation');
const { railwayScope, authorizationFile, authorizeCollection, readCollectionAuthorization, collectionServiceCycle } = require('../payments/collection-service');

async function main() {
  if (process.argv.length !== 3 || !['--authorize', '--run', '--check', '--stop', '--resume'].includes(process.argv[2])) throw new Error('INVALID_SERVICE_OPTIONS');
  const mode = process.argv[2];
  if (mode === '--authorize' && (!process.stdin.isTTY || !process.stdout.isTTY)) throw new Error('PRIVATE_TERMINAL_REQUIRED');
  const treasury = process.env.TRON_TREASURY_ADDRESS || require('../config/tron-payment-setup.json').treasuryAddress;
  const walletFile = path.resolve(process.env.TRON_WALLET_PUBLIC_FILE || path.join(__dirname, '..', 'config', 'tron-wallet-public.json'));
  const wallet = validateWallet(JSON.parse(await fs.readFile(walletFile, 'utf8')), treasury);
  const vaultFile = process.env.TRON_LOCAL_VAULT_FILE || defaultVaultFile(walletFile);
  const backupFile = process.env.TRON_PORTABLE_BACKUP_FILE || vaultFile + '.portable.keystore.json';
  const stopFile = vaultFile + '.collection-stop';
  if (mode === '--stop') {
    await fs.writeFile(stopFile, new Date().toISOString(), { mode: 0o600 });
    console.log('COLLECTION_STOP_REQUESTED');
    return;
  }
  const fuelAddress = process.env.TRON_FUEL_ADDRESS;
  const scope = railwayScope();
  const operator = railwayOperatorClient();
  const client = new TronGrid(process.env.TRONGRID_API_KEY);
  const remote = await operator('collections');
  if (remote.treasury !== treasury) throw new Error('TREASURY_CONFIGURATION_MISMATCH');
  const context = { wallet, treasury, fuelAddress, scope, backendFeeLimit: remote.feeLimitSun };
  const file = authorizationFile(vaultFile);
  if (mode === '--authorize') {
    const limits = validateCollectionLimits(Number(process.env.TRON_COLLECTION_FEE_LIMIT_SUN),
      process.env.TRON_COLLECTION_DAILY_FEE_LIMIT_SUN, process.env.TRON_GAS_DAILY_LIMIT_SUN, remote.feeLimitSun, true);
    const original = await readEncryptedBackup(backupFile);
    let candidate = backupFile;
    try { candidate = await pendingEncryptedBackup(backupFile); }
    catch (error) {
      const prefix = path.basename(backupFile) + '.pending-';
      if ((await fs.readdir(path.dirname(backupFile))).some(name => name.startsWith(prefix))) throw error;
    }
    const encrypted = await readEncryptedBackup(candidate);
    const transfer = await prepareIphoneExport(candidate, path.join(path.dirname(vaultFile), 'iphone-transfer'));
    const returnedFile = await findIphoneReturn(transfer);
    if (!returnedFile) throw new Error('IPHONE_RETURN_NOT_VERIFIED');
    console.log('Use the private password dialog to unlock the backup already returned from your iPhone.');
    console.log('Collection destination:', treasury);
    console.log('Energy limit per transfer / daily (TRX):', limits.feeLimit / 1e6, '/', Number(limits.feeDailyLimit) / 1e6);
    console.log('Daily TRX funding reservation limit:', Number(limits.gasDailyLimit) / 1e6);
    const passphrase = await maskedBackupPassword('collection');
    if (passphrase.length < 20 || !/\p{L}/u.test(passphrase)) throw new Error('BACKUP_PASSWORD_TOO_WEAK');
    const recovery = await verifyPortableRecovery(encrypted, passphrase, wallet, { detailedErrors: true });
    if (recovery.fuelAddress !== fuelAddress) throw new Error('BACKUP_WALLET_MISMATCH');
    if (candidate !== backupFile && encrypted !== original) await replaceEncryptedBackup(backupFile, encrypted, backupDigest(original));
    const policy = await authorizeCollection({ file, ...context, limits, backupFile, returnedFile, passphrase });
    console.log('COLLECTION_SERVICE_AUTHORIZED: verified recovery and bounded policy stored with Windows protection.');
    console.log('Fuel address:', policy.fuelAddress);
    console.log('Confirmed fuel / startup reserve (TRX):', Number(await trxBalance(client, fuelAddress)) / 1e6, '/', (policy.feeLimit + 3_000_000) / 1e6);
    return;
  }
  const policy = await readCollectionAuthorization(file, context);
  if (mode === '--resume') {
    await fs.unlink(stopFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
    console.log('COLLECTION_START_PERMITTED');
    return;
  }
  if (mode === '--check') {
    console.log(JSON.stringify({ authorized: true, treasury, fuelAddress, recoveryVerified: true,
      confirmedFuelTrx: Number(await trxBalance(client, fuelAddress)) / 1e6, startupFuelReserveTrx: (policy.feeLimit + 3_000_000) / 1e6,
      feeLimitTrx: policy.feeLimit / 1e6, dailyEnergyLimitTrx: Number(policy.feeDailyLimit) / 1e6,
      dailyFundingLimitTrx: Number(policy.gasDailyLimit) / 1e6, transactionSigned: false, transactionBroadcast: false }, null, 2));
    return;
  }
  const secret = await readVault(vaultFile);
  const branch = HDNodeWallet.fromPhrase(secret.mnemonic, '', BRANCH_PATH);
  if (branch.neuter().extendedKey !== wallet.xpub || secret.treasuryAddress !== treasury) throw new Error('BACKUP_WALLET_MISMATCH');
  const gasKey = HDNodeWallet.fromPhrase(secret.mnemonic, '', "m/44'/195'/1'/0/0");
  const gasWallet = { address: tronAddress(gasKey.address.slice(2)), privateKey: gasKey.privateKey.slice(2) };
  if (gasWallet.address !== fuelAddress) throw new Error('BACKUP_WALLET_MISMATCH');
  const journal = new SignerJournal(vaultFile + '.signer');
  const statusFile = workerStatusFile(process.env.TASKMALL_DATA_DIR || path.join(__dirname, '..', 'data'));
  let stopped = false;
  let wake;
  const stop = () => { stopped = true; wake?.(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const worker = new CollectionWorker({ operator, client, wallet, treasury, branch, gasWallet, journal,
    ...policy, shouldStop: () => stopped || existsSync(stopFile) });
  let lastStatus = { state: 'paused' };
  let heartbeatQueue = Promise.resolve();
  const heartbeat = status => {
    lastStatus = status;
    const next = heartbeatQueue.then(() => writeWorkerStatus(statusFile, { treasury, fuelAddress, recoveryVerified: true,
      feeLimitSun: policy.feeLimit, feeDailyLimitSun: policy.feeDailyLimit, gasDailyLimitSun: policy.gasDailyLimit, ...status }));
    heartbeatQueue = next.catch(() => {});
    return next;
  };
  const heartbeatTimer = setInterval(() => { heartbeat(lastStatus).catch(stop); }, 30_000);
  heartbeatTimer.unref();
  try {
    await heartbeat({ state: 'paused' });
    console.log('Collection service started for', treasury);
    while (!stopped) {
      try { await fs.access(stopFile); stop(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (stopped) break;
      let status;
      try {
        status = await collectionServiceCycle({ worker, operator, policy, shouldStop: () => stopped || existsSync(stopFile),
          fuelBalance: () => trxBalance(client, fuelAddress),
          checkAuthorization: () => readCollectionAuthorization(file, context) });
      } catch (error) {
        const reasons = ['COLLECTION_AUTHORIZATION_REQUIRED', 'COLLECTION_AUTHORIZATION_CHANGED', 'COLLECTION_BACKUP_CHANGED', 'OFFLINE_BACKUP_COPY_NOT_VERIFIED',
          'COLLECTION_LIMIT_EXCEEDS_BACKEND_CAP', 'TREASURY_CONFIGURATION_MISMATCH'];
        status = { state: 'paused', reason: reasons.includes(error.message) ? error.message : 'CONFIGURATION_OR_NETWORK_UNAVAILABLE', results: [] };
      }
      await heartbeat(status);
      console.log(new Date().toISOString(), status.state, status.reason || '', ...status.results.map(result => result.id + ':' + result.status));
      if (!stopped) await new Promise(resolve => {
        const timer = setTimeout(resolve, 30_000);
        wake = () => { clearTimeout(timer); resolve(); };
      });
    }
  } finally { clearInterval(heartbeatTimer); journal.close(); await heartbeat({ state: 'stopped' }); }
}

main().catch(error => {
  const reasons = ['INVALID_SERVICE_OPTIONS', 'PRIVATE_TERMINAL_REQUIRED', 'RAILWAY_OPERATOR_IDENTITY_REQUIRED',
    'RAILWAY_OPERATOR_UNAVAILABLE', 'COLLECTION_AUTHORIZATION_REQUIRED', 'COLLECTION_BACKUP_CHANGED',
    'IPHONE_RETURN_NOT_VERIFIED', 'BACKUP_PASSWORD_NOT_ACCEPTED', 'BACKUP_PASSWORD_TOO_WEAK',
    'BACKUP_PASSWORD_ENTRY_CANCELLED', 'BACKUP_PASSWORD_DIALOG_TIMED_OUT', 'BACKUP_WALLET_MISMATCH', 'PENDING_BACKUP_NOT_UNIQUE'];
  console.error('Collection service:', reasons.includes(error.message) ? error.message : 'CONFIGURATION_OR_RECOVERY_UNAVAILABLE');
  process.exitCode = 1;
});

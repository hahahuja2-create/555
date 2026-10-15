'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { addressHex } = require('./tron');
const { windowsProtection } = require('./vault');
const { readEncryptedBackup } = require('./iphone-backup');
const { verifiedOfflineCopy } = require('./offline-backup');
const { validateCollectionLimits, verifyPortableRecovery } = require('./collection-activation');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function railwayScope(env = process.env) {
  const scope = { project: env.TASKMALL_RAILWAY_PROJECT_ID, service: env.TASKMALL_RAILWAY_SERVICE_ID,
    environment: env.TASKMALL_RAILWAY_ENVIRONMENT_ID };
  if (!Object.values(scope).every(value => uuid.test(value || ''))) throw new Error('RAILWAY_OPERATOR_IDENTITY_REQUIRED');
  return scope;
}

function authorizationFile(vaultFile) { return vaultFile + '.collection-authorization'; }

function checkPolicy(policy, { wallet, treasury, fuelAddress, scope, backendFeeLimit, now = Date.now() }) {
  try {
    if (policy.version !== 1 || policy.walletDigest !== digest(wallet.xpub) || policy.treasury !== treasury
      || policy.fuelAddress !== fuelAddress || policy.gasEnabled !== true || policy.recoveryVerified !== true
      || !/^[a-f0-9]{64}$/.test(policy.backupDigest) || !Number.isSafeInteger(policy.authorizedAt)
      || policy.authorizedAt > now + 5000 || !path.isAbsolute(policy.backupFile) || !path.isAbsolute(policy.returnedFile)
      || !scope || Object.keys(scope).length !== 3 || Object.keys(policy.scope || {}).length !== 3
      || !Object.entries(scope).every(([key, value]) => uuid.test(value || '') && policy.scope[key] === value)) throw new Error();
    addressHex(treasury);
    addressHex(fuelAddress);
    return { ...policy, ...validateCollectionLimits(policy.feeLimit, policy.feeDailyLimit, policy.gasDailyLimit, backendFeeLimit, true) };
  } catch { throw new Error('COLLECTION_AUTHORIZATION_INVALID'); }
}

async function verifyAuthorizedBackup(policy) {
  const encrypted = await readEncryptedBackup(policy.backupFile);
  if (digest(encrypted) !== policy.backupDigest) throw new Error('COLLECTION_BACKUP_CHANGED');
  await verifiedOfflineCopy(policy.backupFile, policy.returnedFile);
}

async function authorizeCollection({ file, wallet, treasury, fuelAddress, scope, limits, backendFeeLimit,
  backupFile, returnedFile, passphrase, protector = windowsProtection, now = Date.now() }) {
  if (typeof passphrase !== 'string' || passphrase.length < 20 || !/\p{L}/u.test(passphrase)) throw new Error('BACKUP_PASSWORD_TOO_WEAK');
  const encrypted = await verifiedOfflineCopy(backupFile, returnedFile);
  const recovery = await verifyPortableRecovery(encrypted, passphrase, wallet, { detailedErrors: true });
  if (recovery.fuelAddress !== fuelAddress) throw new Error('BACKUP_WALLET_MISMATCH');
  const policy = checkPolicy({ version: 1, walletDigest: digest(wallet.xpub), treasury, fuelAddress, scope,
    ...limits, gasEnabled: true, recoveryVerified: true, backupDigest: recovery.backupDigest,
    backupFile: path.resolve(backupFile), returnedFile: path.resolve(returnedFile), authorizedAt: now },
  { wallet, treasury, fuelAddress, scope, backendFeeLimit, now });
  await verifyAuthorizedBackup(policy);
  const plaintext = Buffer.from(JSON.stringify(policy));
  let sealed;
  try { sealed = await protector.protect(plaintext); } finally { plaintext.fill(0); }
  const temporary = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const output = await fs.open(temporary, 'wx', 0o600);
    try { await output.writeFile(JSON.stringify({ version: 1, protection: 'windows-dpapi-current-user', sealed: sealed.toString('base64') })); await output.sync(); }
    finally { await output.close(); }
    await fs.rename(temporary, file);
  } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return policy;
}

async function readCollectionAuthorization(file, context, protector = windowsProtection) {
  let plaintext;
  let policy;
  try {
    const info = await fs.lstat(file);
    if (!info.isFile() || info.size < 1 || info.size > 1_000_000) throw new Error();
    const envelope = JSON.parse(await fs.readFile(file, 'utf8'));
    if (envelope.version !== 1 || envelope.protection !== 'windows-dpapi-current-user'
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.sealed || '')) throw new Error();
    plaintext = await protector.unprotect(Buffer.from(envelope.sealed, 'base64'));
    policy = checkPolicy(JSON.parse(plaintext.toString('utf8')), context);
  } catch { throw new Error('COLLECTION_AUTHORIZATION_REQUIRED'); }
  finally { plaintext?.fill(0); }
  await verifyAuthorizedBackup(policy);
  return policy;
}

async function collectionServiceCycle({ worker, operator, fuelBalance, policy, checkAuthorization, shouldStop = () => false }) {
  const authorization = await checkAuthorization();
  if (JSON.stringify(authorization) !== JSON.stringify(policy)) throw new Error('COLLECTION_AUTHORIZATION_CHANGED');
  const remote = await operator('collections');
  validateCollectionLimits(policy.feeLimit, policy.feeDailyLimit, policy.gasDailyLimit, remote.feeLimitSun, true);
  if (remote.treasury !== policy.treasury || !Array.isArray(remote.collections)) throw new Error('TREASURY_CONFIGURATION_MISMATCH');
  if (shouldStop()) return { state: 'stopped', results: [] };
  const balance = await fuelBalance();
  const minimum = BigInt(policy.feeLimit) + 3_000_000n;
  // Already funded/signed jobs can finish even when the fuel wallet runs low.
  if (balance < minimum && remote.collections.length === 0) return { state: 'waiting-for-fuel', fuelBalanceSun: balance.toString(), results: [] };
  const results = await worker.cycle();
  const progressed = results.some(result => ['awaiting-confirmation', 'awaiting-gas-confirmation'].includes(result.status));
  return { state: !results.length || progressed ? 'running' : results.some(result => result.status === 'GAS_WALLET_REQUIRES_TRX') ? 'waiting-for-fuel' : 'paused',
    fuelBalanceSun: balance.toString(), results };
}

module.exports = { railwayScope, authorizationFile, checkPolicy, verifyAuthorizedBackup, authorizeCollection,
  readCollectionAuthorization, collectionServiceCycle };

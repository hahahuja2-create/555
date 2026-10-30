'use strict';

// Provisioning is intentionally local. This module does not send transactions or
// change the deposit wallet, database, treasury settings, or production secrets.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Wallet } = require('ethers');
const { tronAddress } = require('./tron');
const { windowsProtection } = require('./vault');

const addressOf = wallet => tronAddress(wallet.address.slice(2));

async function writeNew(file, content) {
  const handle = await fs.open(file, 'wx', 0o600);
  try { await handle.writeFile(content); await handle.sync(); }
  finally { await handle.close(); }
}

async function provisionWorkingWallet({ directory, password, protector = windowsProtection, createWallet = () => Wallet.createRandom() }) {
  if (!path.isAbsolute(directory)) throw new Error('WORKING_WALLET_ABSOLUTE_PATH_REQUIRED');
  if (typeof password !== 'string' || password.length < 20 || !/\p{L}/u.test(password)) throw new Error('WORKING_WALLET_PASSWORD_TOO_WEAK');
  await fs.mkdir(directory, { recursive: true });
  const backup = path.join(directory, 'working-wallet.keystore.json');
  const vault = path.join(directory, 'working-wallet.vault.json');
  for (const file of [backup, vault]) {
    try { await fs.lstat(file); throw new Error('WORKING_WALLET_ALREADY_EXISTS'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const wallet = createWallet();
  const address = addressOf(wallet);
  const encrypted = await wallet.encrypt(password);
  const restored = await Wallet.fromEncryptedJson(encrypted, password);
  if (addressOf(restored) !== address || restored.privateKey !== wallet.privateKey) throw new Error('WORKING_WALLET_RECOVERY_FAILED');
  const plaintext = Buffer.from(JSON.stringify({ version: 1, address, privateKey: wallet.privateKey }), 'utf8');
  let sealed;
  try { sealed = await protector.protect(plaintext); }
  finally { plaintext.fill(0); }
  const document = JSON.stringify({ version: 1, protection: 'windows-dpapi-current-user', sealed: sealed.toString('base64') });
  // Write the portable encrypted recovery copy first. A partial failure never
  // silently replaces or regenerates a wallet on a subsequent run.
  await writeNew(backup, encrypted);
  await writeNew(vault, document);
  const recoveredBytes = await protector.unprotect(Buffer.from(JSON.parse(await fs.readFile(vault, 'utf8')).sealed, 'base64'));
  try {
    const recovered = JSON.parse(recoveredBytes.toString('utf8'));
    if (recovered.version !== 1 || recovered.address !== address || addressOf(new Wallet(recovered.privateKey)) !== address) throw new Error('WORKING_WALLET_RECOVERY_FAILED');
  } finally { recoveredBytes.fill(0); }
  if (crypto.createHash('sha256').update(await fs.readFile(backup)).digest('hex') !== crypto.createHash('sha256').update(encrypted).digest('hex')) throw new Error('WORKING_WALLET_RECOVERY_FAILED');
  return { address, backup, vault };
}

module.exports = { provisionWorkingWallet };

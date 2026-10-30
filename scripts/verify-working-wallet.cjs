'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Wallet, HDNodeWallet } = require('ethers');
const { tronAddress } = require('../payments/tron');
const { provisionWorkingWallet } = require('../payments/working-wallet');

test('working wallet creation stores recoverable encrypted material and never replaces an existing wallet', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portgainy-working-wallet-'));
  t.after(async () => {
    const real = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(real).toLowerCase(), temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('portgainy-working-wallet-'));
    await fs.rm(real, { recursive: true, force: true });
  });
  // Public fixture; these keys and addresses must never hold real funds.
  const fixture = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk');
  const encryptionKey = crypto.randomBytes(32);
  const protector = {
    async protect(bytes) {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    async unprotect(bytes) {
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    }
  };
  const password = 'Fixture password never used in production';
  await assert.rejects(provisionWorkingWallet({ directory, password: 'short', protector }), /PASSWORD_TOO_WEAK/);
  const created = await provisionWorkingWallet({ directory, password, protector, createWallet: () => fixture });
  assert.equal(created.address, tronAddress(fixture.address.slice(2)));
  const encrypted = await fs.readFile(created.backup, 'utf8');
  const vault = await fs.readFile(created.vault, 'utf8');
  assert.ok(!encrypted.includes(fixture.privateKey.slice(2)) && !vault.includes(fixture.privateKey.slice(2)));
  assert.equal((await Wallet.fromEncryptedJson(encrypted, password)).address, fixture.address);
  await assert.rejects(Wallet.fromEncryptedJson(encrypted, 'incorrect password'));
  await assert.rejects(provisionWorkingWallet({ directory, password, protector }), /ALREADY_EXISTS/);
  assert.equal(await fs.readFile(created.backup, 'utf8'), encrypted);
  assert.equal(await fs.readFile(created.vault, 'utf8'), vault);
});

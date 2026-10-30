'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { HDNodeWallet } = require('ethers');
const { BRANCH_PATH, deriveAddress, tronAddress } = require('../payments/tron');
const { authorizeCollection, readCollectionAuthorization, checkPolicy, collectionServiceCycle } = require('../payments/collection-service');
const { readWorkerStatus, writeWorkerStatus } = require('../payments/collection-activation');

// Public, isolated fixtures; these addresses must never be funded.
const phrase = 'test test test test test test test test test test test junk';
const branch = HDNodeWallet.fromPhrase(phrase, '', BRANCH_PATH);
const wallet = { xpub: branch.neuter().extendedKey };
const treasury = deriveAddress(wallet.xpub, 9);
const fuelAddress = tronAddress(HDNodeWallet.fromPhrase(phrase, '', "m/44'/195'/1'/0/0").address.slice(2));
const scope = { project: '11111111-1111-1111-1111-111111111111', service: '22222222-2222-2222-2222-222222222222', environment: '33333333-3333-3333-3333-333333333333' };
const limits = { feeLimit: 20_000_000, feeDailyLimit: '40000000', gasDailyLimit: '50000000', gasEnabled: true };
const context = { wallet, treasury, fuelAddress, scope, backendFeeLimit: 20_000_000 };
const protector = { protect: async bytes => Buffer.from(bytes), unprotect: async bytes => Buffer.from(bytes) };

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskmall-service-test-'));
  t.after(async () => {
    assert.equal(path.dirname(await fs.realpath(directory)).toLowerCase(), (await fs.realpath(os.tmpdir())).toLowerCase());
    assert.ok(path.basename(directory).startsWith('taskmall-service-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const backupFile = path.join(directory, 'backup.keystore.json');
  const returnedFile = path.join(directory, 'returned.keystore.json');
  const file = path.join(directory, 'authorization');
  const passphrase = 'Public collection service fixture password';
  const encrypted = await branch.deriveChild(0).encrypt(passphrase);
  await fs.writeFile(backupFile, encrypted);
  await fs.writeFile(returnedFile, encrypted);
  return { file, backupFile, returnedFile, passphrase, encrypted, protector, limits, ...context };
}

test('protected collection policy requires independent recovery and survives a restart without retaining recovery secrets', { timeout: 60_000 }, async t => {
  const options = await fixture(t);
  const policy = await authorizeCollection(options);
  assert.deepEqual(await readCollectionAuthorization(options.file, context, protector), policy);
  const stored = await fs.readFile(options.file, 'utf8');
  const plaintext = Buffer.from(JSON.parse(stored).sealed, 'base64').toString('utf8');
  assert.ok(!plaintext.includes(phrase));
  assert.ok(!plaintext.includes(options.passphrase));
  assert.ok(!plaintext.includes('privateKey'));
  await assert.rejects(readCollectionAuthorization(options.file, { ...context, treasury: deriveAddress(wallet.xpub, 8) }, protector), /AUTHORIZATION_REQUIRED/);
  await assert.rejects(readCollectionAuthorization(options.file, { ...context, scope: { ...scope, service: scope.project } }, protector), /AUTHORIZATION_REQUIRED/);
  await assert.rejects(readCollectionAuthorization(options.file, { ...context, backendFeeLimit: 10_000_000 }, protector), /AUTHORIZATION_REQUIRED/);
  await fs.writeFile(options.returnedFile, options.encrypted + ' ');
  await assert.rejects(readCollectionAuthorization(options.file, context, protector), /COPY_NOT_VERIFIED/);
  await fs.writeFile(options.returnedFile, options.encrypted);
  await fs.writeFile(options.backupFile, options.encrypted + ' ');
  await assert.rejects(readCollectionAuthorization(options.file, context, protector), /BACKUP_CHANGED/);
});

test('wrong recovery passwords and same-file exports never create an automatic collection policy', { timeout: 60_000 }, async t => {
  const options = await fixture(t);
  await assert.rejects(authorizeCollection({ ...options, passphrase: 'incorrect fixture password' }), /PASSWORD_NOT_ACCEPTED/);
  await assert.rejects(authorizeCollection({ ...options, passphrase: '123456781234567812345678' }), /PASSWORD_TOO_WEAK/);
  await assert.rejects(authorizeCollection({ ...options, returnedFile: options.backupFile }), /COPY_NOT_VERIFIED/);
  await assert.rejects(fs.access(options.file), { code: 'ENOENT' });
});

test('modified limits, identity and recovery fields invalidate authorization', { timeout: 60_000 }, async t => {
  const options = await fixture(t);
  const policy = await authorizeCollection(options);
  for (const change of [{ feeLimit: 30_000_000 }, { feeDailyLimit: '1' }, { gasDailyLimit: '1' }, { recoveryVerified: false },
    { walletDigest: '0'.repeat(64) }, { authorizedAt: Date.now() + 60_000 }, { scope: {} }, { backupFile: 'relative.json' }, { gasEnabled: false }]) {
    assert.throws(() => checkPolicy({ ...policy, ...change }, context), /AUTHORIZATION_INVALID/);
  }
});

test('zero fuel blocks planning and sending; funded or signed work can finish with low remaining fuel', async () => {
  let cycles = 0;
  const policy = { ...limits, treasury };
  const worker = { cycle: async () => { cycles++; return [{ id: 'fixture-job', status: 'awaiting-confirmation' }]; } };
  const dependencies = { policy, worker, operator: async () => ({ treasury, feeLimitSun: 20_000_000, collections: [] }),
    fuelBalance: async () => 0n, checkAuthorization: async () => policy };
  assert.equal((await collectionServiceCycle(dependencies)).state, 'waiting-for-fuel');
  assert.equal(cycles, 0);
  assert.equal((await collectionServiceCycle({ ...dependencies, fuelBalance: async () => 23_000_000n })).state, 'running');
  assert.equal(cycles, 1);
  assert.equal((await collectionServiceCycle({ ...dependencies,
    operator: async () => ({ treasury, feeLimitSun: 20_000_000, collections: [{ status: 'signed' }] }) })).state, 'running');
  assert.equal(cycles, 2);
  await assert.rejects(collectionServiceCycle({ ...dependencies, checkAuthorization: async () => { throw new Error('REVOKED'); } }), /REVOKED/);
  await assert.rejects(collectionServiceCycle({ ...dependencies, checkAuthorization: async () => ({ ...policy, feeDailyLimit: '20000000' }) }), /AUTHORIZATION_CHANGED/);
  assert.equal((await collectionServiceCycle({ ...dependencies, shouldStop: () => true })).state, 'stopped');
  await assert.rejects(collectionServiceCycle({ ...dependencies, operator: async () => ({ treasury, feeLimitSun: 1_000_000, collections: [] }) }), /EXCEEDS_BACKEND/);
  assert.equal(cycles, 2);
});

test('mixed collection results preserve progress while wholly blocked queues remain paused', async () => {
  const policy = { ...limits, treasury };
  const dependencies = { policy, operator: async () => ({ treasury, feeLimitSun: 20_000_000, collections: [{ status: 'planned' }] }),
    fuelBalance: async () => 0n, checkAuthorization: async () => policy };
  for (const [statuses, expected] of [
    [['PAUSED_FOR_REVIEW', 'awaiting-confirmation'], 'running'],
    [['GAS_WALLET_REQUIRES_TRX', 'awaiting-gas-confirmation'], 'running'],
    [['PAUSED_FOR_REVIEW'], 'paused'],
    [['GAS_WALLET_REQUIRES_TRX'], 'waiting-for-fuel']
  ]) {
    const worker = { cycle: async () => statuses.map((status, id) => ({ id: String(id), status })) };
    assert.equal((await collectionServiceCycle({ ...dependencies, worker })).state, expected);
  }
});

test('paused and unfunded services remain observable without claiming that sending is enabled', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskmall-service-test-'));
  t.after(async () => {
    assert.equal(path.dirname(await fs.realpath(directory)).toLowerCase(), (await fs.realpath(os.tmpdir())).toLowerCase());
    assert.ok(path.basename(directory).startsWith('taskmall-service-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, 'status.json');
  for (const state of ['waiting-for-fuel', 'paused', 'running']) {
    await writeWorkerStatus(file, { state, recoveryVerified: true });
    const status = await readWorkerStatus(file);
    assert.equal(status.running, true);
    assert.equal(status.state, state);
    assert.equal(status.sendingEnabled, state === 'running');
  }
  await writeWorkerStatus(file, { state: 'stopped' });
  assert.equal((await readWorkerStatus(file)).running, false);
});

test('collection password dialog validates public inputs locally without changing other recovery dialogs', { skip: process.platform !== 'win32' }, () => {
  const script = `
    $ErrorActionPreference = 'Stop'
    $tokens = $null; $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PWD 'scripts/backup-password.ps1'), [ref] $tokens, [ref] $errors)
    if ($errors.Count) { throw 'Password dialog syntax failed.' }
    $definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'New-BackupPasswordForm' }, $false)
    . ([ScriptBlock]::Create($definition.Extent.Text))
    foreach ($context in @('original', 'returned', 'retry', 'new', 'collection')) {
      $controls = New-BackupPasswordForm $context
      try {
        foreach ($sample in @('', 'Short fixture', '111111111111111111111111', 'Public collection fixture password')) {
          $controls.PasswordBox.Text = $sample
          if ($null -ne $controls.ConfirmationBox) { $controls.ConfirmationBox.Text = $sample }
          $expected = $sample.Length -gt 0
          if ($context -in @('new', 'collection')) { $expected = $sample.Length -ge 20 -and $sample -match '\\p{L}' }
          if ($controls.ContinueButton.Enabled -ne $expected) { throw 'Password validation mismatch.' }
        }
        if ($context -eq 'collection') {
          if ($null -ne $controls.ConfirmationBox -or $controls.ValidationLabel.Bottom -ge $controls.ContinueButton.Top -or
            $controls.ContinueButton.Bottom -gt $controls.Form.ClientSize.Height) { throw 'Collection dialog layout mismatch.' }
        }
      } finally { $controls.Form.Dispose() }
    }
    Write-Output 'PRIVATE_DIALOG_FIXTURES_PASSED'
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  assert.equal(result.status, 0, 'Isolated password dialog fixtures failed: ' + (result.error?.message || result.stderr));
  assert.match(result.stdout, /PRIVATE_DIALOG_FIXTURES_PASSED/);
});

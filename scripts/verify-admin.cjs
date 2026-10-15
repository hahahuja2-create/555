'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { HDNodeWallet } = require('ethers');
const { BRANCH_PATH, deriveAddress, proofMessage } = require('../payments/tron');

const root = path.resolve(__dirname, '..');
// Public test key material only. Never fund any address derived here.
const branch = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', '', BRANCH_PATH);
const xpub = branch.neuter().extendedKey;
const treasury = 'TZBZHkdrwv6xrGzRR9a1WqStf3oEmtjDvw';
const destination = deriveAddress(xpub, 7);

function account(id, email, password, balances = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { id, email, name: email.split('@')[0], passwordSalt: salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex'),
    lockedBalance: 0, withdrawBalance: 0, reservedBalance: 0, earnedTotal: 0, withdrawnTotal: 0, withdrawFeeTotal: 0, activities: [],
    vipId: 'free', createdAt: new Date().toISOString(), ...balances };
}

async function boot(t, { env = {}, users, chain = false, omit = [] }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskmall-admin-'));
  const settings = { NODE_ENV: 'test', PORT: '0', HOST: '127.0.0.1', PUBLIC_ORIGIN: '', TRON_AUTO_WALLET: '', TASKMALL_TEST_WALLET: '',
    TASKMALL_OPERATOR_ENABLED: '', TASKMALL_OPERATOR_TOKEN: '', TRON_DEPOSITS_ENABLED: '', TASKMALL_SQLITE: '', TASKMALL_MYSQL_TEST: '',
    TRON_WALLET_PUBLIC_JSON: '', TRON_MANUAL_WITHDRAWALS_ENABLED: '', TASKMALL_TRON_FIXTURE: '', TASKMALL_DATA_DIR: directory, ...env };
  if (users) await fs.writeFile(path.join(directory, 'db.json'), JSON.stringify({ users }));
  if (chain) {
    const walletFile = path.join(directory, 'wallet.json');
    const fixtureFile = path.join(directory, 'chain.json');
    await fs.writeFile(walletFile, JSON.stringify({ version: 1, network: 'tron-mainnet', branchPath: BRANCH_PATH, xpub, treasuryAddress: treasury,
      firstAddress: deriveAddress(xpub, 0), proof: await branch.deriveChild(0).signMessage(proofMessage(xpub, treasury)) }));
    await fs.writeFile(fixtureFile, JSON.stringify({ history: {}, receipts: {} }));
    // Chain monitoring always runs against the local fixture, never the real TronGrid service.
    Object.assign(settings, { TASKMALL_SQLITE: '1', TRON_DEPOSITS_ENABLED: '1', TRON_MANUAL_WITHDRAWALS_ENABLED: '1', TRON_TREASURY_ADDRESS: treasury,
      TRONGRID_API_KEY: 'fixture-only', TRON_TEST_POLL_MS: '100', TRON_WALLET_PUBLIC_FILE: walletFile, TASKMALL_TRON_FIXTURE: fixtureFile });
  }
  const childEnv = { ...process.env, ...settings };
  for (const name of omit) delete childEnv[name];
  const child = spawn(process.execPath, [...(chain ? ['--require', './scripts/tron-fixture-preload.cjs'] : []), 'server.js'],
    { cwd: root, windowsHide: true, stdio: 'pipe', env: childEnv });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => {
    if (child.exitCode === null) child.kill();
    await exited;
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(directory).startsWith('taskmall-admin-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errors)), 10_000);
    child.stdout.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    exited.then(() => { clearTimeout(timer); reject(new Error(errors)); });
  });
  const request = async (route, body, headers = {}) => {
    const response = await fetch(url + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const login = async (email, password) => {
    const result = await request('/api/auth/login', { email, password });
    assert.equal(result.status, 200, `${email} signs in`);
    return { cookie: result.headers.get('set-cookie').split(';')[0], user: result.body.user };
  };
  return { url, request, login };
}

test('only the configured admin email gets the Admin page, hahahuja2@gmail.com by default', async t => {
  const { request } = await boot(t, { omit: ['TASKMALL_ADMIN_EMAILS'] });
  const admin = await request('/api/auth/signup', { email: 'HahaHuja2@gmail.com', password: 'AdminTest2026' });
  const other = await request('/api/auth/signup', { email: 'someone@test.invalid', password: 'CustomerTest2026' });
  assert.equal(admin.body.user.isAdmin, true);
  assert.equal(other.body.user.isAdmin, false);
  const adminCookie = { Cookie: admin.headers.get('set-cookie').split(';')[0] };
  const otherCookie = { Cookie: other.headers.get('set-cookie').split(';')[0] };
  assert.equal((await request('/api/admin/overview')).status, 401);
  assert.deepEqual((await request('/api/admin/overview', undefined, otherCookie)).body, { error: 'ADMIN_REQUIRED' });
  const overview = (await request('/api/admin/overview', undefined, adminCookie)).body;
  assert.deepEqual(overview.users.map(user => user.email).sort(), ['hahahuja2@gmail.com', 'someone@test.invalid']);
  assert.deepEqual(overview.withdrawals, []);
});

test('admin sees every account and marks manual payouts paid; customers see under review, then confirmed', async t => {
  const customerPassword = 'CustomerTest2026';
  const adminPassword = 'AdminTest2026';
  const server = await boot(t, { chain: true, env: { TASKMALL_ADMIN_EMAILS: 'admin@test.invalid' }, users: [
    account('admin-a', 'admin@test.invalid', adminPassword),
    account('customer-a', 'customer@test.invalid', customerPassword, { lockedBalance: 30, withdrawBalance: 100, earnedTotal: 100, vipId: 'vip1',
      vipStartedAt: new Date().toISOString(), vipExpiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() })
  ] });
  const { request, url } = server;
  for (let i = 0; i < 60 && !(await request('/api/payment-config')).body.available; i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await request('/api/payment-config')).body.withdrawalsAvailable, true, 'the admin account alone can review withdrawals');

  const customer = await server.login('customer@test.invalid', customerPassword);
  const admin = await server.login('admin@test.invalid', adminPassword);
  assert.equal(customer.user.isAdmin, false);
  assert.equal(admin.user.isAdmin, true);
  const asCustomer = { Cookie: customer.cookie };
  const asAdmin = { Cookie: admin.cookie };
  const withdraw = amount => request('/api/wallet/withdraw', { amount, wallet: destination, network: 'trc20', password: customerPassword, requestKey: crypto.randomUUID() }, asCustomer);
  const first = (await withdraw('10')).body.withdrawal.id;
  const second = (await withdraw('12')).body.withdrawal.id;
  const customerStatus = async id => (await request('/api/wallet/withdrawals', undefined, asCustomer)).body.withdrawals.find(row => row.id === id).status;
  assert.equal(await customerStatus(first), 'requested');

  assert.equal((await request('/api/admin/overview', undefined, asCustomer)).status, 403);
  assert.equal((await request(`/api/admin/withdrawals/${first}/confirm`, {}, asCustomer)).status, 403, 'a customer cannot confirm');
  assert.equal((await request(`/api/admin/withdrawals/${first}/confirm`, {}, { ...asAdmin, Origin: 'https://attacker.invalid' })).status, 403);

  const overview = (await request('/api/admin/overview', undefined, asAdmin)).body;
  assert.equal(JSON.stringify(overview).includes('passwordHash'), false);
  assert.equal(JSON.stringify(overview).includes('passwordSalt'), false);
  const row = overview.users.find(user => user.email === 'customer@test.invalid');
  assert.deepEqual([row.vipName, row.vipActive, row.lockedBalance, row.withdrawBalance, row.reservedBalance, row.earnedTotal],
    ['VIP 1', true, 30, 78, 22, 100]);
  const request10 = overview.withdrawals.find(item => item.id === first);
  assert.deepEqual([request10.email, request10.destination, request10.amount, request10.fee, request10.netAmount, request10.status],
    ['customer@test.invalid', destination, 10, 1, 9, 'requested']);

  const confirmed = await request(`/api/admin/withdrawals/${first}/confirm`, {}, asAdmin);
  assert.equal(confirmed.status, 200);
  assert.deepEqual([confirmed.body.withdrawal.status, confirmed.body.withdrawal.txid], ['confirmed', null]);
  assert.equal((await request(`/api/admin/withdrawals/${first}/confirm`, {}, asAdmin)).body.withdrawal.status, 'confirmed', 'a second click changes nothing');
  assert.equal(await customerStatus(first), 'confirmed');
  let me = (await request('/api/me', undefined, asCustomer)).body.user;
  assert.deepEqual([me.withdrawBalance, me.reservedBalance, me.withdrawnTotal, me.withdrawFeeTotal], [78, 12, 9, 1]);
  assert.equal((await request('/api/activity', undefined, asCustomer)).body.activities.find(item => item.id === first).status, 'confirmed');

  assert.equal((await request(`/api/admin/withdrawals/${second}/reject`, {}, asAdmin)).body.withdrawal.status, 'rejected');
  assert.equal((await request(`/api/admin/withdrawals/${second}/confirm`, {}, asAdmin)).body.error, 'WITHDRAWAL_ALREADY_IN_PROGRESS');
  me = (await request('/api/me', undefined, asCustomer)).body.user;
  assert.deepEqual([me.withdrawBalance, me.reservedBalance, me.withdrawnTotal], [90, 0, 9], 'rejection returns the reserved amount');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(await customerStatus(first), 'confirmed', 'chain monitoring leaves a manual payout alone');

  const third = (await withdraw('20')).body.withdrawal.id;
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const output = path.join(root, 'artifacts', 'admin');
  await fs.mkdir(output, { recursive: true });
  const open = async (cookie, viewport) => {
    const context = await browser.newContext({ viewport });
    await context.addCookies([{ name: 'taskmall_session', value: cookie.split('=')[1], url }]);
    await context.addInitScript(() => localStorage.setItem('taskmall_language', 'ka'));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    return { page, pageErrors };
  };

  const shopper = await open(customer.cookie, { width: 390, height: 844 });
  await shopper.page.goto(url + '/#wallet');
  await shopper.page.locator('.wallet-command-bar').waitFor();
  assert.equal(await shopper.page.locator('[data-view="admin"]').count(), 0, 'customers never see the Admin page');
  assert.match(await shopper.page.locator('.withdrawal-state').first().textContent(), /განხილვაში/);
  await shopper.page.goto(url + '/#admin');
  await shopper.page.locator('.app-shell').waitFor();
  assert.equal(await shopper.page.locator('.admin-page').count(), 0);

  for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    const { page, pageErrors } = await open(admin.cookie, viewport);
    await page.goto(url + '/#admin');
    await page.locator(`tr[data-withdrawal="${third}"]`).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' page has no horizontal scrolling');
    await page.screenshot({ path: path.join(output, `withdrawals-${name}.png`), fullPage: true });
    await page.locator('[data-action="admin-tab"][data-tab="users"]').click();
    await page.locator('tr[data-user="customer-a"]').waitFor();
    assert.equal(await page.locator('tr[data-user]').count(), 2);
    await page.locator('#admin-search').fill('customer@');
    assert.equal(await page.locator('tr[data-user]').count(), 1);
    assert.equal(await page.locator('#admin-search').evaluate(input => input === document.activeElement), true, 'typing keeps focus');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `users-${name}.png`), fullPage: true });
    assert.deepEqual(pageErrors, []);
    if (name === 'desktop') {
      await page.locator('[data-action="admin-tab"][data-tab="withdrawals"]').click();
      const confirm = page.locator(`tr[data-withdrawal="${third}"] [data-action="admin-confirm"]`);
      await confirm.click();
      assert.match(await confirm.textContent(), /დააჭირე ისევ/);
      assert.equal(await customerStatus(third), 'requested', 'the first click only arms the button');
      await confirm.click();
      await page.locator('.toast.success').waitFor();
      await page.locator(`tr[data-withdrawal="${third}"]`).waitFor({ state: 'detached' });
      assert.equal(await customerStatus(third), 'confirmed');
      await page.locator('[data-action="admin-filter"][data-filter="all"]').click();
      assert.match(await page.locator(`tr[data-withdrawal="${third}"] .admin-status`).textContent(), /დადასტურებულია/);
      assert.deepEqual(pageErrors, []);
    }
  }

  await shopper.page.goto(url + '/#wallet');
  await shopper.page.reload();
  await shopper.page.locator('.withdrawal-state').first().waitFor();
  assert.match(await shopper.page.locator('.withdrawal-state').first().textContent(), /დადასტურებულია/);
  assert.deepEqual(shopper.pageErrors, []);
});

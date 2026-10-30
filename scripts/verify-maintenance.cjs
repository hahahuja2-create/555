'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { createMaintenance } = require('../platform-maintenance');

test('maintenance blocks public pages and account operations, then reopens exactly at the deadline', async t => {
  const deadline = Date.parse('2026-10-31T14:00:00.000Z');
  let now = deadline - 1000;
  const maintenance = createMaintenance({ enabled: true, resumesAt: new Date(deadline).toISOString() });
  const server = http.createServer(async (req, res) => {
    if (await maintenance.handle(req, res, new URL(req.url, 'http://localhost'), now)) return;
    res.writeHead(200); res.end('ordinary handler');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/index.html', '/earn', '/referrals?ref=INVITE', '/app.js', '/operator']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 503, route);
    assert.match(await response.text(), /maintenance-title/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('retry-after'), 'Sat, 31 Oct 2026 14:00:00 GMT');
  }
  for (const route of ['/api/me', '/api/auth/login', '/api/earn/claim', '/api/wallet/withdraw']) {
    const response = await fetch(base + route, { method: 'POST' });
    assert.equal(response.status, 503, route);
    assert.equal((await response.json()).error, 'MAINTENANCE_MODE');
  }
  for (const route of ['/api/health', '/api/operator/collections', '/operator/login']) {
    assert.equal(await (await fetch(base + route)).text(), 'ordinary handler');
  }
  for (const route of ['/maintenance.js', '/maintenance.css', '/fonts/arcade/big-shoulders.woff2', '/favicon.svg']) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  const head = await fetch(base, { method: 'HEAD' });
  assert.equal(head.status, 503); assert.equal(await head.text(), '');
  assert.equal((await (await fetch(base + '/api/maintenance')).json()).active, true);
  now = deadline;
  assert.equal(maintenance.isActive(now), false);
  assert.equal(await (await fetch(base)).text(), 'ordinary handler');
  assert.equal((await (await fetch(base + '/api/maintenance')).json()).active, false);
  assert.equal(createMaintenance({ enabled: false, resumesAt: new Date(deadline).toISOString() }).isActive(deadline - 1), false);
});

test('the live server shows only maintenance in English on mobile', {
  skip: Date.now() >= Date.parse(require('../config/platform-maintenance.json').resumesAt) ? 'The scheduled maintenance window has ended.' : false
}, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskmall-maintenance-ui-'));
  const output = path.resolve('artifacts/maintenance-ui'); await fs.mkdir(output, { recursive: true });
  const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '0', PUBLIC_ORIGIN: '',
      TASKMALL_DATA_DIR: directory, MYSQL_URL: '', DATABASE_URL: '', TASKMALL_SQLITE: '', TASKMALL_TEST_WALLET: '', TASKMALL_MAINTENANCE_ENABLED: '1',
      TASKMALL_DESIGN_PREVIEW: '0', TASKMALL_EARN_ENABLED: '0', TASKMALL_SPOT_ENABLED: '0',
      TRON_DEPOSITS_ENABLED: '0', TRON_AUTO_WALLET: '0', TASKMALL_OPERATOR_ENABLED: '0',
      TRON_MANUAL_WITHDRAWALS_ENABLED: '0', BINANCE_CREDENTIAL_FILE: path.join(directory, 'missing') } });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      let errors = ''; const timer = setTimeout(() => reject(new Error('Maintenance fixture startup failed: ' + errors)), 10000);
      child.stderr.on('data', data => { errors += data; });
      child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Maintenance fixture exited: ' + errors)); });
    });
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await fetch(base + '/api/me')).status, 503);
    browser = await chromium.launch();
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(base + '/earn?ref=INVITE'); assert.equal(response.status(), 503);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('time').innerText(), '31 October at 18:00');
    assert.equal(await page.locator('#app, form, .shell').count(), 0);
    assert.equal(await page.locator('script[src*="pg-main.js"]').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow');
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    await page.route('**/api/maintenance', route => route.fulfill({ json: { active: false } }));
    await page.route('**/earn?ref=INVITE', route => route.fulfill({ contentType: 'text/html', body: '<h1>Platform reopened</h1>' }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.getByText('Platform reopened').waitFor();
    await context.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (child.exitCode === null && child.signalCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; }
    assert.equal(path.dirname(await fs.realpath(directory)).toLowerCase(), (await fs.realpath(os.tmpdir())).toLowerCase());
    assert.ok(path.basename(directory).startsWith('taskmall-maintenance-ui-'));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

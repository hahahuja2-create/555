// Smoke test for the Portgainy front end: every screen renders without errors or horizontal overflow.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'portgainy-ui-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '0', PUBLIC_ORIGIN: '', TASKMALL_DATA_DIR: dir, TASKMALL_MAINTENANCE_ENABLED: '0',
      TASKMALL_EARN_ENABLED: '1', TASKMALL_SPOT_ENABLED: '1', MYSQL_URL: '', DATABASE_URL: '', TASKMALL_SQLITE: '', TRON_DEPOSITS_ENABLED: '0' } });
  const base = await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => { const m = /http:\/\/[\d.]+:\d+/.exec(String(chunk)); if (m) resolve(m[0]); });
    child.once('exit', code => reject(new Error(`server exited ${code}`)));
  });
  const browser = await chromium.launch();
  const problems = [];
  try {
    for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 820 }]]) {
      const page = await (await browser.newContext({ viewport })).newPage();
      page.on('pageerror', error => problems.push(`${name}: ${error.message}`));
      page.on('console', m => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) problems.push(`${name}: ${m.text()}`); });
      await page.goto(base);
      assert.match(await page.title(), /Portgainy/);
      await page.click('[data-act="auth-mode"][data-mode="signup"]');
      await page.fill('input[name=email]', `ui-${name}@example.com`);
      await page.fill('input[name=password]', 'UiTestPassword2026');
      await page.fill('input[name=confirm]', 'UiTestPassword2026');
      await page.click('button[type=submit]');
      await page.waitForSelector('.shell');
      if (await page.locator('[data-act="close-sheet"]').first().isVisible().catch(() => false)) await page.locator('.sheet [data-act="close-sheet"]').first().click();
      for (const view of ['home', 'markets', 'trade', 'earn', 'assets', 'referrals', 'profile', 'support', 'about']) {
        await page.evaluate(v => { location.hash = v; }, view);
        await page.waitForSelector(`.shell.view-${view}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) problems.push(`${name}/${view}: horizontal overflow ${overflow}px`);
        const text = await page.locator('#content').innerText();
        if (/undefined|NaN|\[object/.test(text)) problems.push(`${name}/${view}: bad text`);
      }
      await page.click('[data-act="wallet-transfer"]').catch(() => {});
      await page.close();
    }
  } finally {
    await browser.close(); child.kill();
  }
  assert.deepEqual(problems, []);
  console.log('Portgainy UI smoke test passed.');
})().catch(error => { console.error(error); process.exit(1); });

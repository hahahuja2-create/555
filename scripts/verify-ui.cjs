// Smoke test for the Portgainy front end: every screen renders without errors or horizontal overflow.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, webkit } = require('playwright');

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
  const browser = await (process.env.PORTGAINY_TEST_BROWSER === 'webkit' ? webkit : chromium).launch();
  const problems = [];
  try {
    for (const [name, viewport] of [['small-phone', { width: 320, height: 740 }], ['phone', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }], ['desktop', { width: 1366, height: 820 }]]) {
      const touch = name !== 'desktop';
      const page = await (await browser.newContext({ viewport, hasTouch: touch })).newPage();
      const checkEditableSizes = async label => {
        if (!touch) return;
        const small = await page.locator('input:not([type=hidden]):not([type=range]), textarea, select').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => ({id: el.id, name: el.name, size: getComputedStyle(el).fontSize})));
        assert.deepEqual(small, [], `${name}/${label}: editable control font below 16px`);
      };
      page.on('pageerror', error => problems.push(`${name}: ${error.message}`));
      page.on('console', m => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) problems.push(`${name}: ${m.text()}`); });
      await page.goto(base);
      assert.match(await page.title(), /Portgainy/);
      await checkEditableSizes('sign-in');
      await page.click('[data-act="auth-mode"][data-mode="signup"]');
      await checkEditableSizes('sign-up');
      await page.fill('input[name=email]', `ui-${name}@example.com`);
      await page.fill('input[name=password]', 'UiTestPassword2026');
      await page.fill('input[name=confirm]', 'UiTestPassword2026');
      await page.click('button[type=submit]');
      await page.waitForSelector('.shell');
      if (await page.locator('[data-act="close-sheet"]').first().isVisible().catch(() => false)) await page.locator('.sheet [data-act="close-sheet"]').first().click();
      for (const view of ['home', 'markets', 'trade', 'earn', 'assets', 'referrals', 'profile', 'support', 'about']) {
        await page.evaluate(v => { location.hash = v; }, view);
        await page.waitForSelector(`.shell.view-${view}`);
        await checkEditableSizes(view);
        if (view === 'markets') {
          const preserved = await page.evaluate(() => {
            S.markets = [];
            const input = document.querySelector('#market-search'); input.focus();
            acceptMarkets({markets: [{symbol: 'BTCUSDT', base: 'BTC', name: 'Bitcoin', price: 100, change: 1, volume: 1000}], status: 'live'});
            const kept = document.activeElement === input && document.querySelector('#market-search') === input;
            input.blur(); updateTimers();
            return {kept, updated: Boolean(document.querySelector('[data-symbol="BTCUSDT"]'))};
          });
          assert.equal(preserved.kept, true, 'first market update preserves the focused field');
          assert.equal(preserved.updated, true, 'market update appears after editing ends');
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) problems.push(`${name}/${view}: horizontal overflow ${overflow}px`);
        const text = await page.locator('#content').innerText();
        if (/undefined|NaN|\[object/.test(text)) problems.push(`${name}/${view}: bad text`);
      }
      await page.locator('[data-act="open-search"]').click();
      await page.waitForSelector('#global-search');
      await checkEditableSizes('global-search');
      await page.locator('#global-search').fill('BTC');
      assert.equal(await page.locator('#global-search').inputValue(), 'BTC');
      await page.keyboard.press('Escape');
      await page.locator('.sheet-backdrop').waitFor({state: 'detached'});
      await page.evaluate(() => {
        S.pay.withdrawals = true; S.pay.mode = 'tron-watch-only';
        S.pay.networks = [{id: 'test1', label: 'Test 1'}, {id: 'test2', label: 'Test 2'}];
        openSheet(walletSheet('withdraw', ['Withdraw', 'Fixture']));
      });
      await page.locator('.sheet-backdrop.is-open').waitFor();
      await checkEditableSizes('withdraw');
      await page.locator('[name=wallet]').fill('TTestFixtureAddress');
      assert.equal(await page.locator('[name=wallet]').inputValue(), 'TTestFixtureAddress');
      await page.keyboard.press('Escape');
      await page.locator('.sheet-backdrop').waitFor({state: 'detached'});
      await page.evaluate(() => openSheet(walletSheet('transfer', ['Transfer', 'Fixture'])));
      await page.locator('.sheet-backdrop.is-open').waitFor();
      await checkEditableSizes('transfer');
      await page.locator('#wallet-amount').fill('12.5');
      assert.equal(await page.locator('#wallet-amount').inputValue(), '12.5');
      await page.keyboard.press('Escape');
      await page.locator('.sheet-backdrop').waitFor({state: 'detached'});
      await page.evaluate(() => {
        S.user.isAdmin = true;
        S.admin = {users: [{id: 'alice', email: 'alice@example.invalid', name: 'Alice'}, {id: 'bob', email: 'bob@example.invalid', name: 'Bob'}], withdrawals: []};
        S.adminTab = 'users'; S.adminSearch = ''; S.view = 'admin'; render();
        window.originalSearch = document.querySelector('#admin-search');
      });
      await checkEditableSizes('admin-search');
      await page.locator('#admin-search').pressSequentially('alice');
      assert.equal(await page.evaluate(() => document.activeElement === window.originalSearch && document.querySelector('#admin-search') === window.originalSearch), true, 'typing keeps the same focused input');
      assert.equal(await page.locator('#admin-search').inputValue(), 'alice');
      assert.equal(await page.locator('#admin-users-results [data-user]').count(), 1);
      assert.equal(await page.locator('#admin-users-results [data-user]').getAttribute('data-user'), 'alice');
      await page.locator('#admin-search').fill('no-match');
      assert.match(await page.locator('#admin-users-results').innerText(), /No users found/);
      await page.locator('#admin-search').fill('');
      assert.equal(await page.locator('#admin-users-results [data-user]').count(), 2);
      const display = await page.evaluate(() => {
        S.user = {...S.user, id: '05fd1537-af76-49d9-afb0-b11859451ed9', isAdmin: true, earnedTotal: 2.6136};
        S.referrals = {level1: 0, level2: 0}; S.earn = {...S.earn, referralEarned: 0}; S.hide = false;
        const before = JSON.stringify({user: S.user, referrals: S.referrals, earn: S.earn});
        const home = homeView(), referrals = referralsView(), profile = profileView();
        const unchanged = before === JSON.stringify({user: S.user, referrals: S.referrals, earn: S.earn});
        S.user.earnedTotal += 10; S.referrals.level1 = 1; S.referrals.level2 = 2; S.earn.referralEarned = 3;
        const future = [displayEarnedTotal(), displayReferralCount(1), displayReferralCount(2), displayReferralEarned()];
        S.user.id = 'different-admin';
        const other = [displayEarnedTotal(), displayReferralCount(1), displayReferralCount(2), displayReferralEarned(), manualAdminDisplay()];
        S.user.id = '05fd1537-af76-49d9-afb0-b11859451ed9'; S.user.isAdmin = false;
        const nonAdmin = manualAdminDisplay();
        return {home, referrals, profile, unchanged, future, other, nonAdmin};
      });
      assert.match(display.home, /Earned all-time.*4,650\.00/);
      assert.match(display.home, /Level 1 . 10%<\/small><b>5<\/b>/);
      assert.match(display.home, /Level 2 . 5%<\/small><b>12<\/b>/);
      assert.match(display.home, /420\.00/);
      assert.doesNotMatch(display.referrals, /manual display/i);
      assert.doesNotMatch(display.home, /manual display/i);
      assert.match(display.referrals, /5 <small>members/);
      assert.match(display.referrals, /12 <small>members/);
      assert.match(display.profile, /Total earned<\/dt>/);
      assert.equal(display.unchanged, true);
      assert.deepEqual(display.future, [4660, 6, 14, 423]);
      assert.deepEqual(display.other, [12.6136, 1, 2, 3, false]);
      assert.equal(display.nonAdmin, false);
      await page.click('[data-act="wallet-transfer"]', { timeout: 500 }).catch(() => {});
      await page.close();
    }
  } finally {
    await browser.close(); child.kill();
  }
  assert.deepEqual(problems, []);
  console.log('Portgainy UI smoke test passed.');
})().catch(error => { console.error(error); process.exit(1); });

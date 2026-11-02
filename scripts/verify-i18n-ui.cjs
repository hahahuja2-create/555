'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

test('profile language uses account preference, survives reload and returns to English on logout', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pg-i18n-ui-'));
  const child = spawn(process.execPath, ['server.js'], {cwd:root, windowsHide:true, stdio:['ignore','pipe','pipe'], env:{
    ...process.env, NODE_ENV:'test', HOST:'127.0.0.1', PORT:'0', PUBLIC_ORIGIN:'', TASKMALL_DATA_DIR:dir,
    TASKMALL_MAINTENANCE_ENABLED:'0', TASKMALL_EARN_ENABLED:'1', TASKMALL_SPOT_ENABLED:'1',
    MYSQL_URL:'', DATABASE_URL:'', TASKMALL_SQLITE:'', TRON_DEPOSITS_ENABLED:'0', TRON_AUTO_WALLET:'0', TASKMALL_OPERATOR_ENABLED:'0'
  }});
  let browser;
  try {
    const base = await new Promise((resolve,reject) => {
      const timeout = setTimeout(()=>reject(new Error('server startup timed out')),10000);
      child.stdout.on('data', data => { const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
      child.once('exit',()=>{clearTimeout(timeout);reject(new Error('server exited'));});
    });
    const script = (await fs.readFile(path.join(root,'public','pg-i18n.js'),'utf8'))
      .replace("Object.freeze(['en'])", "Object.freeze(['en','ka','ar'])");
    assert.match(script, /Object\.freeze\(\['en','ka','ar'\]\)/);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport:{width:390,height:844} });
    let catalogAvailable = true;
    await page.route('**/pg-i18n.js*', route => route.fulfill({status:200,contentType:'text/javascript',body:script}));
    const georgianFixture = {
      Language:'ენა',
      'Minimum withdrawal request: {amount} {currency}.':'მინიმალური გატანა: {amount} {currency}.',
      'Fee ({rate}%)':'საკომისიო ({rate}%)',
      'Wallet address':'საფულის მისამართი',
      'Request withdrawal':'გატანის მოთხოვნა',
      'Daily {account} rewards: {range}':'დღიური {account} ჯილდო: {range}'
    };
    await page.route('**/locales/ka.json', route => catalogAvailable
      ? route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(georgianFixture)})
      : route.fulfill({status:503,body:'Unavailable'}));
    await page.route('**/locales/ar.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Language:'اللغة'})}));
    await page.goto(base);
    await page.click('[data-act="auth-mode"][data-mode="signup"]');
    await page.fill('input[name=email]','i18n-fixture@example.test');
    await page.fill('input[name=password]','FixturePassword2026');
    await page.fill('input[name=confirm]','FixturePassword2026');
    await page.click('button[type=submit]');
    await page.waitForSelector('.shell');
    if (await page.locator('[data-act="dismiss-earn-notice"]').count()) {
      await page.locator('[data-act="dismiss-earn-notice"]').first().click();
      await page.waitForFunction(()=>!S.earnNoticeActive);
    }
    await page.evaluate(()=>{location.hash='profile';});
    await page.waitForSelector('.shell.view-profile');
    const before = await page.evaluate(()=>({locked:S.user.lockedBalance,spot:S.user.withdrawBalance,earned:S.user.earnedTotal}));
    assert.equal(await page.locator('#profile-language').inputValue(),'en');
    await page.locator('#profile-language').selectOption('ka');
    await page.waitForFunction(()=>document.documentElement.lang === 'ka' && S.user.language === 'ka');
    assert.equal(await page.locator('.profile-language > span').textContent(),'ენა');
    assert.deepEqual(await page.evaluate(()=>({locked:S.user.lockedBalance,spot:S.user.withdrawBalance,earned:S.user.earnedTotal})),before);
    const notice = await page.evaluate(()=>{const el=document.createElement('div');el.innerHTML=earnNoticeContent();return el.textContent;});
    assert.match(notice,/დღიური Earn ჯილდო: 8–13%/);
    assert.match(notice,/200 USDT/);
    assert.match(notice,/2% fee/);
    assert.doesNotMatch(notice,/\{(?:minimum|fee|range)\}/);
    await page.evaluate(()=>{S.pay.withdrawals=true;S.pay.mode='tron-watch-only';S.pay.networks=[{id:'fixture',label:'TRC20'}];openSheet(walletSheet('withdraw',['Withdraw','Fixture']));});
    await page.waitForSelector('[name=wallet]');
    assert.match(await page.locator('#withdrawal-minimum').innerText(),/მინიმალური გატანა: 10 USDT/);
    assert.match(await page.locator('.summary').innerText(),/საკომისიო \(2%\)/);
    assert.equal(await page.locator('[data-form=wallet] button[type=submit]').innerText(),'გატანის მოთხოვნა');
    await page.locator('[name=wallet]').fill('TFixtureWalletAddress1234567890123');
    assert.equal(await page.locator('[name=wallet]').inputValue(),'TFixtureWalletAddress1234567890123');
    await page.evaluate(()=>closeSheet(true));
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.lang === 'ka' && S.user?.language === 'ka');
    await page.waitForSelector('.shell.view-profile');
    assert.equal(await page.locator('#profile-language').inputValue(),'ka');
    await page.locator('#profile-language').selectOption('ar');
    await page.waitForFunction(()=>document.documentElement.lang === 'ar' && S.user.language === 'ar');
    assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth),true);
    await page.evaluate(()=>{S.pay.withdrawals=true;S.pay.mode='tron-watch-only';S.pay.networks=[{id:'fixture',label:'TRC20'}];openSheet(walletSheet('withdraw',['Withdraw','Fixture']));});
    await page.waitForSelector('[name=wallet]');
    assert.equal(await page.locator('[name=wallet]').evaluate(el=>getComputedStyle(el).direction),'ltr');
    await page.evaluate(()=>closeSheet(true));
    await page.locator('#profile-language').selectOption('en');
    await page.waitForFunction(()=>document.documentElement.lang === 'en' && S.user.language === 'en');
    assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
    catalogAvailable = false;
    await page.locator('#profile-language').selectOption('ka');
    await page.waitForSelector('.toast.is-error');
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.locator('#profile-language').inputValue(),'en');
    assert.equal(await page.evaluate(()=>S.user.language),'en');
    await page.locator('[data-act="logout"]').click();
    await page.waitForSelector('#auth-form');
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
  } finally {
    if (browser) await browser.close();
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await new Promise(resolve=>child.exitCode!==null||child.signalCode!==null?resolve():child.once('exit',resolve));
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));
    assert.ok(path.basename(dir).startsWith('pg-i18n-ui-'));
    await fs.rm(dir,{recursive:true,force:true});
  }
});

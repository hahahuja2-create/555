'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const earn = require('../markets/earn');
const promotion = require('../markets/referral-promotion');

async function main() {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'taskmall-referral-ui-'));
  const output=path.resolve('artifacts/referral-promotion-ui');await fs.mkdir(output,{recursive:true});
  const password='ReferralUi2026',salt='isolated-referral-ui',now=Date.now();
  const expected={ka:'გაზარდე დღიური Earn 15%-მდე',en:'Unlock 15% daily Earn',es:'Desbloquea un 15% diario en Earn',fr:'Débloquez 15% par jour sur Earn',
    de:'15% tägliche Earn-Prämie freischalten',ru:'Откройте 15% в день в Earn',tr:'Earn günlük oranını %15’e yükselt',
    ar:'ارفع مكافأة Earn اليومية إلى 15%',hi:'Earn पर रोज़ 15% अनलॉक करें',zh:'解锁每日15%的Earn奖励'};
  const make=(id,ref=null)=>({id,name:'Referral account',email:id+'@referral.test',inviteCode:'CODE'+id.toUpperCase(),referredBy:ref,
    passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex'),createdAt:new Date(now-2*earn.DAY).toISOString(),
    vipId:'free',lockedBalance:100,withdrawBalance:0,earnedTotal:0,activities:[]});
  const accounts=Object.keys(expected).map(code=>make(code));
  const boosted=make('boosted'),friends=Array.from({length:10},(_,i)=>make('friend'+i,boosted.inviteCode));
  const state={users:[...accounts,boosted,...friends]};earn.pool(state,now-earn.DAY);
  promotion.initialize(state,friends.map(friend=>({user_id:friend.id,txid:crypto.createHash('sha256').update(friend.id).digest('hex'),log_index:0,amount_units:'50000000',timestamp:now-earn.DAY})),now);
  await fs.writeFile(path.join(directory,'db.json'),JSON.stringify(state));
  const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:'pipe',env:{...process.env,
    NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:directory,TASKMALL_DESIGN_PREVIEW:'0',
    TASKMALL_EARN_ENABLED:'1',TASKMALL_SPOT_ENABLED:'1',TASKMALL_SQLITE:'',MYSQL_URL:'',DATABASE_URL:'',
    TRON_DEPOSITS_ENABLED:'0',TRON_AUTO_WALLET:'0',TASKMALL_OPERATOR_ENABLED:'0',TRON_MANUAL_WITHDRAWALS_ENABLED:'0',BINANCE_CREDENTIAL_FILE:path.join(directory,'missing')}});
  let browser;
  try {
    const base=await new Promise((resolve,reject)=>{let errors='';const timer=setTimeout(()=>reject(new Error('UI fixture startup failed')),10000);
      child.stderr.on('data',d=>{errors+=d;});child.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('UI fixture exited: '+errors));});});
    browser=await chromium.launch();const errors=[];
    async function open(id,lang,width=390) {
      const context=await browser.newContext({viewport:{width,height:844}});
      await context.addInitScript(code=>localStorage.setItem('taskmall_language',code),lang);
      const response=await context.request.post(base+'/api/auth/login',{data:{email:id+'@referral.test',password}});assert.equal(response.status(),200);
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/api/markets',route=>route.fulfill({json:{markets:[],status:'unavailable',updatedAt:now}}));
      await page.route('**/api/markets/stream',route=>route.fulfill({contentType:'text/event-stream',body:': isolated test\n\n'}));
      await page.goto(base);return {context,page};
    }
    const noOverflow=async page=>{const sizes=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,
      dialog:document.querySelector('.referral-promotion-dialog')?.scrollWidth,client:document.querySelector('.referral-promotion-dialog')?.clientWidth}));
      assert.ok(sizes.document<=sizes.viewport+1,JSON.stringify(sizes));if(sizes.client)assert.ok(sizes.dialog<=sizes.client+1,JSON.stringify(sizes));};
    for(const [lang,title] of Object.entries(expected)) {
      const {context,page}=await open(lang,lang,lang==='de'?320:390);
      const dialog=page.locator('.referral-promotion-dialog');await dialog.waitFor();
      assert.equal(await dialog.locator('h2').innerText(),title);assert.match(await dialog.innerText(),/50 USDT/);
      assert.equal(await page.locator('.app-shell').getAttribute('inert'),'');
      if(lang==='ar')assert.equal(await dialog.getAttribute('dir'),'rtl');
      await noOverflow(page);await page.screenshot({path:path.join(output,'notice-'+lang+'.png'),fullPage:true});
      await dialog.locator('[data-promotion-action="team"]').click();await page.locator('[data-referral-promotion]').waitFor();
      assert.match(await page.locator('[data-referral-promotion]').innerText(),/50 USDT/);await noOverflow(page);
      assert.equal(await page.locator('.referral-promotion-dialog').count(),0);
      await page.reload();await page.locator('.team-page').waitFor();
      assert.equal((await(await context.request.get(base+'/api/earn')).json()).promotion.announcementPending,false);
      assert.equal(await page.locator('.referral-promotion-dialog').count(),0);await context.close();
    }
    const premium=await open('boosted','en',1440);const dialog=premium.page.locator('.referral-promotion-dialog');await dialog.waitFor();
    assert.equal(await dialog.locator('h2').innerText(),'15% unlocked permanently');
    await dialog.locator('[data-promotion-action="team"]').click();
    assert.match(await premium.page.locator('[data-referral-promotion]').innerText(),/10 \/ 10/);
    await premium.page.screenshot({path:path.join(output,'referrals-boosted-desktop.png'),fullPage:true});
    await premium.page.locator('.sidebar [data-view="earn"]').click();
    assert.equal(await premium.page.locator('.earn-rate').innerText(),'15%');
    assert.match(await premium.page.locator('.claim-label strong').innerText(),/15/);
    await premium.page.screenshot({path:path.join(output,'earn-15-desktop.png'),fullPage:true});
    await premium.page.locator('[data-earn-action="claim"]').click();
    await premium.page.waitForFunction(()=>document.querySelectorAll('.earn-history .activity-item').length>0);
    assert.equal((await(await premium.context.request.get(base+'/api/earn')).json()).earned,15);
    assert.equal(await premium.page.locator('.referral-promotion-dialog').count(),0);
    await premium.context.close();
    const secondDevice=await open('en','en',390);await secondDevice.page.locator('.assets-page').waitFor();
    assert.equal((await(await secondDevice.context.request.get(base+'/api/me')).json()).user.referralPromotion.announcementPending,false);
    assert.equal(await secondDevice.page.locator('.referral-promotion-dialog').count(),0);await secondDevice.context.close();
    assert.deepEqual(errors,[]);console.log('PASS: 10 languages, mobile/desktop layout, permanent 15%, accurate Claim, and one notice across devices.');
  } finally {
    await browser?.close();if(child.exitCode===null&&child.signalCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}
    assert.equal(path.dirname(await fs.realpath(directory)).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase());
    assert.ok(path.basename(directory).startsWith('taskmall-referral-ui-'));await fs.rm(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

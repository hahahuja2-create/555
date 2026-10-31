'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{chromium,webkit}=require('playwright');
test('existing users see only a one-time update, with persistent dismissal and correct tier UI',{timeout:90000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-notice-')),password='NoticeFixture2026',salt=crypto.randomBytes(16).toString('hex');
 const user={id:crypto.randomUUID(),name:'Existing user',email:'notice@example.invalid',passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex'),inviteCode:'NOTICETEST',createdAt:'2026-01-01T00:00:00Z',vipId:'free',lockedBalance:500,withdrawBalance:12,reservedBalance:0,earnedTotal:0,activities:[]};
 await fs.writeFile(path.join(dir,'db.json'),JSON.stringify({users:[user]}));
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:dir,TASKMALL_MAINTENANCE_ENABLED:'0',TASKMALL_EARN_ENABLED:'1',TASKMALL_SPOT_ENABLED:'1',MYSQL_URL:'',DATABASE_URL:'',TASKMALL_SQLITE:'',TRON_DEPOSITS_ENABLED:'0'}});
 let browser;
 t.after(async()=>{await browser?.close();child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));const resolved=await fs.realpath(dir),temp=await fs.realpath(os.tmpdir());assert.equal(path.dirname(resolved).toLowerCase(),temp.toLowerCase());assert.ok(path.basename(resolved).startsWith('portgainy-notice-'));await fs.rm(resolved,{recursive:true,force:true});});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('fixture startup timed out')),15000);child.stdout.on('data',v=>{const m=String(v).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
 browser=await(process.env.PORTGAINY_TEST_BROWSER==='webkit'?webkit:chromium).launch();
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const login=async()=>{await page.fill('input[name=email]',user.email);await page.fill('input[name=password]',password);await page.click('button[type=submit]');await page.waitForSelector('.shell');};
 await page.goto(base);await login();await page.waitForSelector('.system-notice');assert.match(await page.locator('.system-notice').innerText(),/1 USDT/);assert.equal(await page.locator('.system-notice tbody tr').count(),6);
 assert.equal(await page.locator('[data-act^="guide-"],[id*="language"]').count(),0);
 await fs.mkdir(path.resolve(__dirname,'../artifacts/earn-notice'),{recursive:true});
 await page.evaluate(()=>document.fonts.ready);
 for(const [name,width]of [['phone',390],['small-phone',320],['desktop',1366]]){await page.setViewportSize({width,height:844});await page.screenshot({path:path.resolve(__dirname,`../artifacts/earn-notice/${name}.png`),animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));}
 await page.locator('[data-act="dismiss-earn-notice"]').first().click();await page.waitForFunction(()=>!S.earnNoticeActive);assert.equal(await page.locator('[data-act^="guide-"]').count(),0);
 await page.reload();await page.waitForSelector('.shell');assert.equal(await page.locator('.system-notice').count(),0);
 await page.evaluate(()=>go('profile'));await page.waitForSelector('[data-act="logout"]');await page.locator('[data-act="logout"]').click();await page.waitForSelector('input[name=email]');await login();assert.equal(await page.locator('.system-notice').count(),0);
 await page.evaluate(()=>go('earn'));await page.waitForSelector('#calc-amount');assert.match(await page.locator('.earn-hero-copy h2').innerText(),/^9%/);
 await page.fill('#calc-amount','4000');assert.match(await page.locator('[data-calc=d]').innerText(),/520/);await page.fill('#calc-amount','199');assert.match(await page.locator('[data-calc=d]').innerText(),/^0/);
 await page.evaluate(()=>{acceptMarkets({markets:['BTC','ETH','SOL','BNB','PEPE'].map(base=>({base,symbol:base+'USDT',name:base,price:100,change:1,volume:1000,high:120,low:90})),status:'live'});go('markets');});
 await page.waitForSelector('.mrow .coin-mark img');
 const logos=await page.locator('.mrow .coin-mark img').evaluateAll(async nodes=>Promise.all(nodes.map(async img=>{await img.decode();return{path:img.getAttribute('src'),width:img.naturalWidth,display:getComputedStyle(img).display};})));
 assert.equal(logos.length,5);assert.ok(logos.every(x=>x.width>0&&x.display!=='none'));
 const saved=JSON.parse(await fs.readFile(path.join(dir,'db.json'),'utf8')).users[0];assert.equal(saved.lockedBalance,500);assert.equal(saved.withdrawBalance,12);assert.equal(saved.earnNotice.version,require('../markets/earn-rates').NOTICE_VERSION);assert.deepEqual(errors,[]);
});

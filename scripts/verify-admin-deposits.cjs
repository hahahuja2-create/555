'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { HDNodeWallet } = require('ethers');
const { chromium } = require('playwright');
const { BRANCH_PATH, deriveAddress, proofMessage, addressHex, USDT_CONTRACT, TRANSFER_TOPIC } = require('../payments/tron');

const root = path.resolve(__dirname, '..');
const branch = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', '', BRANCH_PATH);
const xpub = branch.neuter().extendedKey;
const treasury = 'TZBZHkdrwv6xrGzRR9a1WqStf3oEmtjDvw';
const password = 'DepositFixture2026';

function account(id, email, balance) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { id, email, name:id, passwordSalt:salt, passwordHash:crypto.scryptSync(password,salt,64).toString('hex'),
    lockedBalance:balance, withdrawBalance:0, reservedBalance:0, earnedTotal:0, withdrawnTotal:0, withdrawFeeTotal:0,
    activities:[{id:crypto.randomUUID(),at:new Date().toISOString(),type:'adjustment',amount:balance}],
    vipId:'free', createdAt:new Date(Date.now()-86_400_000).toISOString() };
}

function receipt(txid, to, values) {
  return { id:txid, blockNumber:999, blockTimeStamp:Date.now(), receipt:{result:'SUCCESS'}, log:values.map(value=>({
    address:addressHex(USDT_CONTRACT).slice(2), topics:[TRANSFER_TOPIC,addressHex(treasury).slice(2).padStart(64,'0'),
      addressHex(to).slice(2).padStart(64,'0')], data:BigInt(value).toString(16).padStart(64,'0') })) };
}

test('admin sees exact confirmed wallet deposits, excludes manual credits, and can page through results', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'portgainy-admin-deposits-'));
  const chainFile = path.join(dir,'chain.json');
  const walletFile = path.join(dir,'wallet.json');
  await fs.writeFile(path.join(dir,'db.json'), JSON.stringify({users:[account('admin-fixture','owner@example.invalid',2456),account('customer-fixture','customer@example.invalid',200)]}));
  await fs.writeFile(chainFile,JSON.stringify({history:{},receipts:{}}));
  await fs.writeFile(walletFile,JSON.stringify({version:1,network:'tron-mainnet',branchPath:BRANCH_PATH,xpub,treasuryAddress:treasury,
    firstAddress:deriveAddress(xpub,0),proof:await branch.deriveChild(0).signMessage(proofMessage(xpub,treasury))}));
  const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:dir,
    TASKMALL_LOCAL_LIVE_PROXY:'0',TASKMALL_MAINTENANCE_ENABLED:'0',TASKMALL_EARN_ENABLED:'1',TASKMALL_SPOT_ENABLED:'1',
    TASKMALL_TEST_WALLET:'',TASKMALL_SQLITE:'1',MYSQL_URL:'',DATABASE_URL:'',TASKMALL_MYSQL_TEST:'',
    TRON_DEPOSITS_ENABLED:'1',TRON_AUTO_WALLET:'0',TRON_TREASURY_ADDRESS:treasury,TRON_WALLET_PUBLIC_FILE:walletFile,
    TRON_WALLET_PUBLIC_JSON:'',TRONGRID_API_KEY:'fixture-only',TRON_TEST_POLL_MS:'100',TASKMALL_TRON_FIXTURE:chainFile,
    TASKMALL_OPERATOR_ENABLED:'0',TASKMALL_ADMIN_EMAILS:'owner@example.invalid'};
  const child=spawn(process.execPath,['--require','./scripts/tron-fixture-preload.cjs','server.js'],{cwd:root,env,windowsHide:true,stdio:'pipe'});
  let browser, errors='';child.stderr.on('data',data=>{errors+=String(data).slice(0,300)});
  t.after(async()=>{
    await browser?.close();
    if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
    const absolute=await fs.realpath(dir),temp=await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(absolute).toLowerCase(),temp.toLowerCase());assert.ok(path.basename(absolute).startsWith('portgainy-admin-deposits-'));
    await fs.rm(absolute,{recursive:true,force:true});
  });
  const base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Fixture startup failed: '+errors)),15000);
    child.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
    child.once('exit',()=>{clearTimeout(timer);reject(new Error('Fixture exited: '+errors));});
  });
  async function request(route,body,cookie){const response=await fetch(base+route,{method:body===undefined?'GET':'POST',
    headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,headers:response.headers,body:await response.json()};}
  for(let i=0;i<100;i++){if((await request('/api/payment-config')).body.available)break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal((await request('/api/payment-config')).body.available,true);
  async function login(email){const r=await request('/api/auth/login',{email,password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const admin=await login('owner@example.invalid'), customer=await login('customer@example.invalid');
  assert.equal((await request('/api/admin/deposits')).status,401);
  assert.equal((await request('/api/admin/deposits',undefined,customer)).status,403);
  assert.equal((await request('/api/admin/accounting')).status,401);
  assert.equal((await request('/api/admin/accounting',undefined,customer)).status,403);
  assert.equal((await request('/api/admin/accounting/journal')).status,401);
  assert.equal((await request('/api/admin/accounting/journal',undefined,customer)).status,403);
  assert.equal((await request('/api/admin/accounting/journal?offset=-1',undefined,admin)).status,400);
  assert.equal((await request('/api/admin/deposits?offset=-1',undefined,admin)).status,400);
  let summary=(await request('/api/admin/deposits',undefined,admin)).body;
  assert.equal(summary.count,0);assert.equal(summary.totalAmount,'0.000000');
  const customerAddress=(await request('/api/wallet/deposit-address',{},customer)).body.address;
  const adminAddress=(await request('/api/wallet/deposit-address',{},admin)).body.address;
  const first='a'.repeat(64),second='b'.repeat(64),failed='c'.repeat(64);
  const firstReceipt=receipt(first,customerAddress,[...Array(25).fill(1_000_001n),50_123_456n]);
  const secondReceipt=receipt(second,adminAddress,[1_234_567n]);
  const failedReceipt=receipt(failed,adminAddress,[500_000_000n]);failedReceipt.receipt.result='REVERT';
  await fs.writeFile(chainFile,JSON.stringify({history:{[customerAddress]:[{transaction_id:first,block_timestamp:firstReceipt.blockTimeStamp}],
    [adminAddress]:[{transaction_id:second,block_timestamp:secondReceipt.blockTimeStamp},{transaction_id:failed,block_timestamp:failedReceipt.blockTimeStamp}]},
    receipts:{[first]:firstReceipt,[second]:secondReceipt,[failed]:failedReceipt}}));
  for(let i=0;i<160;i++){summary=(await request('/api/admin/deposits',undefined,admin)).body;if(summary.count===27)break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(summary.count,27);assert.equal(summary.totalAmount,'76.358048');assert.equal(summary.deposits.length,25);assert.equal(summary.hasMore,true);
  const accounting=(await request('/api/admin/accounting',undefined,admin)).body;
  assert.equal(accounting.deposits.total,'76.358048');assert.equal(accounting.deposits.count,27);
  assert.equal(accounting.balances.earn,'2732.358048');assert.equal(accounting.balances.spot,'0.000000');
  const journal=(await request('/api/admin/accounting/journal',undefined,admin)).body;
  assert.equal(journal.entries.length,25);assert.equal(journal.hasMore,true);
  assert.ok(journal.entries.every(entry=>['credit','debit'].includes(entry.direction)));
  assert.ok((await request('/api/admin/accounting/journal?offset=25',undefined,admin)).body.entries.length>0);
  assert.ok(summary.deposits.every(row=>row.txid!==failed));assert.ok(summary.deposits.some(row=>row.email==='owner@example.invalid'));
  const page2=(await request('/api/admin/deposits?offset=25',undefined,admin)).body;
  assert.equal(page2.count,27);assert.equal(page2.totalAmount,'76.358048');assert.equal(page2.deposits.length,2);assert.equal(page2.hasMore,false);
  assert.equal((await request('/api/admin/deposits?offset=1e6',undefined,admin)).status,400);
  await new Promise(resolve=>setTimeout(resolve,300));assert.equal((await request('/api/admin/deposits',undefined,admin)).body.count,27,'replay does not duplicate deposits');

  browser=await chromium.launch();const output=path.join(root,'artifacts','admin-deposits');await fs.mkdir(output,{recursive:true});
  for(const [name,viewport] of [['small',{width:320,height:740}],['mobile',{width:390,height:844}],['desktop',{width:1440,height:900}]]){
    const context=await browser.newContext({viewport});await context.addCookies([{name:'taskmall_session',value:admin.split('=')[1],url:base}]);
    const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(base+'/#admin');await page.locator('[data-metric="deposits"] strong').waitFor();
    assert.equal(await page.locator('[data-metric="deposits"] strong').textContent(),'76.358048 USDT');
    assert.match(await page.locator('.accounting').innerText(),/76\.358048 USDT/);
    assert.match(await page.locator('.accounting').innerText(),/Manually marked paid/);
    assert.equal(await page.locator('[data-journal]').count(),25);
    await page.screenshot({path:path.join(output,name+'-accounting.png'),fullPage:true});
    if(name==='desktop'){
      await page.locator('[data-act="admin-journal-page"][data-offset="25"]').click();
      await page.waitForFunction(()=>document.querySelector('.accounting-journal .admin-pages span')?.textContent.startsWith('26'));
      await page.locator('[data-act="admin-journal-page"][data-offset="0"]').click();
      await page.waitForFunction(()=>document.querySelector('.accounting-journal .admin-pages span')?.textContent.startsWith('1'));
    }
    await page.locator('[data-act="admin-tab"][data-tab="deposits"]').click();
    assert.equal(await page.locator('li[data-deposit]').count(),25);assert.match(await page.locator('.note').innerText(),/manual balance adjustments are excluded/i);
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      offenders:[...document.querySelectorAll('*')].map(el=>({tag:el.tagName,cls:typeof el.className==='string'?el.className:'',r:el.getBoundingClientRect()}))
        .filter(({r})=>r.right>innerWidth+1||r.left< -1).slice(0,12).map(({tag,cls,r})=>({tag,cls,left:Math.round(r.left),right:Math.round(r.right)}))}));
    if(geometry.scroll>geometry.width)console.log(JSON.stringify({name,geometry}));
    assert.equal(geometry.scroll<=geometry.width,true,name+' overflow');
    assert.match(await page.locator('li[data-deposit] a').first().getAttribute('href'),/^https:\/\/tronscan\.org\/#\/transaction\/[a-f0-9]{64}$/);
    await page.locator('[data-act="admin-deposit-page"][data-offset="25"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('li[data-deposit]').length===2);
    await page.locator('[data-act="admin-deposit-page"][data-offset="0"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('li[data-deposit]').length===25);
    await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(400);
    await page.screenshot({path:path.join(output,name+'-viewport.png')});
    if(name==='desktop'){
      await page.route('**/api/admin/deposits?*',async route=>{const response=await route.fetch(),data=await response.json();data.totalAmount='9007199254.740993';await route.fulfill({response,json:data});});
      await page.locator('[data-act="admin-refresh"]').click();
      await page.waitForFunction(()=>document.querySelector('[data-metric="deposits"] strong')?.textContent==='9,007,199,254.740993 USDT');
    }
    assert.deepEqual(pageErrors,[]);await context.close();
  }
});

'use strict';
const EARN_NOTICE_VERSION = 'earn-tiers-2026-10-v1';
let noticeSaving=false;
function earnTierTable() {
  return `<div class="earn-tiers"><table><thead><tr><th>Earn balance</th><th>Daily rate</th></tr></thead><tbody>${EARN_TIERS.map(([min,max,rate])=>`<tr class="${S.user&&earnActive()&&earnRatePct()===rate?'is-current':''}"><td dir="ltr">${min.toLocaleString('en-US')} ${max?`– &lt;${max.toLocaleString('en-US')}`:'+'} USDT</td><td dir="ltr">${rate}%</td></tr>`).join('')}</tbody></table></div>`;
}
function earnNoticeContent() {
  return `<div class="earn-notice system-notice"><header><span class="tag tag-lime">Platform update</span><button class="sheet-x" type="button" data-act="dismiss-earn-notice" aria-label="Close platform update">${icon('close')}</button></header>
    <h2 id="notice-title" tabindex="-1">Welcome to the new Earn tiers</h2><p>Here is how your accounts, daily rewards and trading work.</p>
    <section><h3>Daily Earn rewards: 8–13%</h3><p>Earn starts at <b>200 USDT</b>. Your Earn balance at Claim determines the rate for the <b>whole balance</b>. At an exact boundary, the higher tier applies.</p>${earnTierTable()}<p>Your first Claim is available as soon as your Earn balance reaches <b>200 USDT</b>. After that, claim once per day when the countdown finishes. Rewards go to <b>Spot</b>, while your Earn balance stays intact. Missed days do not accumulate.</p></section>
    <section><h3>Crypto markets, buying and selling</h3><p>Use your <b>Spot balance</b> to trade from <b>1 USDT</b>, up to <b>10,000 USDT per order</b>. Review the price and fee before confirming. Positions follow market prices and settle in USDT; you are trading price movements rather than receiving on-chain coins. Losses are possible.</p></section>
    <section><h3>Deposits, referrals and withdrawals</h3><p>Deposit USDT through <b>TRON (TRC20)</b> to your personal address. Confirmed deposits credit Earn. Referral rewards credit Spot: level 1 receives 10% and level 2 receives 5% of claimed Earn rewards. Withdraw from Spot with your account password: <b>10 USDT minimum, 2% fee</b>.</p></section>
    <section><h3>About Portgainy</h3><p>Portgainy brings together market information, daily platform rewards, referrals and USDT accounts. Account balances and blockchain wallet balances are recorded separately. Reward rates and program terms can change; future rewards are not guaranteed.</p></section>
    <p class="form-msg" id="notice-error" role="alert"></p><button class="btn btn-lime btn-block" data-act="dismiss-earn-notice">Got it${icon('check')}</button></div>`;
}
function showEarnNotice() {
  if(!S.user || S.user.earnNoticeSeen || S.earnNoticeActive)return;
  openSheet(earnNoticeContent(),{label:'Platform update'});S.earnNoticeActive=true;
  sheetEl?.querySelector('#notice-title')?.focus({preventScroll:true});
}
async function dismissEarnNotice() {
  if (!S.earnNoticeActive || noticeSaving)return;
  noticeSaving=true;
  for(const button of sheetEl?.querySelectorAll('button')||[])button.disabled=true;
  try {
    const result=await api('/api/earn/notice/seen',{method:'POST',body:{version:EARN_NOTICE_VERSION}});
    S.user=result.user;S.earnNoticeActive=false;closeSheet();
  }catch(error){const el=document.querySelector('#notice-error');if(el)el.textContent=errMsg(error);for(const button of sheetEl?.querySelectorAll('button')||[])button.disabled=false;}
  finally {noticeSaving=false;}
}
document.addEventListener('keydown',event=>{
  if(!S.earnNoticeActive)return;
  if(event.key==='Escape'){event.preventDefault();dismissEarnNotice();}
  if(event.key==='Tab'){
    const buttons=[...sheetEl.querySelectorAll('button:not([disabled])')];if(!buttons.length)return;
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement.id==='notice-title')){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});

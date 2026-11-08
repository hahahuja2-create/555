'use strict';
const EARN_NOTICE_VERSION = 'earn-tiers-2026-11-v2';
let noticeSaving=false;
function earnTierTable() {
  return `<div class="earn-tiers"><table><thead><tr><th>${i18n.html('{account} balance', {account:'Earn'})}</th><th>${i18n.html('Daily rate')}</th></tr></thead><tbody>${EARN_TIERS.map(([min,max,rate])=>`<tr class="${S.user&&earnActive()&&earnRatePct()===rate?'is-current':''}"><td dir="ltr">${min.toLocaleString('en-US')} ${max?`– &lt;${max.toLocaleString('en-US')}`:'+'} USDT</td><td dir="ltr">${rate}%</td></tr>`).join('')}</tbody></table></div>`;
}
function earnNoticeContent() {
  return `<div class="earn-notice system-notice"><header><span class="tag tag-lime">${i18n.html('Platform update')}</span><button class="sheet-x" type="button" data-act="dismiss-earn-notice" aria-label="${i18n.html('Close platform update')}">${icon('close')}</button></header>
    <h2 id="notice-title" tabindex="-1">${i18n.html('Welcome to the new {account} tiers', {account:'Earn'})}</h2><p>${i18n.html('Here is how your accounts, daily rewards and trading work.')}</p>
    <section><h3>${i18n.html('Daily {account} rewards: {range}', {account:'Earn',range:'8–13%'})}</h3><p>${i18n.rich('{earn} starts at {strongStart}{minimum}{strongEnd}. Your {earn} balance at {claim} determines the rate for the {strongStart}whole balance{strongEnd}. At an exact boundary, the higher tier applies.', {earn:'Earn',claim:'Claim',minimum:`${earnMin()} USDT`})}</p>${earnTierTable()}<p>${i18n.rich('Your first {claim} is available as soon as your {earn} balance reaches {strongStart}{minimum}{strongEnd}. After that, claim once per day when the countdown finishes. Rewards go to {strongStart}{spot}{strongEnd}, while your {earn} balance stays intact. Missed days do not accumulate.', {claim:'Claim',earn:'Earn',spot:'Spot',minimum:`${earnMin()} USDT`})}</p></section>
    <section><h3>${i18n.html('Crypto markets, buying and selling')}</h3><p>${i18n.rich('Use your {strongStart}{spot} balance{strongEnd} to trade from {strongStart}{minimum}{strongEnd}, up to {strongStart}{maximum} per order{strongEnd}. Review the price and fee before confirming. Positions follow market prices and settle in {currency}; you are trading price movements rather than receiving on-chain coins. Losses are possible.', {spot:'Spot',minimum:'1 USDT',maximum:'10,000 USDT',currency:'USDT'})}</p></section>
    <section><h3>${i18n.html('Deposits, referrals and withdrawals')}</h3><p>${i18n.rich('Deposit {currency} through {strongStart}{network}{strongEnd} to your personal address. Confirmed deposits credit {earn}. Referral rewards credit {spot}: level {firstLevel} receives {levelOne} and level {secondLevel} receives {levelTwo} of claimed {earn} rewards. Withdraw from {spot} with your account password: {strongStart}{minimum} minimum, {fee} fee{strongEnd}.', {currency:'USDT',network:'TRON (TRC20)',earn:'Earn',spot:'Spot',firstLevel:'1',secondLevel:'2',levelOne:'10%',levelTwo:'5%',minimum:'10 USDT',fee:'2%'})}</p></section>
    <section><h3>${i18n.html('About {platform}', {platform:'Portgainy'})}</h3><p>${i18n.html('{platform} brings together market information, daily platform rewards, referrals and {currency} accounts. Account balances and blockchain wallet balances are recorded separately. Reward rates and program terms can change; future rewards are not guaranteed.', {platform:'Portgainy',currency:'USDT'})}</p></section>
    <p class="form-msg" id="notice-error" role="alert"></p><button class="btn btn-lime btn-block" data-act="dismiss-earn-notice">${i18n.html('Got it')}${icon('check')}</button></div>`;
}
function showEarnNotice() {
  if(!S.user || S.user.earnNoticeSeen || S.earnNoticeActive)return;
  openSheet(earnNoticeContent(),{label:i18n.text('Platform update')});S.earnNoticeActive=true;
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

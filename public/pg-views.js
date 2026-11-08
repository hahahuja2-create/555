'use strict';

/* Portgainy views, part 1: shell, auth, home and markets. */

const wordmark = (cls = '') => `<span class="wordmark ${cls}" role="img" aria-label="Portgainy"><span>Portgainy</span></span>`;
const markImg = (size = 40, cls = '') => `<img class="mark ${cls}" src="/assets/brand/portgainy-mark.svg?v=pg1" width="${size}" height="${size}" alt="" decoding="async">`;
const brandLockup = (size = 38) => `${markImg(size)}${wordmark()}`;

function avatarHex(name, cls = '') {
  return `<span class="hexbadge ${cls}"><b>${esc(String(name || 'P').trim().charAt(0).toUpperCase() || 'P')}</b></span>`;
}

function emptyState(glyph, title, text = '', action = '') {
  return `<div class="empty"><span class="empty-ic">${icon(glyph)}</span><strong>${i18n.html(title)}</strong>${text ? `<p>${i18n.html(text)}</p>` : ''}${action}</div>`;
}

function sectionHead(title, action = '') { return `<div class="sec-head"><h2>${i18n.html(title)}</h2>${action}</div>`; }
const moreLink = (label, view) => `<button class="more-link" type="button" data-act="goto" data-view="${view}">${i18n.html(label)}${icon('chevron')}</button>`;

/* ----------------------------------------------------------------- shell */

const NAV = [
  ['home', 'Home', 'home'], ['markets', 'Markets', 'chart'], ['trade', 'Trade', 'candles'],
  ['earn', 'Earn', 'earn'], ['assets', 'Wallet', 'wallet']
];
const RAIL_EXTRA = [['referrals', 'Referrals', 'users'], ['support', 'Support', 'headset'], ['about', 'About', 'building']];

function liveBadge() {
  const live = S.marketStatus === 'live';
  return `<span class="live ${live ? '' : 'is-off'}" data-live-badge><i></i>${i18n.html(live ? 'Live' : S.marketStatus === 'loading' ? 'Connecting' : 'Delayed')}</span>`;
}

function navButton([view, label, glyph], mode) {
  if(view==='earn'&&S.user?.forgeEnabled)label='Forge';
  const active = S.view === view;
  return `<button class="${mode}-item ${active ? 'is-active' : ''} ${view === 'earn' && mode === 'tab' ? 'is-hero' : ''}" type="button" data-act="goto" data-view="${view}" ${active ? 'aria-current="page"' : ''}><span class="nav-ic">${icon(glyph)}</span><span>${i18n.html(label)}</span></button>`;
}

function headerLink([view, label], extra = '') {
  if(view==='earn'&&S.user?.forgeEnabled)label='Forge';
  const active = S.view === view;
  return `<button class="gh-link ${active ? 'is-active' : ''} ${extra}" type="button" data-act="goto" data-view="${view}" ${active ? 'aria-current="page"' : ''}>${i18n.html(label)}</button>`;
}

function accountMenu(name) {
  const items = [['profile', 'Profile', 'user'], ['referrals', 'Referrals', 'users'], ['support', 'Support', 'headset'], ['about', 'About', 'building'], ...(S.user.isAdmin ? [['admin', 'Admin', 'shield']] : [])];
  return `<span class="gh-menu"><button class="gh-avatar" type="button" data-act="menu-toggle" aria-haspopup="true" aria-expanded="false" aria-label="${i18n.html('Account')}">${avatarHex(name, 'is-sm')}${icon('chevronDown')}</button>
    <div class="gh-pop" role="menu"><div class="gh-pop-head">${avatarHex(name, 'is-sm')}<span><strong>${esc(name)}</strong><small>${esc(S.user.email)}</small></span></div>
      ${items.map(([v, l, g]) => `<button type="button" role="menuitem" data-act="goto" data-view="${v}">${icon(g)}<span>${i18n.html(l)}</span></button>`).join('')}
      <button type="button" role="menuitem" data-act="toggle-theme">${icon('moon')}<span>${i18n.html('Switch theme')}</span></button>
      <button type="button" role="menuitem" class="is-danger" data-act="logout">${icon('logout')}<span>${i18n.html('Sign out')}</span></button></div></span>`;
}

const TAB_VIEWS = ['home', 'markets', 'earn', 'assets', 'profile'];

/* Phone app bar: avatar or back button, centred title, search and notifications. */
function appBar(name) {
  const inner = !TAB_VIEWS.includes(S.view);
  const title = S.view === 'home' ? '' : i18n.text(TITLES[S.view] || 'Home');
  const left = inner
    ? `<button class="ab-btn" type="button" data-act="back" aria-label="${i18n.html('Back')}">${icon('chevronLeft')}</button>`
    : `<button class="ab-avatar" type="button" data-act="goto" data-view="profile" aria-label="${i18n.html('Profile')}">${avatarHex(name, 'is-sm')}</button>`;
  const center = S.view === 'home' ? `<span class="ab-brand">${markImg(26)}${wordmark()}</span>` : `<b class="ab-title">${esc(title)}</b>`;
  const live = ['markets', 'trade'].includes(S.view) ? `<span class="ab-live">${liveBadge()}</span>` : '';
  return `<header class="ab" id="ab"><div class="ab-in"><span class="ab-l">${left}</span><span class="ab-c">${center}</span>
    <span class="ab-r">${live}<button class="ab-btn" type="button" data-act="open-search" aria-label="${i18n.html('Search')}">${icon('search')}</button><button class="ab-btn" type="button" data-act="open-notices" aria-label="${i18n.html('Notifications')}">${icon('bell')}${S.activities.length ? '<i class="dot"></i>' : ''}</button></span></div></header>`;
}

function renderShell() {
  const views = { home: homeView, markets: marketsView, trade: tradeView, earn: earnView, assets: assetsView, referrals: referralsView, profile: profileView, support: supportView, about: aboutView, admin: adminView };
  const body = (views[S.view] || homeView)();
  const name = S.user.name || 'Player';
  app.innerHTML = `<div class="shell view-${S.view}">
    ${appBar(name)}
    <header class="topbar gh"><div class="gh-in">
      <button class="gh-brand" type="button" data-act="goto" data-view="home" aria-label="Portgainy">${brandLockup(32)}</button>
      <nav class="gh-nav" aria-label="${i18n.html('Main')}">${NAV.map(([v, l]) => headerLink([v, l])).join('')}${headerLink(['referrals', 'Referrals'])}</nav>
      <button class="avatar-btn" type="button" data-act="goto" data-view="profile" aria-label="${i18n.html('Profile')}">${avatarHex(name, 'is-sm')}</button>
      <button class="search-pill" type="button" data-act="open-search">${icon('search')}<span>${i18n.html('Search coins and pages')}</span><kbd>/</kbd></button>
      <span class="top-live">${liveBadge()}</span>
      <button class="icon-btn" type="button" data-act="open-notices" aria-label="${i18n.html('Notifications')}">${icon('bell')}${S.activities.length ? '<i class="dot"></i>' : ''}</button>
      <button class="btn btn-lime btn-sm top-deposit" type="button" data-act="wallet-deposit">${icon('plus')}${i18n.html('Deposit')}</button>
      ${accountMenu(name)}
    </div></header>
    <div class="stage">
      <main class="content" id="content">${S.platform?.localTestWallet?`<p class="note">${icon('info')}Local testing · Account balances and deposits here are simulated. Do not send real crypto.</p>`:''}${body}</main>
      <footer class="foot"><span>Portgainy &copy; 2026</span><span>${i18n.html('Prices by {provider} · Positions are settled in {currency}', {provider:'Binance',currency:'USDT'})}</span></footer>
    </div>
    <nav class="tabbar" aria-label="${i18n.html('Primary')}">${PHONE_NAV.map(item => navButton(item, 'tab')).join('')}</nav>
  </div>`;
}

/* ------------------------------------------------------------------ auth */

function renderAuth() {
  const signup = S.authMode === 'signup';
  app.innerHTML = `<main class="auth">
    <section class="auth-hero">
      <div class="auth-top"><button class="rail-brand" type="button" data-act="auth-home">${brandLockup(34)}</button><span class="auth-links"><button class="link-btn" data-act="goto" data-view="about">${i18n.html("About")}</button><button class="link-btn" data-act="goto" data-view="support">${i18n.html("Support")}</button></span></div>
      <div class="auth-stage">
        <div class="auth-cube">${markImg(172, 'float')}<i class="ring r1"></i><i class="ring r2"></i></div>
        ${wordmark('is-xl')}
        <p class="auth-tag">${i18n.html("Trade. Earn.")} <b>${i18n.html("Level up.")}</b></p>
        <p class="auth-sub">${i18n.html("One account for live crypto markets, daily Earn rewards and {value0} wallets.", {"value0":"USDT"})}</p>
      </div>
      <ul class="auth-stats">
        <li><b>24/7</b><span>${i18n.html("Real-time prices")}</span></li>
        <li><b>${PG_READY_LANGUAGES.length}</b><span>${i18n.html("Interface languages")}</span></li>
        <li><b>USDT</b><span>${i18n.html("Account currency")}</span></li>
      </ul>
    </section>
    <section class="auth-card">
      <div class="seg" role="tablist" aria-label="${i18n.html("Account")}">
        <button class="${!signup ? 'is-on' : ''}" type="button" role="tab" aria-selected="${!signup}" data-act="auth-mode" data-mode="login">${i18n.html("Sign in")}</button>
        <button class="${signup ? 'is-on' : ''}" type="button" role="tab" aria-selected="${signup}" data-act="auth-mode" data-mode="signup">${i18n.html("Create account")}</button>
      </div>
      <h1>${i18n.html(signup ? 'Join Portgainy' : 'Welcome back')}</h1>
      <p class="auth-lead">${i18n.html(signup ? 'Create your account in a minute.' : 'Sign in to continue to your workspace.')}</p>
      <form class="form" id="auth-form" data-form="auth" novalidate>
        <label class="field"><span>${i18n.html("Email")}</span><div class="control">${icon('mail')}<input name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@example.com" required></div></label>
        <label class="field"><span>${i18n.html("Password")}</span><div class="control">${icon('lock')}<input id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" placeholder="${i18n.html("At least {value0} characters", {"value0":"8"})}" required><button class="eye" type="button" data-act="toggle-password" data-target="auth-password" aria-label="${i18n.html("Show password")}">${icon('eye')}</button></div></label>
        ${signup ? `<label class="field"><span>${i18n.html("Confirm password")}</span><div class="control">${icon('lock')}<input id="auth-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="${i18n.html("Repeat password")}" required><button class="eye" type="button" data-act="toggle-password" data-target="auth-confirm" aria-label="${i18n.html("Show password")}">${icon('eye')}</button></div></label>
        <label class="field"><span>${i18n.html("Invite code")} <em>${i18n.html("optional")}</em></span><div class="control">${icon('gift')}<input name="referral" type="text" maxlength="24" autocomplete="off" spellcheck="false" value="${esc(S.referralCode)}" placeholder="TM…"></div></label>` : ''}
        <p class="form-msg" id="auth-message" role="alert"></p>
        <button class="btn btn-lime btn-lg btn-block" type="submit">${i18n.html(signup ? 'Create account' : 'Sign in')}${icon('arrow')}</button>
      </form>
      <p class="auth-fine">${i18n.html("By continuing you agree to use {value0} responsibly. Crypto prices move quickly; never trade more than you can afford to lose.", {"value0":"Portgainy"})}</p>
    </section>
  </main>`;
}

/* ------------------------------------------------------------------ home */

function marketRow(row, opts = {}) {
  return `<button class="mrow" type="button" data-act="open-trade" data-symbol="${esc(row.symbol)}">
    ${coinMark(row.base, 38)}
    <span class="mrow-name"><b>${esc(row.base)}</b><small>${esc(row.name)}</small></span>
    <span class="mrow-price"><b data-px="${esc(row.symbol)}">${price(row.price)}</b><small data-vol="${esc(row.symbol)}">${i18n.html('Vol {volume}', {volume:compact(row.volume)})}</small></span>
    <span class="chg ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</span>
    ${opts.star ? `<span class="star ${S.favorites.includes(row.symbol) ? 'is-on' : ''}" data-act="toggle-fav" data-symbol="${esc(row.symbol)}" role="button" aria-label="${i18n.html("Favorite")}">${icon('star')}</span>` : ''}
  </button>`;
}

function sortedMarkets(kind) {
  const list = [...S.markets];
  if (kind === 'gainers') return list.sort((a, b) => b.change - a.change);
  if (kind === 'losers') return list.sort((a, b) => a.change - b.change);
  if (kind === 'favorites') return list.filter(row => S.favorites.includes(row.symbol));
  return list.sort((a, b) => b.volume - a.volume);
}

function marketsLoading() {
  return S.marketStatus === 'loading'
    ? `<div class="skeleton-list">${Array.from({ length: 5 }, () => '<i class="skeleton"></i>').join('')}</div>`
    : emptyState('globe', 'Market feed unavailable', 'Live prices could not be loaded. Your balances are not affected.', `<button class="btn btn-ghost btn-sm" data-act="refresh-markets">${i18n.html('Try again')}</button>`);
}

function claimStrip() {
  const e = S.earn;
  if (!e?.enabled) return '';
  const ready = claimReady();
  const rate = earnRatePct();
  if (!earnActive()) return `<article class="claim-strip is-locked"><span class="claim-gem">${icon('lock')}</span><span class="claim-copy"><small>${i18n.html('Daily {account} reward · {rate}%', {account:'Earn',rate})}</small><strong>${i18n.rich('Add {strongStart}{amount} {currency}{strongEnd} to start {account}', {amount:usd(earnShortfall()),currency:'USDT',account:'Earn'})}</strong><small>${i18n.html('{account} starts at {amount} {currency}', {account:'Earn',amount:earnMin(),currency:'USDT'})}</small></span><button class="btn btn-lime btn-sm" type="button" data-act="wallet-deposit">${i18n.html("Deposit")}</button></article>`;
  return `<article class="claim-strip ${ready ? 'is-ready' : ''}">
    <span class="claim-gem">${icon('earn')}</span>
    <span class="claim-copy"><small>${i18n.html('Daily {account} reward · {rate}%', {account:'Earn',rate})}</small><strong data-claim-title>${ready ? i18n.html('{amount} {currency} ready', {amount:usd(e.nextReward),currency:'USDT'}) : e.nextReward > 0 && earnActive() ? i18n.rich('Next claim in {timerStart}{time}{timerEnd}', {time:clock(e.nextClaimAt - serverNow())}) : i18n.html('Deposit to start earning')}</strong></span>
    ${e.nextReward > 0 ? `<button class="btn ${ready ? 'btn-lime' : 'btn-dark'} btn-sm" type="button" data-act="claim" data-claim-btn ${ready ? '' : 'disabled'}>${ready ? i18n.html('Claim') : icon('clock')}</button>`
      : `<button class="btn btn-lime btn-sm" type="button" data-act="wallet-deposit">${i18n.html("Deposit")}</button>`}
  </article>`;
}

function earnProgress() {
  if(S.user?.forgeEnabled)return `<button class="earn-meter is-active" type="button" data-act="goto" data-view="earn"><span>${icon('earn')}${i18n.html('Your Forge collection')}</span><b>${S.forge?.cores?.length||0} ${i18n.html('Cores')}</b></button>`;
  const e = earnMin(), bal = num(S.user.lockedBalance), short = earnShortfall();
  if (!short) return `<div class="earn-meter is-active"><span>${icon('earn')}${i18n.html('{account} active · {rate}% daily', {account:'Earn',rate:earnRatePct()})}</span><b>${money(bal)} USDT</b></div>`;
  return `<button class="earn-meter" type="button" data-act="wallet-deposit"><span>${icon('earn')}${i18n.rich('{account} starts at {minimum} {currency} · {strongStart}{amount} {currency}{strongEnd} to go', {account:'Earn',minimum:e,currency:'USDT',amount:usd(short)})}</span><i class="bar"><b style="width:${Math.round(clamp(bal / e, 0, 1) * 100)}%"></b></i></button>`;
}

function referralCard() {
  const code = S.team?.inviteCode || S.user.inviteCode;
  return `<article class="card ref-card"><div class="sec-head"><h2>${i18n.html("Referral program")}</h2><button class="more-link" type="button" data-act="goto" data-view="referrals">${i18n.html('Details')}${icon('chevron')}</button></div>
    <div class="ref-top"><div><small>${i18n.html("Your invite code")}</small><code>${esc(code)}</code></div><button class="icon-btn" type="button" data-act="copy-invite" aria-label="${i18n.html("Copy code")}">${icon('copy')}</button></div>
    <div class="ref-stats"><div><small>${i18n.html("Level {value0} · {value1}", {"value0":"1","value1":"10%"})}</small><b>${displayReferralCount(1)}</b></div><div><small>${i18n.html("Level {value0} · {value1}", {"value0":"2","value1":"5%"})}</small><b>${displayReferralCount(2)}</b></div><div><small>${i18n.html("Earned")}</small><b class="up">${S.hide ? '••••' : usd(displayReferralEarned())}</b></div></div>
    <p class="ref-note">${i18n.html("Earn {value0} of every reward your friends claim, and {value1} from the friends they invite.", {"value0":"10%","value1":"5%"})}</p>
    <div class="btn-row"><button class="btn btn-lime btn-sm" type="button" data-act="copy-invite-link">${icon('link')}${i18n.html('Copy link')}</button><button class="btn btn-ghost btn-sm" type="button" data-act="share-invite">${icon('share')}${i18n.html('Share')}</button></div></article>`;
}

function allocationCard() {
  const u = S.user;
  const parts = u.forgeEnabled ? [[i18n.text('USDT wallet'),num(u.withdrawBalance),'var(--lime)'],[i18n.text('Crypto'),cryptoValue(),'var(--pink)'],[i18n.text('Pending withdrawals'),num(u.reservedBalance),'var(--amber)']] : [
    [i18n.text('Spot USDT'), num(u.withdrawBalance), 'var(--cyan)'],
    [i18n.text('Earn USDT'), num(u.lockedBalance), 'var(--lime)'],
    [i18n.text('Crypto'), cryptoValue(), 'var(--pink)'],
    [i18n.text('Reserved'), num(u.reservedBalance), 'var(--amber)']
  ];
  const total = parts.reduce((s, p) => s + p[1], 0);
  const bar = total > 0
    ? parts.filter(p => p[1] > 0).map(p => `<i style="flex:${p[1]};background:${p[2]}" title="${esc(p[0])}"></i>`).join('')
    : '<i style="flex:1;background:var(--line-2)"></i>';
  return `<article class="card allocation"><div class="sec-head"><h2>${i18n.html("Allocation")}</h2><button class="more-link" type="button" data-act="goto" data-view="assets">${i18n.html('Details')}${icon('chevron')}</button></div>
    <div class="alloc-bar">${bar}</div>
    <ul class="alloc-legend">${parts.map(p => `<li><i style="background:${p[2]}"></i><span>${esc(p[0])}</span><b>${total > 0 ? ((p[1] / total) * 100).toFixed(1) : '0.0'}%</b></li>`).join('')}</ul></article>`;
}

function activityIconFor(a) {
  return { earn: 'earn', topup: 'earn', referral: 'users', deposit: 'deposit', withdraw: 'withdraw', transfer: 'transfer', spot: a.side === 'BUY' ? 'trendUp' : 'trendDown', welcome: 'sparkles', task: 'check', vip: 'crown' }[a.type] || 'receipt';
}

function activityTitle(a) {
  switch (a.type) {
    case 'forge_purchase': return i18n.text('Forge Core purchase');
    case 'forge_upgrade': return i18n.text('Forge Core upgrade');
    case 'forge_reward': return i18n.text('Forge rewards collected');
    case 'earn': return i18n.text('Daily Earn claim');
    case 'referral': return a.source==='forge'?i18n.text('Forge referral rewards collected'):i18n.text('Referral reward · Level {level}', {level:a.level || 1});
    case 'deposit': return i18n.text(S.user?.forgeEnabled ? (a.status==='below-minimum'?'Deposit awaiting minimum':'USDT deposit') : 'Deposit to Earn');
    case 'withdraw': return i18n.text('Withdrawal request');
    case 'transfer': return i18n.text('Transfer to Earn');
    case 'spot': return i18n.text('{action} {asset}', {action:i18n.text(a.side === 'BUY' ? 'Bought' : 'Sold'),asset:a.base || ''}).trim();
    case 'welcome': return i18n.text('Welcome to Portgainy');
    case 'topup': return i18n.text('Earn minimum top-up');
    case 'task': return i18n.text('Task reward (legacy)');
    case 'vip': return a.vipName ? i18n.text('Membership purchase · {name} (legacy)', {name:a.vipName}) : i18n.text('Membership purchase (legacy)');
    default: return i18n.text('Account activity');
  }
}

function activityAmount(a) {
  if(a.type==='deposit'&&a.creditedAmount!==undefined)return a.status==='below-minimum'?{text:usd(a.amount),cls:''}:{text:`+${usd(a.creditedAmount)}`,cls:'up'};
  if (!a.amount) return { text: '—', cls: '' };
  if (a.type === 'withdraw' || a.type === 'vip' || a.type==='forge_purchase' || a.type==='forge_upgrade') return { text: `-${usd(a.amount)}`, cls: 'down' };
  if (a.type === 'transfer') return { text: `${usd(a.amount)}`, cls: '' };
  if (a.type === 'spot') return { text: `${a.side === 'BUY' ? '-' : '+'}${usd(a.amount)}`, cls: a.side === 'BUY' ? 'down' : 'up' };
  return { text: `+${usd(a.amount)}`, cls: 'up' };
}

function activityList(limit = 0, filter = 'all') {
  let rows = S.activities;
  if (filter !== 'all') rows = rows.filter(a => (filter === 'trades' ? a.type === 'spot' : filter === 'rewards' ? ['earn', 'referral','forge_reward'].includes(a.type) : a.type === filter));
  if (limit) rows = rows.slice(0, limit);
  if (!rows.length) return emptyState('receipt', 'Nothing here yet', 'Your activity will appear as soon as you use your account.');
  return `<ul class="acts">${rows.map(a => {
    const amt = activityAmount(a);
    const status = a.type === 'withdraw' && a.status ? `<em class="st st-${esc(a.status)}">${esc(withdrawStatus(a))}</em>` : '';
    return `<li class="act"><span class="act-ic ${a.type}">${icon(activityIconFor(a))}</span><span class="act-copy"><b>${esc(activityTitle(a))}</b><small>${esc(dateText(a.at))} ${status}</small></span><span class="act-amt ${amt.cls}">${S.hide ? '••••' : esc(amt.text)}<small>USDT</small></span></li>`;
  }).join('')}</ul>`;
}

const WITHDRAW_STATUS = { requested: 'Under review', approved: 'Approved', submitted: 'Awaiting confirmation', confirmed: 'Sent', rejected: 'Rejected', pending: 'Pending', failed: 'Failed' };
const withdrawStatus = item => item.automatic && ['requested', 'approved'].includes(item.status) ? i18n.text('Processing') : (WITHDRAW_STATUS[item.status] ? i18n.text(WITHDRAW_STATUS[item.status]) : item.status);

function tickerRow() {
  const list = sortedMarkets('hot').slice(0, 8);
  if (!list.length) return '';
  return `<div class="tickrow" role="list">${list.map(r => `<button class="tick-chip" type="button" role="listitem" data-act="open-trade" data-symbol="${esc(r.symbol)}">${coinMark(r.base, 22)}<b>${esc(r.base)}</b><span data-px="${esc(r.symbol)}">${price(r.price)}</span><i class="chg-text ${tone(r.change)}" data-chg="${esc(r.symbol)}">${pct(r.change)}</i></button>`).join('')}</div>`;
}

/* A medal stepper for the six balance tiers, shown on phones. */
function earnLevelCard() {
  if(S.user?.forgeEnabled)return PortgainyForge.summaryCard();
  const bal = num(S.user.lockedBalance);
  let idx = -1;
  EARN_TIERS.forEach(([min], i) => { if (bal >= min) idx = i; });
  const next = EARN_TIERS[idx + 1], base = EARN_TIERS[Math.max(idx, 0)][0];
  const progress = next ? clamp((bal - (idx < 0 ? 0 : base)) / (next[0] - (idx < 0 ? 0 : base)), 0, 1) : 1;
  const steps = EARN_TIERS.map(([min], i) => `<li class="${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}"><i>${i <= idx ? `<b>${i + 1}</b>` : icon('lock')}</i><small>${compact(min)}</small></li>`).join('');
  const title = idx < 0 ? i18n.html('Not started') : i18n.html('Tier {n} of {total}', { n: idx + 1, total: EARN_TIERS.length });
  const hint = next ? i18n.html('Add {amount} USDT to reach tier {n}', { amount: usd(Math.max(0, next[0] - bal)), n: idx + 2 }) : i18n.html('You are on the highest tier');
  return `<article class="card earnlvl"><div class="sec-head"><h2>${i18n.html('Earn level')}</h2><button class="more-link" type="button" data-act="goto" data-view="earn">${i18n.html('Details')}${icon('chevron')}</button></div>
    <div class="lvl-top"><strong>${title}</strong><span class="tag ${idx >= 0 ? 'tag-lime' : ''}">${idx >= 0 ? `${earnRatePct()}% ${i18n.html('daily')}` : `${earnMin()} USDT`}</span></div>
    <ol class="lvl-steps" style="--k:${((idx < 0 ? 0 : idx + (next ? progress : 0)) / (EARN_TIERS.length - 1)).toFixed(3)}">${steps}</ol>
    <i class="xp"><b style="width:${Math.round(progress * 100)}%"></b></i>
    <p class="lvl-hint">${hint}</p></article>`;
}

function homeView() {
  if (isPhone()) return phoneHome();
  const u = S.user, pnl = unrealized();
  const hasCrypto = holdings().length > 0;
  const tabs = [['hot', i18n.text('Hot')], ['gainers', i18n.text('Gainers')], ['losers', i18n.text('Losers')], ['favorites', i18n.text('Favorites')]];
  const rows = sortedMarkets(S.marketTab).slice(0, 5);
  const movers = sortedMarkets('gainers').slice(0, 4);
  return `<div class="page home"><div class="col">
    <article class="hero-card">
      <div class="hero-top"><span class="hero-label">${i18n.html("Est. total value")}<button class="eye-btn" type="button" data-act="toggle-hide" aria-label="${i18n.html(S.hide ? 'Show balances' : 'Hide balances')}">${icon(S.hide ? 'eyeOff' : 'eye')}</button></span></div>
      <div class="hero-num"><strong data-total>${S.hide ? '••••••' : usd(totalValue())}</strong><span>USDT</span></div>
      <div class="hero-sub"><span>≈ $<span data-total-usd>${S.hide ? '••••' : usd(totalValue())}</span></span>
        ${hasCrypto ? `<span class="pnl ${tone(pnl.amount)}" data-pnl>${S.hide ? '••••' : `${pnl.amount >= 0 ? '+' : ''}${usd(pnl.amount)} (${pct(pnl.percent)})`}<small>${i18n.html("Unrealized PNL")}</small></span>` : ''}${!hasCrypto || manualAdminDisplay() ? `<span class="pnl-note">${i18n.html("Earned all-time")} <b>${money(displayEarnedTotal())}</b></span>` : ''}</div>
      ${earnProgress()}
      <div class="quick">${[['wallet-deposit', 'deposit', i18n.text('Add Funds')], ['wallet-withdraw', 'withdraw', i18n.text('Send')], [u.forgeEnabled?'goto':'wallet-transfer', u.forgeEnabled?'candles':'transfer', i18n.text(u.forgeEnabled?'Trade':'Transfer'), u.forgeEnabled?'trade':null], ['goto', 'earn', i18n.text(u.forgeEnabled?'Forge':'Earn'), 'earn']].map(([act, glyph, label, view]) => `<button type="button" data-act="${act}" ${view ? `data-view="${view}"` : ''}><span class="quick-ic">${icon(glyph)}</span><span>${esc(label)}</span></button>`).join('')}</div>
    </article>
    ${tickerRow()}
    ${claimStrip()}
    ${earnLevelCard()}
    ${allocationCard()}
    ${referralCard()}
    </div><div class="col">
    <section class="card home-markets">
      <div class="tabs" role="tablist">${tabs.map(([key, label]) => `<button class="${S.marketTab === key ? 'is-on' : ''}" type="button" role="tab" data-act="market-tab" data-tab="${key}">${esc(label)}</button>`).join('')}<button class="more-link push" type="button" data-act="goto" data-view="markets">${i18n.html('All')}${icon('chevron')}</button></div>
      <div class="mlist" id="home-markets">${rows.length ? rows.map(row => marketRow(row)).join('') : S.markets.length ? emptyState('star', 'No favorites yet', 'Tap the star on any market to pin it here.') : marketsLoading()}</div>
    </section>
    ${movers.length ? `<section class="movers">${movers.map(row => `<button class="mover" type="button" data-act="open-trade" data-symbol="${esc(row.symbol)}"><span class="mover-top">${coinMark(row.base, 24)}<b>${esc(row.base)}</b></span><strong data-px="${esc(row.symbol)}">${price(row.price)}</strong><span class="chg-text ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</span></button>`).join('')}</section>` : ''}
    <section class="card home-activity">${sectionHead('Recent activity', moreLink('History', 'assets'))}${activityList(5)}</section>
  </div></div>`;
}

function promoBanner() {
  const p = S.user.referralPromotion;
  if (!p) return '';
  const unlocked = p.status === 'unlocked';
  const ended = !unlocked && serverNow() >= p.expiresAt;
  if (ended) return '';
  return `<button class="promo" type="button" data-act="goto" data-view="referrals">
    <span class="promo-rate"><b>10%</b>${icon('arrow')}<b class="hi">15%</b></span>
    <span class="promo-copy"><strong>${unlocked ? '15% daily Earn unlocked' : 'Unlock 15% daily Earn'}</strong><small>${unlocked ? 'Permanently active on your account' : `${p.qualifyingReferrals} / ${p.requiredReferrals} active referrals · <span data-promo-timer="${p.expiresAt}">${promoRemaining(p.expiresAt)}</span>`}</small>
      <i class="xp"><b style="width:${Math.round(clamp(p.qualifyingReferrals / p.requiredReferrals, 0, 1) * 100)}%"></b></i></span>${icon('chevron')}</button>`;
}

function promoRemaining(expiresAt) {
  const ms = Math.max(0, expiresAt - serverNow()), days = Math.floor(ms / 86400000);
  return `${days ? `${days}d ` : ''}${clock(ms % 86400000)}`;
}

/* --------------------------------------------------------------- markets */

function marketsView() {
  const cats = ['all', ...new Set(S.markets.map(row => row.category).filter(Boolean))];
  const tabs = [['hot', i18n.text('Hot')], ['gainers', i18n.text('Gainers')], ['losers', i18n.text('Losers')], ['favorites', i18n.text('Favorites')]];
  let rows = sortedMarkets(S.marketTab);
  if (S.marketCategory !== 'all') rows = rows.filter(row => row.category === S.marketCategory);
  const query = S.marketQuery.trim().toLowerCase();
  if (query) rows = rows.filter(row => `${row.base} ${row.name}`.toLowerCase().includes(query));
  const up = S.markets.filter(row => row.change >= 0).length, down = S.markets.length - up;
  const breadth = S.markets.length ? Math.round(up / S.markets.length * 100) : 50;
  const avg = S.markets.length ? S.markets.reduce((s, r) => s + r.change, 0) / S.markets.length : 0;
  const mood = i18n.text(breadth >= 65 ? 'Greedy' : breadth >= 50 ? 'Optimistic' : breadth >= 35 ? 'Cautious' : 'Fearful');
  return `<div class="page markets">
    <header class="page-head"><div><h1>${i18n.html("Markets")}</h1><p>${i18n.html('Live prices · {count} assets', {count:S.markets.length})}</p></div>${liveBadge()}</header>
    <article class="card mood">
      <div class="mood-top"><span>${i18n.html("Market mood")}</span><b class="${tone(avg)}">${esc(mood)}</b></div>
      <div class="mood-bar"><i style="width:${breadth}%"></i></div>
      <div class="mood-legend"><span class="up">${i18n.html('{count} rising', {count:up})}</span><span class="muted">${i18n.html('Avg {percent}', {percent:pct(avg)})}</span><span class="down">${i18n.html('{count} falling', {count:down})}</span></div>
    </article>
    <div class="mk-sticky">
    <div class="search-field"><span>${icon('search')}</span><input id="market-search" type="search" value="${esc(S.marketQuery)}" placeholder="${i18n.html("Search coin or name")}" autocomplete="off" aria-label="${i18n.html("Search markets")}"></div>
    <div class="tabs" role="tablist">${tabs.map(([key, label]) => `<button class="${S.marketTab === key ? 'is-on' : ''}" type="button" role="tab" data-act="market-tab" data-tab="${key}">${esc(label)}</button>`).join('')}</div>
    <div class="chips" role="tablist" aria-label="${i18n.html("Categories")}">${cats.map(c => `<button class="${S.marketCategory === c ? 'is-on' : ''}" type="button" data-act="market-cat" data-cat="${esc(c)}">${i18n.html(c === 'all' ? 'All' : c)}</button>`).join('')}</div>
    </div>
    <section class="card flush"><div class="mhead"><span>${i18n.html("Name")}</span><span>${i18n.html("Last price")}</span><span>24h</span></div>
      <div class="mlist" id="market-list">${rows.length ? rows.map(row => marketRow(row, { star: true })).join('') : S.markets.length ? emptyState('search', 'No assets found', 'Try a different search or category.') : marketsLoading()}</div></section>
  </div>`;
}

function refreshMarketList() {
  const list = document.querySelector('#market-list');
  if (!list) return;
  let rows = sortedMarkets(S.marketTab);
  if (S.marketCategory !== 'all') rows = rows.filter(row => row.category === S.marketCategory);
  const query = S.marketQuery.trim().toLowerCase();
  if (query) rows = rows.filter(row => `${row.base} ${row.name}`.toLowerCase().includes(query));
  list.innerHTML = rows.length ? rows.map(row => marketRow(row, { star: true })).join('') : emptyState('search', 'No assets found', 'Try a different search or category.');
}

'use strict';

/* Portgainy views, part 1: shell, auth, home and markets. */

const wordmark = (cls = '') => `<span class="wordmark ${cls}" role="img" aria-label="Portgainy"><span>Portgainy</span></span>`;
const markImg = (size = 40, cls = '') => `<img class="mark ${cls}" src="/assets/brand/portgainy-mark.svg?v=pg1" width="${size}" height="${size}" alt="" decoding="async">`;
const brandLockup = (size = 38) => `${markImg(size)}${wordmark()}`;

function avatarHex(name, cls = '') {
  return `<span class="hexbadge ${cls}"><b>${esc(String(name || 'P').trim().charAt(0).toUpperCase() || 'P')}</b></span>`;
}

function emptyState(glyph, title, text = '', action = '') {
  return `<div class="empty"><span class="empty-ic">${icon(glyph)}</span><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

function sectionHead(title, action = '') { return `<div class="sec-head"><h2>${esc(title)}</h2>${action}</div>`; }
const moreLink = (label, view) => `<button class="more-link" type="button" data-act="goto" data-view="${view}">${esc(label)}${icon('chevron')}</button>`;

/* ----------------------------------------------------------------- shell */

const NAV = [
  ['home', 'Home', 'home'], ['markets', 'Markets', 'chart'], ['trade', 'Trade', 'candles'],
  ['earn', 'Earn', 'earn'], ['assets', 'Assets', 'wallet']
];
const RAIL_EXTRA = [['referrals', 'Referrals', 'users'], ['support', 'Support', 'headset'], ['about', 'About', 'building']];

function liveBadge() {
  const live = S.marketStatus === 'live';
  return `<span class="live ${live ? '' : 'is-off'}" data-live-badge><i></i>${live ? 'Live' : S.marketStatus === 'loading' ? 'Connecting' : 'Delayed'}</span>`;
}

function navButton([view, label, glyph], mode) {
  const active = S.view === view;
  return `<button class="${mode}-item ${active ? 'is-active' : ''} ${view === 'trade' && mode === 'tab' ? 'is-hero' : ''}" type="button" data-act="goto" data-view="${view}" ${active ? 'aria-current="page"' : ''}><span class="nav-ic">${icon(glyph)}</span><span>${label}</span></button>`;
}

function renderShell() {
  const views = { home: homeView, markets: marketsView, trade: tradeView, earn: earnView, assets: assetsView, referrals: referralsView, profile: profileView, support: supportView, about: aboutView, admin: adminView };
  const body = (views[S.view] || homeView)();
  const name = S.user.name || 'Player';
  app.innerHTML = `<div class="shell view-${S.view}">
    <aside class="rail" aria-label="Main">
      <button class="rail-brand" type="button" data-act="goto" data-view="home">${brandLockup(40)}</button>
      <nav class="rail-nav">${NAV.map(item => navButton(item, 'rail')).join('')}<span class="rail-label">Community</span>${RAIL_EXTRA.map(item => navButton(item, 'rail')).join('')}${S.user.isAdmin ? navButton(['admin', 'Admin', 'shield'], 'rail') : ''}</nav>
      <button class="rail-rank" type="button" data-act="goto" data-view="profile">${avatarHex(name)}<span><strong>${esc(name)}</strong><small>${esc(S.user.email)}</small></span></button>
    </aside>
    <div class="stage">
      <header class="topbar">
        <button class="avatar-btn" type="button" data-act="goto" data-view="profile" aria-label="Profile">${avatarHex(name, 'is-sm')}</button>
        <button class="search-pill" type="button" data-act="open-search">${icon('search')}<span>Search coins and pages</span><kbd>/</kbd></button>
        <span class="top-live">${liveBadge()}</span>
        <button class="icon-btn" type="button" data-act="open-notices" aria-label="Notifications">${icon('bell')}${S.activities.length ? '<i class="dot"></i>' : ''}</button>
        <button class="icon-btn hide-sm" type="button" data-act="goto" data-view="support" aria-label="Support">${icon('headset')}</button>
        <button class="btn btn-lime btn-sm top-deposit" type="button" data-act="wallet-deposit">${icon('plus')}Deposit</button>
      </header>
      <main class="content" id="content">${body}</main>
      <footer class="foot"><span>Portgainy &copy; 2026</span><span>Prices by Binance · Positions are settled in USDT</span></footer>
    </div>
    <nav class="tabbar" aria-label="Primary">${NAV.map(item => navButton(item, 'tab')).join('')}</nav>
  </div>`;
}

function renderPublic() {
  const view = S.view === 'support' ? supportView : aboutView;
  app.innerHTML = `<div class="public">
    <header class="public-top"><button class="rail-brand" type="button" data-act="auth-home">${brandLockup(34)}</button><nav><button class="link-btn" data-act="goto" data-view="about">About</button><button class="link-btn" data-act="goto" data-view="support">Support</button><button class="btn btn-lime btn-sm" data-act="auth-home">Sign in</button></nav></header>
    <main class="content public-content">${view()}</main></div>`;
}

/* ------------------------------------------------------------------ auth */

function renderAuth() {
  const signup = S.authMode === 'signup';
  app.innerHTML = `<main class="auth">
    <section class="auth-hero">
      <div class="auth-top"><button class="rail-brand" type="button" data-act="auth-home">${brandLockup(34)}</button><span class="auth-links"><button class="link-btn" data-act="goto" data-view="about">About</button><button class="link-btn" data-act="goto" data-view="support">Support</button></span></div>
      <div class="auth-stage">
        <div class="auth-cube">${markImg(172, 'float')}<i class="ring r1"></i><i class="ring r2"></i></div>
        ${wordmark('is-xl')}
        <p class="auth-tag">Trade. Earn. <b>Level up.</b></p>
        <p class="auth-sub">One account for live crypto markets, daily Earn rewards and USDT wallets.</p>
      </div>
      <ul class="auth-stats">
        <li><b>10%</b><span>Daily Earn rate</span></li>
        <li><b>24h</b><span>Claim cycle</span></li>
        <li><b>USDT</b><span>Account currency</span></li>
      </ul>
    </section>
    <section class="auth-card">
      <div class="seg" role="tablist" aria-label="Account">
        <button class="${!signup ? 'is-on' : ''}" type="button" role="tab" aria-selected="${!signup}" data-act="auth-mode" data-mode="login">Sign in</button>
        <button class="${signup ? 'is-on' : ''}" type="button" role="tab" aria-selected="${signup}" data-act="auth-mode" data-mode="signup">Create account</button>
      </div>
      <h1>${signup ? 'Join Portgainy' : 'Welcome back'}</h1>
      <p class="auth-lead">${signup ? 'Create your account in a minute.' : 'Sign in to continue to your workspace.'}</p>
      <form class="form" id="auth-form" data-form="auth" novalidate>
        <label class="field"><span>Email</span><div class="control">${icon('mail')}<input name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@example.com" required></div></label>
        <label class="field"><span>Password</span><div class="control">${icon('lock')}<input id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" placeholder="At least 8 characters" required><button class="eye" type="button" data-act="toggle-password" data-target="auth-password" aria-label="Show password">${icon('eye')}</button></div></label>
        ${signup ? `<label class="field"><span>Confirm password</span><div class="control">${icon('lock')}<input id="auth-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Repeat password" required><button class="eye" type="button" data-act="toggle-password" data-target="auth-confirm" aria-label="Show password">${icon('eye')}</button></div></label>
        <label class="field"><span>Invite code <em>optional</em></span><div class="control">${icon('gift')}<input name="referral" type="text" maxlength="24" autocomplete="off" spellcheck="false" value="${esc(S.referralCode)}" placeholder="TM…"></div></label>` : ''}
        <p class="form-msg" id="auth-message" role="alert"></p>
        <button class="btn btn-lime btn-lg btn-block" type="submit">${signup ? 'Create account' : 'Sign in'}${icon('arrow')}</button>
      </form>
      <p class="auth-fine">By continuing you agree to use Portgainy responsibly. Crypto prices move quickly; never trade more than you can afford to lose.</p>
    </section>
  </main>`;
}

/* ------------------------------------------------------------------ home */

function marketRow(row, opts = {}) {
  return `<button class="mrow" type="button" data-act="open-trade" data-symbol="${esc(row.symbol)}">
    ${coinMark(row.base, 38)}
    <span class="mrow-name"><b>${esc(row.base)}</b><small>${esc(row.name)}</small></span>
    <span class="mrow-price"><b data-px="${esc(row.symbol)}">${price(row.price)}</b><small data-vol="${esc(row.symbol)}">Vol ${compact(row.volume)}</small></span>
    <span class="chg ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</span>
    ${opts.star ? `<span class="star ${S.favorites.includes(row.symbol) ? 'is-on' : ''}" data-act="toggle-fav" data-symbol="${esc(row.symbol)}" role="button" aria-label="Favorite">${icon('star')}</span>` : ''}
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
    : emptyState('globe', 'Market feed unavailable', 'Live prices could not be loaded. Your balances are not affected.', '<button class="btn btn-ghost btn-sm" data-act="refresh-markets">Try again</button>');
}

function claimStrip() {
  const e = S.earn;
  if (!e?.enabled) return '';
  const ready = claimReady();
  const rate = Math.round((S.user.earnRate ?? e.rate ?? 0.1) * 100);
  if (!earnActive()) return `<article class="claim-strip is-locked"><span class="claim-gem">${icon('lock')}</span><span class="claim-copy"><small>Daily Earn reward · ${rate}%</small><strong>Add <b>${usd(earnShortfall())} USDT</b> to start Earn</strong><small>Earn starts at ${earnMin()} USDT</small></span><button class="btn btn-lime btn-sm" type="button" data-act="wallet-deposit">Deposit</button></article>`;
  return `<article class="claim-strip ${ready ? 'is-ready' : ''}">
    <span class="claim-gem">${icon('earn')}</span>
    <span class="claim-copy"><small>Daily Earn reward · ${rate}%</small><strong data-claim-title>${ready ? `${usd(e.nextReward)} USDT ready` : e.nextReward > 0 && earnActive() ? `Next claim in <b data-earn-timer>${clock(e.nextClaimAt - serverNow())}</b>` : 'Deposit to start earning'}</strong></span>
    ${e.nextReward > 0 ? `<button class="btn ${ready ? 'btn-lime' : 'btn-dark'} btn-sm" type="button" data-act="claim" data-claim-btn ${ready ? '' : 'disabled'}>${ready ? 'Claim' : icon('clock')}</button>`
      : `<button class="btn btn-lime btn-sm" type="button" data-act="wallet-deposit">Deposit</button>`}
  </article>`;
}

function earnProgress() {
  const e = earnMin(), bal = num(S.user.lockedBalance), short = earnShortfall();
  if (!short) return `<div class="earn-meter is-active"><span>${icon('earn')}Earn active · ${Math.round(num(S.user.earnRate ?? 0.1) * 100)}% daily</span><b>${money(bal)} USDT</b></div>`;
  return `<button class="earn-meter" type="button" data-act="wallet-deposit"><span>${icon('earn')}Earn starts at ${e} USDT · <b>${usd(short)} USDT</b> to go</span><i class="bar"><b style="width:${Math.round(clamp(bal / e, 0, 1) * 100)}%"></b></i></button>`;
}

function allocationCard() {
  const u = S.user;
  const parts = [
    ['Spot USDT', num(u.withdrawBalance), 'var(--cyan)'],
    ['Earn USDT', num(u.lockedBalance), 'var(--lime)'],
    ['Crypto', cryptoValue(), 'var(--pink)'],
    ['Reserved', num(u.reservedBalance), 'var(--amber)']
  ];
  const total = parts.reduce((s, p) => s + p[1], 0);
  const bar = total > 0
    ? parts.filter(p => p[1] > 0).map(p => `<i style="flex:${p[1]};background:${p[2]}" title="${esc(p[0])}"></i>`).join('')
    : '<i style="flex:1;background:var(--line-2)"></i>';
  return `<article class="card allocation"><div class="sec-head"><h2>Allocation</h2><button class="more-link" type="button" data-act="goto" data-view="assets">Details${icon('chevron')}</button></div>
    <div class="alloc-bar">${bar}</div>
    <ul class="alloc-legend">${parts.map(p => `<li><i style="background:${p[2]}"></i><span>${p[0]}</span><b>${total > 0 ? ((p[1] / total) * 100).toFixed(1) : '0.0'}%</b></li>`).join('')}</ul></article>`;
}

function activityIconFor(a) {
  return { earn: 'earn', topup: 'earn', referral: 'users', deposit: 'deposit', withdraw: 'withdraw', transfer: 'transfer', spot: a.side === 'BUY' ? 'trendUp' : 'trendDown', welcome: 'sparkles', task: 'check', vip: 'crown' }[a.type] || 'receipt';
}

function activityTitle(a) {
  switch (a.type) {
    case 'earn': return 'Daily Earn claim';
    case 'referral': return `Referral reward · Level ${a.level || 1}`;
    case 'deposit': return 'Deposit to Earn';
    case 'withdraw': return 'Withdrawal request';
    case 'transfer': return 'Transfer to Earn';
    case 'spot': return `${a.side === 'BUY' ? 'Bought' : 'Sold'} ${a.base || ''}`.trim();
    case 'welcome': return 'Welcome to Portgainy';
    case 'topup': return 'Earn minimum top-up';
    case 'task': return 'Task reward (legacy)';
    case 'vip': return `Membership purchase${a.vipName ? ` · ${a.vipName}` : ''} (legacy)`;
    default: return 'Account activity';
  }
}

function activityAmount(a) {
  if (!a.amount) return { text: '—', cls: '' };
  if (a.type === 'withdraw' || a.type === 'vip') return { text: `-${usd(a.amount)}`, cls: 'down' };
  if (a.type === 'transfer') return { text: `${usd(a.amount)}`, cls: '' };
  if (a.type === 'spot') return { text: `${a.side === 'BUY' ? '-' : '+'}${usd(a.amount)}`, cls: a.side === 'BUY' ? 'down' : 'up' };
  return { text: `+${usd(a.amount)}`, cls: 'up' };
}

function activityList(limit = 0, filter = 'all') {
  let rows = S.activities;
  if (filter !== 'all') rows = rows.filter(a => (filter === 'trades' ? a.type === 'spot' : filter === 'rewards' ? ['earn', 'referral'].includes(a.type) : a.type === filter));
  if (limit) rows = rows.slice(0, limit);
  if (!rows.length) return emptyState('receipt', 'Nothing here yet', 'Your activity will appear as soon as you use your account.');
  return `<ul class="acts">${rows.map(a => {
    const amt = activityAmount(a);
    const status = a.type === 'withdraw' && a.status ? `<em class="st st-${esc(a.status)}">${esc(WITHDRAW_STATUS[a.status] || a.status)}</em>` : '';
    return `<li class="act"><span class="act-ic ${a.type}">${icon(activityIconFor(a))}</span><span class="act-copy"><b>${esc(activityTitle(a))}</b><small>${esc(dateText(a.at))} ${status}</small></span><span class="act-amt ${amt.cls}">${S.hide ? '••••' : esc(amt.text)}<small>USDT</small></span></li>`;
  }).join('')}</ul>`;
}

const WITHDRAW_STATUS = { requested: 'Under review', approved: 'Approved', submitted: 'Awaiting confirmation', confirmed: 'Sent', rejected: 'Rejected', pending: 'Pending', failed: 'Failed' };

function homeView() {
  const u = S.user, pnl = unrealized();
  const hasCrypto = holdings().length > 0;
  const tabs = [['hot', 'Hot'], ['gainers', 'Gainers'], ['losers', 'Losers'], ['favorites', 'Favorites']];
  const rows = sortedMarkets(S.marketTab).slice(0, 5);
  const movers = sortedMarkets('gainers').slice(0, 4);
  return `<div class="page home"><div class="col">
    <article class="hero-card">
      <div class="hero-top"><span class="hero-label">Est. total value<button class="eye-btn" type="button" data-act="toggle-hide" aria-label="${S.hide ? 'Show balances' : 'Hide balances'}">${icon(S.hide ? 'eyeOff' : 'eye')}</button></span></div>
      <div class="hero-num"><strong data-total>${S.hide ? '••••••' : usd(totalValue())}</strong><span>USDT</span></div>
      <div class="hero-sub"><span>≈ $<span data-total-usd>${S.hide ? '••••' : usd(totalValue())}</span></span>
        ${hasCrypto ? `<span class="pnl ${tone(pnl.amount)}" data-pnl>${S.hide ? '••••' : `${pnl.amount >= 0 ? '+' : ''}${usd(pnl.amount)} (${pct(pnl.percent)})`}<small>Unrealized PNL</small></span>` : `<span class="pnl-note">Earned all-time <b>${money(u.earnedTotal)}</b></span>`}</div>
      ${earnProgress()}
      <div class="quick">${[['wallet-deposit', 'deposit', 'Add Funds'], ['wallet-withdraw', 'withdraw', 'Send'], ['wallet-transfer', 'transfer', 'Transfer'], ['goto', 'earn', 'Earn', 'earn']].map(([act, glyph, label, view]) => `<button type="button" data-act="${act}" ${view ? `data-view="${view}"` : ''}><span class="quick-ic">${icon(glyph)}</span><span>${label}</span></button>`).join('')}</div>
    </article>
    ${claimStrip()}
    ${allocationCard()}
    </div><div class="col">
    <section class="card">
      <div class="tabs" role="tablist">${tabs.map(([key, label]) => `<button class="${S.marketTab === key ? 'is-on' : ''}" type="button" role="tab" data-act="market-tab" data-tab="${key}">${label}</button>`).join('')}<button class="more-link push" type="button" data-act="goto" data-view="markets">All${icon('chevron')}</button></div>
      <div class="mlist" id="home-markets">${rows.length ? rows.map(row => marketRow(row)).join('') : S.markets.length ? emptyState('star', 'No favorites yet', 'Tap the star on any market to pin it here.') : marketsLoading()}</div>
    </section>
    ${movers.length ? `<section class="movers">${movers.map(row => `<button class="mover" type="button" data-act="open-trade" data-symbol="${esc(row.symbol)}"><span class="mover-top">${coinMark(row.base, 24)}<b>${esc(row.base)}</b></span><strong data-px="${esc(row.symbol)}">${price(row.price)}</strong><span class="chg-text ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</span></button>`).join('')}</section>` : ''}
    <section class="card">${sectionHead('Recent activity', moreLink('History', 'assets'))}${activityList(5)}</section>
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
  const tabs = [['hot', 'Hot'], ['gainers', 'Gainers'], ['losers', 'Losers'], ['favorites', 'Favorites']];
  let rows = sortedMarkets(S.marketTab);
  if (S.marketCategory !== 'all') rows = rows.filter(row => row.category === S.marketCategory);
  const query = S.marketQuery.trim().toLowerCase();
  if (query) rows = rows.filter(row => `${row.base} ${row.name}`.toLowerCase().includes(query));
  const up = S.markets.filter(row => row.change >= 0).length, down = S.markets.length - up;
  const breadth = S.markets.length ? Math.round(up / S.markets.length * 100) : 50;
  const avg = S.markets.length ? S.markets.reduce((s, r) => s + r.change, 0) / S.markets.length : 0;
  const mood = breadth >= 65 ? 'Greedy' : breadth >= 50 ? 'Optimistic' : breadth >= 35 ? 'Cautious' : 'Fearful';
  return `<div class="page markets">
    <header class="page-head"><div><h1>Markets</h1><p>Live prices · ${S.markets.length} assets</p></div>${liveBadge()}</header>
    <article class="card mood">
      <div class="mood-top"><span>Market mood</span><b class="${tone(avg)}">${mood}</b></div>
      <div class="mood-bar"><i style="width:${breadth}%"></i></div>
      <div class="mood-legend"><span class="up">${up} rising</span><span class="muted">Avg ${pct(avg)}</span><span class="down">${down} falling</span></div>
    </article>
    <div class="search-field"><span>${icon('search')}</span><input id="market-search" type="search" value="${esc(S.marketQuery)}" placeholder="Search coin or name" autocomplete="off" aria-label="Search markets"></div>
    <div class="tabs" role="tablist">${tabs.map(([key, label]) => `<button class="${S.marketTab === key ? 'is-on' : ''}" type="button" role="tab" data-act="market-tab" data-tab="${key}">${label}</button>`).join('')}</div>
    <div class="chips" role="tablist" aria-label="Categories">${cats.map(c => `<button class="${S.marketCategory === c ? 'is-on' : ''}" type="button" data-act="market-cat" data-cat="${esc(c)}">${c === 'all' ? 'All' : esc(c)}</button>`).join('')}</div>
    <section class="card flush"><div class="mhead"><span>Name</span><span>Last price</span><span>24h</span></div>
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

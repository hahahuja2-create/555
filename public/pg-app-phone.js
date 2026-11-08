'use strict';

/*
 * Portgainy phone app screens: Home, Wallet and the Profile header.
 * These replace the desktop dashboards under 1024px so the site behaves like an installed app
 * with five tabs: Home, Markets, Earn (or Forge), Wallet and Profile.
 */

const PHONE_NAV = [['home', 'Home', 'home'], ['markets', 'Markets', 'chart'], ['earn', 'Earn', 'earn'], ['assets', 'Wallet', 'wallet'], ['profile', 'Profile', 'user']];

const pa = (act, glyph, label, { view = '', symbol = '', cls = '' } = {}) =>
  `<button class="pa ${cls}" type="button" data-act="${act}" ${view ? `data-view="${view}"` : ''} ${symbol ? `data-symbol="${esc(symbol)}"` : ''}><span class="pa-ic">${icon(glyph)}</span><span>${i18n.html(label)}</span></button>`;

function earnTier() {
  const bal = num(S.user.lockedBalance);
  let idx = -1;
  EARN_TIERS.forEach(([min], i) => { if (bal >= min) idx = i; });
  const next = EARN_TIERS[idx + 1] || null;
  const floor = idx < 0 ? 0 : EARN_TIERS[idx][0];
  return { idx, next, bal, progress: next ? clamp((bal - floor) / (next[0] - floor), 0, 1) : 1 };
}

/* One tile of the 2-column Home grid. */
function homeTile({ act = 'goto', view = '', glyph, tint = '', chip = '', label, title, sub, cls = '', ring = null }) {
  const art = ring === null ? `<span class="ht-ic ${tint}">${icon(glyph)}</span>` : `<span class="ht-ring" style="--p:${Math.round(ring * 100)}"><span class="ht-ic ${tint}">${icon(glyph)}</span></span>`;
  return `<button class="ht ${cls}" type="button" data-act="${act}" ${view ? `data-view="${view}"` : ''}><span class="ht-top">${art}${chip ? `<em class="ht-chip">${chip}</em>` : ''}</span><small>${i18n.html(label)}</small><b>${title}</b><span class="ht-sub">${sub}</span></button>`;
}

function phoneHome() {
  const u = S.user, forge = u.forgeEnabled, pnl = unrealized(), hasCrypto = holdings().length > 0;
  const btc = coin('BTC'), eth = coin('ETH');
  const top = sortedMarkets('hot').slice(0, 5);
  const tabs = [['hot', 'Hot'], ['gainers', 'Gainers'], ['losers', 'Losers']];
  const rows = sortedMarkets(S.marketTab === 'favorites' ? 'hot' : S.marketTab).slice(0, 5);
  const t = earnTier();
  const ready = !forge && claimReady();
  const earnTile = forge
    ? homeTile({ view: 'earn', glyph: 'layers', tint: 't-lime', chip: S.forge?.pending > 0 ? i18n.html('Ready') : i18n.html('Active'), label: 'Forge', title: `${S.forge?.cores?.length || 0} <small>${i18n.html('Cores')}</small>`, sub: `${i18n.html('Settled rewards')}: <b>${money(S.forge?.pending || 0)}</b>` })
    : homeTile({ view: 'earn', glyph: 'earn', tint: 't-lime', chip: !earnActive() ? i18n.html('Locked') : ready ? i18n.html('Ready') : i18n.html('On'), label: 'Earn',
      title: !earnActive() ? `${usd(earnShortfall())} <small>USDT</small>` : ready ? i18n.html('Claim now') : `<span data-earn-timer>${clock((S.earn?.nextClaimAt || 0) - serverNow())}</span>`,
      sub: !earnActive() ? i18n.html('to start Earn') : ready ? i18n.html('Reward is ready') : i18n.html('until next claim') });
  const levelTile = forge
    ? homeTile({ view: 'assets', glyph: 'wallet', tint: 't-cyan', label: 'USDT wallet', title: `${money(u.withdrawBalance)} <small>USDT</small>`, sub: i18n.html('Available to spend or withdraw'), cls: '' })
    : homeTile({ view: 'earn', glyph: 'trophy', tint: 't-violet', ring: t.progress, label: t.idx < 0 ? 'Earn level' : 'Your tier', title: t.idx < 0 ? i18n.html('Not started') : i18n.html('Tier {n} of {total}', { n: t.idx + 1, total: EARN_TIERS.length }),
      sub: t.next ? i18n.html('Add {amount} USDT to reach tier {n}', { amount: usd(Math.max(0, t.next[0] - t.bal)), n: t.idx + 2 }) : i18n.html('You are on the highest tier'), cls: '' });
  return `<div class="page phome">
    <section class="ph-top"><i class="ph-glow"></i>
      <div class="ph-bar"><button class="ph-round" type="button" data-act="goto" data-view="profile" aria-label="${i18n.html('Profile')}">${avatarHex(u.name, 'is-sm')}</button>
        <span class="ph-pill">${markImg(22)}<b>Portgainy</b></span>
        <span class="ph-bar-r"><button class="ph-round" type="button" data-act="open-search" aria-label="${i18n.html('Search')}">${icon('search')}</button><button class="ph-round" type="button" data-act="open-notices" aria-label="${i18n.html('Notifications')}">${icon('bell')}${S.activities.length ? '<i class="dot"></i>' : ''}</button></span></div>
      <div class="ph-bal"><span class="ph-lbl">${i18n.html('Wallet balance')}<button class="eye-btn" type="button" data-act="toggle-hide" aria-label="${i18n.html(S.hide ? 'Show balances' : 'Hide balances')}">${icon(S.hide ? 'eyeOff' : 'eye')}</button></span>
        <strong><i>$</i><span data-total>${S.hide ? '••••••' : usd(totalValue())}</span></strong>
        ${hasCrypto ? `<span class="pnl ${tone(pnl.amount)}" data-pnl>${S.hide ? '••••' : `${pnl.amount >= 0 ? '+' : ''}${usd(pnl.amount)} (${pct(pnl.percent)})`}<small>${i18n.html('Unrealized PNL')}</small></span>` : `<span class="ph-sub">≈ <span data-total-usd>${S.hide ? '••••' : usd(totalValue())}</span> USDT</span>`}</div>
      <div class="pas">${pa('wallet-deposit', 'plus', 'Top up', { cls: 'is-primary' })}${pa('wallet-withdraw', 'withdraw', 'Send')}${pa('goto', 'candles', 'Trade', { view: 'trade' })}${pa('goto', 'users', 'Referral', { view: 'referrals' })}</div>
    </section>
    <section class="ph-prices"><button type="button" data-act="open-trade" data-symbol="BTCUSDT"><span>${coinMark('BTC', 20)}BTC</span><b data-px="BTCUSDT">${price(btc?.price)}</b><i class="${tone(btc?.change)}" data-chg="BTCUSDT">${pct(btc?.change)}</i></button><button type="button" data-act="open-trade" data-symbol="ETHUSDT"><span>${coinMark('ETH', 20)}ETH</span><b data-px="ETHUSDT">${price(eth?.price)}</b><i class="${tone(eth?.change)}" data-chg="ETHUSDT">${pct(eth?.change)}</i></button></section>
    <section class="ph-grid">${earnTile}
      ${homeTile({ view: 'assets', glyph: 'chart', tint: 't-pink', label: 'Earned all-time', title: `${money(u.earnedTotal)} <small>USDT</small>`, sub: i18n.html('Claims and referrals') })}
      ${levelTile}
      ${homeTile({ view: 'referrals', glyph: 'users', tint: 't-amber', label: 'Referrals', title: `${(S.referrals?.level1 || 0) + (S.referrals?.level2 || 0)} <small>${i18n.html('members')}</small>`, sub: i18n.html('Two reward levels') })}
    </section>
    ${S.hide ? '' : ''}<button class="ph-banner" type="button" data-act="goto" data-view="referrals"><span class="pb-copy"><b>${i18n.html('Invite friends')}</b><small>${i18n.html('Share your link and grow your network')}</small><i>${i18n.html('Get my link')}${icon('chevron')}</i></span><span class="pb-art">${markImg(120, 'float')}</span></button>
    <section class="card ph-card"><div class="tabs" role="tablist">${tabs.map(([key, label]) => `<button class="${S.marketTab === key ? 'is-on' : ''}" type="button" role="tab" data-act="market-tab" data-tab="${key}">${i18n.html(label)}</button>`).join('')}<button class="more-link push" type="button" data-act="goto" data-view="markets">${i18n.html('All')}${icon('chevron')}</button></div>
      <div class="mlist" id="home-markets">${rows.length ? rows.map(row => marketRow(row)).join('') : marketsLoading()}</div></section>
    <section class="card ph-card">${sectionHead('Recent activity', moreLink('History', 'assets'))}${activityList(4)}</section>
  </div>`;
}

/* ------------------------------------------------------------------ wallet */

function walletRow({ mark, name, sub, amount, fiat, symbol = '' }) {
  const attrs = symbol ? `data-act="open-trade" data-symbol="${esc(symbol)}"` : '';
  return `<${symbol ? 'button type="button"' : 'div'} class="wr" ${attrs}>${mark}<span class="wr-name"><b>${name}</b><small>${sub}</small></span><span class="wr-amt"><b>${amount}</b><small>${fiat}</small></span></${symbol ? 'button' : 'div'}>`;
}

function phoneWallet() {
  const u = S.user, forge = u.forgeEnabled, tab = S.assetsTab === 'history' ? 'history' : 'overview';
  const total = totalValue();
  const quick = sortedMarkets('hot').slice(0, 3);
  const rows = [];
  rows.push(walletRow({ mark: usdtMark(42), name: i18n.html(forge ? 'USDT wallet' : 'Spot'), sub: i18n.html('Available to trade or withdraw'), amount: money(u.withdrawBalance), fiat: `$${S.hide ? '••••' : usd(u.withdrawBalance)}` }));
  if (!forge) rows.push(walletRow({ mark: usdtMark(42), name: i18n.html('Earn'), sub: i18n.html('Principal for daily rewards'), amount: money(u.lockedBalance), fiat: `$${S.hide ? '••••' : usd(u.lockedBalance)}` }));
  if (num(u.reservedBalance) > 0) rows.push(walletRow({ mark: usdtMark(42), name: i18n.html('Reserved'), sub: i18n.html('Pending withdrawals'), amount: money(u.reservedBalance), fiat: `$${S.hide ? '••••' : usd(u.reservedBalance)}` }));
  for (const h of holdings()) {
    const c = coin(h.base), value = num(h.quantity) * num(c?.price);
    rows.push(walletRow({ mark: coinMark(h.base, 42), name: esc(h.base), sub: c ? `$${price(c.price)}` : '—', amount: S.hide ? '••••' : qty(h.quantity), fiat: c ? `$${S.hide ? '••••' : usd(value)}` : '—', symbol: c?.symbol || `${h.base}USDT` }));
  }
  const filters = [['all', 'All'], ['deposit', 'Deposits'], ['withdraw', 'Withdrawals'], ['transfer', 'Transfers'], ['trades', 'Trades'], ['rewards', 'Rewards']];
  const body = tab === 'overview' ? `
      <button class="wl-row" type="button" data-act="goto" data-view="earn"><span class="wl-ic">${icon(forge ? 'layers' : 'earn')}</span><span class="wl-copy"><b>${i18n.html(forge ? 'Forge' : 'Earn')}</b><small>${forge ? `${S.forge?.cores?.length || 0} ${i18n.html('Cores')} · ${money(S.forge?.pending || 0)} USDT ${i18n.html('ready')}` : earnActive() ? i18n.html('Your Earn account is active') : i18n.html('Add funds to start earning')}</small></span>${icon('chevron')}</button>
      <section class="card ph-card"><div class="sec-head"><h2>${i18n.html('Quick trade')}</h2></div><div class="qt">${quick.map(r => `<button type="button" data-act="open-trade" data-symbol="${esc(r.symbol)}"><span class="qt-pair">${coinMark(r.base, 26)}<i>${icon('arrow')}</i>${usdtMark(26)}</span><b>${esc(r.base)}</b><small class="${tone(r.change)}" data-chg="${esc(r.symbol)}">${pct(r.change)}</small></button>`).join('')}</div></section>
      <section class="card ph-card"><div class="sec-head"><h2>${i18n.html('Crypto')}</h2></div><div class="wrs">${rows.join('')}</div></section>
      <section class="card ph-card">${sectionHead('Allocation')}${allocationBar()}</section>`
    : `<section class="card ph-card"><div class="sec-head"><h2>${i18n.html('Transactions')}</h2><button class="btn btn-ghost btn-sm" type="button" data-act="export-history" ${S.activities.length ? '' : 'disabled'}>${icon('download')}${i18n.html('CSV')}</button></div>
      <div class="chips">${filters.map(([k, l]) => `<button class="${S.historyFilter === k ? 'is-on' : ''}" type="button" data-act="history-filter" data-filter="${k}">${i18n.html(l)}</button>`).join('')}</div>
      <div id="history-body">${activityList(0, S.historyFilter)}</div></section>
      <section class="card ph-card" id="withdraw-status">${sectionHead('Withdrawal requests')}${withdrawalsList()}</section>`;
  return `<div class="page pwallet">
    <div class="pw-tabs" role="tablist"><button class="${tab === 'overview' ? 'is-on' : ''}" type="button" role="tab" data-act="assets-tab" data-tab="overview">${i18n.html('Assets')}</button><button class="${tab === 'history' ? 'is-on' : ''}" type="button" role="tab" data-act="assets-tab" data-tab="history">${i18n.html('History')}</button></div>
    <section class="pw-card"><div class="pw-top"><span>${i18n.html('Total balance')}<button class="eye-btn" type="button" data-act="toggle-hide" aria-label="${i18n.html(S.hide ? 'Show balances' : 'Hide balances')}">${icon(S.hide ? 'eyeOff' : 'eye')}</button></span></div>
      <strong class="pw-num"><i>$</i><span data-total>${S.hide ? '••••••' : usd(total)}</span></strong>
      <div class="pas">${pa('wallet-deposit', 'plus', 'Top up', { cls: 'is-primary' })}${pa('goto', 'candles', 'Trade', { view: 'trade' })}${forge ? pa('goto', 'layers', 'Forge', { view: 'earn' }) : pa('wallet-transfer', 'transfer', 'Transfer')}${pa('wallet-withdraw', 'withdraw', 'Withdraw')}</div></section>
    ${body}</div>`;
}

function allocationBar() {
  const u = S.user;
  const parts = u.forgeEnabled
    ? [[i18n.text('USDT wallet'), num(u.withdrawBalance), 'var(--lime)'], [i18n.text('Crypto'), cryptoValue(), 'var(--pink)'], [i18n.text('Pending withdrawals'), num(u.reservedBalance), 'var(--amber)']]
    : [[i18n.text('Spot'), num(u.withdrawBalance), 'var(--cyan)'], [i18n.text('Earn'), num(u.lockedBalance), 'var(--lime)'], [i18n.text('Crypto'), cryptoValue(), 'var(--pink)'], [i18n.text('Reserved'), num(u.reservedBalance), 'var(--amber)']];
  const sum = parts.reduce((s, p) => s + p[1], 0);
  const bar = sum > 0 ? parts.filter(p => p[1] > 0).map(p => `<i style="flex:${p[1]};background:${p[2]}" title="${esc(p[0])}"></i>`).join('') : '<i style="flex:1;background:var(--line-2)"></i>';
  return `<div class="alloc-bar">${bar}</div><ul class="alloc-legend">${parts.map(p => `<li><i style="background:${p[2]}"></i><span>${esc(p[0])}</span><b>${sum > 0 ? ((p[1] / sum) * 100).toFixed(1) : '0.0'}%</b></li>`).join('')}</ul>`;
}

/* ----------------------------------------------------------------- profile */

function profileHead() {
  const u = S.user, forge = u.forgeEnabled, r = stats(), t = earnTier();
  const levelValue = forge ? i18n.html('Forge collector') : t.idx < 0 ? i18n.html('Not started') : i18n.html('Tier {n} of {total}', { n: t.idx + 1, total: EARN_TIERS.length });
  return `<section class="pp-head"><div class="pp-id"><span class="pp-avatar">${esc(String(u.name || 'P').trim().charAt(0).toUpperCase() || 'P')}</span><span class="pp-name"><b>${esc(u.name)}</b><small>${i18n.html('ID')}: ${esc(u.inviteCode)}<button type="button" data-act="copy-invite" aria-label="${i18n.html('Copy code')}">${icon('copy')}</button></small></span>
      <button class="pp-edit" type="button" data-act="focus-name">${icon('settings')}<span>${i18n.html('Edit profile')}</span></button></div>
    <div class="pp-tiles"><button type="button" data-act="goto" data-view="${forge ? 'earn' : 'earn'}"><span class="ht-ring" style="--p:${forge ? 100 : Math.round(t.progress * 100)}"><span class="ht-ic t-violet">${icon('trophy')}</span></span><small>${i18n.html(forge ? 'Collection' : 'Earn level')}</small><b>${levelValue}</b></button>
      <button type="button" data-act="goto" data-view="referrals"><span class="ht-ic t-lime">${icon('users')}</span><small>${i18n.html('Invites')}</small><b>${r.invites} <em>${i18n.html('members')}</em></b></button></div></section>`;
}

Object.assign(acts, {
  'assets-history': () => { S.assetsTab = 'history'; go('assets'); },
  'focus-name': () => { const input = document.querySelector('form[data-form="profile"] input[name="name"]'); input?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => input?.focus({ preventScroll: true }), 250); }
});

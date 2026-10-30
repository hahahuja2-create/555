'use strict';

/* Portgainy main: rendering, data loading, live markets and event wiring. */

const TITLES = { home: 'Home', markets: 'Markets', trade: 'Trade', earn: 'Earn', assets: 'Assets', referrals: 'Referrals', profile: 'Profile', support: 'Support', about: 'About', admin: 'Admin' };

function renderLoading() {
  app.innerHTML = `<main class="loading" aria-label="Loading"><span class="loading-cube">${markImg(96, 'float')}</span><i class="xp is-lg"><b class="indeterminate"></b></i></main>`;
}

function render() {
  const active = document.activeElement;
  const keep = active && active.id && /^(admin-search|market-search|faq-search|chat-input|order-input|calc-amount)$/.test(active.id)
    ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
  const y = window.scrollY;
  S.trade.chart?.destroy(); S.trade.chart = null;
  if (S.loading) renderLoading();
  else if (!S.user) { if (PUBLIC_VIEWS.includes(S.view)) renderPublic(); else renderAuth(); }
  else renderShell();
  document.title = `Portgainy | ${S.user || PUBLIC_VIEWS.includes(S.view) ? (TITLES[S.view] || 'Home') : 'Trade. Earn. Level up.'}`;
  document.body.dataset.view = S.user ? S.view : 'auth';
  postRender();
  window.scrollTo(0, y);
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.start, keep.end); } catch { /* not a text field */ } } }
}

function postRender() {
  if (!S.user) return;
  if (S.view === 'trade') {
    updateOrderEstimate();
    if (S.trade.history) drawTradeChart(); else if (coinBySymbol(S.trade.symbol)) loadTradeHistory();
  }
  if (S.view === 'earn') updateCalc();
  if (S.view === 'support') { const log = document.querySelector('#chat-log'); if (log) log.scrollTop = log.scrollHeight; }
  if (S.view === 'assets' && S.assetsTab === 'history') loadWalletLists();
  if (S.view === 'admin' && !S.admin) loadAdmin();
}

/* ----------------------------------------------------------------- data */

async function loadAll() {
  const id = S.user.id;
  const [activity, team, config, earn, referrals, portfolio, spot] = await Promise.all([
    api('/api/activity'), api('/api/team'), api('/api/payment-config', { timeout: 15000 }).catch(() => ({})),
    api('/api/earn').catch(() => null), api('/api/earn/referrals').catch(() => null),
    api('/api/spot/portfolio').catch(() => null), api('/api/spot/config').catch(() => null)
  ]);
  if (S.user?.id !== id) return;
  S.activities = activity.activities; S.team = team.team; S.earn = earn; S.referrals = referrals;
  if (earn) S.serverOffset = earn.serverTime - Date.now();
  if (portfolio) S.portfolio = portfolio;
  if (spot) S.spot = spot;
  applyPayConfig(config);
  try { await loadDepositAddress(); } catch { S.pay.wallet = null; }
}

async function refreshAccount() {
  const id = S.user.id;
  const [me, activity, earn, portfolio, team, referrals] = await Promise.all([
    api('/api/me', { timeout: 15000 }), api('/api/activity', { timeout: 15000 }), api('/api/earn').catch(() => null),
    api('/api/spot/portfolio').catch(() => null), api('/api/team').catch(() => null), api('/api/earn/referrals').catch(() => null)
  ]);
  if (S.user?.id !== id) return;
  S.user = me.user; S.activities = activity.activities;
  if (earn) { S.earn = earn; S.serverOffset = earn.serverTime - Date.now(); }
  if (portfolio) S.portfolio = portfolio;
  if (team) S.team = team.team;
  if (referrals) S.referrals = referrals;
}

async function loadWalletLists() {
  if (S.wallet.loading) return;
  S.wallet.loading = true;
  try {
    const data = await api('/api/wallet/withdrawals', { timeout: 15000 });
    S.wallet.withdrawals = data.withdrawals || [];
    const box = document.querySelector('#withdraw-status');
    if (box) box.innerHTML = `${sectionHead('Withdrawal requests')}${withdrawalsList()}`;
  } catch { S.wallet.withdrawals = S.wallet.withdrawals || []; }
  finally { S.wallet.loading = false; }
}

let adminRequest = 0;
async function loadAdmin() {
  if (!S.user?.isAdmin) return;
  const id = ++adminRequest;
  try {
    const data = await api('/api/admin/overview', { timeout: 20000 });
    if (id !== adminRequest) return;
    S.admin = data;
  } catch (error) { if (id === adminRequest) toast(errMsg(error), 'error'); return; }
  if (S.view === 'admin' && !sheetEl && document.activeElement?.id !== 'admin-search') render();
}

/* ------------------------------------------------------------ live prices */

let feed = null;
let previousPrices = new Map();

function acceptMarkets(data) {
  const first = !S.markets.length;
  S.markets = Array.isArray(data.markets) ? data.markets : [];
  S.marketStatus = data.status || 'live'; S.marketUpdated = data.updatedAt;
  if (!S.user && !PUBLIC_VIEWS.includes(S.view)) return;
  if (first && S.markets.length && S.user && ['home', 'markets', 'trade', 'assets'].includes(S.view) && !sheetEl) render();
  else refreshCells();
  checkAlerts();
}

function flash(el, up) {
  el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
  el.classList.add(up ? 'flash-up' : 'flash-down');
}

function refreshCells() {
  const map = new Map(S.markets.map(row => [row.symbol, row]));
  for (const el of document.querySelectorAll('[data-px]')) {
    const row = map.get(el.dataset.px); if (!row) continue;
    const text = price(row.price);
    if (el.textContent !== text) { const before = previousPrices.get(row.symbol); el.textContent = text; if (before !== undefined && before !== row.price) flash(el, row.price > before); }
  }
  for (const el of document.querySelectorAll('[data-chg]')) {
    const row = map.get(el.dataset.chg); if (!row) continue;
    el.textContent = pct(row.change); el.classList.toggle('up', row.change >= 0); el.classList.toggle('down', row.change < 0);
  }
  for (const el of document.querySelectorAll('.px-big')) { const row = map.get(el.dataset.px); if (row) { el.classList.toggle('up', row.change >= 0); el.classList.toggle('down', row.change < 0); } }
  for (const el of document.querySelectorAll('[data-px-usd]')) { const row = map.get(el.dataset.pxUsd); if (row) el.textContent = price(row.price); }
  for (const el of document.querySelectorAll('[data-hi]')) { const row = map.get(el.dataset.hi); if (row) el.textContent = price(row.high); }
  for (const el of document.querySelectorAll('[data-lo]')) { const row = map.get(el.dataset.lo); if (row) el.textContent = price(row.low); }
  for (const el of document.querySelectorAll('[data-vol]')) { const row = map.get(el.dataset.vol); if (row) el.textContent = `Vol ${compact(row.volume)}`; }
  for (const el of document.querySelectorAll('[data-live-badge]')) el.outerHTML = liveBadge();
  if (S.user) {
    const total = S.hide ? '••••••' : usd(totalValue());
    for (const el of document.querySelectorAll('[data-total],[data-total-usd]')) el.textContent = S.hide && el.hasAttribute('data-total-usd') ? '••••' : total;
    const pnl = unrealized();
    for (const el of document.querySelectorAll('[data-pnl]')) { el.classList.toggle('up', pnl.amount >= 0); el.classList.toggle('down', pnl.amount < 0); const small = el.querySelector('small'); el.firstChild.textContent = S.hide ? '••••' : `${pnl.amount >= 0 ? '+' : ''}${usd(pnl.amount)} (${pct(pnl.percent)})`; if (small) el.append(small); }
    for (const el of document.querySelectorAll('[data-pos-val],[data-pos-pnl]')) {
      const base = el.dataset.posVal || el.dataset.posPnl, row = holdingOf(base), c = coin(base);
      if (!row || !c) continue;
      const value = num(row.quantity) * c.price, profit = value - num(row.cost), p = num(row.cost) > 0 ? profit / num(row.cost) * 100 : 0;
      if (el.dataset.posVal) el.innerHTML = `${money(value)}<small> USDT</small>`;
      else { el.textContent = S.hide ? '••••' : `${profit >= 0 ? '+' : ''}${usd(profit)} (${pct(p)})`; el.classList.toggle('up', profit >= 0); el.classList.toggle('down', profit < 0); }
    }
    updateOrderEstimate();
  }
  previousPrices = new Map(S.markets.map(row => [row.symbol, row.price]));
}

async function pollMarkets() {
  try { acceptMarkets(await api('/api/markets', { timeout: 20000 })); }
  catch { S.marketStatus = 'stale'; refreshCells(); }
}

function startFeed() {
  if (feed || document.hidden || typeof EventSource === 'undefined') return;
  feed = new EventSource('/api/markets/stream');
  feed.onmessage = event => { try { acceptMarkets(JSON.parse(event.data)); } catch { /* ignore malformed frame */ } };
  feed.onerror = () => { S.marketStatus = 'stale'; refreshCells(); };
}

function stopFeed() { feed?.close(); feed = null; }

document.addEventListener('visibilitychange', () => { if (document.hidden) stopFeed(); else { startFeed(); pollMarkets(); } });

/* ----------------------------------------------------------------- actions */

async function claimReward() {
  if (S.claimBusy || !claimReady()) return;
  S.claimBusy = true; S.claimKey ||= crypto.randomUUID();
  for (const b of document.querySelectorAll('[data-claim-btn]')) b.disabled = true;
  try {
    const result = await api('/api/earn/claim', { method: 'POST', body: { requestKey: S.claimKey } });
    S.user = result.user; S.activities = result.activities; S.earn = result.earn;
    S.serverOffset = result.earn.serverTime - Date.now(); S.claimKey = null;
    render(); burst();
    toast(`${usd(result.receipt.amount)} USDT added to Spot`, 'ok', 'Reward claimed');
  } catch (error) {
    const label = document.querySelector('#earn-error');
    if (label) label.textContent = 'Could not claim. Refresh and try again.';
    toast('Could not claim. Refresh and try again.', 'error');
  } finally { S.claimBusy = false; updateTimers(); }
}

function burst() {
  const layer = document.createElement('div'); layer.className = 'burst'; layer.setAttribute('aria-hidden', 'true');
  const colors = ['#c8f751', '#45d6ff', '#ff4794', '#ffc93a', '#9b7bff'];
  for (let i = 0; i < 26; i += 1) {
    const p = document.createElement('i'), angle = (Math.PI * 2 * i) / 26 + Math.random() * 0.4, dist = 80 + Math.random() * 140;
    p.style.cssText = `--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 40}px;--c:${colors[i % colors.length]};--r:${Math.random() * 360}deg`;
    layer.append(p);
  }
  document.body.append(layer); setTimeout(() => layer.remove(), 1200);
}

async function showPromotionNotice() {
  const p = S.user?.referralPromotion;
  if (!p?.announcementPending || S.noticeRequested || sheetEl) return;
  S.noticeRequested = true;
  try {
    const result = await api('/api/earn/promotion/announcement', { method: 'POST', body: {} });
    S.user.referralPromotion = result.promotion;
    if (result.show && S.user) {
      const pr = result.promotion;
      openSheet(`<div class="notice"><span class="tag tag-lime">${pr.status === 'unlocked' ? 'Unlocked' : '10-day offer'}</span><div class="promo-rate big"><b>10%</b>${icon('arrow')}<b class="hi">15%</b></div><h2>${pr.status === 'unlocked' ? '15% daily Earn unlocked' : 'Unlock 15% daily Earn'}</h2><p>Invite ${pr.requiredReferrals} active friends within your personal 10-day window. An active referral has at least ${pr.minimumDepositUSDT} USDT in confirmed deposits. Existing active referrals count too.</p><div class="prog"><span>Active referrals</span><b>${pr.qualifyingReferrals} / ${pr.requiredReferrals}</b></div><i class="xp is-lg"><b style="width:${Math.round(clamp(pr.qualifyingReferrals / pr.requiredReferrals, 0, 1) * 100)}%"></b></i><div class="sheet-actions"><button class="btn btn-ghost" data-act="close-sheet">Got it</button><button class="btn btn-lime" data-act="goto" data-view="referrals">View referrals${icon('arrow')}</button></div></div>`, { label: 'Referral offer' });
    }
  } catch { setTimeout(() => { S.noticeRequested = false; }, 30000); }
}

async function adminDecision(action, id) {
  if (S.busy) return;
  if (S.adminArmed?.id !== id || S.adminArmed.action !== action) {
    S.adminArmed = { id, action };
    clearTimeout(adminDecision.timer);
    adminDecision.timer = setTimeout(() => { if (S.adminArmed?.id === id) { S.adminArmed = null; if (S.view === 'admin') render(); } }, 6000);
    render(); return;
  }
  S.adminArmed = null; S.busy = true; render();
  try {
    await api(`/api/admin/withdrawals/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: {} });
    toast(action === 'confirm' ? 'Withdrawal marked as sent' : 'Withdrawal rejected', 'ok');
  } catch (error) { toast(errMsg(error), 'error'); } finally { S.busy = false; }
  await loadAdmin(); render();
}

/* ------------------------------------------------------------------ timers */

function updateTimers() {
  const e = S.earn;
  if (e) {
    const ms = e.nextClaimAt - serverNow(), ready = claimReady();
    for (const el of document.querySelectorAll('[data-earn-timer]')) { if (ready) { if (el.textContent !== 'Ready') el.textContent = 'Ready'; } else el.textContent = clock(ms); }
    for (const button of document.querySelectorAll('[data-claim-btn]')) {
      button.disabled = !ready || S.claimBusy;
      button.classList.toggle('btn-lime', ready); button.classList.toggle('btn-dark', !ready);
    }
    if (ready && !S.readyRendered) { S.readyRendered = true; if (['home', 'earn'].includes(S.view) && !sheetEl) render(); }
    if (!ready) S.readyRendered = false;
  }
  for (const el of document.querySelectorAll('[data-promo-timer]')) el.textContent = promoRemaining(Number(el.dataset.promoTimer));
}

setInterval(updateTimers, 1000);

let refreshRunning = false;
setInterval(async () => {
  if (refreshRunning || !S.user || document.hidden || S.busy || sheetEl) return;
  refreshRunning = true;
  const id = S.user.id, before = S.user.lockedBalance;
  try {
    const [me, activity, config] = await Promise.all([api('/api/me', { timeout: 15000 }), api('/api/activity', { timeout: 15000 }), api('/api/payment-config', { timeout: 15000 }).catch(() => null)]);
    if (S.user?.id !== id) return;
    const credited = me.user.lockedBalance > before && activity.activities.some(a => a.type === 'deposit' && !S.activities.some(p => p.id === a.id));
    const changed = JSON.stringify(me.user) !== JSON.stringify(S.user) || JSON.stringify(activity.activities) !== JSON.stringify(S.activities);
    S.user = me.user; S.activities = activity.activities;
    if (config) applyPayConfig(config);
    if (changed) { await refreshAccount().catch(() => {}); const typing = document.activeElement?.matches?.('input,textarea,select'); if (!sheetEl && !typing && S.view !== 'profile') render(); }
    if (credited) toast('A confirmed USDT deposit was credited.', 'ok', 'Deposit received');
  } catch { /* network interruptions never change displayed balances */ } finally { refreshRunning = false; }
}, 20000);

setInterval(() => { if (S.view === 'admin' && S.user?.isAdmin && !document.hidden && !S.busy && !S.adminArmed && document.activeElement?.id !== 'admin-search') loadAdmin(); }, 20000);

/* ------------------------------------------------------------------ events */

const acts = {
  goto: el => go(el.dataset.view),
  'open-trade': el => go('trade', el.dataset.symbol),
  'auth-home': () => { S.view = 'home'; history.replaceState(null, '', location.pathname + location.search); render(); },
  'auth-mode': el => { S.authMode = el.dataset.mode; render(); },
  'toggle-password': el => {
    const input = document.getElementById(el.dataset.target); if (!input) return;
    const show = input.type === 'password'; input.type = show ? 'text' : 'password';
    el.innerHTML = icon(show ? 'eyeOff' : 'eye'); el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  },
  'toggle-hide': () => { S.hide = !S.hide; store.write('pg_hide', S.hide); render(); },
  'toggle-fav': el => {
    const s = el.dataset.symbol;
    S.favorites = S.favorites.includes(s) ? S.favorites.filter(x => x !== s) : [...S.favorites, s].slice(0, 64);
    store.write('pg_favorites', S.favorites);
    if (S.view === 'markets' && S.marketTab === 'favorites') refreshMarketList();
    else for (const node of document.querySelectorAll(`[data-act="toggle-fav"][data-symbol="${s}"]`)) node.classList.toggle('is-on', S.favorites.includes(s));
  },
  'market-tab': el => { S.marketTab = el.dataset.tab; render(); },
  'market-cat': el => { S.marketCategory = el.dataset.cat; render(); },
  'refresh-markets': () => { S.marketStatus = 'loading'; render(); pollMarkets(); },
  'open-search': openSearch, 'open-notices': openNotices, 'open-alert': openAlertSheet, 'pick-pair': pickPair,
  'trade-range': el => { S.trade.range = el.dataset.range; S.trade.history = null; render(); },
  'trade-side': el => { S.trade.side = el.dataset.side; S.trade.input = ''; render(); },
  'trade-tab': el => { S.trade.tab = el.dataset.tab; const box = document.querySelector('#trade-tab-body'); if (box) { box.innerHTML = tradeTabBody(coinBySymbol(S.trade.symbol)); for (const b of el.parentElement.children) b.classList.toggle('is-on', b === el); } },
  'trade-pct': el => {
    const T = S.trade, row = coinBySymbol(T.symbol), input = document.querySelector('#order-input'); if (!row || !input) return;
    const buy = T.side === 'BUY', avail = tradeAvailable(row), places = buy ? 6 : 8, f = 10 ** places, p = Number(el.dataset.pct);
    const capped = buy ? Math.min(10000, avail) : avail;
    input.value = !buy && p === 100 ? String(holdingOf(row.base)?.quantity || '0') : (Math.floor(capped * p / 100 * f) / f).toFixed(places);
    T.input = input.value; updateOrderEstimate();
  },
  'confirm-order': confirmOrder,
  'close-sheet': () => closeSheet(),
  'alert-dir': el => { document.querySelector('[data-form="alert"] [name="dir"]').value = el.dataset.dir; for (const b of el.parentElement.children) b.classList.toggle('is-on', b === el); },
  'remove-alert': el => { S.alerts = S.alerts.filter(a => a.id !== el.dataset.id); store.write('pg_alerts', S.alerts); render(); },
  'wallet-deposit': () => openWallet('deposit'), 'wallet-withdraw': () => openWallet('withdraw'), 'wallet-transfer': () => openWallet('transfer'),
  'retry-wallet': el => openWallet(el.dataset.type),
  'wallet-max': () => { const input = document.querySelector('#wallet-amount'); if (input) { input.value = maxAmount(); input.dispatchEvent(new Event('input', { bubbles: true })); } },
  'copy-address': async el => { const v = document.querySelector('#dep-address')?.value; if (v && await copyText(v)) { el.textContent = 'COPIED'; setTimeout(() => { el.textContent = 'COPY'; }, 1500); } },
  claim: claimReward,
  'copy-invite': async () => { if (await copyText(S.team?.inviteCode || S.user.inviteCode)) toast('Invite code copied'); },
  'copy-invite-link': async () => { if (await copyText(inviteUrl(S.team?.inviteCode || S.user.inviteCode))) toast('Invite link copied'); },
  'share-invite': async () => {
    const url = inviteUrl(S.team?.inviteCode || S.user.inviteCode);
    if (navigator.share) { try { await navigator.share({ title: 'Portgainy', text: 'Join me on Portgainy — trade, earn and level up.', url }); return; } catch { /* cancelled */ } }
    if (await copyText(url)) toast('Invite link copied');
  },
  logout: async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* cookie is cleared by the server when reachable */ }
    Object.assign(S, { user: null, activities: [], team: null, earn: null, referrals: null, portfolio: null, admin: null, view: 'home', wallet: { withdrawals: null, deposits: null } });
    history.replaceState(null, '', location.pathname); closeSheet(true); render();
  },
  'assets-tab': el => { S.assetsTab = el.dataset.tab; render(); },
  'history-filter': el => { S.historyFilter = el.dataset.filter; render(); },
  'export-history': exportHistory,
  'chat-suggest': el => sendChat(el.dataset.text),
  'admin-tab': el => { S.adminTab = el.dataset.tab; render(); },
  'admin-filter': el => { S.adminFilter = el.dataset.filter; render(); },
  'admin-refresh': () => loadAdmin(),
  'admin-confirm': el => adminDecision('confirm', el.dataset.id),
  'admin-reject': el => adminDecision('reject', el.dataset.id),
  'admin-copy': async el => { if (await copyText(el.dataset.value)) toast('Copied'); }
};

document.addEventListener('click', event => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const handler = acts[el.dataset.act];
  if (!handler) return;
  event.preventDefault();
  if (sheetEl && ['goto', 'open-trade'].includes(el.dataset.act)) closeSheet(true);
  handler(el, event);
});

document.addEventListener('input', event => {
  const t = event.target;
  if (t.id === 'market-search') { S.marketQuery = t.value; refreshMarketList(); }
  else if (t.id === 'faq-search') { S.faqQuery = t.value; document.querySelector('#faq-list').innerHTML = faqList(FAQ.filter(([a, b]) => !t.value || `${a} ${b}`.toLowerCase().includes(t.value.toLowerCase()))); }
  else if (t.id === 'admin-search') { S.adminSearch = t.value; render(); }
  else if (t.id === 'order-input') {
    const places = S.trade.side === 'BUY' ? 6 : 8;
    let v = t.value.replace(',', '.').replace(/[^\d.]/g, '');
    const parts = v.split('.'); if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join('')}`;
    if (v.includes('.')) { const [w, f] = v.split('.'); v = `${w}.${f.slice(0, places)}`; }
    if (v !== t.value) t.value = v;
    S.trade.input = v; updateOrderEstimate();
  } else if (t.id === 'calc-amount') { const r = document.querySelector('#calc-range'); if (r) r.value = clamp(num(t.value), 0, 10000); updateCalc(); }
  else if (t.id === 'calc-range') { const a = document.querySelector('#calc-amount'); if (a) a.value = t.value; updateCalc(); }
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  if (kind === 'auth') return submitAuth(form);
  if (kind === 'order') return requestQuote(form);
  if (kind === 'wallet') return submitWallet(form);
  if (kind === 'alert') {
    const data = new FormData(form), target = num(String(data.get('price')).replace(',', '.')), msg = form.querySelector('#alert-msg');
    if (!(target > 0)) { msg.textContent = 'Enter a target price.'; return; }
    if (S.alerts.length >= 30) { msg.textContent = 'You can keep up to 30 alerts.'; return; }
    S.alerts.push({ id: crypto.randomUUID(), symbol: S.trade.symbol, dir: data.get('dir') === 'below' ? 'below' : 'above', price: target, created: Date.now() });
    store.write('pg_alerts', S.alerts); closeSheet(); S.trade.tab = 'alerts'; render(); toast('Price alert created');
  }
  if (kind === 'profile') {
    const msg = form.querySelector('#profile-msg'), button = form.querySelector('button[type="submit"]');
    if (S.busy) return; S.busy = true; button.disabled = true;
    try { const result = await api('/api/profile', { method: 'PATCH', body: { name: new FormData(form).get('name') } }); S.user = result.user; render(); toast('Name updated'); }
    catch (error) { msg.textContent = errMsg(error); button.disabled = false; } finally { S.busy = false; }
  }
  if (kind === 'chat') { const input = form.querySelector('#chat-input'), text = input.value; input.value = ''; sendChat(text); }
});

async function submitAuth(form) {
  if (S.busy) return;
  const data = new FormData(form), msg = document.querySelector('#auth-message'), button = form.querySelector('button[type="submit"]');
  const signup = S.authMode === 'signup', email = String(data.get('email') || '').trim();
  if (!email || !data.get('password')) { msg.textContent = 'Enter your email and password.'; return; }
  if (signup && data.get('password') !== data.get('confirm')) { msg.textContent = 'Passwords do not match.'; return; }
  S.busy = true; button.disabled = true; msg.textContent = '';
  try {
    const result = await api(signup ? '/api/auth/signup' : '/api/auth/login', { method: 'POST', body: { name: nameFromEmail(email), email, password: data.get('password'), referral: data.get('referral') } });
    S.user = result.user; S.view = 'home'; S.referralCode = '';
    const url = new URL(location.href); url.searchParams.delete('ref'); history.replaceState(null, '', `${url.pathname}${url.search}#home`);
    await loadAll(); render(); showPromotionNotice();
    if (signup) toast('Account created — your first mission awaits.', 'ok', 'Welcome');
  } catch (error) { msg.textContent = errMsg(error); button.disabled = false; } finally { S.busy = false; }
}

document.addEventListener('keydown', event => {
  if (event.key === '/' && S.user && !sheetEl && !event.target.closest('input,textarea,select,[contenteditable]')) { event.preventDefault(); openSearch(); }
});

/* -------------------------------------------------------------------- init */

async function init() {
  const params = new URLSearchParams(location.search);
  const ref = (params.get('ref') || '').trim().toUpperCase();
  if (ref) { S.referralCode = ref.slice(0, 24); S.authMode = 'signup'; }
  renderLoading();
  const parsed = parseHash(); S.view = parsed.view || 'home'; S.params = parsed.params;
  if (S.view === 'trade' && parsed.params[0] && /^[A-Z0-9]+USDT$/.test(parsed.params[0])) S.trade.symbol = parsed.params[0];
  pollMarkets(); startFeed();
  try {
    const me = await api('/api/me');
    S.user = me.user;
    await loadAll();
    if (S.view === 'admin' && !S.user.isAdmin) S.view = 'home';
  } catch { S.user = null; }
  S.loading = false;
  render();
  if (S.user) {
    showPromotionNotice();
    const intent = params.get('wallet');
    if (['deposit', 'withdraw', 'transfer'].includes(intent)) openWallet(intent);
  }
}

init();

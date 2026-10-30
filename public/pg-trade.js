'use strict';

/* Portgainy views, part 2: trade, assets, wallet sheets, orders, search and notices. */

/* ----------------------------------------------------------------- trade */

const RANGES = ['1H', '1D', '1W', '1M'];

function holdingOf(base) { return holdings().find(row => row.base === base); }

function tradeAvailable(row) {
  const T = S.trade;
  return T.side === 'BUY' ? num(S.user.withdrawBalance) : num(holdingOf(row.base)?.quantity);
}

function tradeView() {
  const T = S.trade;
  const row = coinBySymbol(T.symbol);
  if (!row) {
    return `<div class="page trade"><header class="page-head"><div><h1>Trade</h1><p>Spot · USDT</p></div>${liveBadge()}</header>${S.markets.length ? emptyState('candles', 'Pair not available', 'Pick another market to continue.', '<button class="btn btn-lime btn-sm" data-act="pick-pair">Choose market</button>') : `<section class="card">${marketsLoading()}</section>`}</div>`;
  }
  const buy = T.side === 'BUY';
  const avail = tradeAvailable(row);
  const span = row.high - row.low;
  const position = span > 0 ? clamp((row.price - row.low) / span * 100, 0, 100) : 50;
  const fav = S.favorites.includes(row.symbol);
  const hasAlert = S.alerts.some(a => a.symbol === row.symbol);
  return `<div class="page trade">
    <header class="pair-head">
      <button class="pair-btn" type="button" data-act="pick-pair">${coinMark(row.base, 34)}<span><b>${esc(row.base)}<small>/USDT</small></b><em>${esc(row.name)}</em></span>${icon('chevronDown')}</button>
      <span class="pair-actions"><button class="icon-btn ${fav ? 'is-on' : ''}" type="button" data-act="toggle-fav" data-symbol="${esc(row.symbol)}" aria-label="Favorite">${icon('star')}</button>
      <button class="icon-btn ${hasAlert ? 'is-on' : ''}" type="button" data-act="open-alert" aria-label="Price alert">${icon('bellPlus')}</button></span>
    </header>
    <div class="trade-grid">
      <section class="card chart-card">
        <div class="px-row"><strong class="px-big ${tone(row.change)}" data-px="${esc(row.symbol)}">${price(row.price)}</strong><span class="chg ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</span></div>
        <div class="px-sub">≈ $<span data-px-usd="${esc(row.symbol)}">${price(row.price)}</span> · ${liveBadge()}</div>
        <div class="stat-row"><span>24h High<b data-hi="${esc(row.symbol)}">${price(row.high)}</b></span><span>24h Low<b data-lo="${esc(row.symbol)}">${price(row.low)}</b></span><span>24h Vol<b>${compact(row.volume)}</b></span></div>
        <div class="ranges" role="tablist">${RANGES.map(r => `<button class="${T.range === r ? 'is-on' : ''}" type="button" data-act="trade-range" data-range="${r}">${r}</button>`).join('')}</div>
        <div class="chart-wrap"><canvas id="trade-chart" role="img" aria-label="${esc(row.name)} price history"></canvas><span class="chart-status" id="chart-status">${T.history ? '' : 'Loading price history…'}</span></div>
        <div class="range-bar" aria-label="24 hour range"><span>${price(row.low)}</span><div><i style="left:${position}%"></i></div><span>${price(row.high)}</span></div>
      </section>
      <section class="card order-card">
        <div class="seg seg-trade" role="tablist"><button class="${buy ? 'is-on is-buy' : ''}" type="button" data-act="trade-side" data-side="BUY">Buy</button><button class="${!buy ? 'is-on is-sell' : ''}" type="button" data-act="trade-side" data-side="SELL">Sell</button></div>
        <div class="avail"><span>Available</span><b>${buy ? `${money(avail)} USDT` : `${S.hide ? '••••' : qty(avail)} ${esc(row.base)}`}</b><button class="mini-link" type="button" data-act="wallet-deposit">${icon('plus')}</button></div>
        <form class="form" data-form="order" novalidate>
          <label class="field"><span>${buy ? 'Total' : 'Quantity'}</span><div class="control">
            <input id="order-input" name="value" type="text" inputmode="decimal" autocomplete="off" placeholder="${buy ? '0.00' : '0.00000000'}" value="${esc(T.input)}"><b class="suffix">${buy ? 'USDT' : esc(row.base)}</b></div></label>
          <div class="pcts">${[25, 50, 75, 100].map(p => `<button type="button" data-act="trade-pct" data-pct="${p}">${p === 100 ? 'Max' : p + '%'}</button>`).join('')}</div>
          <div class="est"><span>${buy ? 'You get ≈' : 'You receive ≈'}</span><b id="order-est">—</b></div>
          <p class="form-msg" id="order-msg" role="alert"></p>
          <button class="btn btn-lg btn-block ${buy ? 'btn-buy' : 'btn-sell'}" type="submit" ${T.busy ? 'disabled' : ''}>${buy ? 'Buy' : 'Sell'} ${esc(row.base)}</button>
        </form>
        <p class="fine">${icon('info')}Prices follow live Binance quotes; positions are recorded by Portgainy and settled in USDT. No coin custody is implied.</p>
      </section>
    </div>
    <section class="card">${tradeTabs(row)}</section>
  </div>`;
}

function tradeTabs(row) {
  const T = S.trade;
  const tabs = [['positions', 'Positions'], ['orders', 'Orders'], ['alerts', 'Alerts'], ['info', 'Info']];
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="${T.tab === k ? 'is-on' : ''}" type="button" role="tab" data-act="trade-tab" data-tab="${k}">${l}${k === 'alerts' && S.alerts.length ? `<sup>${S.alerts.length}</sup>` : ''}</button>`).join('')}</div><div id="trade-tab-body">${tradeTabBody(row)}</div>`;
}

function tradeTabBody(row) {
  const T = S.trade;
  if (T.tab === 'positions') return positionsList(true);
  if (T.tab === 'orders') {
    const orders = S.portfolio?.orders || [];
    if (!orders.length) return emptyState('receipt', 'No orders yet', 'Filled orders will be listed here.');
    return `<ul class="acts">${orders.slice(0, 20).map(o => `<li class="act"><span class="act-ic ${o.side === 'BUY' ? 'earn' : 'withdraw'}">${icon(o.side === 'BUY' ? 'trendUp' : 'trendDown')}</span><span class="act-copy"><b>${o.side === 'BUY' ? 'Bought' : 'Sold'} ${esc(o.base)}</b><small>${qty(o.quantity)} @ ${price(o.price)} · ${esc(dateText(o.filledAt || o.createdAt || o.at))}</small></span><span class="act-amt ${o.side === 'BUY' ? 'down' : 'up'}">${S.hide ? '••••' : `${o.side === 'BUY' ? '-' : '+'}${usd(o.total)}`}<small>USDT</small></span></li>`).join('')}</ul>`;
  }
  if (T.tab === 'alerts') {
    const list = S.alerts;
    return `<div class="alerts-head"><p>Alerts fire while Portgainy is open.</p><button class="btn btn-ghost btn-sm" type="button" data-act="open-alert">${icon('plus')}New alert</button></div>
      ${list.length ? `<ul class="acts">${list.map(a => `<li class="act"><span class="act-ic transfer">${icon('bell')}</span><span class="act-copy"><b>${esc(a.symbol.replace('USDT', ''))} ${a.dir === 'above' ? 'rises above' : 'falls below'} ${price(a.price)}</b><small>Set ${esc(timeAgo(a.created))}</small></span><button class="icon-btn" type="button" data-act="remove-alert" data-id="${esc(a.id)}" aria-label="Remove alert">${icon('trash')}</button></li>`).join('')}</ul>` : emptyState('bell', 'No price alerts', 'Get notified when a market reaches your target.')}`;
  }
  return `<dl class="facts"><div><dt>Asset</dt><dd>${esc(row.name)} (${esc(row.base)})</dd></div><div><dt>Category</dt><dd>${esc(row.category || '—')}</dd></div><div><dt>Quote</dt><dd>USDT</dd></div><div><dt>24h change</dt><dd class="${tone(row.change)}">${pct(row.change)}</dd></div><div><dt>24h volume</dt><dd>${compact(row.volume)} USDT</dd></div><div><dt>Order size</dt><dd>1 – 10,000 USDT</dd></div><div><dt>Quote validity</dt><dd>${S.spot?.quoteLifetimeSeconds || 15} seconds</dd></div><div><dt>Trading fee</dt><dd>${S.spot ? `${(num(S.spot.feeRate) * 100).toFixed(2)}%` : '—'}</dd></div></dl>`;
}

function positionsList(compactMode = false) {
  const rows = holdings();
  if (!rows.length) return emptyState('layers', 'No open positions', 'Buy a coin with your Spot balance and it will show up here.', compactMode ? '' : '<button class="btn btn-lime btn-sm" data-act="goto" data-view="trade">Start trading</button>');
  return `<ul class="pos">${rows.map(row => {
    const c = coin(row.base), value = num(row.quantity) * num(c?.price), pnl = value - num(row.cost), p = num(row.cost) > 0 ? pnl / num(row.cost) * 100 : 0;
    return `<li class="pos-row"><button type="button" data-act="open-trade" data-symbol="${esc(c?.symbol || row.base + 'USDT')}">${coinMark(row.base, 38)}<span class="pos-name"><b>${esc(row.base)}</b><small>${S.hide ? '••••' : qty(row.quantity)}</small></span><span class="pos-val"><b data-pos-val="${esc(row.base)}">${c ? money(value) : '—'}<small> USDT</small></b><small class="${tone(pnl)}" data-pos-pnl="${esc(row.base)}">${c ? (S.hide ? '••••' : `${pnl >= 0 ? '+' : ''}${usd(pnl)} (${pct(p)})`) : '—'}</small></span></button></li>`;
  }).join('')}</ul>`;
}

function updateOrderEstimate() {
  const T = S.trade, row = coinBySymbol(T.symbol), out = document.querySelector('#order-est');
  if (!row || !out) return;
  const value = num(T.input);
  out.textContent = value > 0 ? (T.side === 'BUY' ? `${qty(value / row.price)} ${row.base}` : `${usd(value * row.price)} USDT`) : '—';
}

async function loadTradeHistory() {
  const T = S.trade, symbol = T.symbol, range = T.range;
  T.token = (T.token || 0) + 1;
  const token = T.token;
  try {
    const data = await api(`/api/markets/history?${new URLSearchParams({ symbol, range })}`, { timeout: 16000 });
    if (token !== T.token || S.view !== 'trade') return;
    T.history = data;
    document.querySelector('#chart-status')?.replaceChildren();
    drawTradeChart();
  } catch {
    if (token === T.token) { const el = document.querySelector('#chart-status'); if (el) el.textContent = 'Price history temporarily unavailable'; }
  }
}

function drawTradeChart() {
  const T = S.trade, canvas = document.querySelector('#trade-chart');
  T.chart?.destroy(); T.chart = null;
  if (!canvas || !T.history?.points?.length) return;
  const points = T.history.points;
  const rising = points.at(-1).price >= points[0].price;
  const color = rising ? '#35e08f' : '#ff4a6e';
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 220);
  gradient.addColorStop(0, rising ? 'rgba(53,224,143,.32)' : 'rgba(255,74,110,.30)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  T.chart = new Chart(canvas, {
    type: 'line',
    data: { labels: points.map(p => new Date(p.time).toLocaleString('en-US', T.range === '1D' || T.range === '1H' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { month: 'short', day: 'numeric' })), datasets: [{ data: points.map(p => p.price), borderColor: color, backgroundColor: gradient, fill: true, pointRadius: 0, pointHitRadius: 12, borderWidth: 2, tension: 0.18 }] },
    options: { animation: false, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: '#111', borderColor: '#2a2a2e', borderWidth: 1, titleColor: '#9a9a96', bodyColor: '#f4f4ef', callbacks: { label: item => `${price(item.raw)} USDT` } } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6c6c68', maxTicksLimit: 4, font: { size: 10 } } }, y: { position: 'right', border: { display: false }, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#6c6c68', maxTicksLimit: 4, font: { size: 10 }, callback: v => price(v) } } } }
  });
}

/* Order flow: request a quote, review it, then confirm. */

let quote = null;
let quoteTimer = null;
let orderUncertain = false;

async function requestQuote(form) {
  const T = S.trade, row = coinBySymbol(T.symbol), msg = form.querySelector('#order-msg');
  if (!row || T.busy) return;
  const value = String(T.input).trim();
  if (!/^\d+(\.\d+)?$/.test(value) || num(value) <= 0) { msg.textContent = T.side === 'BUY' ? 'Enter the USDT amount you want to spend.' : 'Enter the quantity you want to sell.'; return; }
  msg.textContent = ''; T.busy = true;
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  const owner = S.user.id;
  try {
    const result = await api('/api/spot/quote', { method: 'POST', body: { symbol: T.symbol, side: T.side, ...(T.side === 'BUY' ? { amount: value } : { quantity: value }) }, timeout: 16000 });
    if (S.user?.id !== owner) return;
    quote = result; orderUncertain = false;
    openQuoteSheet();
  } catch (error) {
    msg.textContent = errMsg(error);
  } finally { T.busy = false; button.disabled = false; }
}

function openQuoteSheet(note = '') {
  const q = quote, buy = q.side === 'BUY';
  openSheet(`${sheetHead(`${buy ? 'Buy' : 'Sell'} ${q.base}`, 'Review your order')}
    <div class="quote-hero">${coinMark(q.base, 52)}<strong>${qty(q.quantity)} <small>${esc(q.base)}</small></strong><span>${buy ? 'for' : 'receive'} ${usd(q.total)} USDT</span></div>
    <dl class="facts"><div><dt>Price</dt><dd>${price(q.price)} USDT</dd></div><div><dt>Fee</dt><dd>${usd(q.fee)} USDT</dd></div><div><dt>${buy ? 'Total cost' : 'Total received'}</dt><dd><b>${usd(q.total)} USDT</b></dd></div></dl>
    <p class="quote-timer" data-quote-expiry></p>
    <p class="form-msg" id="quote-msg" role="alert">${esc(note)}</p>
    <div class="sheet-actions"><button class="btn btn-ghost" type="button" data-act="close-sheet">Cancel</button><button class="btn ${buy ? 'btn-buy' : 'btn-sell'}" type="button" data-act="confirm-order" data-confirm-order>${orderUncertain ? 'Check order' : 'Confirm'}</button></div>`,
  { label: 'Confirm order', onClose: () => { clearInterval(quoteTimer); if (!orderUncertain) quote = null; } });
  clearInterval(quoteTimer);
  quoteTimer = setInterval(tickQuote, 500); tickQuote();
}

function tickQuote() {
  if (!quote) return clearInterval(quoteTimer);
  const seconds = Math.max(0, Math.ceil((quote.expiresAt - Date.now()) / 1000));
  const label = document.querySelector('[data-quote-expiry]'), button = document.querySelector('[data-confirm-order]');
  if (label) label.innerHTML = seconds ? `${icon('clock')}Quote valid for <b>${seconds}s</b>` : `${icon('clock')}Quote expired — close and review again`;
  if (button) button.disabled = S.trade.busy || (!seconds && !orderUncertain);
}

async function confirmOrder() {
  const T = S.trade;
  if (!quote || T.busy) return;
  const owner = S.user.id, id = quote.id, msg = document.querySelector('#quote-msg');
  T.busy = true; tickQuote();
  try {
    const result = await api('/api/spot/orders', { method: 'POST', body: { quoteId: id }, timeout: 16000 });
    if (S.user?.id !== owner) return;
    S.user = result.user; S.activities = result.activities; S.portfolio = result.portfolio;
    orderUncertain = false; quote = null; T.input = '';
    closeSheet(); render(); toast('Order filled', 'ok', 'Trade complete');
  } catch (error) {
    orderUncertain = !error.status;
    if (msg) msg.textContent = orderUncertain ? 'No response received. Tap “Check order” to confirm the same order safely.' : errMsg(error);
    const button = document.querySelector('[data-confirm-order]'); if (button && orderUncertain) button.textContent = 'Check order';
  } finally { T.busy = false; tickQuote(); }
}

function pickPair() {
  const sheet = openSheet(`${sheetHead('Choose market', 'Spot · USDT')}<div class="search-field"><span>${icon('search')}</span><input id="pair-search" type="search" placeholder="Search coin" autocomplete="off" autofocus></div><div class="mlist sheet-list" id="pair-list"></div>`, { label: 'Choose market' });
  const fill = text => {
    const q = text.trim().toLowerCase();
    const rows = sortedMarkets('hot').filter(r => !q || `${r.base} ${r.name}`.toLowerCase().includes(q));
    sheet.querySelector('#pair-list').innerHTML = rows.length ? rows.map(r => marketRow(r)).join('') : emptyState('search', 'No match');
  };
  fill('');
  sheet.querySelector('#pair-search').addEventListener('input', event => fill(event.target.value));
}

/* Price alerts live in the browser and are checked on every live tick. */

function openAlertSheet() {
  const row = coinBySymbol(S.trade.symbol);
  if (!row) return;
  openSheet(`${sheetHead(`${row.base} price alert`, `Current price ${price(row.price)} USDT`)}
    <form class="form" data-form="alert" novalidate>
      <div class="seg"><button class="is-on" type="button" data-act="alert-dir" data-dir="above">Rises above</button><button type="button" data-act="alert-dir" data-dir="below">Falls below</button></div>
      <input type="hidden" name="dir" value="above">
      <label class="field"><span>Target price</span><div class="control"><input name="price" type="text" inputmode="decimal" placeholder="${esc(price(row.price))}" autofocus><b class="suffix">USDT</b></div></label>
      <p class="form-msg" id="alert-msg" role="alert"></p>
      <button class="btn btn-lime btn-lg btn-block" type="submit">${icon('bellPlus')}Create alert</button>
      <p class="fine">${icon('info')}Alerts are stored on this device and trigger while Portgainy is open.</p>
    </form>`, { label: 'Price alert' });
}

function checkAlerts() {
  if (!S.alerts.length) return;
  const fired = [];
  S.alerts = S.alerts.filter(a => {
    const row = coinBySymbol(a.symbol);
    if (!row) return true;
    const hit = a.dir === 'above' ? row.price >= a.price : row.price <= a.price;
    if (hit) fired.push([a, row]);
    return !hit;
  });
  if (!fired.length) return;
  store.write('pg_alerts', S.alerts);
  for (const [a, row] of fired) toast(`${row.base} ${a.dir === 'above' ? 'rose above' : 'fell below'} ${price(a.price)} — now ${price(row.price)}`, 'warn', 'Price alert');
  if (S.view === 'trade') document.querySelector('#trade-tab-body') && (document.querySelector('#trade-tab-body').innerHTML = tradeTabBody(coinBySymbol(S.trade.symbol)));
}

/* ---------------------------------------------------------------- assets */

function assetsView() {
  const u = S.user, pnl = unrealized();
  const tabs = [['overview', 'Overview'], ['spot', 'Spot'], ['earn', 'Earn'], ['history', 'History']];
  let body = '';
  if (S.assetsTab === 'overview') {
    body = `${allocationCard()}<section class="card">${sectionHead('Balance')}${balanceRows()}</section>`;
  } else if (S.assetsTab === 'spot') {
    body = `<section class="card">${sectionHead('Spot account', '<span class="tag">Trading · Withdraw</span>')}<div class="acct"><div>${usdtMark(40)}<span><b>USDT</b><small>Available to trade or withdraw</small></span></div><strong>${money(u.withdrawBalance)}</strong></div>
      <div class="btn-row"><button class="btn btn-lime" data-act="wallet-transfer">${icon('transfer')}Transfer</button><button class="btn btn-ghost" data-act="wallet-withdraw">${icon('withdraw')}Withdraw</button><button class="btn btn-ghost" data-act="goto" data-view="trade">${icon('candles')}Trade</button></div>
      ${num(u.reservedBalance) > 0 ? `<p class="note">${icon('clock')}Reserved for pending withdrawals: <b>${money(u.reservedBalance)} USDT</b></p>` : ''}</section>
      <section class="card">${sectionHead('Crypto positions', `<span class="${tone(pnl.amount)} tag">${holdings().length ? (S.hide ? '••••' : `${pnl.amount >= 0 ? '+' : ''}${usd(pnl.amount)}`) : '—'}</span>`)}${positionsList()}</section>`;
  } else if (S.assetsTab === 'earn') {
    body = `<section class="card">${sectionHead('Earn account', '<span class="tag">Daily rewards</span>')}<div class="acct"><div>${usdtMark(40)}<span><b>USDT</b><small>Principal for daily rewards</small></span></div><strong>${money(u.lockedBalance)}</strong></div>
      <div class="btn-row"><button class="btn btn-lime" data-act="wallet-deposit">${icon('deposit')}Deposit</button><button class="btn btn-ghost" data-act="wallet-transfer">${icon('transfer')}Move from Spot</button><button class="btn btn-ghost" data-act="goto" data-view="earn">${icon('earn')}Open Earn</button></div></section>
      ${claimStrip()}`;
  } else {
    const filters = [['all', 'All'], ['deposit', 'Deposits'], ['withdraw', 'Withdrawals'], ['transfer', 'Transfers'], ['trades', 'Trades'], ['rewards', 'Rewards']];
    body = `<section class="card"><div class="sec-head"><h2>Transactions</h2><button class="btn btn-ghost btn-sm" type="button" data-act="export-history" ${S.activities.length ? '' : 'disabled'}>${icon('download')}CSV</button></div>
      <div class="chips">${filters.map(([k, l]) => `<button class="${S.historyFilter === k ? 'is-on' : ''}" type="button" data-act="history-filter" data-filter="${k}">${l}</button>`).join('')}</div>
      <div id="history-body">${activityList(0, S.historyFilter)}</div></section>
      <section class="card" id="withdraw-status">${sectionHead('Withdrawal requests')}${withdrawalsList()}</section>`;
  }
  return `<div class="page assets">
    <header class="page-head"><div><h1>Assets</h1><p>Spot · Earn · Crypto</p></div><button class="icon-btn" type="button" data-act="toggle-hide" aria-label="Toggle balances">${icon(S.hide ? 'eyeOff' : 'eye')}</button></header>
    <article class="hero-card is-compact">
      <div class="hero-top"><span class="hero-label">Est. total value</span></div>
      <div class="hero-num"><strong data-total>${S.hide ? '••••••' : usd(totalValue())}</strong><span>USDT</span></div>
      <div class="hero-sub"><span>≈ $<span data-total-usd>${S.hide ? '••••' : usd(totalValue())}</span></span>${holdings().length ? `<span class="pnl ${tone(pnl.amount)}" data-pnl>${S.hide ? '••••' : `${pnl.amount >= 0 ? '+' : ''}${usd(pnl.amount)} (${pct(pnl.percent)})`}<small>Unrealized PNL</small></span>` : ''}</div>
      <div class="quick">${[['wallet-deposit', 'deposit', 'Add Funds'], ['wallet-withdraw', 'withdraw', 'Send'], ['wallet-transfer', 'transfer', 'Transfer'], ['goto', 'earn', 'Earn', 'earn']].map(([act, glyph, label, view]) => `<button type="button" data-act="${act}" ${view ? `data-view="${view}"` : ''}><span class="quick-ic">${icon(glyph)}</span><span>${label}</span></button>`).join('')}</div>
    </article>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="${S.assetsTab === k ? 'is-on' : ''}" type="button" role="tab" data-act="assets-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}
  </div>`;
}

function balanceRows() {
  const u = S.user;
  const usdtRows = [
    ['Spot account', 'Available to trade or withdraw', u.withdrawBalance, `<button class="btn btn-chip" data-act="wallet-transfer">Transfer</button><button class="btn btn-chip" data-act="goto" data-view="trade">Trade</button>`],
    ['Earn account', 'Principal for daily rewards', u.lockedBalance, `<button class="btn btn-chip" data-act="wallet-deposit">Deposit</button><button class="btn btn-chip" data-act="goto" data-view="earn">Earn</button>`]
  ].map(([title, sub, value, buttons]) => `<article class="bal"><div class="bal-main">${usdtMark(38)}<span class="bal-name"><b>USDT</b><small>${title}</small></span><span class="bal-val"><b>${money(value)}</b><small>${S.hide ? '••••' : `${usd(value)} USDT`}</small></span></div><div class="bal-btns">${buttons}</div></article>`);
  const cryptoRows = holdings().map(row => {
    const c = coin(row.base), value = num(row.quantity) * num(c?.price), pnl = value - num(row.cost), p = num(row.cost) > 0 ? pnl / num(row.cost) * 100 : 0;
    return `<article class="bal"><div class="bal-main">${coinMark(row.base, 38)}<span class="bal-name"><b>${esc(row.base)}</b><small>${esc(c?.name || row.base)}</small></span><span class="bal-val"><b>${S.hide ? '••••' : qty(row.quantity)}</b><small>${c ? moneyUsdt(value) : '—'}</small></span></div>
      <div class="bal-pnl"><span>Unrealized PNL</span><b class="${tone(pnl)}">${S.hide ? '••••' : `${pnl >= 0 ? '+' : ''}${usd(pnl)} USDT (${pct(p)})`}</b></div>
      <div class="bal-btns"><button class="btn btn-chip" data-act="goto" data-view="earn">Earn</button><button class="btn btn-chip" data-act="open-trade" data-symbol="${esc(c?.symbol || row.base + 'USDT')}">Trade</button></div></article>`;
  });
  return `<div class="bals">${[...usdtRows, ...cryptoRows].join('')}</div>`;
}

function withdrawalsList() {
  const rows = S.wallet.withdrawals;
  if (!rows) return `<div class="skeleton-list"><i class="skeleton"></i><i class="skeleton"></i></div>`;
  if (!rows.length) return emptyState('withdraw', 'No withdrawals', 'Your withdrawal requests and their status will show here.');
  return `<ul class="acts">${rows.map(w => `<li class="act"><span class="act-ic withdraw">${icon('withdraw')}</span><span class="act-copy"><b>${usd(w.amount)} USDT <em class="st withdrawal-state st-${esc(w.status)}">${esc(withdrawStatus(w))}</em></b><small>${esc(dateText(w.createdAt))} · to ${esc(shortAddress(w.destination))}${/^[a-f0-9]{64}$/.test(w.txid || '') ? ` · <a href="https://tronscan.org/#/transaction/${w.txid}" target="_blank" rel="noopener noreferrer">TXID</a>` : ''}</small></span><span class="act-amt">${S.hide ? '••••' : usd(w.netAmount)}<small>net</small></span></li>`).join('')}</ul>`;
}

const shortAddress = value => (String(value || '').length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : String(value || ''));

function exportHistory() {
  const quoteCell = value => { const text = String(value ?? ''); return `"${(/^[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`; };
  const rows = [['Type', 'Date', 'Amount USDT', 'Status', 'Net USDT', 'Fee USDT', 'TxID'], ...S.activities.map(a => [activityTitle(a), a.at, num(a.amount), a.status || '', a.netAmount ?? '', a.fee ?? '', a.txid || ''])];
  const blob = new Blob(['﻿' + rows.map(r => r.map(quoteCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'portgainy-transactions.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------- wallet sheets */

function applyPayConfig(config = {}) {
  const mode = ['tron-watch-only', 'test-wallet', 'production-redirect'].includes(config.mode) ? config.mode : 'disabled';
  if (S.pay.mode !== mode || config.available !== true) S.pay.wallet = null;
  S.pay.mode = mode;
  S.pay.origin = mode === 'production-redirect' && config.origin === 'https://taskmall.app' ? config.origin : null;
  S.pay.available = mode !== 'disabled' && config.available === true;
  S.pay.withdrawals = mode !== 'disabled' && config.withdrawalsAvailable === true;
  S.pay.automaticWithdrawals = config.automaticWithdrawals === true;
  const min = Number(config.minimumWithdrawalAmount);
  S.pay.minimum = Number.isFinite(min) && min >= 10 ? min : 10;
  S.pay.networks = Array.isArray(config.networks) ? config.networks : [];
}

async function loadDepositAddress() {
  if (S.pay.mode !== 'tron-watch-only' || !S.pay.available || S.pay.wallet) return;
  S.pay.wallet = await api('/api/wallet/deposit-address', { method: 'POST', body: {}, timeout: 15000 });
}

let walletToken = 0;

async function openWallet(type) {
  if (!S.user) return;
  const token = ++walletToken;
  const meta = { deposit: ['Add funds', 'Deposit USDT to your Earn account'], withdraw: ['Send USDT', 'Withdraw from your Spot account'], transfer: ['Transfer', 'Move USDT from Spot to Earn'] }[type];
  openSheet(`${sheetHead(meta[0], meta[1])}<div class="sheet-loading"><i class="spinner"></i><span>${type === 'transfer' ? 'Preparing…' : 'Checking payment availability…'}</span></div>`, { label: meta[0] });
  try {
    if (type !== 'transfer') {
      applyPayConfig(await api('/api/payment-config', { timeout: 15000 }));
      if (type === 'deposit') await loadDepositAddress();
    }
    if (token !== walletToken) return;
    openSheet(walletSheet(type, meta), { label: meta[0] });
    bindWalletSheet(type);
  } catch (error) {
    if (token !== walletToken) return;
    openSheet(`${sheetHead(meta[0], meta[1])}${emptyState('info', 'Temporarily unavailable', errMsg(error), `<button class="btn btn-lime btn-sm" data-act="retry-wallet" data-type="${type}">Try again</button>`)}`, { label: meta[0] });
  }
}

function maxAmount() { return clamp(num(S.user.withdrawBalance), 0, 100000).toFixed(6).replace(/\.?0+$/, '') || '0'; }

function amountField(type) {
  const min = type === 'withdraw' ? S.pay.minimum : '0.000001';
  return `<div class="avail"><span>Available Spot balance</span><b data-wallet-available>${money(S.user.withdrawBalance)} USDT</b></div>
    <label class="field"><span>Amount</span><div class="control"><input id="wallet-amount" name="amount" type="number" inputmode="decimal" min="${min}" max="100000" step="0.000001" placeholder="0.00" required><b class="suffix">USDT</b><button class="max-btn" type="button" data-act="wallet-max">MAX</button></div></label>${type === 'withdraw' ? `<p class="hint" id="withdrawal-minimum">Minimum withdrawal request: ${S.pay.minimum} USDT.</p>` : ''}`;
}

function networkSelect() {
  if (S.pay.networks.length < 2) return S.pay.networks[0] ? `<input type="hidden" name="network" value="${esc(S.pay.networks[0].id)}"><div class="net-chip">${icon('globe')}${esc(S.pay.networks[0].label)}</div>` : '';
  return `<label class="field"><span>Network</span><div class="control select">${icon('globe')}<select name="network" data-deposit-network>${S.pay.networks.map(n => `<option value="${esc(n.id)}">${esc(n.label)}</option>`).join('')}</select></div></label>`;
}

function walletSheet(type, meta) {
  const head = sheetHead(meta[0], meta[1]);
  const unavailable = text => `${head}${emptyState('info', 'Temporarily unavailable', text, `<button class="btn btn-lime btn-sm" data-act="retry-wallet" data-type="${type}">Try again</button>`)}`;
  if (type !== 'transfer' && S.pay.mode === 'production-redirect' && S.pay.origin) {
    return `${head}<p class="note">${icon('shield')}For your security, this action opens on our verified payments site.</p><a class="btn btn-lime btn-lg btn-block" href="${esc(S.pay.origin)}/?wallet=${type}#wallet" rel="noopener">Continue securely${icon('external')}</a>`;
  }
  if (type === 'deposit') {
    if (!S.pay.available) return unavailable('Deposits are temporarily unavailable.');
    if (S.pay.mode === 'tron-watch-only') {
      const w = S.pay.wallet;
      if (!w) return unavailable('Deposits are temporarily unavailable.');
      return `${head}<div class="dep">
        <div class="dep-net"><span class="tag tag-lime">USDT</span><span class="tag">TRON · TRC20</span></div>
        <div class="qr"><img class="deposit-qr" src="${esc(w.qr)}" width="180" height="180" alt="Deposit QR code"></div>
        <label class="field"><span>Deposit address</span><div class="control addr"><input id="dep-address" type="text" value="${esc(w.address)}" readonly><button class="max-btn" type="button" data-act="copy-address">COPY</button></div></label>
        <ul class="steps"><li>${icon('shield')}Send only USDT on the TRON (TRC20) network.</li><li>${icon('clock')}Your balance updates automatically after blockchain confirmation.</li><li>${icon('earn')}Deposits credit your Earn account.</li></ul>
        <a class="link-btn" href="${esc(w.explorer)}" target="_blank" rel="noopener noreferrer">View address on TRONSCAN ${icon('external')}</a></div>`;
    }
    const first = S.pay.networks[0] || { address: '' };
    return `${head}<form class="form modal-wallet-form" data-form="wallet" data-wallet-form="deposit" data-type="deposit">${networkSelect()}<label class="field"><span>Deposit address</span><div class="control addr"><input id="dep-address" data-deposit-address type="text" value="${esc(first.address)}" readonly><button class="max-btn" type="button" data-act="copy-address">COPY</button></div></label>
      <label class="field"><span>Amount</span><div class="control"><input name="amount" type="number" min="5" step="0.01" placeholder="25.00" required><b class="suffix">USDT</b></div></label><p class="form-msg" role="alert"></p><button class="btn btn-lime btn-lg btn-block" type="submit">Add to Earn</button></form>`;
  }
  if (type === 'withdraw') {
    if (!S.pay.withdrawals) return unavailable('Withdrawals are temporarily unavailable.');
    const strict = S.pay.mode === 'tron-watch-only';
    const fee = num(S.user.withdrawalFeeRate, 0.02), bps = BigInt(Math.round(fee * 10000));
    return `${head}<form class="form modal-wallet-form" data-form="wallet" data-wallet-form="withdraw" data-type="withdraw">${networkSelect()}${amountField('withdraw')}
      <label class="field"><span>Wallet address</span><div class="control">${icon('wallet')}<input name="wallet" type="text" minlength="${strict ? 34 : 12}" maxlength="${strict ? 34 : 120}" placeholder="${strict ? 'TRON (TRC20) address' : 'USDT wallet address'}" autocomplete="off" spellcheck="false" required></div></label>
      ${strict ? `<label class="field"><span>Confirm account password</span><div class="control">${icon('lock')}<input name="password" type="password" autocomplete="current-password" maxlength="128" required></div></label>` : ''}
      <div class="summary"><span>Fee (${+(fee * 100).toFixed(2)}%)</span><output data-withdraw-fee>0.00 USDT</output><span>You receive</span><output data-withdraw-net>0.00 USDT</output></div>
      <p class="form-msg" role="alert"></p><button class="btn btn-lime btn-lg btn-block" type="submit">Request withdrawal</button>
      <p class="fine">${icon('info')}${S.pay.automaticWithdrawals ? 'Withdrawals are processed automatically when funds and network resources are available.' : 'Withdrawals are reviewed before they are sent.'} Never share your password or seed phrase with anyone.</p></form>`;
  }
  return `${head}<form class="form modal-wallet-form" data-form="wallet" data-wallet-form="transfer" data-type="transfer"><div class="route"><span>${icon('wallet')}Spot</span>${icon('arrow')}<span>${icon('earn')}Earn</span></div>${amountField('transfer')}<p class="form-msg" role="alert"></p><button class="btn btn-lime btn-lg btn-block" type="submit">Transfer to Earn</button><p class="fine">${icon('info')}Funds in Earn generate your daily reward. Move them back only through a withdrawal review.</p></form>`;
}

function bindWalletSheet(type) {
  const amount = document.querySelector('#wallet-amount');
  if (type === 'withdraw' && amount) {
    const bps = BigInt(Math.round(num(S.user.withdrawalFeeRate, 0.02) * 10000));
    const update = () => {
      let net = 0, fee = 0;
      if (/^\d+(\.\d{1,6})?$/.test(amount.value) && Number(amount.value) <= 100000) {
        const [whole, fraction = ''] = amount.value.split('.');
        const gross = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
        const cut = (gross * bps + 5000n) / 10000n;
        fee = Number(cut) / 1e6; net = Number(gross - cut) / 1e6;
      }
      document.querySelector('[data-withdraw-fee]').textContent = `${usd(fee)} USDT`;
      document.querySelector('[data-withdraw-net]').textContent = `${usd(net)} USDT`;
    };
    amount.addEventListener('input', update);
    document.querySelector('[data-act="wallet-max"]')?.addEventListener('click', () => setTimeout(update));
  }
  document.querySelector('[data-deposit-network]')?.addEventListener('change', event => {
    const field = document.querySelector('[data-deposit-address]');
    if (field) field.value = S.pay.networks.find(n => n.id === event.target.value)?.address || '';
  });
}

async function submitWallet(form) {
  if (S.busy) return;
  const type = form.dataset.type, data = new FormData(form), msg = form.querySelector('.form-msg'), button = form.querySelector('button[type="submit"]');
  const endpoints = { deposit: '/api/wallet/deposit', withdraw: '/api/wallet/withdraw', transfer: '/api/wallet/transfer' };
  const done = { deposit: 'Deposit added to Earn', withdraw: 'Withdrawal requested', transfer: 'Transferred to Earn' };
  const amount = data.get('amount');
  if (!(num(amount) > 0)) { msg.textContent = 'Enter a valid USDT amount.'; return; }
  S.busy = true; button.disabled = true; msg.textContent = '';
  try {
    const body = { amount };
    if (data.has('wallet')) body.wallet = data.get('wallet');
    if (data.has('network')) body.network = data.get('network');
    if (type === 'withdraw' && S.pay.mode === 'tron-watch-only') {
      form.dataset.requestKey ||= crypto.randomUUID();
      body.requestKey = form.dataset.requestKey; body.password = data.get('password');
    }
    const result = await api(endpoints[type], { method: 'POST', body });
    if (result.user) S.user = result.user;
    if (result.activities) S.activities = result.activities;
    closeSheet();
    await refreshAccount();
    render();
    toast(done[type], 'ok', type === 'withdraw' ? 'Request sent' : 'Done');
  } catch (error) {
    msg.textContent = errMsg(error); button.disabled = false;
  } finally { S.busy = false; }
}

/* ------------------------------------------------------- search & notices */

const PAGES = [['home', 'Home', 'home'], ['markets', 'Markets', 'chart'], ['trade', 'Trade', 'candles'], ['earn', 'Earn', 'earn'], ['assets', 'Assets', 'wallet'], ['referrals', 'Referrals', 'users'], ['profile', 'Profile', 'user'], ['support', 'Support', 'headset'], ['about', 'About', 'building']];

function openSearch() {
  const sheet = openSheet(`<div class="search-field is-large"><span>${icon('search')}</span><input id="global-search" type="search" placeholder="Search coins, pages…" autocomplete="off" autofocus></div><div class="sheet-list" id="global-results"></div>`, { label: 'Search', wide: true });
  const fill = text => {
    const q = text.trim().toLowerCase();
    const coins = sortedMarkets('hot').filter(r => !q || `${r.base} ${r.name}`.toLowerCase().includes(q)).slice(0, q ? 12 : 6);
    const pages = PAGES.filter(p => !q || p[1].toLowerCase().includes(q));
    sheet.querySelector('#global-results').innerHTML = `${coins.length ? `<h3 class="mini-title">Markets</h3><div class="mlist">${coins.map(r => marketRow(r)).join('')}</div>` : ''}${pages.length ? `<h3 class="mini-title">Pages</h3><div class="pages-list">${pages.map(([view, label, glyph]) => `<button type="button" data-act="goto" data-view="${view}">${icon(glyph)}<span>${label}</span>${icon('chevron')}</button>`).join('')}</div>` : ''}${!coins.length && !pages.length ? emptyState('search', 'No results') : ''}`;
  };
  fill('');
  sheet.querySelector('#global-search').addEventListener('input', event => fill(event.target.value));
}

function openNotices() {
  const acts = S.activities.slice(0, 12);
  const promo = S.user.referralPromotion;
  openSheet(`${sheetHead('Notifications', 'Account activity')}${activityList(12)}${acts.length ? '' : ''}`, { label: 'Notifications' });
}

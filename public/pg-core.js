'use strict';

/* Portgainy core: state, API client, formatting, icons, router, toasts and sheets. */

const app = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');
const sheetRoot = document.querySelector('#sheet-root');

const store = {
  read(key, fallback) { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
};

const S = {
  loading: true, user: null, view: 'home', params: [],
  activities: [], team: null, earn: null, referrals: null, portfolio: null, serverOffset: 0,
  markets: [], marketStatus: 'loading', marketUpdated: null,
  pay: { mode: 'disabled', available: false, withdrawals: false, minimum: 10, networks: [], origin: null, wallet: null },
  hide: store.read('pg_hide', false),
  favorites: store.read('pg_favorites', ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']),
  alerts: store.read('pg_alerts', []),
  authMode: 'login', referralCode: '', busy: false,
  marketTab: 'hot', marketCategory: 'all', marketQuery: '',
  assetsTab: 'overview', historyFilter: 'all',
  trade: { symbol: store.read('pg_last_symbol', 'BTCUSDT'), side: 'BUY', input: '', range: '1D', tab: 'positions', history: null, chart: null, busy: false },
  chat: { messages: [], busy: false },
  admin: null, adminTab: 'withdrawals', adminFilter: 'pending', adminSearch: '', adminArmed: null,
  wallet: { withdrawals: null, deposits: null }
};

/* ------------------------------------------------------------- utilities */

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf6 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const nf8 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const nfCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

const mask = text => (S.hide ? '••••••' : text);
const usd = value => nf6.format(num(value));
const usdt = value => `${usd(value)} USDT`;
const money = value => mask(usd(value));
const moneyUsdt = value => mask(usdt(value));
const qty = value => nf8.format(num(value));
const compact = value => nfCompact.format(num(value));

function price(value) {
  const n = num(value);
  if (n <= 0) return '—';
  if (n >= 1000) return nf2.format(n);
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 10 });
}

const pct = value => `${num(value) > 0 ? '+' : ''}${num(value).toFixed(2)}%`;
const tone = value => (num(value) >= 0 ? 'up' : 'down');

function dateText(value, long = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', long ? { year: 'numeric', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const serverNow = () => Date.now() + S.serverOffset;

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
}

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'Player';
  const name = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
  return name.length >= 2 ? name : 'Player';
}

/* ----------------------------------------------------------------- icons */

const ICONS = {
  logo: 'Boxes', check: 'Check', mail: 'Mail', user: 'UserRound', users: 'UsersRound', lock: 'LockKeyhole',
  eye: 'Eye', eyeOff: 'EyeOff', arrow: 'ArrowRight', arrowUp: 'ArrowUp', arrowDown: 'ArrowDown', home: 'House',
  chart: 'ChartNoAxesCombined', candles: 'ChartCandlestick', wallet: 'Wallet', deposit: 'ArrowDownToLine', withdraw: 'ArrowUpFromLine',
  transfer: 'ArrowLeftRight', gift: 'Gift', earn: 'Gem', copy: 'Copy', link: 'Link', close: 'X', logout: 'LogOut',
  info: 'Info', search: 'Search', bell: 'Bell', bellPlus: 'BellPlus', headset: 'Headset', chevron: 'ChevronRight', chevronDown: 'ChevronDown',
  shield: 'ShieldCheck', settings: 'Settings2', retry: 'RefreshCw', star: 'Star', flame: 'Flame', trophy: 'Trophy',
  bolt: 'Zap', clock: 'Clock3', download: 'Download', share: 'Share2', qr: 'QrCode', send: 'SendHorizontal', bot: 'Bot',
  building: 'Building2', list: 'ListFilter', target: 'Target', swords: 'Swords', crown: 'Crown', sparkles: 'Sparkles',
  trendUp: 'TrendingUp', trendDown: 'TrendingDown', globe: 'Globe', plus: 'Plus', minus: 'Minus', trash: 'Trash2',
  history: 'History', receipt: 'ReceiptText', fingerprint: 'Fingerprint', help: 'CircleHelp', external: 'ExternalLink', pie: 'ChartPie',
  layers: 'Layers', coins: 'Coins', rocket: 'Rocket', mailCheck: 'MailCheck', key: 'KeyRound', menu: 'Menu', gamepad: 'Gamepad2'
};

function icon(name, cls = '') {
  const glyph = lucide.icons[ICONS[name]] || lucide.icons.Sparkles;
  return lucide.createElement(glyph, { class: `ic ${cls}`.trim(), 'aria-hidden': 'true', 'stroke-width': 1.9 }).outerHTML;
}

/* ------------------------------------------------------------------ coins */

function coin(base) { return S.markets.find(row => row.base === base); }
function coinBySymbol(symbol) { return S.markets.find(row => row.symbol === symbol); }

function coinMark(base, size = 36, color) {
  const src = typeof COIN_LOGOS === 'object' ? COIN_LOGOS[base] : '';
  const row = coin(base);
  const tint = color || row?.color || '#5b6270';
  return src
    ? `<span class="coin-mark" style="--s:${size}px"><img src="${esc(src)}" width="${size}" height="${size}" alt="" decoding="async" loading="lazy"></span>`
    : `<span class="coin-mark is-letter" style="--s:${size}px;--tint:${esc(tint)}">${esc(String(base).slice(0, 2))}</span>`;
}

const usdtMark = (size = 36) => `<span class="coin-mark is-usdt" style="--s:${size}px"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#26a17b"/><path fill="#fff" d="M17.9 17.2v-.001c-.1.008-.62.04-1.78.04-.92 0-1.58-.03-1.81-.04v.001c-3.56-.16-6.22-.78-6.22-1.52 0-.74 2.66-1.36 6.22-1.52v2.42c.23.02.9.06 1.83.06 1.1 0 1.66-.05 1.76-.06v-2.42c3.55.16 6.2.78 6.2 1.52 0 .74-2.65 1.36-6.2 1.52m0-3.29v-2.17h4.95V8.44H9.19v3.3h4.95v2.17c-4.02.18-7.04.98-7.04 1.94 0 .96 3.02 1.76 7.04 1.94v6.95h3.76v-6.95c4.01-.18 7.03-.98 7.03-1.94 0-.96-3.02-1.76-7.03-1.94"/></svg></span>`;

/* ------------------------------------------------------------------- API */

const ERRORS = {
  INVALID_NAME: 'Name must be between 2 and 50 characters.',
  INVALID_EMAIL: 'Enter a valid email address.',
  WEAK_PASSWORD: 'Use at least 8 characters with one letter and one number.',
  EMAIL_EXISTS: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  TOO_MANY_REQUESTS: 'Too many attempts. Try again in a little while.',
  AUTH_REQUIRED: 'Your session ended. Please sign in again.',
  INVALID_AMOUNT: 'Enter a valid USDT amount.',
  INVALID_WALLET: 'Enter a valid USDT wallet address.',
  INVALID_NETWORK: 'Choose a supported network.',
  INVALID_REFERRAL: 'Invite code was not found.',
  INSUFFICIENT_WITHDRAW_BALANCE: 'Not enough Spot balance.',
  PASSWORD_CONFIRMATION_REQUIRED: 'Your account password is incorrect.',
  PAYMENTS_UNAVAILABLE: 'Deposits and withdrawals are temporarily unavailable.',
  DEPOSITS_UNAVAILABLE: 'Deposits are temporarily unavailable. Please try again later.',
  EARN_MINIMUM_REQUIRED: 'Earn starts at 200 USDT. Add funds to your Earn balance to start claiming.',
  INSUFFICIENT_SPOT_BALANCE: 'Not enough Spot balance.',
  INSUFFICIENT_ASSET_BALANCE: 'Not enough of this asset.',
  SPOT_LIQUIDITY_UNAVAILABLE: 'Liquidity for this asset is currently insufficient. No funds were deducted.',
  QUOTE_EXPIRED: 'Quote expired. Review a new order.',
  QUOTE_PRICE_CHANGED: 'The price changed. Review a new quote.',
  QUOTE_UNAVAILABLE: 'Live pricing is temporarily unavailable.',
  SPOT_NOT_ACTIVE: 'Trading is temporarily unavailable.',
  ADMIN_REQUIRED: 'This page is for administrators only.',
  WITHDRAWAL_ALREADY_IN_PROGRESS: 'This request was already processed. Refresh the list.',
  WITHDRAWAL_NOT_FOUND: 'The request was not found.'
};

const errMsg = error => ERRORS[error?.code] || 'Something went wrong. Please try again.';

async function api(path, options = {}) {
  const hasBody = options.body !== undefined;
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin', cache: 'no-store',
    signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
  });
  let data = {};
  try { data = await response.json(); } catch { /* response without a JSON body */ }
  if (!response.ok) {
    const error = new Error(data.error || 'REQUEST_FAILED');
    error.code = data.error; error.status = response.status; error.data = data;
    throw error;
  }
  return data;
}

/* ---------------------------------------------------------------- toasts */

function toast(message, kind = 'ok', title) {
  const el = document.createElement('div');
  el.className = `toast is-${kind}`;
  const glyph = kind === 'ok' ? 'check' : kind === 'warn' ? 'bell' : 'info';
  el.innerHTML = `<span class="toast-badge">${icon(glyph)}</span><span class="toast-copy"><em>${esc(title || (kind === 'ok' ? 'Success' : kind === 'warn' ? 'Alert' : 'Notice'))}</em><b>${esc(message)}</b></span><i class="toast-shine"></i>`;
  toastRegion.append(el);
  setTimeout(() => el.classList.add('is-out'), 3400);
  setTimeout(() => el.remove(), 3900);
}

/* ---------------------------------------------------------------- sheets */

let sheetEl = null;
let sheetOnClose = null;

function openSheet(html, { wide = false, onClose, label = 'Dialog' } = {}) {
  closeSheet(true);
  sheetEl = document.createElement('div');
  sheetEl.className = `sheet-backdrop${wide ? ' is-wide' : ''}`;
  sheetEl.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="sheet-grip" aria-hidden="true"></span>${html}</section>`;
  sheetEl.addEventListener('mousedown', event => { if (event.target === sheetEl) closeSheet(); });
  sheetRoot.append(sheetEl);
  document.body.classList.add('has-sheet');
  sheetOnClose = onClose || null;
  requestAnimationFrame(() => {
    sheetEl?.classList.add('is-open');
    const focus = sheetEl?.querySelector('[autofocus],input:not([type=hidden]),button.sheet-x');
    focus?.focus({ preventScroll: true });
  });
  return sheetEl;
}

function closeSheet(immediate = false) {
  if (!sheetEl) return;
  const el = sheetEl, callback = sheetOnClose;
  sheetEl = null; sheetOnClose = null;
  document.body.classList.remove('has-sheet');
  if (immediate) el.remove(); else { el.classList.remove('is-open'); setTimeout(() => el.remove(), 220); }
  callback?.();
}

const sheetHead = (title, sub = '') => `<header class="sheet-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="sheet-x" type="button" data-act="close-sheet" aria-label="Close">${icon('close')}</button></header>`;

document.addEventListener('keydown', event => { if (event.key === 'Escape' && sheetEl) closeSheet(); });

/* ---------------------------------------------------------------- router */

const VIEW_ALIASES = { wallet: 'assets', me: 'profile', company: 'about', team: 'referrals', tasks: 'home', vip: 'earn' };
const PUBLIC_VIEWS = ['about', 'support'];
const VIEWS = ['home', 'markets', 'trade', 'earn', 'assets', 'referrals', 'profile', 'support', 'about', 'admin'];

function parseHash() {
  const [raw, ...params] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const view = VIEW_ALIASES[raw] || raw;
  return { view: VIEWS.includes(view) ? view : '', params };
}

function go(view, ...params) {
  const target = VIEW_ALIASES[view] || view;
  const hash = `#${[target, ...params].map(encodeURIComponent).join('/')}`;
  if (location.hash === hash) { route(); return; }
  location.hash = hash;
}

function route() {
  const { view, params } = parseHash();
  S.view = view || 'home';
  S.params = params;
  if (S.view === 'admin' && !S.user?.isAdmin) S.view = 'home';
  if (S.view === 'trade' && params[0] && /^[A-Z0-9]+USDT$/.test(params[0])) {
    S.trade.symbol = params[0]; store.write('pg_last_symbol', params[0]);
    S.trade.input = ''; S.trade.history = null;
  }
  closeSheet(true);
  render();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

/* -------------------------------------------------------- derived values */

function holdings() { return S.portfolio?.holdings || []; }

function cryptoValue() {
  return holdings().reduce((sum, row) => sum + num(row.quantity) * num(coin(row.base)?.price), 0);
}

function cryptoCost() { return holdings().reduce((sum, row) => sum + num(row.cost), 0); }

function totalValue() {
  const user = S.user;
  return num(user?.lockedBalance) + num(user?.withdrawBalance) + num(user?.reservedBalance) + cryptoValue();
}

function unrealized() {
  const value = holdings().reduce((sum, row) => sum + (coin(row.base) ? num(row.quantity) * num(coin(row.base).price) : num(row.cost)), 0);
  const cost = cryptoCost();
  return { amount: value - cost, percent: cost > 0 ? (value - cost) / cost * 100 : 0, cost };
}

const EARN_MIN_DEFAULT = 200;
const earnMin = () => num(S.earn?.minimum, EARN_MIN_DEFAULT);
const earnShortfall = () => Math.max(0, Math.round((earnMin() - num(S.user?.lockedBalance)) * 1e6) / 1e6);
const earnActive = () => earnShortfall() === 0;

function stats() {
  const acts = S.activities || [];
  return {
    claims: acts.filter(a => a.type === 'earn').length,
    trades: acts.filter(a => a.type === 'spot').length,
    invites: (S.referrals?.level1 || 0) + (S.referrals?.level2 || 0),
    deposited: acts.some(a => a.type === 'deposit')
  };
}

/* A short getting-started checklist built from real account state. */
function checklist() {
  const acts = S.activities || [], today = new Date().toISOString().slice(0, 10), st = stats();
  return [
    { id: 'fund', icon: 'deposit', title: `Reach ${earnMin()} USDT in Earn`, hint: earnActive() ? 'Earn is active' : `${usd(earnShortfall())} USDT to go`, done: earnActive(), act: 'wallet-deposit' },
    { id: 'claim', icon: 'earn', title: 'Claim today’s reward', hint: 'Once per UTC day', done: acts.some(a => a.type === 'earn' && String(a.at).slice(0, 10) === today), act: 'goto', view: 'earn' },
    { id: 'trade', icon: 'candles', title: 'Place your first trade', hint: 'Spot · USDT', done: st.trades > 0, act: 'goto', view: 'trade' },
    { id: 'invite', icon: 'users', title: 'Invite a friend', hint: 'Earn 10% + 5%', done: st.invites > 0, act: 'goto', view: 'referrals' }
  ];
}

function claimReady() {
  const e = S.earn;
  return Boolean(e?.enabled && e.nextReward > 0 && serverNow() >= e.nextClaimAt);
}

function inviteUrl(code) {
  const url = new URL('/', location.origin);
  url.searchParams.set('ref', code);
  return url.href;
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; } catch {
    const field = document.createElement('textarea');
    field.value = value; field.readOnly = true; field.className = 'clipboard-helper';
    document.body.append(field);
    try { field.select(); return document.execCommand('copy'); } catch { return false; } finally { field.remove(); }
  }
}

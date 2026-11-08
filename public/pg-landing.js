'use strict';

/* Portgainy landing page: the public front door. Ink hero, light sections, live prices and arcade motion. */

const LAND_NAV = [['markets', 'Markets'], ['earn', 'Earn'], ['network', 'Referrals'], ['security', 'Security'], ['faq', 'FAQ']];
const L = { tab: 'hot', fx: null, chartLoaded: false, chartBusy: false };
const lt = (source, parameters) => i18n.html(source, parameters);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function guestLanguage() {
  const code = store.read('pg_guest_lang', 'en');
  return PG_READY_LANGUAGES.includes(code) ? code : 'en';
}

function langSelect() {
  const options = PORTGAINY_LANGUAGES.filter(item => PG_READY_LANGUAGES.includes(item.code))
    .map(item => `<option value="${esc(item.code)}" ${item.code === i18n.language ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
  return `<label class="lang-select">${icon('globe')}<span class="sr">${lt('Language')}</span><select data-land-lang aria-label="${lt('Language')}">${options}</select>${icon('chevronDown')}</label>`;
}

const themeButton = () => `<button class="theme-btn" type="button" data-act="toggle-theme" aria-label="${lt('Toggle theme')}"><span class="th-sun">${icon('sun')}</span><span class="th-moon">${icon('moon')}</span></button>`;

/* ---------------------------------------------------------------- chrome */

function landingHeader(inner = false) {
  const links = [...LAND_NAV.map(([id, label]) => `<button type="button" data-act="scroll-to" data-target="${id}">${lt(label)}</button>`),
    `<button type="button" data-act="goto" data-view="about">${lt('About')}</button>`].join('');
  return `<header class="lh ${inner ? 'is-solid' : 'on-dark'}" id="lh"><div class="lh-in">
    <button class="lh-brand" type="button" data-act="auth-home" aria-label="Portgainy">${brandLockup(34)}</button>
    <nav class="lh-nav" aria-label="${lt('Main')}">${links}</nav>
    <span class="lh-right">
      <span class="lh-chip" aria-label="BTC">${coinMark('BTC', 20)}<b data-px="BTCUSDT">${price(coinBySymbol('BTCUSDT')?.price)}</b><i data-chg="BTCUSDT" class="${tone(coinBySymbol('BTCUSDT')?.change)}">${pct(coinBySymbol('BTCUSDT')?.change)}</i></span>
      ${themeButton()}${langSelect()}
      <button class="btn btn-ghost btn-sm lh-login" type="button" data-act="auth-open" data-mode="login">${lt('Log in')}</button>
      <button class="btn btn-lime btn-sm" type="button" data-act="auth-open" data-mode="signup">${lt('Sign up')}</button>
      <button class="lh-burger" type="button" data-act="land-menu" aria-label="${lt('Menu')}" aria-expanded="false">${icon('menu')}</button></span></div>
    <div class="lh-menu" id="lh-menu"><nav>${links}</nav><div class="lh-menu-row">${langSelect()}${themeButton()}</div><div class="lh-menu-cta"><button class="btn btn-ghost" type="button" data-act="auth-open" data-mode="login">${lt('Log in')}</button><button class="btn btn-lime" type="button" data-act="auth-open" data-mode="signup">${lt('Sign up')}</button></div></div>
  </header>`;
}

function landingFooter() {
  return `<footer class="lf on-ink"><div class="lf-in">
    <div class="lf-brand">${brandLockup(36)}<p>${lt('Live crypto markets, daily Earn rewards and a USDT wallet in one game-inspired workspace.')}</p>${langSelect()}</div>
    <div class="lf-col"><h4>${lt('Product')}</h4><button data-act="scroll-to" data-target="markets">${lt('Markets')}</button><button data-act="scroll-to" data-target="earn">${lt('Earn')}</button><button data-act="scroll-to" data-target="network">${lt('Referrals')}</button></div>
    <div class="lf-col"><h4>${lt('Company')}</h4><button data-act="goto" data-view="about">${lt('About')}</button><button data-act="goto" data-view="support">${lt('Support')}</button><button data-act="scroll-to" data-target="faq">${lt('FAQ')}</button></div>
    <div class="lf-col"><h4>${lt('Account')}</h4><button data-act="auth-open" data-mode="login">${lt('Log in')}</button><button data-act="auth-open" data-mode="signup">${lt('Sign up')}</button></div>
  </div>
  <div class="lf-risk"><p>${lt('Crypto prices are volatile and trading can result in losses. Reward rates and program terms can change and are not guaranteed. Nothing on Portgainy is investment advice. Only use funds you can afford to lose.')}</p>
    <div class="lf-bottom"><span>Portgainy &copy; 2026</span><span>${lt('Prices by {provider} · Positions are settled in {currency}', { provider: 'Binance', currency: 'USDT' })}</span></div></div></footer>`;
}

function renderPublic() {
  const view = S.view === 'support' ? supportView : aboutView;
  app.innerHTML = `<div class="land is-inner">${landingHeader(true)}<main class="content public-content">${view()}</main>${landingFooter()}</div>`;
}

/* ------------------------------------------------------- phone mock-ups */

const phone = (inner, cls = '') => `<div class="phone ${cls}" aria-hidden="true"><i class="notch"></i><div class="screen">${inner}</div></div>`;
const demoTag = () => `<em class="demo">${lt('Demo view')}</em>`;

const sparkPath = (seed, w = 120, h = 36) => {
  let y = h / 2, d = '';
  for (let i = 0; i <= 12; i += 1) { y = clamp(y + (Math.sin(seed * 9.1 + i * 1.7) * 0.5 + Math.sin(seed * 3.3 + i * 0.6) * 0.35) * 7, 4, h - 4); d += `${i ? 'L' : 'M'}${(i * w / 12).toFixed(1)} ${y.toFixed(1)}`; }
  return d;
};

function phoneAssets() {
  const act = (g, label, cls = '') => `<span class="ps-act"><i class="${cls}">${icon(g)}</i>${lt(label)}</span>`;
  return phone(`<div class="ps-top"><b>${lt('Assets')}</b>${demoTag()}</div>
    <small class="ps-label">${lt('Total balance')}</small><div class="ps-bal">$12,480<span>.52</span></div>
    <div class="ps-actions">${act('deposit', 'Deposit', 'lime')}${act('withdraw', 'Send')}${act('transfer', 'Transfer')}${act('earn', 'Earn')}</div>
    <div class="ps-alloc"><div class="bar"><i style="flex:5;background:var(--lime)"></i><i style="flex:3;background:#6fe0ff"></i><i style="flex:2;background:#ff7cb6"></i></div><div class="lg"><span><i style="background:var(--lime)"></i>Earn</span><span><i style="background:#6fe0ff"></i>Spot</span><span><i style="background:#ff7cb6"></i>${lt('Crypto')}</span></div></div>
    <div class="ps-rows" data-land="phone-rows"></div>`, 'front');
}

function phoneMarkets() {
  return phone(`<div class="ps-top"><b>${lt('Markets')}</b>${liveBadge()}</div>
    <div class="ps-tabs"><i class="on">${lt('Hot')}</i><i>${lt('Gainers')}</i><i>${lt('Losers')}</i></div>
    <div class="ps-rows" data-land="phone-rows2"></div>`, 'back');
}

function phoneEarn() {
  return phone(`<div class="ps-top"><b>Earn</b>${demoTag()}</div>
    <div class="ps-ring"><svg viewBox="0 0 120 120"><circle class="rg-bg" cx="60" cy="60" r="50"/><circle class="rg-fg" cx="60" cy="60" r="50" pathLength="100"/></svg><span><small>${lt('Next claim in')}</small><b data-demo-timer>08:12:44</b></span></div>
    <div class="ps-kv"><span>${lt('Earn balance')}</span><b>1,000.00 USDT</b></div>
    <div class="ps-kv"><span>${lt('Spot balance')}</span><b>254.30 USDT</b></div>
    <div class="ps-cta">${icon('earn')}${lt('Claim reward')}</div>`, 'solo');
}

function phoneTrade() {
  return phone(`<div class="ps-top"><b>BTC/USDT</b><em class="chg ${tone(coinBySymbol('BTCUSDT')?.change)}" data-chg="BTCUSDT">${pct(coinBySymbol('BTCUSDT')?.change)}</em></div>
    <div class="ps-price" data-px="BTCUSDT">${price(coinBySymbol('BTCUSDT')?.price)}</div>
    <div class="chart-vis"><svg class="cv-svg" viewBox="0 0 300 110" preserveAspectRatio="none"><defs><linearGradient id="cvg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c6f432" stop-opacity=".4"/><stop offset="1" stop-color="#c6f432" stop-opacity="0"/></linearGradient></defs><path class="cv-area" d="" fill="url(#cvg)"/><path class="cv-line" d="" pathLength="1"/><circle class="cv-dot" r="4" cx="300" cy="55"/></svg></div>
    <div class="ps-seg"><i class="buy">${lt('Buy')}</i><i>${lt('Sell')}</i></div>
    <div class="ps-kv"><span>${lt('Total')}</span><b>250.00 USDT</b></div>
    <div class="ps-cta buy">${lt('Buy {asset}', { asset: 'BTC' })}</div>`, 'solo');
}

/* ------------------------------------------------------------------ hero */

function heroSection() {
  const chips = [['BTC', 'c1'], ['ETH', 'c2'], ['SOL', 'c3'], ['BNB', 'c4'], ['XRP', 'c5']].map(([base, cls]) => `<span class="chip ${cls}">${coinMark(base, 46)}</span>`).join('');
  return `<section class="hero on-ink" id="sec-top"><canvas class="hero-canvas" id="hero-canvas" aria-hidden="true"></canvas><i class="glow g1"></i><i class="glow g2"></i><i class="dots"></i>
    <div class="hero-in">
      <div class="hero-copy">
        <span class="pill rv"><i class="live-dot"></i>${lt('Live markets')} · ${lt('Earn')} · USDT</span>
        <h1 class="rv" style="--d:80ms"><span>${lt('Trade. Earn.')}</span> <span class="hl">${lt('Level up.')}</span> <span>${lt('One app.')}</span></h1>
        <p class="hero-lead rv" style="--d:160ms">${lt('Live crypto markets, a daily Earn account and a {currency} wallet, built like a game and run like a platform.', { currency: 'USDT' })}</p>
        <div class="hero-cta rv" style="--d:240ms"><button class="btn btn-lime btn-lg magnetic" type="button" data-act="auth-open" data-mode="signup">${lt('Create free account')}${icon('arrow')}</button><button class="btn btn-glass btn-lg" type="button" data-act="scroll-to" data-target="markets">${icon('chart')}${lt('Explore markets')}</button></div>
        <ul class="hero-facts rv" style="--d:320ms"><li>${icon('bolt')}<span>${lt('Live {provider} prices', { provider: 'Binance' })}</span></li><li>${icon('shield')}<span>${lt('Password-confirmed withdrawals')}</span></li><li>${icon('globe')}<span>${lt('{count} languages', { count: PG_READY_LANGUAGES.length })}</span></li></ul>
      </div>
      <div class="hero-vis rv" style="--d:200ms"><div class="phones" data-tilt>${phoneMarkets()}${phoneAssets()}${chips}
        <span class="float-tag t1">${icon('bell')}<b>${lt('Price alert')}</b><small>BTC · ${lt('target reached')}</small></span>
        <span class="float-tag t2">${icon('check')}<b>${lt('Deposit confirmed')}</b><small>USDT · TRC20</small></span>
        <div class="ph-cube">${markImg(150, 'float')}</div></div></div>
    </div>
    <button class="scroll-cue" type="button" data-act="scroll-to" data-target="ticker" aria-label="${lt('Scroll')}">${icon('chevronDown')}</button>
  </section>
  <div class="ticker on-ink" id="sec-ticker" aria-label="${lt('Live prices')}"><div class="tk-track" data-land="ticker"></div></div>`;
}

/* -------------------------------------------------------------- sections */

function secHead(eyebrow, title, text = '', center = true) {
  return `<header class="sh ${center ? 'is-center' : ''} rv">${eyebrow ? `<span class="eyebrow">${lt(eyebrow)}</span>` : ''}<h2>${title}</h2>${text ? `<p>${lt(text)}</p>` : ''}</header>`;
}

function featuresSection() {
  return `<section class="ls" id="sec-features"><div class="ls-in">
    ${secHead('', `${lt('Earn and trade,')} <span class="hl">${lt('your way')}</span>`, 'Keep USDT working in Earn, trade live markets with Spot, or do both from one account.')}
    <div class="fgrid">
      <article class="fcard t-lime rv" id="sec-earn">
        <h3>Earn</h3>
        <p>${lt('Keep USDT in your Earn account and claim your daily platform reward. The rate depends on your balance tier, is shown before you claim and is not guaranteed.')}</p>
        <div class="fc-cta"><button class="btn btn-dark" type="button" data-act="auth-open" data-mode="signup">${lt('Start earning')}</button><button class="btn btn-ghost" type="button" data-act="goto" data-view="about">${lt('Learn more')}</button></div>
        <div class="fc-phone">${phoneEarn()}</div>
      </article>
      <article class="fcard t-cyan rv" style="--d:100ms">
        <h3>${lt('Trade')}</h3>
        <p>${lt('Review a live quote, confirm in one tap and follow every position with real-time profit and loss. Orders settle in {currency}.', { currency: 'USDT' })}</p>
        <div class="fc-cta"><button class="btn btn-dark" type="button" data-act="auth-open" data-mode="signup">${lt('Start trading')}</button><button class="btn btn-ghost" type="button" data-act="scroll-to" data-target="markets">${lt('Live markets')}</button></div>
        <div class="fc-phone">${phoneTrade()}</div>
      </article>
    </div></div></section>`;
}

function statsSection() {
  const markets = S.markets.length || 60;
  const items = [[markets, '+', 'Live markets', 'chart', 'lime', 'markets'], [PG_READY_LANGUAGES.length, '', 'Interface languages', 'globe', 'cyan'], [24, '/7', 'Real-time prices', 'bolt', 'pink'], [0, 'TRC20', 'USDT deposit network', 'wallet', 'violet']];
  return `<section class="ls ls-stats"><div class="ls-in"><div class="stats">${items.map(([n, s, label, g, c, live], i) => `<div class="stat rv" style="--d:${i * 80}ms"><span class="stat-ic is-${c}">${icon(g)}</span><b>${n ? `<span data-count="${n}" data-suffix="${s}" ${live ? `data-live="${live}"` : ''}>${n}${s}</span>` : s}</b><small>${lt(label)}</small></div>`).join('')}</div></div></section>`;
}

function netSvg() {
  const path = { a: 'M200 118 L112 52', b: 'M200 118 L288 52', c: 'M112 52 L50 142', d: 'M112 52 L148 152', e: 'M288 52 L252 152', f: 'M288 52 L350 142' };
  const lines = Object.entries(path).map(([k, d]) => `<path id="np-${k}" class="np" d="${d}"/>`).join('');
  const pulses = Object.keys(path).map((k, i) => `<circle r="3.5" class="pulse"><animateMotion dur="${2.2 + i * 0.25}s" begin="${i * 0.3}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#np-${k}"/></animateMotion></circle>`).join('');
  const node = (x, y, r, label, cls) => `<g class="nn ${cls}" transform="translate(${x} ${y})"><circle r="${r}"/><text y="4" text-anchor="middle">${label}</text></g>`;
  return `<svg viewBox="0 0 400 190" role="img" aria-label="${lt('Referral network')}">${lines}${pulses}${node(200, 118, 26, lt('You'), 'me')}${node(112, 52, 18, '10%', 'l1')}${node(288, 52, 18, '10%', 'l1')}${node(50, 142, 14, '5%', 'l2')}${node(148, 152, 14, '5%', 'l2')}${node(252, 152, 14, '5%', 'l2')}${node(350, 142, 14, '5%', 'l2')}</svg>`;
}

function walletSection() {
  const langs = ['Aa', 'ა', 'Ж', '中', 'ع', 'हि', 'Ω', '한', 'あ', 'Ñ'].map((g, i) => `<i style="--i:${i}">${g}</i>`).join('');
  return `<section class="ls" id="sec-wallet"><div class="ls-in">
    ${secHead('', `${lt('Everything in')} <span class="hl">${lt('one place')}</span>`, 'A wallet, price alerts, a referral program and your own language. All inside one account.')}
    <div class="wgrid">
      <article class="wcard t-violet rv"><div class="wc-copy"><h3>${lt('USDT wallet')}</h3><p>${lt('A personal TRON (TRC20) deposit address, password-confirmed withdrawals and a clear status for every request.')}</p><div class="fc-cta"><button class="btn btn-dark" type="button" data-act="auth-open" data-mode="signup">${lt('Open wallet')}</button></div></div>
        <div class="wc-vis qr-vis"><div class="qr-card"><span class="qr-grid">${Array.from({ length: 49 }, (_, i) => `<i class="${(i * 7 + Math.floor(i / 5)) % 3 === 0 || i % 8 === 0 ? 'on' : ''}"></i>`).join('')}</span><div><small>${lt('Deposit address')}</small><b>TXq9…f2Lm</b><em>USDT · TRC20</em></div></div></div></article>
      <article class="wcard t-cyan rv" style="--d:90ms"><div class="wc-copy"><h3>${lt('Price alerts')}</h3><p>${lt('Set above or below targets on any market and get notified the moment a price is reached.')}</p><div class="fc-cta"><button class="btn btn-dark" type="button" data-act="auth-open" data-mode="signup">${lt('Create an alert')}</button></div></div>
        <div class="wc-vis toast-vis"><div class="mock-toast"><span class="mt-ic">${icon('bell')}</span><span><b>${lt('Price alert')}</b><small>BTC · <span data-px="BTCUSDT">—</span> USDT</small></span><i>${lt('Now')}</i></div><div class="mock-toast is-2"><span class="mt-ic is-lime">${icon('check')}</span><span><b>${lt('Deposit confirmed')}</b><small>USDT · TRC20</small></span><i>2m</i></div></div></article>
      <article class="wcard t-pink rv" id="sec-network"><div class="wc-copy"><h3>${lt('Referral network')}</h3><p>${lt('Invite friends and receive {first}% of every Earn reward they claim, plus {second}% from the friends they invite. Rewards credit your Spot balance and never reduce theirs.', { first: 10, second: 5 })}</p><div class="fc-cta"><button class="btn btn-dark" type="button" data-act="auth-open" data-mode="signup">${lt('Get my invite link')}</button></div></div><div class="wc-vis net-vis">${netSvg()}</div></article>
      <article class="wcard t-lime rv" style="--d:90ms"><div class="wc-copy"><h3>${lt('Your language')}</h3><p>${lt('The whole interface is available in {count} languages and switches instantly from your profile.', { count: PG_READY_LANGUAGES.length })}</p><div class="fc-cta"><button class="btn btn-dark" type="button" data-act="goto" data-view="about">${lt('About Portgainy')}</button></div></div><div class="wc-vis lang-vis">${langs}</div></article>
    </div></div></section>`;
}

function marketsSection() {
  const tabs = [['hot', 'Hot'], ['gainers', 'Gainers'], ['losers', 'Losers']];
  return `<section class="ls ls-alt" id="sec-markets"><div class="ls-in">
    ${secHead('', `${lt('Real prices.')} <span class="hl">${lt('Real time.')}</span>`, 'Prices stream in live from Binance. Sign up to trade any of them with your Spot balance.')}
    <div class="mk-card rv"><div class="mk-tabs" role="tablist">${tabs.map(([k, label]) => `<button type="button" role="tab" class="${L.tab === k ? 'is-on' : ''}" data-act="land-tab" data-tab="${k}">${lt(label)}</button>`).join('')}<span class="mk-live">${liveBadge()}</span></div>
      <div class="mk-head"><span>${lt('Name')}</span><span>${lt('Price')}</span><span>${lt('24h')}</span><span class="mk-hide">${lt('24h range')}</span><span class="mk-hide">${lt('Volume')}</span></div>
      <div class="mk-rows" data-land="mkt-rows"></div>
      <div class="mk-foot"><button class="btn btn-dark" type="button" data-act="auth-open" data-mode="signup">${lt('Trade these markets')}${icon('arrow')}</button></div></div>
  </div></section>`;
}

function securitySection() {
  const items = [['lock', 'Password-confirmed withdrawals', 'Every withdrawal request is confirmed with your account password.'], ['qr', 'Unique deposit addresses', 'Each account has its own TRON address. Deposits credit after blockchain confirmation.'], ['fingerprint', 'Retry-safe operations', 'Claims, orders and withdrawals use request keys, so a retry can never be paid twice.'], ['shield', 'Protected sessions', 'Secure same-site cookies, rate limits and server-side checks on every action.'], ['key', 'No keys in the browser', 'The website never holds your private keys, and staff never ask for them.'], ['history', 'Full transaction trail', 'Every deposit, claim, trade and withdrawal is recorded and exportable.']];
  return `<section class="ls" id="sec-security"><div class="ls-in"><div class="band on-ink rv"><i class="glow g1"></i><i class="glow g2"></i><i class="dots"></i>
    <header class="band-head"><span class="eyebrow">${lt('Security')}</span><h2>${lt('Built to be')} <span class="hl">${lt('boringly safe')}</span></h2><p>${lt('The exciting part is your portfolio. The safeguards stay out of the way and keep working.')}</p><button class="btn btn-lime" type="button" data-act="goto" data-view="about">${lt('How it works')}${icon('arrow')}</button></header>
    <div class="band-grid">${items.map(([g, t, d], i) => `<article class="scard" style="--d:${(i % 3) * 90}ms"><span class="hexic">${icon(g)}</span><h3>${lt(t)}</h3><p>${lt(d)}</p></article>`).join('')}</div></div></div></section>`;
}

function stepsSection() {
  const steps = [['user', 'Create your account', 'Sign up with an email and password in under a minute.'], ['deposit', 'Fund your account', 'Deposit USDT on TRON (TRC20) to your personal address.'], ['earn', 'Claim and trade', 'Claim your Earn reward once a day and trade live markets.'], ['withdraw', 'Withdraw any time', 'Request a withdrawal to your own wallet, confirmed with your password.']];
  return `<section class="ls" id="sec-how"><div class="ls-in">
    ${secHead('How it works', `${lt('Four steps.')} <span class="hl">${lt('Zero guesswork.')}</span>`)}
    <ol class="how-steps" id="steps">${steps.map(([g, t, d], i) => `<li class="hs rv" style="--d:${i * 110}ms"><span class="hs-n">${icon(g)}<em>${i + 1}</em></span><h3>${lt(t)}</h3><p>${lt(d)}</p></li>`).join('')}</ol>
  </div></section>`;
}

function faqSection() {
  return `<section class="ls ls-alt" id="sec-faq"><div class="ls-in faq-wrap">
    <div class="faq-side rv"><span class="eyebrow">FAQ</span><h2>${lt('Questions,')} <span class="hl">${lt('answered')}</span></h2><p>${lt('Need more help?')}</p><button class="btn btn-dark" type="button" data-act="goto" data-view="support">${icon('headset')}${lt('Visit Support')}</button></div>
    <div class="faq rv" style="--d:100ms">${faqList(FAQ)}</div>
  </div></section>`;
}

function ctaSection() {
  return `<section class="ls ls-cta"><div class="ls-in"><div class="cta on-ink rv"><i class="glow g1"></i><i class="glow g2"></i><i class="dots"></i><div class="cta-copy"><h2>${lt('Ready to')} <span class="hl">${lt('level up?')}</span></h2><p>${lt('Create your free account, fund Earn and watch the markets move. It takes a minute.')}</p>
    <div class="hero-cta"><button class="btn btn-lime btn-lg magnetic" type="button" data-act="auth-open" data-mode="signup">${lt('Create free account')}${icon('arrow')}</button><button class="btn btn-glass btn-lg" type="button" data-act="auth-open" data-mode="login">${lt('Log in')}</button></div></div>
    <div class="cta-cube">${markImg(220, 'float')}</div></div></div></section>`;
}

function renderLanding() {
  landingTeardown();
  const dock = `<div class="cta-dock" id="cta-dock"><div class="dock-copy"><b>${lt('Portgainy')}</b><small>${lt('Trade. Earn. Level up.')}</small></div><button class="btn btn-lime" type="button" data-act="auth-open" data-mode="signup">${lt('Sign up')}</button></div>`;
  app.innerHTML = `<div class="land">${landingHeader()}<main>${heroSection()}${featuresSection()}${statsSection()}${walletSection()}${marketsSection()}${securitySection()}${stepsSection()}${faqSection()}${ctaSection()}</main>${landingFooter()}${dock}</div>`;
  landingFillMarkets();
  landingFx();
}

/* ------------------------------------------------------- live market fill */

function landingRows() {
  const list = [...S.markets];
  if (L.tab === 'gainers') list.sort((a, b) => b.change - a.change);
  else if (L.tab === 'losers') list.sort((a, b) => a.change - b.change);
  else list.sort((a, b) => b.volume - a.volume);
  return list.slice(0, 8);
}

function landingFillMarkets() {
  const by = new Map(S.markets.map(row => [row.base, row]));
  const ticker = document.querySelector('[data-land="ticker"]');
  if (ticker) {
    const items = [...S.markets].sort((a, b) => b.volume - a.volume).slice(0, 16);
    const one = items.map(row => `<span class="tk">${coinMark(row.base, 22)}<b>${esc(row.base)}</b><span data-px="${esc(row.symbol)}">${price(row.price)}</span><i class="tk-chg ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</i></span>`).join('');
    ticker.innerHTML = items.length ? one + one : `<span class="tk"><b>${lt('Connecting to live prices…')}</b></span>`;
    ticker.classList.toggle('is-running', items.length > 0);
  }
  const miniRow = row => `<div class="ps-row">${coinMark(row.base, 26)}<b>${esc(row.base)}</b><svg viewBox="0 0 120 36" preserveAspectRatio="none"><path d="${sparkPath(row.price % 7)}" class="${tone(row.change)}"/></svg><span><strong data-px="${esc(row.symbol)}">${price(row.price)}</strong><em class="${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</em></span></div>`;
  const skeleton = `<div class="skeleton-list"><i class="skeleton"></i><i class="skeleton"></i></div>`;
  const phoneA = document.querySelector('[data-land="phone-rows"]');
  if (phoneA) phoneA.innerHTML = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].map(base => by.get(base)).filter(Boolean).map(miniRow).join('') || skeleton;
  const phoneB = document.querySelector('[data-land="phone-rows2"]');
  if (phoneB) phoneB.innerHTML = [...S.markets].sort((a, b) => b.volume - a.volume).slice(0, 6).map(miniRow).join('') || skeleton;
  const rows = document.querySelector('[data-land="mkt-rows"]');
  if (rows) rows.innerHTML = landingRows().map(row => {
    const span = row.high - row.low, pos = span > 0 ? clamp((row.price - row.low) / span * 100, 0, 100) : 50;
    return `<button class="mk-row" type="button" data-act="auth-open" data-mode="signup"><span class="mk-name">${coinMark(row.base, 38)}<span><b>${esc(row.base)}</b><small>${esc(row.name)}</small></span></span><strong data-px="${esc(row.symbol)}">${price(row.price)}</strong><span class="chg ${tone(row.change)}" data-chg="${esc(row.symbol)}">${pct(row.change)}</span><span class="mk-range mk-hide"><i><b style="left:${pos}%"></b></i></span><small class="mk-hide">${compact(row.volume)}</small></button>`;
  }).join('') || `<div class="skeleton-list">${Array.from({ length: 6 }, () => '<i class="skeleton"></i>').join('')}</div>`;
  const live = document.querySelector('[data-live="markets"]');
  if (live && S.markets.length) { live.dataset.count = S.markets.length; if (live.dataset.done) live.textContent = `${S.markets.length}+`; }
  const chip = document.querySelector('.lh-chip');
  if (chip && by.get('BTC')) { const btc = by.get('BTC'); chip.querySelector('[data-px]').textContent = price(btc.price); const c = chip.querySelector('[data-chg]'); c.textContent = pct(btc.change); c.className = tone(btc.change); }
  landingChart();
}

async function landingChart() {
  const svg = document.querySelector('.cv-svg');
  if (!svg || L.chartLoaded || L.chartBusy) return;
  L.chartBusy = true;
  try {
    const data = await api('/api/markets/history?symbol=BTCUSDT&range=1D', { timeout: 12000 });
    const pts = (data.points || []).map(p => p.price); if (pts.length < 8) return;
    const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
    const xy = pts.map((v, i) => [i / (pts.length - 1) * 300, 100 - (v - lo) / span * 84 - 8]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    const target = document.querySelector('.cv-svg');
    if (!target) return;
    target.querySelector('.cv-line').setAttribute('d', line);
    target.querySelector('.cv-area').setAttribute('d', `${line}L300 110L0 110Z`);
    const last = xy.at(-1); const dot = target.querySelector('.cv-dot'); dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]);
    target.closest('.chart-vis')?.classList.add('is-ready'); L.chartLoaded = true;
  } catch { /* the decorative frame stays empty if history is unavailable */ } finally { L.chartBusy = false; }
}

/* -------------------------------------------------------------- effects */

function landingTeardown() { L.fx?.(); L.fx = null; }

function landingFx() {
  const cleanups = [];
  const root = app.querySelector('.land'); if (!root) return;
  const still = reduceMotion();
  const head = root.querySelector('#lh');
  const stepsEl = root.querySelector('#steps');
  const onScroll = () => {
    head?.classList.toggle('is-stuck', window.scrollY > 24);
    root.querySelector('#cta-dock')?.classList.toggle('is-shown', window.scrollY > innerHeight * 0.9);
    if (stepsEl) { const r = stepsEl.getBoundingClientRect(); stepsEl.style.setProperty('--p', clamp((innerHeight * 0.72 - r.top) / (r.height * 0.9), 0, 1).toFixed(3)); }
  };
  window.addEventListener('scroll', onScroll, { passive: true }); cleanups.push(() => window.removeEventListener('scroll', onScroll)); onScroll();
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target; el.classList.add('is-in'); reveal.unobserve(el);
      for (const c of el.querySelectorAll('[data-count]')) countUp(c);
      if (el.matches('[data-count]')) countUp(el);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  for (const el of root.querySelectorAll('.rv, .fc-phone, .chart-vis')) reveal.observe(el);
  cleanups.push(() => reveal.disconnect());
  // demo countdown inside the Earn mock-up
  let seconds = 8 * 3600 + 12 * 60 + 44;
  const timer = setInterval(() => { seconds = seconds > 0 ? seconds - 1 : 86399; for (const el of root.querySelectorAll('[data-demo-timer]')) el.textContent = clock(seconds * 1000); }, 1000);
  cleanups.push(() => clearInterval(timer));
  if (!still) {
    const tilt = root.querySelector('[data-tilt]'), hero = root.querySelector('.hero');
    const move = event => {
      const r = hero.getBoundingClientRect(), x = (event.clientX - r.left) / r.width - 0.5, y = (event.clientY - r.top) / r.height - 0.5;
      tilt?.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`); tilt?.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      hero.style.setProperty('--gx', `${(x * 50).toFixed(1)}px`); hero.style.setProperty('--gy', `${(y * 36).toFixed(1)}px`);
    };
    hero?.addEventListener('pointermove', move); cleanups.push(() => hero?.removeEventListener('pointermove', move));
    for (const btn of root.querySelectorAll('.magnetic')) {
      const m = e => { const r = btn.getBoundingClientRect(); btn.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 8}px, ${((e.clientY - r.top) / r.height - 0.5) * 6}px)`; };
      const out = () => { btn.style.transform = ''; };
      btn.addEventListener('pointermove', m); btn.addEventListener('pointerleave', out);
      cleanups.push(() => { btn.removeEventListener('pointermove', m); btn.removeEventListener('pointerleave', out); });
    }
  }
  cleanups.push(sparkles(root.querySelector('#hero-canvas'), still));
  L.fx = () => { for (const fn of cleanups) fn(); };
  if (S.pendingScroll) { const id = S.pendingScroll; S.pendingScroll = null; setTimeout(() => landingScroll(id), 60); }
}

function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const to = Number(el.dataset.count) || 0, suffix = el.dataset.suffix || '';
  if (reduceMotion()) { el.textContent = `${to}${suffix}`; return; }
  const start = performance.now(), ms = 1400;
  const step = now => { const t = clamp((now - start) / ms, 0, 1), e = 1 - (1 - t) ** 4; el.textContent = `${Math.round(to * e)}${suffix}`; if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* Drifting pixel sparkles and faint constellation lines behind the hero. */
function sparkles(canvas, still) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d'), colors = ['198,244,50', '111,224,255', '255,124,182', '167,139,255'];
  let w = 0, h = 0, dots = [], raf = 0, running = true, visible = true;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = clamp(Math.round(w / 26), 18, 54);
    dots = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.26, vy: (Math.random() - 0.5) * 0.26, s: 1.2 + Math.random() * 2.2, c: colors[i % colors.length], a: 0.25 + Math.random() * 0.5, shape: i % 3, p: Math.random() * 6 }));
  };
  const draw = time => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      if (!still) { d.x += d.vx; d.y += d.vy; if (d.x < -10) d.x = w + 10; if (d.x > w + 10) d.x = -10; if (d.y < -10) d.y = h + 10; if (d.y > h + 10) d.y = -10; }
      const twinkle = still ? 1 : 0.6 + Math.sin(time / 700 + d.p) * 0.4;
      ctx.fillStyle = `rgba(${d.c},${(d.a * twinkle).toFixed(3)})`;
      if (d.shape === 0) { ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 6.283); ctx.fill(); }
      else { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.shape === 1 ? 0.785 : 0); ctx.fillRect(-d.s, -d.s, d.s * 2, d.s * 2); ctx.restore(); }
    }
    for (let i = 0; i < dots.length; i += 1) for (let j = i + 1; j < dots.length; j += 1) {
      const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y, dist = Math.hypot(dx, dy);
      if (dist < 120) { ctx.strokeStyle = `rgba(${dots[i].c},${((1 - dist / 120) * 0.14).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke(); }
    }
  };
  const loop = time => { if (!running) return; if (visible && !document.hidden) draw(time); raf = requestAnimationFrame(loop); };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  resize(); draw(0);
  window.addEventListener('resize', resize);
  if (!still) raf = requestAnimationFrame(loop);
  return () => { running = false; cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', resize); };
}

/* --------------------------------------------------------------- actions */

function landingScroll(id) {
  const el = document.getElementById(`sec-${id}`);
  if (!el) return false;
  const offset = (document.querySelector('#lh')?.offsetHeight || 64) + 10;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: reduceMotion() ? 'auto' : 'smooth' });
  return true;
}

Object.assign(acts, {
  'auth-open': el => { S.authMode = el.dataset.mode === 'signup' ? 'signup' : 'login'; location.hash = S.authMode === 'signup' ? '#signup' : '#signin'; },
  'scroll-to': el => {
    document.querySelector('#lh-menu')?.classList.remove('is-open');
    if (!landingScroll(el.dataset.target)) { S.pendingScroll = el.dataset.target; S.view = 'home'; history.replaceState(null, '', location.pathname + location.search); render(); }
  },
  'land-menu': el => { const menu = document.querySelector('#lh-menu'); const open = menu.classList.toggle('is-open'); el.setAttribute('aria-expanded', String(open)); },
  'land-tab': el => { L.tab = el.dataset.tab; for (const b of el.parentElement.querySelectorAll('button')) b.classList.toggle('is-on', b === el); landingFillMarkets(); },
  'toggle-theme': () => { PGTheme.toggle(); if (S.view === 'profile') render(); },
  'menu-toggle': el => {
    const wrap = el.closest('.gh-menu'), open = wrap.classList.toggle('is-open');
    el.setAttribute('aria-expanded', String(open));
  }
});

document.addEventListener('change', async event => {
  const select = event.target.closest?.('[data-land-lang]');
  if (!select || !PG_READY_LANGUAGES.includes(select.value)) return;
  const previous = i18n.language;
  try { if (!await i18n.use(select.value)) return; store.write('pg_guest_lang', select.value); updateDocumentLanguage(); render(); }
  catch { await i18n.use(previous).catch(() => {}); select.value = previous; }
});

document.addEventListener('click', event => {
  const menu = document.querySelector('#lh-menu');
  if (menu?.classList.contains('is-open') && !event.target.closest('.lh')) menu.classList.remove('is-open');
  for (const wrap of document.querySelectorAll('.gh-menu.is-open')) {
    if (!wrap.contains(event.target) || event.target.closest('.gh-pop button')) { wrap.classList.remove('is-open'); wrap.querySelector('.gh-avatar')?.setAttribute('aria-expanded', 'false'); }
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  for (const wrap of document.querySelectorAll('.gh-menu.is-open, #lh-menu.is-open')) wrap.classList.remove('is-open');
});

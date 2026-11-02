'use strict';

/* Portgainy views, part 3: earn, referrals, profile, support, about and admin. */

/* ------------------------------------------------------------------ earn */

function earnView() {
  const u = S.user, e = S.earn;
  const rate = earnRatePct();
  const reward = earnActive() ? (e?.nextReward ?? num(u.lockedBalance) * (rate / 100)) : 0;
  const ready = claimReady();
  const history = S.activities.filter(a => a.type === 'earn' || a.type === 'referral');
  const calcBase = Math.max(earnMin(), Math.round(num(u.lockedBalance)));
  const short = earnShortfall(), active = short === 0;
  return `<div class="page earn">
    <header class="page-head"><div><h1>Earn</h1><p>${i18n.html("Your balance. Your daily reward.")}</p></div><span class="tag tag-lime">${icon('clock')}${i18n.html('{duration} cycle', {duration:'24h'})}</span></header>
    <article class="earn-hero">
      <div class="gauge-wrap"><div class="gauge" style="--p:${clamp(rate / 13, 0, 1) * 100}"></div><span class="gauge-in"><b>${rate}<small>%</small></b><em>${i18n.html("per day")}</em></span></div>
      <div class="earn-hero-copy">
        <span class="eyebrow">${i18n.html("Daily reward rate")}</span>
        <h2>${i18n.html('{rate}% of your {account} balance, every day', {rate,account:'Earn'})}</h2>
        <p>${i18n.html("Your first Claim is available once Earn reaches {value0} {value1}. After that, claim once per day when the countdown finishes. Rewards credit Spot and your principal stays in Earn.", {"value0":"200","value1":"USDT"})}</p>
      </div>
      ${active ? '' : `<div class="earn-gate"><div class="earn-gate-top"><span>${icon('lock')}${i18n.html('{account} starts at {amount} {currency}', {account:'Earn',amount:earnMin(),currency:'USDT'})}</span><b>${i18n.html('{amount} {currency} to go', {amount:usd(short),currency:'USDT'})}</b></div><i class="xp is-lg"><b style="width:${Math.round(clamp(num(u.lockedBalance) / earnMin(), 0, 1) * 100)}%"></b></i><p>${i18n.html('Your {account} balance is {balance} {currency}. Add {amount} {currency} more to unlock daily rewards.', {account:'Earn',balance:money(u.lockedBalance),amount:usd(short),currency:'USDT'})}</p><button class="btn btn-lime btn-block" type="button" data-act="wallet-deposit">${icon('deposit')}${i18n.html('Add {amount} {currency}', {amount:usd(short),currency:'USDT'})}</button></div>`}
      ${active ? `      <div class="claim-box ${ready ? 'is-ready' : ''}">
        <div><small>${i18n.html("Next reward")}</small><strong>${usd(reward)} <span>USDT</span></strong></div>
        <div><small>${i18n.html(ready || !active ? 'Status' : 'Opens in')}</small><strong class="${ready ? 'up' : ''}" ${active ? 'data-earn-timer' : ''}>${ready ? i18n.html('Ready') : !active ? i18n.html('Locked') : e ? clock(e.nextClaimAt - serverNow()) : '--:--:--'}</strong></div>
        <button class="btn ${ready ? 'btn-lime' : 'btn-dark'} btn-lg btn-block" type="button" data-act="claim" data-claim-btn ${ready ? '' : 'disabled'}><span data-claim-label>${ready ? i18n.html('Claim reward') : !active ? i18n.html('{account} starts at {amount} {currency}', {account:'Earn',amount:earnMin(),currency:'USDT'}) : i18n.html(reward > 0 ? 'Waiting for next claim' : 'No reward available')}</span></button>
        <p class="form-msg" id="earn-error" role="alert"></p>
      </div>` : ''}
    </article>
    <section class="tiles">
      <article class="tile"><span class="tile-ic">${icon('earn')}</span><small>${i18n.html("Earn balance")}</small><strong>${money(u.lockedBalance)}</strong><div class="btn-row"><button class="btn btn-lime btn-sm" data-act="wallet-deposit">${icon('deposit')}${i18n.html('Deposit')}</button><button class="btn btn-ghost btn-sm" data-act="wallet-transfer">${icon('transfer')}${i18n.html('Move')}</button></div></article>
      <article class="tile"><span class="tile-ic is-cyan">${icon('wallet')}</span><small>${i18n.html("Spot balance")}</small><strong>${money(u.withdrawBalance)}</strong><div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="goto" data-view="trade">${icon('candles')}${i18n.html('Trade')}</button><button class="btn btn-ghost btn-sm" data-act="wallet-withdraw">${icon('withdraw')}${i18n.html('Send')}</button></div></article>
    </section>
    
    <section class="card">${sectionHead('Daily reward tiers')}${earnTierTable()}<p class="fine">${i18n.html("The rate applies to your entire Earn balance at the time of Claim. Below {value0} {value1}, no daily reward is available.", {"value0":"200","value1":"USDT"})}</p></section>
    <section class="card calc">${sectionHead('Reward calculator', `<span class="tag">${i18n.html('Estimate')}</span>`)}
      <label class="field"><span>${i18n.html("Earn balance")}</span><div class="control"><input id="calc-amount" type="number" inputmode="decimal" min="0" step="1" value="${calcBase}"><b class="suffix">USDT</b></div></label>
      <input id="calc-range" class="range" type="range" min="200" max="10000" step="10" value="${clamp(calcBase, 200, 10000)}" aria-label="${i18n.html("Balance")}">
      <div class="calc-out" data-rate="${rate}"><span><small>${i18n.html("Daily")}</small><b data-calc="d">—</b></span><span><small>${i18n.html("{value0} days", {"value0":"7"})}</small><b data-calc="w">—</b></span><span><small>${i18n.html("{value0} days", {"value0":"30"})}</small><b data-calc="m">—</b></span></div>
      <p class="fine">${icon('info')}${i18n.html('Estimate for an unchanged balance and one claim per day. The calculator uses the tier for the entered balance. Future rewards are not guaranteed.')}</p>
    </section>
    <section class="rules">${[['clock', i18n.text('One claim per day'), i18n.text('Your first Claim is available when you start Earn. Later claims open when the countdown finishes. Missed days do not accumulate.')], ['wallet', i18n.text('Principal stays put'), i18n.text('Claims do not reduce your Earn balance. Rewards credit Spot.')], ['users', i18n.text('Two referral levels'), i18n.text('Level {levelOne} earns {firstRate}% and level {levelTwo} earns {secondRate}% of each claimed reward.', {levelOne:1,firstRate:10,levelTwo:2,secondRate:5})]].map(([g, t, d]) => `<article>${icon(g)}<div><b>${esc(t)}</b><p>${esc(d)}</p></div></article>`).join('')}</section>
    <section class="card">${sectionHead('Earn activity', moreLink('Referrals', 'referrals'))}${history.length ? `<ul class="acts">${history.slice(0, 12).map(a => `<li class="act"><span class="act-ic ${a.type}">${icon(activityIconFor(a))}</span><span class="act-copy"><b>${esc(activityTitle(a))}</b><small>${esc(dateText(a.at))}</small></span><span class="act-amt up">${S.hide ? '••••' : `+${usd(a.amount)}`}<small>USDT</small></span></li>`).join('')}</ul>` : emptyState('earn', 'No Earn activity yet', 'Your claims and referral rewards will be listed here.')}</section>
  </div>`;
}

function updateCalc() {
  const wrap = document.querySelector('.calc-out'), input = document.querySelector('#calc-amount');
  if (!wrap || !input) return;
  const base = Math.max(0, num(input.value)), rate = base >= earnMin() ? earnRatePct(base) / 100 : 0;
  wrap.dataset.rate = String(rate*100);
  const set = (key, days) => { const el = wrap.querySelector(`[data-calc="${key}"]`); if (el) el.textContent = `${usd(base * rate * days)} USDT`; };
  set('d', 1); set('w', 7); set('m', 30);
}

function promoCard(p) {
  const unlocked = p.status === 'unlocked';
  const ended = !unlocked && serverNow() >= p.expiresAt;
  const title = unlocked ? '15% daily Earn unlocked' : ended ? 'This offer has ended' : 'Unlock 15% daily Earn';
  return `<article class="promo-card ${unlocked ? 'is-unlocked' : ''} ${ended ? 'is-ended' : ''}">
    <div class="promo-card-top"><span class="tag tag-lime">${unlocked ? 'Unlocked' : ended ? 'Ended' : '10-day offer'}</span><span class="promo-rate big"><b>10%</b>${icon('arrow')}<b class="hi">15%</b></span></div>
    <h2>${title}</h2>
    ${ended ? '' : `<p>${unlocked ? 'Your higher daily rate is active permanently.' : `Invite ${p.requiredReferrals} active friends within your personal 10-day window. An active referral has confirmed deposits of at least ${p.minimumDepositUSDT} USDT.`}</p>`}
    <div class="prog"><span>${i18n.html("Active referrals")}</span><b>${p.qualifyingReferrals} / ${p.requiredReferrals}</b></div>
    <i class="xp is-lg"><b style="width:${Math.round(clamp(p.qualifyingReferrals / p.requiredReferrals, 0, 1) * 100)}%"></b></i>
    ${!unlocked && !ended ? `<div class="prog"><span>${i18n.html("Time left")}</span><b data-promo-timer="${p.expiresAt}">${promoRemaining(p.expiresAt)}</b></div>` : ''}
  </article>`;
}

/* ------------------------------------------------------------- referrals */

function referralsView() {
  const u = S.user, code = S.team?.inviteCode || u.inviteCode, link = inviteUrl(code);
  const members = S.team?.members || [];
  const income = S.activities.filter(a => a.type === 'referral');
  return `<div class="page referrals">
    <header class="page-head"><div><h1>${i18n.html("Referrals")}</h1><p>${i18n.html("Share {value0}. Grow your network.", {"value0":"Portgainy"})}</p></div></header>
    
    <article class="invite">
      <span class="eyebrow">${i18n.html("Your invite code")}</span>
      <div class="invite-code"><code data-invite-code>${esc(code)}</code><button class="icon-btn" type="button" data-act="copy-invite" aria-label="${i18n.html("Copy code")}">${icon('copy')}</button></div>
      <a class="invite-link" data-invite-link href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>
      <div class="btn-row"><button class="btn btn-lime" type="button" data-act="copy-invite-link">${icon('link')}${i18n.html('Copy link')}</button><button class="btn btn-ghost" type="button" data-act="share-invite">${icon('share')}${i18n.html('Share')}</button></div>
    </article>
    <section class="tiles">${[[1, 10, displayReferralCount(1), i18n.text('Directly invited friends')], [2, 5, displayReferralCount(2), i18n.text('Friends invited by your friends')]].map(([lv, rate, count, text]) => `<article class="tile level"><span class="eyebrow">${i18n.html('Level {level}', {level:lv})}</span><strong class="big">${rate}<small>%</small></strong><p>${esc(text)}. ${i18n.html('You earn {rate}% of every {account} reward they claim.', {rate,account:'Earn'})}</p><b class="count">${count} <small>${i18n.html("members")}</small></b></article>`).join('')}</section>
    <div class="note">${icon('info')}${i18n.html('Referral rewards credit your Spot balance and never reduce your friends’ own rewards.')}</div>
    <section class="card">${sectionHead('Referral income', `<b class="up">${money(displayReferralEarned())} USDT</b>`)}${income.length ? `<ul class="acts">${income.slice(0, 12).map(a => `<li class="act"><span class="act-ic referral">${icon('users')}</span><span class="act-copy"><b>${esc(activityTitle(a))}</b><small>${esc(dateText(a.at))}</small></span><span class="act-amt up">${S.hide ? '••••' : `+${usd(a.amount)}`}<small>USDT</small></span></li>`).join('')}</ul>` : emptyState('users', 'No recorded referral income yet', 'Rewards appear after your friends claim their Earn rewards.')}</section>
    <section class="card">${sectionHead('Your team', `<span class="tag">${i18n.html('{count} members', {count:members.length})}</span>`)}${members.length ? `<ul class="acts">${members.map(m => `<li class="act"><span class="act-ic transfer">${icon('user')}</span><span class="act-copy"><b>${esc(m.name)}</b><small>${i18n.html('Joined {date}', {date:dateText(m.createdAt, true)})}</small></span></li>`).join('')}</ul>` : emptyState('user', 'No members yet', 'Share your link to bring friends in.')}</section>
  </div>`;
}

/* --------------------------------------------------------------- profile */

function profileView() {
  const u = S.user, r = stats();
  return `<div class="page profile">
    <article class="profile-hero">
      <div class="profile-badge">${avatarHex(u.name, 'is-xl')}</div>
      <h1>${esc(u.name)}</h1><p>${esc(u.email)}</p>
      <span class="tag tag-lime">${earnActive() ? i18n.html('{account} active · {rate}% daily', {account:'Earn',rate:earnRatePct()}) : i18n.html('{account} starts at {amount} {currency}', {account:'Earn',amount:earnMin(),currency:'USDT'})}</span>
    </article>
    <section class="tiles stats3">${[[i18n.text('Claims'), r.claims, 'earn'], [i18n.text('Trades'), r.trades, 'swords'], [i18n.text('Invites'), r.invites, 'users']].map(([l, v, g]) => `<article class="tile mini"><span class="tile-ic">${icon(g)}</span><strong>${v}</strong><small>${esc(l)}</small></article>`).join('')}</section>
    <section class="card">${sectionHead('Preferences')}
      <div class="setting"><span>${icon('eyeOff')}<span><b>${i18n.html("Hide balances")}</b><small>${i18n.html("Mask amounts across the app")}</small></span></span><button class="switch ${S.hide ? 'is-on' : ''}" type="button" role="switch" aria-checked="${S.hide}" data-act="toggle-hide"><i></i></button></div>
      <label class="field profile-language"><span>${i18n.html('Language')}</span><div class="control">${icon('globe')}<select id="profile-language" aria-label="${i18n.html('Language')}">${PORTGAINY_LANGUAGES.filter(item => PG_READY_LANGUAGES.includes(item.code)).map(item => `<option value="${esc(item.code)}" ${item.code === i18n.language ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select>${icon('chevronDown')}</div></label>
      ${PG_REVIEWED_LANGUAGES.includes(i18n.language) ? '' : `<p class="language-note">${i18n.html('Automatic translation may be incomplete. Some information remains in English.')}</p>`}
    </section>
    <section class="card">${sectionHead('Account')}
      <form class="form" data-form="profile" novalidate><label class="field"><span>${i18n.html("Display name")}</span><div class="control">${icon('user')}<input name="name" type="text" value="${esc(u.name)}" minlength="2" maxlength="50" required></div></label><p class="form-msg" id="profile-msg" role="alert"></p><button class="btn btn-ghost" type="submit">${icon('check')}${i18n.html('Save name')}</button></form>
      <dl class="facts"><div><dt>${i18n.html("Email")}</dt><dd>${esc(u.email)}</dd></div><div><dt>${i18n.html("Invite code")}</dt><dd>${esc(u.inviteCode)}</dd></div><div><dt>${i18n.html("Member since")}</dt><dd>${esc(dateText(u.createdAt, true))}</dd></div><div><dt>${i18n.html("Total earned")}</dt><dd>${money(displayEarnedTotal())} USDT</dd></div><div><dt>${i18n.html("Total withdrawn")}</dt><dd>${money(u.withdrawnTotal)} USDT</dd></div></dl>
    </section>
    <section class="card links">${[['support', 'headset', i18n.text('Help & Support')], ['about', 'building', i18n.text('About Portgainy')], ['referrals', 'users', i18n.text('Referrals')], ...(u.isAdmin ? [['admin', 'shield', i18n.text('Admin console')]] : [])].map(([v, g, l]) => `<button type="button" data-act="goto" data-view="${v}">${icon(g)}<span>${esc(l)}</span>${icon('chevron')}</button>`).join('')}</section>
    <button class="btn btn-danger btn-lg btn-block" type="button" data-act="logout">${icon('logout')}${i18n.html('Sign out')}</button>
  </div>`;
}

/* --------------------------------------------------------------- support */

const FAQ = [
  ['How do deposits work?', 'Send {currency} on the {network} network to your personal deposit address. Once the transfer is confirmed on the blockchain it is credited to your {earn} account automatically.', {currency:'USDT',network:'TRON (TRC20)',earn:'Earn'}],
  ['How do I claim my daily reward?', 'Your first {claim} is available as soon as {earn} reaches {minimum} {currency}. Open {earn} and tap {claim}. Later claims are available once per day when the countdown finishes. Rewards credit {spot} and your {earn} principal stays untouched.', {claim:'Claim',earn:'Earn',minimum:'200',currency:'USDT',spot:'Spot'}],
  ['What are the withdrawal rules?', 'Withdrawals are requested from {spot} and confirmed with your password. Automatic processing depends on available funds and network resources. A {fee}% fee applies and the minimum request is {minimum} {currency}. Status updates appear under {assets} → {history}.', {spot:'Spot',fee:'2',minimum:'10',currency:'USDT',assets:'Assets',history:'History'}],
  ['How does trading work?', 'Choose a market, enter an amount in {currency} and review a {seconds}-second quote. Prices follow live {provider} quotes; positions are recorded by {platform} and settled in {currency}.', {currency:'USDT',seconds:'15',provider:'Binance',platform:'Portgainy'}],
  ['How do referrals pay out?', 'Level {firstLevel} earns {firstRate}% and level {secondLevel} earns {secondRate}% of the {earn} rewards your network claims. Referral rewards credit your {spot} balance.', {firstLevel:'1',firstRate:'10',secondLevel:'2',secondRate:'5',earn:'Earn',spot:'Spot'}],
  ['How do I stay safe?', 'Use a unique password, never share it, and remember that Portgainy staff will never ask for your password or seed phrase. Check addresses carefully before sending funds.']
];

function filterFaq(query) {
  const q = String(query || '').toLocaleLowerCase(i18n.language);
  return FAQ.filter(([a, b, parameters]) => !q || `${a} ${b} ${i18n.text(a)} ${i18n.text(b, parameters)}`.toLocaleLowerCase(i18n.language).includes(q));
}

function supportView() {
  const list = filterFaq(S.faqQuery);
  return `<div class="page support">
    <header class="page-head"><div><h1>${i18n.html('Support')}</h1><p>${i18n.html('Answers, guides and the Portgainy assistant.')}</p></div></header>
    <section class="card chat">
      <div class="chat-head"><span class="bot-ic">${icon('bot')}</span><div><b>${i18n.html('Portgainy Assistant')}</b><small>${i18n.html('Automated help · cannot move funds')}</small></div></div>
      <div class="chat-log" id="chat-log" aria-live="polite">${chatLog()}</div>
      <div class="chat-suggest">${['How do I deposit?', 'How does Earn work?', 'How do I withdraw?', 'What is the BTC price?'].map(s => `<button type="button" data-act="chat-suggest" data-text="${esc(s)}">${i18n.html(s)}</button>`).join('')}</div>
      <form class="chat-form" data-form="chat"><input id="chat-input" type="text" maxlength="600" placeholder="${i18n.html('Ask a question…')}" autocomplete="off" aria-label="${i18n.html('Message')}"><button class="btn btn-lime btn-icon" type="submit" aria-label="${i18n.html('Send')}">${icon('send')}</button></form>
    </section>
    <div class="search-field"><span>${icon('search')}</span><input id="faq-search" type="search" value="${esc(S.faqQuery || '')}" placeholder="${i18n.html('Search help articles')}" autocomplete="off" aria-label="${i18n.html('Search help')}"></div>
    <section class="faq" id="faq-list">${faqList(list)}</section>
    <p class="fine center">${icon('shield')}${i18n.html('Portgainy will never ask for your password, seed phrase or private keys.')}</p>
  </div>`;
}

const faqList = list => (list.length ? list.map(([a, b, parameters], i) => `<details class="faq-item" ${i === 0 && !S.faqQuery ? 'open' : ''}><summary>${i18n.html(a)}${icon('chevronDown')}</summary><p>${i18n.html(b, parameters)}</p></details>`).join('') : emptyState('search', 'No articles found', 'Try another keyword or ask the assistant.'));

function chatLog() {
  const C = S.chat;
  const intro = `<div class="msg bot"><p>${i18n.html('Hi! I’m the Portgainy assistant. Ask about deposits, withdrawals, Earn, referrals or crypto prices. I can’t change balances or give personal investment advice.')}</p></div>`;
  return intro + C.messages.map(m => `<div class="msg ${m.role}"><p>${m.role === 'bot' ? i18n.html(m.text) : esc(m.text)}</p>${m.links?.length ? `<div class="msg-links">${m.links.map(l => `<button type="button" data-act="goto" data-view="${esc(l.view)}">${i18n.html(l.label)}${icon('arrow')}</button>`).join('')}</div>` : ''}</div>`).join('') + (C.busy ? '<div class="msg bot typing"><i></i><i></i><i></i></div>' : '');
}

async function sendChat(text, displayText = text) {
  const C = S.chat, message = String(text || '').trim().slice(0, 600);
  if (!message || C.busy) return;
  C.messages.push({ role: 'user', text: String(displayText || '').trim().slice(0, 600) }); C.busy = true; refreshChat();
  try {
    const result = await api('/api/assistant/message', { method: 'POST', body: { message, lang: 'en' }, timeout: 15000 });
    C.messages.push({ role: 'bot', text: result.text, links: result.links });
  } catch {
    C.messages.push({ role: 'bot', text: 'I couldn’t respond just now. Please try again or browse the help articles below.' });
  } finally { C.busy = false; C.messages = C.messages.slice(-24); refreshChat(); document.querySelector('#chat-input')?.focus(); }
}

function refreshChat() {
  const log = document.querySelector('#chat-log');
  if (!log) return;
  log.innerHTML = chatLog(); log.scrollTop = log.scrollHeight;
}

/* ----------------------------------------------------------------- about */

function aboutView() {
  const fee = +(num(S.user?.withdrawalFeeRate, 0.02) * 100).toFixed(2);
  const status = i18n.text(S.pay.mode === 'disabled' && !S.pay.available ? 'Payment status is loading or temporarily unavailable.' : S.pay.withdrawals ? 'Deposits and withdrawals are available.' : 'Deposits are available. Withdrawals are currently paused.');
  const facts = [[`${S.markets.length || '80+'}`, 'Live markets'], ['8–13%', 'Daily Earn rate'], ['200', 'USDT to start Earn'], ['15s', 'Quote validity']];
  const products = [
    ['chart', 'Live markets', 'Real-time prices for dozens of leading assets with 24-hour range, volume, favorites, category filters and a market-mood read-out.'],
    ['candles', 'Spot trading', 'Review a quote, confirm in one tap and track every position with live unrealized PNL. Orders settle in USDT.'],
    ['earn', 'Earn', 'Keep USDT in your Earn account and claim a daily reward. Your first Claim is available when you start Earn. Later claims open once per day. Your principal stays in place.'],
    ['users', 'Referrals', i18n.text('Invite friends and receive {firstRate}% of their claimed rewards at level {firstLevel} and {secondRate}% at level {secondLevel}, credited to your {account} balance.', {firstRate:10,firstLevel:1,secondRate:5,secondLevel:2,account:'Spot'})],
    ['wallet', 'USDT wallet', 'A unique TRON (TRC20) deposit address per account, password-confirmed withdrawals and a clear status trail.'],
    ['bell', 'Price alerts', 'Set above/below targets on any market and get notified the moment a price is reached while Portgainy is open.']
  ];
  const steps = [['Create your account', 'Sign up with an email and password. No documents are needed to explore live markets.'], ['Fund Earn', i18n.text('Deposit {currency} ({network}). {account} starts once your {account} balance reaches {minimum} {currency}.', {currency:'USDT',network:'TRC20',account:'Earn',minimum:200})], ['Claim every day', i18n.text('Your first Claim is available when you start {earn}; later claims open once per day. Your daily rate is {range}, based on your {earn} balance. Rewards credit {spot}.', {earn:'Earn',range:'8–13%',spot:'Spot'})], ['Trade, transfer or withdraw', i18n.text('Use {spot} {currency} to trade, move it back to {earn}, or request a withdrawal ({fee}% fee, {minimum} {currency} minimum).', {spot:'Spot',currency:'USDT',earn:'Earn',fee,minimum:10})]];
  const accounts = [['Earn', 'Deposits and principal', 'Generates your daily reward. Principal is never reduced by claims.', 'earn'], ['Spot', 'Rewards, trading, withdrawals', 'Receives claims and referral rewards. Used for trades and withdrawal requests.', 'wallet'], ['Reserved', 'Pending withdrawals', 'Funds held while a withdrawal request is processed.', 'clock']];
  const limits = [['Earn minimum', '200 USDT'], ['Daily reward rate', '8–13% of your Earn balance'], ['Claim cycle', 'First claim when you start Earn; then once per day'], ['Referral rewards', 'Level 1: 10% · Level 2: 5%'], ['Spot order size', '1 – 10,000 USDT per order'], ['Quote validity', '15 seconds'], ['Withdrawal minimum', `${S.pay.minimum || 10} USDT`], ['Withdrawal fee', `${fee}%`], ['Deposit network', 'USDT on TRON (TRC20)']];
  const safety = [['lock', 'Password-confirmed withdrawals', 'Confirm withdrawals with your account password. Automatic processing requires sufficient funds and network resources.'], ['qr', 'Unique deposit addresses', 'Each account receives its own TRON address. Deposits are credited only after blockchain confirmation.'], ['fingerprint', 'Idempotent operations', 'Claims, orders and withdrawals use request keys to protect retries against duplicate processing.'], ['shield', 'Protected sessions', 'Sessions use secure, same-site cookies and sensitive endpoints are rate-limited against abuse.'], ['key', 'No keys in the browser', 'The website never holds private keys or seed phrases and Portgainy staff will never ask for them.'], ['history', 'Full transaction trail', 'Every deposit, transfer, claim, trade and withdrawal is recorded and can be exported as CSV.']];
  return `<div class="page about">
    <article class="about-hero">
      <div class="about-cube">${markImg(120, 'float')}</div>
      ${wordmark('is-lg')}
      <h1>${i18n.html("Markets, rewards and {value0},", {"value0":"USDT"})} <span>${i18n.html("in one place.")}</span></h1>
      <p>${i18n.html("{value0} is a fast, game-inspired digital-asset workspace: live crypto markets, daily Earn rewards, a two-level referral program and a {value1} wallet, designed to be clear about where every balance lives.", {"value0":"Portgainy","value1":"USDT"})}</p>
      <div class="btn-row about-cta">${S.user ? `<button class="btn btn-lime" data-act="goto" data-view="markets">${icon('chart')}${i18n.html("Explore markets")}</button><button class="btn btn-ghost" data-act="goto" data-view="earn">${icon('earn')}${i18n.html("Open Earn")}</button>` : `<button class="btn btn-lime" data-act="auth-home">${icon('rocket')}${i18n.html("Get started")}</button><button class="btn btn-ghost" data-act="goto" data-view="support">${icon('headset')}${i18n.html("Support")}</button>`}</div>
    </article>
    <section class="facts-strip">${facts.map(([v, l]) => `<div><b>${esc(v)}</b><span>${i18n.html(l)}</span></div>`).join('')}</section>

    <section class="card about-sec"><span class="eyebrow">${i18n.html("Who we are")}</span><h2>${i18n.html("Built for clarity and speed")}</h2>
      <p>${i18n.html("{value0} brings together the tools people actually use every day: a live price board, a straightforward trading flow, a daily reward cycle and a wallet that explains itself. Everything is designed mobile-first, so the full experience fits in your pocket while still scaling up to a complete desktop workspace.", {"value0":"Portgainy"})}</p>
      <p>${i18n.html("We keep the model simple and visible. Your balances are split into clearly labeled accounts, every action leaves a record, and every limit, fee and rule is written down on this page instead of buried in fine print.")}</p></section>

    <section class="block">${sectionHead('What you can do')}<div class="pillars">${products.map(([g, t, d]) => `<article><span class="pillar-ic">${icon(g)}</span><h3>${i18n.html(t)}</h3><p>${i18n.html(d)}</p></article>`).join('')}</div></section>

    <section class="card about-sec"><span class="eyebrow">${i18n.html("Step by step")}</span><h2>${i18n.html("How {value0} works", {"value0":"Portgainy"})}</h2>
      <ol class="how">${steps.map(([t, d], i) => `<li><span class="how-n">${i + 1}</span><div><b>${i18n.html(t)}</b><p>${i18n.html(d)}</p></div></li>`).join('')}</ol></section>

    <section class="block">${sectionHead('Your accounts')}<div class="acct-cards">${accounts.map(([t, sub, d, g]) => `<article class="tile"><span class="tile-ic ${t === 'Spot' ? 'is-cyan' : ''}">${icon(g)}</span><strong>${i18n.html(t)}</strong><small>${i18n.html(sub)}</small><p>${i18n.html(d)}</p></article>`).join('')}</div></section>

    <section class="card about-sec"><span class="eyebrow">Earn</span><h2>${i18n.html("A daily reward on your Earn balance")}</h2>
      <p>${i18n.html("Earn starts at {value0} {value1}. Your daily rate is {value2}–{value3}, based on your Earn balance at Claim. Your first Claim is available when you start Earn. After that, use the countdown to see when your next daily Claim opens. Missed days do not accumulate, and claims do not reduce your principal.", {"value0":"200","value1":"USDT","value2":"8","value3":"13%"})}</p>${earnTierTable()}
      <ul class="ticks"><li>${icon('check')}${i18n.html("Rewards are credited to your Spot balance.")}</li><li>${icon('check')}${i18n.html("Level {value0} referrals earn you {value1} and level {value2} earns you {value3} of each reward they claim, without reducing theirs.", {"value0":"1","value1":"10%","value2":"2","value3":"5%"})}</li><li>${icon('check')}${i18n.html("Accounts below {value0} {value1} see exactly how much is needed to start.", {"value0":"200","value1":"USDT"})}</li></ul></section>

    <section class="card about-sec"><span class="eyebrow">${i18n.html("Trading")}</span><h2>${i18n.html("How orders are priced and settled")}</h2>
      <p>${i18n.html("Prices come from Binance public market data. When you place an order you receive a quote that is valid for {value0} seconds; if the market moves materially, a fresh quote is required. Orders are unleveraged, cannot be sold short and settle in {value1}.", {"value0":"15","value1":"USDT"})}</p>
      <p>${i18n.html("Positions are recorded by {value0} as price-linked holdings. They are not on-chain coins, they cannot be withdrawn as crypto, and no coin custody is implied. Your Spot balance and positions are shown separately, with unrealized PNL updated live.", {"value0":"Portgainy"})}</p></section>

    <section class="block">${sectionHead('Security & safeguards')}<div class="pillars safety">${safety.map(([g, t, d]) => `<article><span class="pillar-ic">${icon(g)}</span><h3>${i18n.html(t)}</h3><p>${i18n.html(d)}</p></article>`).join('')}</div></section>

    <section class="card about-sec"><span class="eyebrow">${i18n.html("Reference")}</span><h2>${i18n.html("Fees, limits and rules")}</h2>
      <dl class="facts">${limits.map(([k, v]) => `<div><dt>${i18n.html(k)}</dt><dd>${i18n.html(v)}</dd></div>`).join('')}</dl></section>

    <section class="card about-sec"><span class="eyebrow">${i18n.html("Transparency")}</span><h2>${i18n.html("Data sources and availability")}</h2>
      <p>${i18n.html("Market prices and {value0}-hour statistics are provided by Binance. If the price feed is interrupted, {value1} marks the connection as delayed and pauses new quotes. Your balances and history are unaffected by price-feed interruptions.", {"value0":"24","value1":"Portgainy"})}</p>
      <div class="status-row">${liveBadge()}<span>${esc(status)}</span></div></section>

    <section class="card about-sec disclaimer"><span class="eyebrow warn">${i18n.html("Risk notice")}</span><h2>${i18n.html("Please read")}</h2>
      <p>${i18n.html("Crypto prices are volatile and trading can result in losses, including the loss of your entire position. Reward rates and program terms can change and are not guaranteed. Past results do not indicate future performance. Nothing on {value0} is investment, legal or tax advice. Only use funds you can afford to lose and keep your credentials private.", {"value0":"Portgainy"})}</p></section>

    <section class="about-end"><h2>${i18n.html("Questions?")}</h2><p>${i18n.html("Browse the help center or ask the {value0} assistant any time.", {"value0":"Portgainy"})}</p><button class="btn btn-lime" data-act="goto" data-view="support">${icon('headset')}${i18n.html("Visit Support")}</button></section>
  </div>`;
}

/* ----------------------------------------------------------------- admin */

const ADMIN_OPEN = ['requested', 'approved', 'submitted'];
const adminNum = value => `<span class="mono">${esc(usdt(value))}</span>`;
function exactDepositAmount(value) {
  const match = /^(\d+)\.(\d{6})$/.exec(String(value ?? ''));
  if (!match) return '—';
  const whole = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = match[2].replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${fraction} USDT`;
}
function sumExactAmounts(...values) {
  if(values.some(value=>!/^\d+\.\d{6}$/.test(String(value))))return '—';
  const total=values.reduce((sum,value)=>sum+BigInt(value.replace('.','')),0n);
  return exactDepositAmount(`${total/1_000_000n}.${(total%1_000_000n).toString().padStart(6,'0')}`);
}

function adminView() {
  const head = `<header class="page-head"><div><h1>${i18n.html("Admin")}</h1><p>${i18n.html("Accounting, wallet activity and accounts")}</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="admin-refresh">${icon('retry')}${i18n.html("Refresh")}</button></header>`;
  if (!S.admin) return `<div class="page admin">${head}${emptyState('retry', 'Loading admin data…')}</div>`;
  const { users, withdrawals } = S.admin;
  const depositInfo = S.admin.depositInfo;
  const report = S.admin.accounting;
  const open = withdrawals.filter(w => ADMIN_OPEN.includes(w.status));
  const total = (rows, field) => Math.round(rows.reduce((s, r) => s + num(r[field]), 0) * 1e6) / 1e6;
  const metrics = [['Confirmed deposits', depositInfo ? exactDepositAmount(depositInfo.totalAmount) : i18n.text('Unavailable'), 'deposit', 'deposits', i18n.text('All-time USDT · TRC20')],
    ['Pending', String(report?.withdrawals.pending.count ?? open.length), 'clock', 'pending'], ['Pending net', report ? exactDepositAmount(report.withdrawals.pending.net) : i18n.text('Unavailable'), 'withdraw', 'to-send'],
    ['Earn balances', report ? exactDepositAmount(report.balances.earn) : usdt(total(users, 'lockedBalance')), 'earn', 'vip-balance'],
    ['Spot balances', report ? exactDepositAmount(report.balances.spot) : usdt(total(users, 'withdrawBalance')), 'wallet', 'withdraw-balance', i18n.text('Reserved separately: {amount}', {amount:report ? exactDepositAmount(report.balances.reserved) : usdt(total(users, 'reservedBalance'))})],
    ['Accounts', String(users.length), 'users', 'users'], ['Paid out', report ? sumExactAmounts(report.withdrawals.chainConfirmed.net,report.withdrawals.manualConfirmed.net) : i18n.text('Unavailable'), 'check', 'paid']];
  const tabs = [['accounting', 'Accounting', ''], ['withdrawals', 'Withdrawals', report?.withdrawals.pending.count ?? open.length], ['deposits', 'Deposits', depositInfo?.count ?? '—'], ['users', 'Users', users.length],
    ...(S.admin.workingWallet ? [['working-wallet', 'Working wallet', '']] : [])];
  return `<div class="page admin">${head}
    <section class="metric-grid">${metrics.map(([l, v, g, key, note]) => `<article class="metric" data-metric="${key}"><span>${icon(g)}${i18n.html(l)}</span><strong>${esc(v)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</article>`).join('')}</section>
    <div class="tabs">${tabs.map(([k, l, n]) => `<button class="${S.adminTab === k ? 'is-on' : ''}" type="button" data-act="admin-tab" data-tab="${k}">${i18n.html(l)}<sup>${n}</sup></button>`).join('')}</div>
    ${S.adminTab === 'accounting' ? adminAccounting(report,S.admin.workingWallet) : S.adminTab === 'users' ? adminUsers(users) : S.adminTab === 'deposits' ? adminDepositList(depositInfo) : S.adminTab === 'working-wallet' && S.admin.workingWallet ? adminWorkingWallet(S.admin.workingWallet) : adminWithdrawals(withdrawals)}</div>`;
}

function adminAccounting(report,wallet) {
  if(!report)return emptyState('retry','Accounting temporarily unavailable','Refresh to try again.');
  const value = amount => amount == null ? i18n.text('Needs reconciliation') : exactDepositAmount(amount);
  const entry = (label,amount,extra='') => `<div><dt>${i18n.html(label)}</dt><dd><b>${esc(amount)}</b>${extra ? `<small> · ${i18n.html(extra)}</small>` : ''}</dd></div>`;
  const section = (title,content) => `<section class="card">${sectionHead(title)}<dl class="facts">${content}</dl></section>`;
  const w=report.withdrawals,c=report.collections,s=report.ownerSweeps,b=report.balances,e=report.earnings,d=report.deposits;
  return `<div class="page accounting">
    <p class="note">${icon('info')}${i18n.html("Ledger totals are all-time. Balances are not deposits or profit; wallet values are separate on-chain balances. Synthetic positions are shown at cost, not market value.")}</p>
    <div class="accounting-grid">
    ${section('Customer balances',entry('Earn USDT',value(b.earn))+entry('Spot USDT',value(b.spot))+entry('Reserved withdrawals',value(b.reserved))+
      entry('Total account USDT',value(b.totalUsdt))+entry('Synthetic positions at cost',value(b.positionCost),i18n.text('{count} positions',{count:b.positionCount})))}
    ${section('Deposits and collection',entry('Confirmed wallet deposits',value(d.total),i18n.text('{count} deposits',{count:d.count}))+
      entry('Collected to treasury',value(c.confirmed.gross),i18n.text('{count} transfers · all destinations',{count:c.confirmed.count}))+entry('Credited but not yet collected',value(d.uncollected),'ledger estimate')+
      entry('Collection in progress',value(c.pending.gross),i18n.text('{count} transfers',{count:c.pending.count})))}
    ${section('Withdrawals',entry('Pending requests — gross',value(w.pending.gross),i18n.text('{count} requests',{count:w.pending.count}))+entry('Pending requests — net',value(w.pending.net))+
      entry('Confirmed on-chain — net',value(w.chainConfirmed.net),i18n.text('{count} withdrawals',{count:w.chainConfirmed.count}))+
      entry('Manually marked paid — net',value(w.manualConfirmed.net),i18n.text('{count} withdrawals',{count:w.manualConfirmed.count}))+
      entry('Recorded withdrawal fees',sumExactAmounts(w.chainConfirmed.fee,w.manualConfirmed.fee),'confirmed and manually marked'))}
    ${section('Rewards and adjustments',entry('Earn claims',value(e.earnClaims))+entry('Referral rewards',value(e.referralRewards))+
      entry('Total recorded earned',value(e.totalEarned))+entry('Recorded manual Earn credits',value(e.manualEarnCredits)))}
    ${section('Working wallet',entry('Available USDT on-chain',wallet?.balance==null?'Unavailable':usdt(wallet.balance))+
      entry('Working wallet TRX',wallet?.workingTrx==null?'Unavailable':`${usd(wallet.workingTrx)} TRX`)+
      (wallet?.fuelAddress && wallet.fuelAddress!==wallet.address ? entry('Fuel wallet TRX',wallet.fuelTrx==null?'Unavailable':`${usd(wallet.fuelTrx)} TRX`) : '')+
      entry('Confirmed transfers to owner',value(s.confirmed.gross),i18n.text('{count} transfers',{count:s.confirmed.count}))+
      entry('Owner transfer in progress',value(s.pending.gross),i18n.text('{count} transfers',{count:s.pending.count})))}
    </div>
    ${adminJournal(S.admin.journal)}
    <p class="fine">${i18n.html("Manual balance credits are not blockchain deposits. Manually marked withdrawals have no verified transaction in this ledger. Network fees and personal-wallet holdings are not included as profit.")}</p>
  </div>`;
}

function adminJournal(journal) {
  if(!journal)return `<section class="card">${sectionHead('Account ledger')}${emptyState('retry','Ledger temporarily unavailable')}</section>`;
  const title = reason => ({'confirmed-trc20-deposit':i18n.text('Confirmed deposit'),'confirmed-trc20-payout':i18n.text('Confirmed withdrawal'),
    'withdrawal-reservation':i18n.text('Withdrawal reservation'),'withdrawal-rejected':i18n.text('Withdrawal returned'),
    'verified-failed-payout-release':i18n.text('Failed withdrawal returned'),'platform-operation':i18n.text('Account update')}[reason]
    || (reason.startsWith('bulk-spot-to-earn:')?i18n.text('Spot to Earn transfer'):reason.startsWith('admin-earn-set:')?i18n.text('Manual Earn credit'):i18n.text('Account adjustment')));
  const first=journal.count?journal.offset+1:0,last=journal.offset+journal.entries.length;
  return `<section class="card accounting-journal">${sectionHead('Account ledger',`<span class="tag">${i18n.html('{count} entries', {count:journal.count})}</span>`)}
    <p class="fine">${i18n.html("Each line is a balance movement. Transfers have both a debit and a credit.")}</p>
    ${journal.entries.length?`<ul class="acts">${journal.entries.map(row=>`<li class="act" data-journal="${esc(row.batch)}"><span class="act-ic transfer">${icon('receipt')}</span><span class="act-copy"><b>${esc(title(row.reason))}</b><small>${esc(row.account)} · ${esc(row.balance)} · ${esc(dateText(row.at))}</small></span><span class="act-amt ${row.direction==='credit'?'up':'down'}">${row.direction==='credit'?'+':'−'}${esc(exactDepositAmount(row.amount))}</span></li>`).join('')}</ul>`:emptyState('receipt','No ledger entries')}
    ${journal.count?`<div class="admin-pages"><span>${i18n.html('{first}–{last} of {total}', {first,last,total:journal.count})}</span><div><button class="btn btn-ghost btn-sm" type="button" data-act="admin-journal-page" data-offset="${Math.max(0,journal.offset-journal.limit)}" ${journal.offset===0?'disabled':''}>${i18n.html("Previous")}</button><button class="btn btn-ghost btn-sm" type="button" data-act="admin-journal-page" data-offset="${journal.offset+journal.limit}" ${journal.hasMore?'':'disabled'}>${i18n.html("Next")}</button></div></div>`:''}</section>`;
}

function adminWorkingWallet(wallet) {
  const pending = wallet.pending;
  const issue = {TREASURY_USDT_INSUFFICIENT:'The working wallet does not have enough USDT.', TREASURY_TRX_RESERVE_REQUIRED:'The working wallet needs more TRX for network fees.',
    WORKING_WALLET_BUSY:'Waiting for an outgoing withdrawal to confirm.', SIGNED_TRANSACTION_EXPIRED:'The signed transfer expired and needs review.',
    OWNER_SWEEP_RECEIPT_MISMATCH:'The network receipt needs review.', NETWORK_OR_STORAGE_UNAVAILABLE:'The network or storage is temporarily unavailable.'}[wallet.issue];
  const payoutIssue = {TREASURY_USDT_INSUFFICIENT:'Automatic withdrawals are waiting for USDT.', TREASURY_TRX_RESERVE_REQUIRED:'Automatic withdrawals are waiting for TRX.',
    WORKING_WALLET_BUSY:'Automatic withdrawals are waiting for another outgoing transfer.', SIGNED_TRANSACTION_EXPIRED:'A signed withdrawal expired and needs review.',
    PAYOUT_INTENT_EXPIRED_REVIEW_REQUIRED:'A withdrawal needs review before it can continue.', NETWORK_OR_STORAGE_UNAVAILABLE:'Withdrawal processing is temporarily unavailable.',
    BROADCAST_NOT_ACKNOWLEDGED:'A withdrawal is awaiting a network response.'}[wallet.payoutIssue];
  const collectionIssue = {GAS_WALLET_REQUIRES_TRX:'Deposit collection is waiting for more TRX in the funding wallet.', TRX_FEE_RESERVE_REQUIRED:'Deposit collection is waiting for TRX.', WORKING_WALLET_BUSY:'Deposit collection is waiting for another wallet transaction to confirm.',
    DAILY_SPENDING_LIMIT_REACHED:'The daily collection fee budget has been reached.', USDT_BALANCE_NOT_YET_AVAILABLE:'A deposit is waiting for its confirmed balance.',
    SIGNED_TRANSACTION_EXPIRED:'A signed collection needs review.', PAUSED_FOR_REVIEW:'Deposit collection needs review.', NETWORK_OR_STORAGE_UNAVAILABLE:'Deposit collection is temporarily unavailable.'}[wallet.collectionIssue];
  return `<section class="card">${sectionHead('Working wallet')}
    <dl class="facts"><div><dt>${i18n.html("Balance")}</dt><dd>${wallet.balance == null ? i18n.html('Unavailable') : `${money(wallet.balance)} USDT`}</dd></div>
      <div><dt>${i18n.html("Working wallet {value0}", {"value0":"TRX"})}</dt><dd>${wallet.workingTrx == null ? i18n.html('Unavailable') : `${money(wallet.workingTrx)} TRX`}</dd></div>
      ${wallet.fuelAddress && wallet.fuelAddress!==wallet.address ? `<div><dt>${i18n.html("Fuel wallet {value0}", {"value0":"TRX"})}</dt><dd>${wallet.fuelTrx == null ? i18n.html('Unavailable') : `${money(wallet.fuelTrx)} TRX`}</dd></div>` : ''}
      <div><dt>${i18n.html("Working address")}</dt><dd><code>${esc(wallet.address)}</code></dd></div>
      ${wallet.fuelAddress && wallet.fuelAddress!==wallet.address ? `<div><dt>${i18n.html("Fuel address")}</dt><dd><code>${esc(wallet.fuelAddress)}</code></dd></div>` : ''}
      <div><dt>${i18n.html("Send to your treasury")}</dt><dd><code>${esc(wallet.destination)}</code></dd></div></dl>
    <p class="note">${icon('info')}${i18n.html("Funds stay here until you request a transfer. Keep enough {value0} and {value1} available for customer withdrawals.", {"value0":"USDT","value1":"TRX"})}</p>
    ${payoutIssue ? `<p class="note">${icon('info')}${i18n.html(payoutIssue)}</p>` : ''}${collectionIssue ? `<p class="note">${icon('info')}${i18n.html(collectionIssue)}</p>` : ''}
    ${pending && issue ? `<p class="note">${icon('info')}${i18n.html(issue)}</p>` : ''}
    ${!pending && wallet.recent ? `<p class="note">Last transfer: ${money(wallet.recent.amount)} USDT · ${esc(wallet.recent.status)}${/^[a-f0-9]{64}$/.test(wallet.recent.txid || '') ? ` · <a href="https://tronscan.org/#/transaction/${wallet.recent.txid}" target="_blank" rel="noopener noreferrer">${i18n.html("View transaction")}</a>` : ''}</p>` : ''}
    ${pending ? `<p class="note">Transfer ${money(pending.amount)} USDT · ${esc(pending.status)}${pending.txid ? ` · <a href="https://tronscan.org/#/transaction/${esc(pending.txid)}" target="_blank" rel="noopener noreferrer">${i18n.html("View transaction")}</a>` : ''}</p>
      ${pending.status === 'planned' ? `<form class="form" data-form="owner-sweep-cancel" data-id="${esc(pending.id)}"><label class="field"><span>${i18n.html("Account password")}</span><div class="control"><input name="password" type="password" autocomplete="current-password" required></div></label><p class="form-msg" role="alert"></p><button class="btn btn-ghost" type="submit">${i18n.html("Cancel pending transfer")}</button></form>` : ''}`
      : `<form class="form" data-form="owner-sweep"><label class="field"><span>${i18n.html("Amount to send")}</span><div class="control"><input name="amount" type="number" inputmode="decimal" min="0.000001" step="0.000001" placeholder="0.00" required><b class="suffix">USDT</b></div></label>
        <label class="field"><span>${i18n.html("Account password")}</span><div class="control"><input name="password" type="password" autocomplete="current-password" required></div></label><p class="form-msg" role="alert"></p>
        <button class="btn btn-lime" type="submit">${i18n.html("Send to my treasury")}</button></form>`}</section>`;
}

function adminDepositList(info) {
  if (!info) return emptyState('retry', 'Deposit ledger temporarily unavailable', 'Refresh to try again.');
  const rows = Array.isArray(info.deposits) ? info.deposits : [];
  const first = info.count ? info.offset + 1 : 0, last = info.offset + rows.length;
  return `<p class="note">${icon('info')}${i18n.html("All-time confirmed {value0} deposits recorded on {value1}. This is not the current wallet balance. Internal transfers and manual balance adjustments are excluded.", {"value0":"USDT","value1":"TRON"})}</p>
    ${rows.length ? `<ul class="admin-list">${rows.map(d => `<li class="admin-card" data-deposit="${esc(d.txid)}:${esc(d.logIndex)}"><div class="admin-row"><b>${esc(d.email || 'Account unavailable')}</b><span class="st st-confirmed">${i18n.html("Confirmed")}</span></div><small>${esc(d.name || '')} · ${esc(dateText(d.timestamp))}</small>
      <div class="admin-kv"><span>${i18n.html("Amount")}</span><b class="mono">${esc(exactDepositAmount(d.amount))}</b><span>${i18n.html("Network")}</span><b>${i18n.html("{value0} · {value1}", {"value0":"USDT","value1":"TRC20"})}</b></div>
      <div class="admin-addr"><code title="${esc(d.address)}">${esc(d.address)}</code><button class="icon-btn" type="button" data-act="admin-copy" data-value="${esc(d.address)}" aria-label="${i18n.html("Copy deposit address")}">${icon('copy')}</button></div>
      ${/^[a-f0-9]{64}$/.test(d.txid || '') ? `<a class="link-btn" href="https://tronscan.org/#/transaction/${d.txid}" target="_blank" rel="noopener noreferrer">${i18n.html("View transaction")} ${icon('external')}</a>` : ''}</li>`).join('')}</ul>` : emptyState('deposit', 'No confirmed deposits')}
    ${info.count ? `<div class="admin-pages"><span>${i18n.html('{first}–{last} of {total}', {first,last,total:info.count})}</span><div><button class="btn btn-ghost btn-sm" type="button" data-act="admin-deposit-page" data-offset="${Math.max(0, info.offset - info.limit)}" ${info.offset === 0 ? 'disabled' : ''}>${i18n.html("Previous")}</button><button class="btn btn-ghost btn-sm" type="button" data-act="admin-deposit-page" data-offset="${info.offset + info.limit}" ${info.hasMore ? '' : 'disabled'}>${i18n.html("Next")}</button></div></div>` : ''}`;
}

function adminActionBtn(row, action) {
  const armed = S.adminArmed?.id === row.id && S.adminArmed.action === action, ok = action === 'confirm';
  return `<button class="btn ${ok ? 'btn-lime' : 'btn-danger'} btn-sm ${armed ? 'is-armed' : ''}" type="button" data-act="admin-${action}" data-id="${esc(row.id)}" ${S.busy ? 'disabled' : ''}>${icon(ok ? 'check' : 'close')}${i18n.html(ok ? (armed ? 'Confirm sent?' : 'Mark sent') : (armed ? 'Reject now?' : 'Reject'))}</button>`;
}

function adminWithdrawals(all) {
  const rows = S.adminFilter === 'pending' ? all.filter(w => ADMIN_OPEN.includes(w.status)) : all;
  const filter = [['pending', i18n.text('Pending')], ['all', i18n.text('All')]].map(([k, l]) => `<button class="${S.adminFilter === k ? 'is-on' : ''}" type="button" data-act="admin-filter" data-filter="${k}">${esc(l)}</button>`).join('');
  return `<div class="chips">${filter}</div><p class="note">${icon('info')}${i18n.html(S.pay.automaticWithdrawals ? 'Automatic requests are sent from the working wallet; older manual requests still require review.' : 'Send the “To send” amount from the treasury wallet, then press Mark sent. Each decision needs two clicks.')}</p>
    ${rows.length ? `<ul class="admin-list">${rows.map(w => `<li class="admin-card" data-withdrawal="${esc(w.id)}"><div class="admin-row"><b>${esc(w.email || 'Deleted account')}</b><span class="st st-${esc(w.status)}">${esc(withdrawStatus(w))}</span></div><small>${esc(w.name || '')} · ${esc(dateText(w.createdAt))}</small>
      <div class="admin-kv"><span>${i18n.html("Requested")}</span>${adminNum(w.amount)}<span>${i18n.html("Fee")}</span>${adminNum(w.fee)}<span>${i18n.html("To send")}</span><b class="mono">${esc(usdt(w.netAmount))}</b></div>
      <div class="admin-addr"><code>${esc(w.destination)}</code><button class="icon-btn" type="button" data-act="admin-copy" data-value="${esc(w.destination)}" aria-label="${i18n.html("Copy address")}">${icon('copy')}</button><button class="icon-btn" type="button" data-act="admin-copy" data-value="${esc(String(w.netAmount))}" aria-label="${i18n.html("Copy amount")}">${icon('coins')}</button></div>
      ${!S.pay.automaticWithdrawals && !w.automatic && ['requested','approved'].includes(w.status) ? `<div class="btn-row">${adminActionBtn(w, 'confirm')}${w.status === 'requested' ? adminActionBtn(w, 'reject') : ''}</div>` : /^[a-f0-9]{64}$/.test(w.txid || '') ? `<a class="link-btn" href="https://tronscan.org/#/transaction/${w.txid}" target="_blank" rel="noopener noreferrer">${i18n.html("View transaction")} ${icon('external')}</a>` : ''}</li>`).join('')}</ul>` : emptyState('list', 'No withdrawal requests')}`;
}

function adminUsers(users) {
  return `<div class="search-field"><span>${icon('search')}</span><input id="admin-search" type="search" value="${esc(S.adminSearch)}" placeholder="${i18n.html("Search users")}" autocomplete="off"></div>
    <div id="admin-users-results">${adminUserResults(users)}</div>`;
}

function adminUserResults(users) {
  const q = S.adminSearch.trim().toLowerCase();
  const rows = [...users].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).filter(u => !q || `${u.email} ${u.name}`.toLowerCase().includes(q));
  return `${rows.length ? `<ul class="admin-list" id="admin-users">${rows.map(u => `<li class="admin-card" data-user="${esc(u.id)}"><div class="admin-row"><b>${esc(u.email)}</b><span class="tag">${Math.round(num(u.earnRate ?? 0.1) * 100)}% / 24h</span></div><small>${i18n.html('{name} · joined {date}', {name:u.name,date:dateText(u.createdAt, true)})}</small><div class="admin-kv"><span>Earn</span>${adminNum(u.lockedBalance)}<span>Spot</span>${adminNum(u.withdrawBalance)}<span>${i18n.html("Reserved")}</span>${adminNum(u.reservedBalance)}<span>${i18n.html("Earned")}</span>${adminNum(u.earnedTotal)}<span>${i18n.html("Withdrawn")}</span>${adminNum(u.withdrawnTotal)}</div></li>`).join('')}</ul>` : emptyState('users', 'No users found')}`;
}

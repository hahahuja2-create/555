'use strict';

/* Portgainy views, part 3: earn, referrals, profile, support, about and admin. */

/* ------------------------------------------------------------------ earn */

function earnView() {
  const u = S.user, e = S.earn;
  const rate = Math.round(num(u.earnRate ?? e?.rate ?? 0.1) * 100);
  const reward = earnActive() ? (e?.nextReward ?? num(u.lockedBalance) * (rate / 100)) : 0;
  const ready = claimReady();
  const history = S.activities.filter(a => a.type === 'earn' || a.type === 'referral');
  const calcBase = Math.max(earnMin(), Math.round(num(u.lockedBalance)));
  const short = earnShortfall(), active = short === 0;
  return `<div class="page earn">
    <header class="page-head"><div><h1>Earn</h1><p>Your balance. Your daily reward.</p></div><span class="tag tag-lime">${icon('clock')}24h cycle</span></header>
    <article class="earn-hero">
      <div class="gauge-wrap"><div class="gauge" style="--p:${clamp(rate / 15, 0, 1) * 100}"></div><span class="gauge-in"><b>${rate}<small>%</small></b><em>per day</em></span></div>
      <div class="earn-hero-copy">
        <span class="eyebrow">Daily reward rate</span>
        <h2>${rate}% of your Earn balance, every day</h2>
        <p>Claim once per UTC day. Rewards are paid to your Spot balance and your principal stays in Earn.</p>
      </div>
      ${active ? '' : `<div class="earn-gate"><div class="earn-gate-top"><span>${icon('lock')}Earn starts at ${earnMin()} USDT</span><b>${usd(short)} USDT to go</b></div><i class="xp is-lg"><b style="width:${Math.round(clamp(num(u.lockedBalance) / earnMin(), 0, 1) * 100)}%"></b></i><p>Your Earn balance is ${money(u.lockedBalance)} USDT. Add ${usd(short)} USDT more to unlock daily rewards.</p><button class="btn btn-lime btn-block" type="button" data-act="wallet-deposit">${icon('deposit')}Add ${usd(short)} USDT</button></div>`}
      ${active ? `      <div class="claim-box ${ready ? 'is-ready' : ''}">
        <div><small>Next reward</small><strong>${usd(reward)} <span>USDT</span></strong></div>
        <div><small>${ready || !active ? 'Status' : 'Opens in'}</small><strong class="${ready ? 'up' : ''}" ${active ? 'data-earn-timer' : ''}>${ready ? 'Ready' : !active ? 'Locked' : e ? clock(e.nextClaimAt - serverNow()) : '--:--:--'}</strong></div>
        <button class="btn ${ready ? 'btn-lime' : 'btn-dark'} btn-lg btn-block" type="button" data-act="claim" data-claim-btn ${ready ? '' : 'disabled'}><span data-claim-label>${ready ? 'Claim reward' : !active ? `Earn starts at ${earnMin()} USDT` : reward > 0 ? 'Waiting for next claim' : 'No reward available'}</span></button>
        <p class="form-msg" id="earn-error" role="alert"></p>
      </div>` : ''}
    </article>
    <section class="tiles">
      <article class="tile"><span class="tile-ic">${icon('earn')}</span><small>Earn balance</small><strong>${money(u.lockedBalance)}</strong><div class="btn-row"><button class="btn btn-lime btn-sm" data-act="wallet-deposit">${icon('deposit')}Deposit</button><button class="btn btn-ghost btn-sm" data-act="wallet-transfer">${icon('transfer')}Move</button></div></article>
      <article class="tile"><span class="tile-ic is-cyan">${icon('wallet')}</span><small>Spot balance</small><strong>${money(u.withdrawBalance)}</strong><div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="goto" data-view="trade">${icon('candles')}Trade</button><button class="btn btn-ghost btn-sm" data-act="wallet-withdraw">${icon('withdraw')}Send</button></div></article>
    </section>
    
    <section class="card calc">${sectionHead('Reward calculator', '<span class="tag">Estimate</span>')}
      <label class="field"><span>Earn balance</span><div class="control"><input id="calc-amount" type="number" inputmode="decimal" min="0" step="1" value="${calcBase}"><b class="suffix">USDT</b></div></label>
      <input id="calc-range" class="range" type="range" min="200" max="10000" step="10" value="${clamp(calcBase, 200, 10000)}" aria-label="Balance">
      <div class="calc-out" data-rate="${rate}"><span><small>Daily</small><b data-calc="d">—</b></span><span><small>7 days</small><b data-calc="w">—</b></span><span><small>30 days</small><b data-calc="m">—</b></span></div>
      <p class="fine">${icon('info')}Estimate assuming one claim every day at today’s ${rate}% rate on an unchanged balance. It is not a promise of future rewards.</p>
    </section>
    <section class="rules">${[['clock', 'One claim per day', 'A new claim opens daily at 00:00 UTC. Missed days do not accumulate.'], ['wallet', 'Principal stays put', 'Claims do not reduce your Earn balance. Rewards credit Spot.'], ['users', 'Two referral levels', 'Level 1 earns 10% and level 2 earns 5% of each claimed reward.']].map(([g, t, d]) => `<article>${icon(g)}<div><b>${t}</b><p>${d}</p></div></article>`).join('')}</section>
    <section class="card">${sectionHead('Earn activity', moreLink('Referrals', 'referrals'))}${history.length ? `<ul class="acts">${history.slice(0, 12).map(a => `<li class="act"><span class="act-ic ${a.type}">${icon(activityIconFor(a))}</span><span class="act-copy"><b>${esc(activityTitle(a))}</b><small>${esc(dateText(a.at))}</small></span><span class="act-amt up">${S.hide ? '••••' : `+${usd(a.amount)}`}<small>USDT</small></span></li>`).join('')}</ul>` : emptyState('earn', 'No Earn activity yet', 'Your claims and referral rewards will be listed here.')}</section>
  </div>`;
}

function updateCalc() {
  const wrap = document.querySelector('.calc-out'), input = document.querySelector('#calc-amount');
  if (!wrap || !input) return;
  const rate = num(wrap.dataset.rate) / 100, base = Math.max(0, num(input.value));
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
    <div class="prog"><span>Active referrals</span><b>${p.qualifyingReferrals} / ${p.requiredReferrals}</b></div>
    <i class="xp is-lg"><b style="width:${Math.round(clamp(p.qualifyingReferrals / p.requiredReferrals, 0, 1) * 100)}%"></b></i>
    ${!unlocked && !ended ? `<div class="prog"><span>Time left</span><b data-promo-timer="${p.expiresAt}">${promoRemaining(p.expiresAt)}</b></div>` : ''}
  </article>`;
}

/* ------------------------------------------------------------- referrals */

function referralsView() {
  const u = S.user, code = S.team?.inviteCode || u.inviteCode, link = inviteUrl(code);
  const members = S.team?.members || [];
  const income = S.activities.filter(a => a.type === 'referral');
  return `<div class="page referrals">
    <header class="page-head"><div><h1>Referrals</h1><p>Share Portgainy. Grow your network.</p></div></header>
    
    <article class="invite">
      <span class="eyebrow">Your invite code</span>
      <div class="invite-code"><code data-invite-code>${esc(code)}</code><button class="icon-btn" type="button" data-act="copy-invite" aria-label="Copy code">${icon('copy')}</button></div>
      <a class="invite-link" data-invite-link href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>
      <div class="btn-row"><button class="btn btn-lime" type="button" data-act="copy-invite-link">${icon('link')}Copy link</button><button class="btn btn-ghost" type="button" data-act="share-invite">${icon('share')}Share</button></div>
    </article>
    <section class="tiles">${[[1, 10, displayReferralCount(1), 'Directly invited friends'], [2, 5, displayReferralCount(2), 'Friends invited by your friends']].map(([lv, rate, count, text]) => `<article class="tile level"><span class="eyebrow">Level ${lv}</span><strong class="big">${rate}<small>%</small></strong><p>${text}. You earn ${rate}% of every Earn reward they claim.</p><b class="count">${count} <small>members</small></b></article>`).join('')}</section>
    ${manualAdminDisplay() ? `<div class="note">${icon('info')}Referral counts and income include manual display adjustments; actual referrals and rewards are unchanged.</div>` : ''}
    <div class="note">${icon('info')}Referral rewards credit your Spot balance and never reduce your friends’ own rewards.</div>
    <section class="card">${sectionHead('Referral income', `<b class="up">${money(displayReferralEarned())} USDT</b>`)}${income.length ? `<ul class="acts">${income.slice(0, 12).map(a => `<li class="act"><span class="act-ic referral">${icon('users')}</span><span class="act-copy"><b>${esc(activityTitle(a))}</b><small>${esc(dateText(a.at))}</small></span><span class="act-amt up">${S.hide ? '••••' : `+${usd(a.amount)}`}<small>USDT</small></span></li>`).join('')}</ul>` : emptyState('users', 'No recorded referral income yet', 'Rewards appear after your friends claim their Earn rewards.')}</section>
    <section class="card">${sectionHead('Your team', `<span class="tag">${members.length} members</span>`)}${members.length ? `<ul class="acts">${members.map(m => `<li class="act"><span class="act-ic transfer">${icon('user')}</span><span class="act-copy"><b>${esc(m.name)}</b><small>Joined ${esc(dateText(m.createdAt, true))}</small></span></li>`).join('')}</ul>` : emptyState('user', 'No members yet', 'Share your link to bring friends in.')}</section>
  </div>`;
}

/* --------------------------------------------------------------- profile */

function profileView() {
  const u = S.user, r = stats();
  return `<div class="page profile">
    <article class="profile-hero">
      <div class="profile-badge">${avatarHex(u.name, 'is-xl')}</div>
      <h1>${esc(u.name)}</h1><p>${esc(u.email)}</p>
      <span class="tag tag-lime">${earnActive() ? `Earn active · ${Math.round(num(u.earnRate ?? 0.1) * 100)}% daily` : `Earn starts at ${earnMin()} USDT`}</span>
    </article>
    <section class="tiles stats3">${[['Claims', r.claims, 'earn'], ['Trades', r.trades, 'swords'], ['Invites', r.invites, 'users']].map(([l, v, g]) => `<article class="tile mini"><span class="tile-ic">${icon(g)}</span><strong>${v}</strong><small>${l}</small></article>`).join('')}</section>
    <section class="card">${sectionHead('Preferences')}
      <div class="setting"><span>${icon('eyeOff')}<span><b>Hide balances</b><small>Mask amounts across the app</small></span></span><button class="switch ${S.hide ? 'is-on' : ''}" type="button" role="switch" aria-checked="${S.hide}" data-act="toggle-hide"><i></i></button></div>
    </section>
    <section class="card">${sectionHead('Account')}
      <form class="form" data-form="profile" novalidate><label class="field"><span>Display name</span><div class="control">${icon('user')}<input name="name" type="text" value="${esc(u.name)}" minlength="2" maxlength="50" required></div></label><p class="form-msg" id="profile-msg" role="alert"></p><button class="btn btn-ghost" type="submit">${icon('check')}Save name</button></form>
      <dl class="facts"><div><dt>Email</dt><dd>${esc(u.email)}</dd></div><div><dt>Invite code</dt><dd>${esc(u.inviteCode)}</dd></div><div><dt>Member since</dt><dd>${esc(dateText(u.createdAt, true))}</dd></div><div><dt>Total earned${manualAdminDisplay() ? ' (manual display)' : ''}</dt><dd>${money(displayEarnedTotal())} USDT</dd></div><div><dt>Total withdrawn</dt><dd>${money(u.withdrawnTotal)} USDT</dd></div></dl>
    </section>
    <section class="card links">${[['support', 'headset', 'Help & Support'], ['about', 'building', 'About Portgainy'], ['referrals', 'users', 'Referrals'], ...(u.isAdmin ? [['admin', 'shield', 'Admin console']] : [])].map(([v, g, l]) => `<button type="button" data-act="goto" data-view="${v}">${icon(g)}<span>${l}</span>${icon('chevron')}</button>`).join('')}</section>
    <button class="btn btn-danger btn-lg btn-block" type="button" data-act="logout">${icon('logout')}Sign out</button>
  </div>`;
}

/* --------------------------------------------------------------- support */

const FAQ = [
  ['How do deposits work?', 'Send USDT on the TRON (TRC20) network to your personal deposit address. Once the transfer is confirmed on the blockchain it is credited to your Earn account automatically.'],
  ['How do I claim my daily reward?', 'Open Earn and tap Claim when the timer reaches zero. A new claim opens every day at 00:00 UTC. Rewards credit your Spot balance and your Earn principal stays untouched.'],
  ['What are the withdrawal rules?', 'Withdrawals are requested from your Spot balance, confirmed with your password and reviewed before sending. A 2% fee applies and the minimum request is 10 USDT. Status updates appear under Assets → History.'],
  ['How does trading work?', 'Choose a market, enter an amount in USDT and review a 15-second quote. Prices follow live Binance quotes; positions are recorded by Portgainy and settled in USDT.'],
  ['How do referrals pay out?', 'Level 1 earns 10% and level 2 earns 5% of the Earn rewards your network claims. Referral rewards credit your Spot balance.'],
  ['How do I stay safe?', 'Use a unique password, never share it, and remember that Portgainy staff will never ask for your password or seed phrase. Check addresses carefully before sending funds.']
];

function supportView() {
  const q = (S.faqQuery || '').toLowerCase();
  const list = FAQ.filter(([a, b]) => !q || `${a} ${b}`.toLowerCase().includes(q));
  return `<div class="page support">
    <header class="page-head"><div><h1>Support</h1><p>Answers, guides and the Portgainy assistant.</p></div></header>
    <section class="card chat">
      <div class="chat-head"><span class="bot-ic">${icon('bot')}</span><div><b>Portgainy Assistant</b><small>Automated help · cannot move funds</small></div></div>
      <div class="chat-log" id="chat-log" aria-live="polite">${chatLog()}</div>
      <div class="chat-suggest">${['How do I deposit?', 'How does Earn work?', 'How do I withdraw?', 'What is the BTC price?'].map(s => `<button type="button" data-act="chat-suggest" data-text="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <form class="chat-form" data-form="chat"><input id="chat-input" type="text" maxlength="600" placeholder="Ask a question…" autocomplete="off" aria-label="Message"><button class="btn btn-lime btn-icon" type="submit" aria-label="Send">${icon('send')}</button></form>
    </section>
    <div class="search-field"><span>${icon('search')}</span><input id="faq-search" type="search" value="${esc(S.faqQuery || '')}" placeholder="Search help articles" autocomplete="off" aria-label="Search help"></div>
    <section class="faq" id="faq-list">${faqList(list)}</section>
    <p class="fine center">${icon('shield')}Portgainy will never ask for your password, seed phrase or private keys.</p>
  </div>`;
}

const faqList = list => (list.length ? list.map(([a, b], i) => `<details class="faq-item" ${i === 0 && !S.faqQuery ? 'open' : ''}><summary>${esc(a)}${icon('chevronDown')}</summary><p>${esc(b)}</p></details>`).join('') : emptyState('search', 'No articles found', 'Try another keyword or ask the assistant.'));

function chatLog() {
  const C = S.chat;
  const intro = `<div class="msg bot"><p>Hi! I’m the Portgainy assistant. Ask about deposits, withdrawals, Earn, referrals or crypto prices. I can’t change balances or give personal investment advice.</p></div>`;
  return intro + C.messages.map(m => `<div class="msg ${m.role}"><p>${esc(m.text)}</p>${m.links?.length ? `<div class="msg-links">${m.links.map(l => `<button type="button" data-act="goto" data-view="${esc(l.view)}">${esc(l.label)}${icon('arrow')}</button>`).join('')}</div>` : ''}</div>`).join('') + (C.busy ? '<div class="msg bot typing"><i></i><i></i><i></i></div>' : '');
}

async function sendChat(text) {
  const C = S.chat, message = String(text || '').trim().slice(0, 600);
  if (!message || C.busy) return;
  C.messages.push({ role: 'user', text: message }); C.busy = true; refreshChat();
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
  const status = S.pay.mode === 'disabled' && !S.pay.available ? 'Payment status is loading or temporarily unavailable.' : S.pay.withdrawals ? 'Deposits and reviewed withdrawals are available.' : 'Deposits are available. Withdrawals are currently paused.';
  const facts = [[`${S.markets.length || '80+'}`, 'Live markets'], ['10%', 'Daily Earn rate'], ['200', 'USDT to start Earn'], ['15s', 'Quote validity']];
  const products = [
    ['chart', 'Live markets', 'Real-time prices for dozens of leading assets with 24-hour range, volume, favorites, category filters and a market-mood read-out.'],
    ['candles', 'Spot trading', 'Review a quote, confirm in one tap and track every position with live unrealized PNL. Orders settle in USDT.'],
    ['earn', 'Earn', 'Keep USDT in your Earn account and claim a daily reward once per UTC day. Your principal always stays in place.'],
    ['users', 'Referrals', 'Invite friends and receive 10% of their claimed rewards at level 1 and 5% at level 2, credited to your Spot balance.'],
    ['wallet', 'USDT wallet', 'A unique TRON (TRC20) deposit address per account, password-confirmed withdrawals and a clear status trail.'],
    ['bell', 'Price alerts', 'Set above/below targets on any market and get notified the moment a price is reached while Portgainy is open.']
  ];
  const steps = [['Create your account', 'Sign up with an email and password. No documents are needed to explore live markets.'], ['Fund Earn', `Deposit USDT (TRC20). Earn starts once your Earn balance reaches 200 USDT.`], ['Claim every day', 'Open Earn after the 00:00 UTC reset and claim 10% of your Earn balance. Rewards land in Spot.'], ['Trade, transfer or withdraw', `Use Spot USDT to trade, move it back to Earn, or request a withdrawal (${fee}% fee, 10 USDT minimum).`]];
  const accounts = [['Earn', 'Deposits and principal', 'Generates your daily reward. Principal is never reduced by claims.', 'earn'], ['Spot', 'Rewards, trading, withdrawals', 'Receives claims and referral rewards. Used for trades and withdrawal requests.', 'wallet'], ['Reserved', 'Pending withdrawals', 'Funds held while a withdrawal request is reviewed and sent.', 'clock']];
  const limits = [['Earn minimum', '200 USDT'], ['Daily reward rate', '10% of your Earn balance'], ['Claim cycle', 'Once per UTC day · resets 00:00 UTC'], ['Referral rewards', 'Level 1: 10% · Level 2: 5%'], ['Spot order size', '1 – 10,000 USDT per order'], ['Quote validity', '15 seconds'], ['Withdrawal minimum', `${S.pay.minimum || 10} USDT`], ['Withdrawal fee', `${fee}%`], ['Deposit network', 'USDT on TRON (TRC20)']];
  const safety = [['lock', 'Password-confirmed withdrawals', 'Every withdrawal request must be confirmed with your account password and is reviewed before it is sent.'], ['qr', 'Unique deposit addresses', 'Each account receives its own TRON address. Deposits are credited only after blockchain confirmation.'], ['fingerprint', 'Idempotent operations', 'Claims, orders and withdrawals use request keys, so a retry after a poor connection can never be paid twice.'], ['shield', 'Protected sessions', 'Sessions use secure, same-site cookies and sensitive endpoints are rate-limited against abuse.'], ['key', 'No keys in the browser', 'The website never holds private keys or seed phrases and Portgainy staff will never ask for them.'], ['history', 'Full transaction trail', 'Every deposit, transfer, claim, trade and withdrawal is recorded and can be exported as CSV.']];
  return `<div class="page about">
    <article class="about-hero">
      <div class="about-cube">${markImg(120, 'float')}</div>
      ${wordmark('is-lg')}
      <h1>Markets, rewards and USDT, <span>in one place.</span></h1>
      <p>Portgainy is a fast, game-inspired digital-asset workspace: live crypto markets, daily Earn rewards, a two-level referral program and a USDT wallet, designed to be clear about where every balance lives.</p>
      <div class="btn-row about-cta">${S.user ? `<button class="btn btn-lime" data-act="goto" data-view="markets">${icon('chart')}Explore markets</button><button class="btn btn-ghost" data-act="goto" data-view="earn">${icon('earn')}Open Earn</button>` : `<button class="btn btn-lime" data-act="auth-home">${icon('rocket')}Get started</button><button class="btn btn-ghost" data-act="goto" data-view="support">${icon('headset')}Support</button>`}</div>
    </article>
    <section class="facts-strip">${facts.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</section>

    <section class="card about-sec"><span class="eyebrow">Who we are</span><h2>Built for clarity and speed</h2>
      <p>Portgainy brings together the tools people actually use every day: a live price board, a straightforward trading flow, a daily reward cycle and a wallet that explains itself. Everything is designed mobile-first, so the full experience fits in your pocket while still scaling up to a complete desktop workspace.</p>
      <p>We keep the model simple and visible. Your balances are split into clearly labeled accounts, every action leaves a record, and every limit, fee and rule is written down on this page instead of buried in fine print.</p></section>

    <section class="block">${sectionHead('What you can do')}<div class="pillars">${products.map(([g, t, d]) => `<article><span class="pillar-ic">${icon(g)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div></section>

    <section class="card about-sec"><span class="eyebrow">Step by step</span><h2>How Portgainy works</h2>
      <ol class="how">${steps.map(([t, d], i) => `<li><span class="how-n">${i + 1}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}</ol></section>

    <section class="block">${sectionHead('Your accounts')}<div class="acct-cards">${accounts.map(([t, sub, d, g]) => `<article class="tile"><span class="tile-ic ${t === 'Spot' ? 'is-cyan' : ''}">${icon(g)}</span><strong>${t}</strong><small>${sub}</small><p>${d}</p></article>`).join('')}</div></section>

    <section class="card about-sec"><span class="eyebrow">Earn</span><h2>A daily reward on your Earn balance</h2>
      <p>When your Earn balance reaches 200 USDT, you can claim a reward of 10% of that balance once per UTC day. The claim window resets at 00:00 UTC (04:00 in Tbilisi). Missed days never accumulate, and claiming never reduces your principal.</p>
      <ul class="ticks"><li>${icon('check')}Rewards are credited to your Spot balance.</li><li>${icon('check')}Level 1 referrals earn you 10% and level 2 earns you 5% of each reward they claim, without reducing theirs.</li><li>${icon('check')}Accounts below 200 USDT see exactly how much is needed to start.</li></ul></section>

    <section class="card about-sec"><span class="eyebrow">Trading</span><h2>How orders are priced and settled</h2>
      <p>Prices come from Binance public market data. When you place an order you receive a quote that is valid for 15 seconds; if the market moves materially, a fresh quote is required. Orders are unleveraged, cannot be sold short and settle in USDT.</p>
      <p>Positions are recorded by Portgainy as price-linked holdings. They are not on-chain coins, they cannot be withdrawn as crypto, and no coin custody is implied. Your Spot balance and positions are shown separately, with unrealized PNL updated live.</p></section>

    <section class="block">${sectionHead('Security & safeguards')}<div class="pillars safety">${safety.map(([g, t, d]) => `<article><span class="pillar-ic">${icon(g)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div></section>

    <section class="card about-sec"><span class="eyebrow">Reference</span><h2>Fees, limits and rules</h2>
      <dl class="facts">${limits.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>

    <section class="card about-sec"><span class="eyebrow">Transparency</span><h2>Data sources and availability</h2>
      <p>Market prices and 24-hour statistics are provided by Binance. If the price feed is interrupted, Portgainy marks the connection as delayed and pauses new quotes. Your balances and history are unaffected by price-feed interruptions.</p>
      <div class="status-row">${liveBadge()}<span>${esc(status)}</span></div></section>

    <section class="card about-sec disclaimer"><span class="eyebrow warn">Risk notice</span><h2>Please read</h2>
      <p>Crypto prices are volatile and trading can result in losses, including the loss of your entire position. Reward rates and program terms can change and are not guaranteed. Past results do not indicate future performance. Nothing on Portgainy is investment, legal or tax advice. Only use funds you can afford to lose and keep your credentials private.</p></section>

    <section class="about-end"><h2>Questions?</h2><p>Browse the help center or ask the Portgainy assistant any time.</p><button class="btn btn-lime" data-act="goto" data-view="support">${icon('headset')}Visit Support</button></section>
  </div>`;
}

/* ----------------------------------------------------------------- admin */

const ADMIN_OPEN = ['requested', 'approved'];
const adminNum = value => `<span class="mono">${esc(usdt(value))}</span>`;
function exactDepositAmount(value) {
  const match = /^(\d+)\.(\d{6})$/.exec(String(value ?? ''));
  if (!match) return '—';
  const whole = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = match[2].replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${fraction} USDT`;
}

function adminView() {
  const head = `<header class="page-head"><div><h1>Admin</h1><p>Deposits, withdrawal review and accounts</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="admin-refresh">${icon('retry')}Refresh</button></header>`;
  if (!S.admin) return `<div class="page admin">${head}${emptyState('retry', 'Loading admin data…')}</div>`;
  const { users, withdrawals } = S.admin;
  const depositInfo = S.admin.depositInfo;
  const open = withdrawals.filter(w => ADMIN_OPEN.includes(w.status));
  const total = (rows, field) => Math.round(rows.reduce((s, r) => s + num(r[field]), 0) * 1e6) / 1e6;
  const metrics = [['Confirmed deposits', depositInfo ? exactDepositAmount(depositInfo.totalAmount) : 'Unavailable', 'deposit', 'deposits', 'All-time USDT · TRC20'], ['Pending', String(open.length), 'clock', 'pending'], ['To send', usdt(total(open, 'netAmount')), 'withdraw', 'to-send'], ['Earn balances', usdt(total(users, 'lockedBalance')), 'earn', 'vip-balance'], ['Spot balances', usdt(total(users, 'withdrawBalance')), 'wallet', 'withdraw-balance', `Includes ${usdt(total(users, 'reservedBalance'))} reserved`], ['Accounts', String(users.length), 'users', 'users'], ['Paid out', usdt(total(withdrawals.filter(w => w.status === 'confirmed'), 'netAmount')), 'check', 'paid']];
  const tabs = [['withdrawals', 'Withdrawals', open.length], ['deposits', 'Deposits', depositInfo?.count ?? '—'], ['users', 'Users', users.length]];
  return `<div class="page admin">${head}
    <section class="metric-grid">${metrics.map(([l, v, g, key, note]) => `<article class="metric" data-metric="${key}"><span>${icon(g)}${l}</span><strong>${esc(v)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</article>`).join('')}</section>
    <div class="tabs">${tabs.map(([k, l, n]) => `<button class="${S.adminTab === k ? 'is-on' : ''}" type="button" data-act="admin-tab" data-tab="${k}">${l}<sup>${n}</sup></button>`).join('')}</div>
    ${S.adminTab === 'users' ? adminUsers(users) : S.adminTab === 'deposits' ? adminDepositList(depositInfo) : adminWithdrawals(withdrawals)}</div>`;
}

function adminDepositList(info) {
  if (!info) return emptyState('retry', 'Deposit ledger temporarily unavailable', 'Refresh to try again.');
  const rows = Array.isArray(info.deposits) ? info.deposits : [];
  const first = info.count ? info.offset + 1 : 0, last = info.offset + rows.length;
  return `<p class="note">${icon('info')}All-time confirmed USDT deposits recorded on TRON. This is not the current wallet balance. Internal transfers and manual balance adjustments are excluded.</p>
    ${rows.length ? `<ul class="admin-list">${rows.map(d => `<li class="admin-card" data-deposit="${esc(d.txid)}:${esc(d.logIndex)}"><div class="admin-row"><b>${esc(d.email || 'Account unavailable')}</b><span class="st st-confirmed">Confirmed</span></div><small>${esc(d.name || '')} · ${esc(dateText(d.timestamp))}</small>
      <div class="admin-kv"><span>Amount</span><b class="mono">${esc(exactDepositAmount(d.amount))}</b><span>Network</span><b>USDT · TRC20</b></div>
      <div class="admin-addr"><code title="${esc(d.address)}">${esc(d.address)}</code><button class="icon-btn" type="button" data-act="admin-copy" data-value="${esc(d.address)}" aria-label="Copy deposit address">${icon('copy')}</button></div>
      ${/^[a-f0-9]{64}$/.test(d.txid || '') ? `<a class="link-btn" href="https://tronscan.org/#/transaction/${d.txid}" target="_blank" rel="noopener noreferrer">View transaction ${icon('external')}</a>` : ''}</li>`).join('')}</ul>` : emptyState('deposit', 'No confirmed deposits')}
    ${info.count ? `<div class="admin-pages"><span>${first}–${last} of ${info.count}</span><div><button class="btn btn-ghost btn-sm" type="button" data-act="admin-deposit-page" data-offset="${Math.max(0, info.offset - info.limit)}" ${info.offset === 0 ? 'disabled' : ''}>Previous</button><button class="btn btn-ghost btn-sm" type="button" data-act="admin-deposit-page" data-offset="${info.offset + info.limit}" ${info.hasMore ? '' : 'disabled'}>Next</button></div></div>` : ''}`;
}

function adminActionBtn(row, action) {
  const armed = S.adminArmed?.id === row.id && S.adminArmed.action === action, ok = action === 'confirm';
  return `<button class="btn ${ok ? 'btn-lime' : 'btn-danger'} btn-sm ${armed ? 'is-armed' : ''}" type="button" data-act="admin-${action}" data-id="${esc(row.id)}" ${S.busy ? 'disabled' : ''}>${icon(ok ? 'check' : 'close')}${ok ? (armed ? 'Confirm sent?' : 'Mark sent') : (armed ? 'Reject now?' : 'Reject')}</button>`;
}

function adminWithdrawals(all) {
  const rows = S.adminFilter === 'pending' ? all.filter(w => ADMIN_OPEN.includes(w.status)) : all;
  const filter = [['pending', 'Pending'], ['all', 'All']].map(([k, l]) => `<button class="${S.adminFilter === k ? 'is-on' : ''}" type="button" data-act="admin-filter" data-filter="${k}">${l}</button>`).join('');
  return `<div class="chips">${filter}</div><p class="note">${icon('info')}Send the “To send” amount from the treasury wallet, then press Mark sent. Each decision needs two clicks.</p>
    ${rows.length ? `<ul class="admin-list">${rows.map(w => `<li class="admin-card" data-withdrawal="${esc(w.id)}"><div class="admin-row"><b>${esc(w.email || 'Deleted account')}</b><span class="st st-${esc(w.status)}">${esc(WITHDRAW_STATUS[w.status] || w.status)}</span></div><small>${esc(w.name || '')} · ${esc(dateText(w.createdAt))}</small>
      <div class="admin-kv"><span>Requested</span>${adminNum(w.amount)}<span>Fee</span>${adminNum(w.fee)}<span>To send</span><b class="mono">${esc(usdt(w.netAmount))}</b></div>
      <div class="admin-addr"><code>${esc(w.destination)}</code><button class="icon-btn" type="button" data-act="admin-copy" data-value="${esc(w.destination)}" aria-label="Copy address">${icon('copy')}</button><button class="icon-btn" type="button" data-act="admin-copy" data-value="${esc(String(w.netAmount))}" aria-label="Copy amount">${icon('coins')}</button></div>
      ${ADMIN_OPEN.includes(w.status) ? `<div class="btn-row">${adminActionBtn(w, 'confirm')}${w.status === 'requested' ? adminActionBtn(w, 'reject') : ''}</div>` : /^[a-f0-9]{64}$/.test(w.txid || '') ? `<a class="link-btn" href="https://tronscan.org/#/transaction/${w.txid}" target="_blank" rel="noopener noreferrer">View transaction ${icon('external')}</a>` : ''}</li>`).join('')}</ul>` : emptyState('list', 'No withdrawal requests')}`;
}

function adminUsers(users) {
  const q = S.adminSearch.trim().toLowerCase();
  const rows = [...users].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).filter(u => !q || `${u.email} ${u.name}`.toLowerCase().includes(q));
  return `<div class="search-field"><span>${icon('search')}</span><input id="admin-search" type="search" value="${esc(S.adminSearch)}" placeholder="Search users" autocomplete="off"></div>
    ${rows.length ? `<ul class="admin-list" id="admin-users">${rows.map(u => `<li class="admin-card" data-user="${esc(u.id)}"><div class="admin-row"><b>${esc(u.email)}</b><span class="tag">${Math.round(num(u.earnRate ?? 0.1) * 100)}% / 24h</span></div><small>${esc(u.name)} · joined ${esc(dateText(u.createdAt, true))}</small><div class="admin-kv"><span>Earn</span>${adminNum(u.lockedBalance)}<span>Spot</span>${adminNum(u.withdrawBalance)}<span>Reserved</span>${adminNum(u.reservedBalance)}<span>Earned</span>${adminNum(u.earnedTotal)}<span>Withdrawn</span>${adminNum(u.withdrawnTotal)}</div></li>`).join('')}</ul>` : emptyState('users', 'No users found')}`;
}

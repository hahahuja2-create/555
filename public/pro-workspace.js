'use strict';

// Presentation and market workspace; existing wallet and membership accounting remains in app.js.
const pro = {
  markets:[],status:'loading',updatedAt:null,source:null,portfolio:null,portfolioOwner:null,
  config:null,assetTab:'all',hide:false,marketQuery:'',category:'all',marketSort:'default',
  favorites:readFavorites(),trade:null,quote:null,tradeSide:'BUY',tradeBusy:false,tradeRange:'1D',
  history:null,historyRequest:0,assetChart:null,tradeChart:null,selectedPlan:null,
  missionPhase:0,missionAnswer:null,chatOpen:false,chatBusy:false,messages:[],chatInput:'',feed:null
};
function readFavorites() { try { const value=JSON.parse(localStorage.getItem('taskmall_watchlist')||'["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT"]');return Array.isArray(value)?value.filter(item=>typeof item==='string' && /^[A-Z0-9]+USDT$/.test(item)).slice(0,64):[]; } catch { return []; } }
function pcopy(ka,en) { return state.lang==='ka'?ka:en; }
function pe(ka,en) { return escapeHtml(pcopy(ka,en)); }
function price(value) {
  if (!Number.isFinite(value) || value<=0) return '—';
  return new Intl.NumberFormat(locale(),{minimumFractionDigits:value>=1?2:4,maximumFractionDigits:value>=1?2:8}).format(value);
}
function quantity(value) { return new Intl.NumberFormat(locale(),{maximumFractionDigits:8}).format(Number(value)||0); }
function moneyView(value) { return pro.hide?'••••••':formatUsdt(value); }
function changeView(value) { return (value>0?'+':'')+Number(value).toFixed(2)+'%'; }
function coinIcon(coin) {
  const base=String(coin.base||''),src=COIN_LOGOS[base];
  return src?`<span class="coin-mark coin-logo coin-${escapeHtml(base)}"><img src="${escapeHtml(src)}" width="36" height="36" alt="${escapeHtml(coin.name||base)}" decoding="async"></span>`:`<span class="coin-mark" style="--coin:#68788f">${escapeHtml(base.slice(0,2))}</span>`;
}
function freshCoin(coin) { return Boolean(coin && Date.now()-coin.updatedAt<30_000); }
function liveBadge() { return `<span class="live-badge ${pro.status==='live'?'':'is-offline'}" data-live-status><i></i>${pe(pro.status==='live'?'ცოცხალი ბაზარი':pro.status==='loading'?'მონაცემები იტვირთება':'კავშირი შეყოვნებულია',pro.status==='live'?'Live market':pro.status==='loading'?'Connecting to market':'Market connection delayed')}</span>`; }
function marketPrice(coin) { return `<span data-live-price="${escapeHtml(coin.symbol)}">${price(coin.price)}</span>`; }
function marketChange(coin) { return `<span class="price-change ${coin.change>=0?'up':'down'}" data-live-change="${escapeHtml(coin.symbol)}">${changeView(coin.change)}</span>`; }
function marketError() { return `<div class="market-unavailable">${icon('globe')}<strong>${pe('საბაზრო კავშირი დროებით მიუწვდომელია','Market connection is temporarily unavailable')}</strong><p>${pe('ფასები მხოლოდ დადასტურებული საბაზრო მონაცემებიდან გამოჩნდება.','Prices will appear when verified market data is available.')}</p><button class="secondary-button" data-pro-action="refresh-markets">${icon('retry')}${pe('ხელახლა ცდა','Retry connection')}</button></div>`; }
function proHeading(title,sub,actions='') { return `<header class="page-heading pro-heading"><div><h1>${title}</h1><p>${sub}</p></div>${actions}</header>`; }
function assetValue() { return state.user.lockedBalance+state.user.withdrawBalance+(state.user.reservedBalance||0); }
function spotValue() { return (pro.portfolio?.cash||0)+(pro.portfolio?.holdings||[]).reduce((total,item)=>total+item.quantity*(pro.markets.find(coin=>coin.base===item.base)?.price||0),0); }
function walletButtons() { return `<div class="pro-wallet-buttons"><button class="primary-button" data-action="open-wallet" data-wallet-type="deposit">${icon('deposit')}${escapeHtml(t('deposit'))}</button><button class="secondary-button" data-action="open-wallet" data-wallet-type="withdraw">${escapeHtml(t('withdraw'))}</button><button class="secondary-button" data-action="open-wallet" data-wallet-type="transfer">${icon('transfer')}${escapeHtml(t('transfer'))}</button></div>`; }

renderHome = function() {
  const vip=currentVip();
  return `<div class="page assets-page pro-page">
    ${proHeading(pe('აქტივების მიმოხილვა','Assets overview'),pe('შენი ანგარიშები. სრული სურათი.','Your accounts. The complete picture.'),walletButtons())}
    <section class="asset-hero"><div class="asset-hero-main"><div class="asset-label">${pe('საერთო ანგარიშის ღირებულება','Estimated account value')}<button class="icon-button" data-pro-action="toggle-balances" aria-label="${pe('ბალანსების ჩვენება ან დამალვა','Show or hide balances')}" aria-pressed="${pro.hide}">${icon(pro.hide?'eyeOff':'eye')}</button></div><div class="asset-big-number" data-account-total>${escapeHtml(moneyView(assetValue()))}</div><div class="asset-hero-meta"><span>${icon('wallet')}USDT ${pe('ანგარიშები','accounts')}</span><span>${pe('დაჯავშნილია','Reserved')} <strong>${escapeHtml(moneyView(state.user.reservedBalance||0))}</strong></span></div><div class="asset-earned"><span>${pe('სულ მიღებული ჯილდოები','Total earned rewards')}</span><strong class="up">${escapeHtml(moneyView(state.user.earnedTotal))}</strong><button data-action="view" data-view="wallet">${pe('ოპერაციების ისტორია','View activity')}${icon('chevron')}</button></div></div><div class="asset-history"><div><span>${pe('ჯილდოების ისტორია','Rewards history')}</span><small>${escapeHtml(t('lastSevenDays'))}</small></div><div class="asset-history-canvas"><canvas id="asset-earnings-chart" role="img" aria-label="${pe('ბოლო 7 დღის რეალური ჯილდოები','Actual rewards over the last 7 days')}"></canvas></div></div></section>
    <section class="account-strip"><button data-pro-action="asset-tab" data-tab="vip"><span class="account-strip-icon">${icon('earn')}</span><div><span>${pe('Earning balance','Earning balance')}</span><strong>${escapeHtml(moneyView(state.user.lockedBalance))}</strong><small>${pe('დღიური ჯილდოს ძირითადი თანხა','Daily reward principal')}</small></div>${icon('chevron')}</button><button data-pro-action="asset-tab" data-tab="rewards"><span class="account-strip-icon teal">${icon('wallet')}</span><div><span>${pe('Spot balance','Spot balance')}</span><strong>${escapeHtml(moneyView(state.user.withdrawBalance))}</strong><small>${pe('ხელმისაწვდომია გასატანად','Available for withdrawal requests')}</small></div>${icon('chevron')}</button><button data-pro-action="asset-tab" data-tab="spot"><span class="account-strip-icon blue">${icon('chart')}</span><div><span>Spot</span><strong data-spot-value>—</strong><small>${pe('Spot ანგარიში დაუკავშირებელია','Spot account not connected')}</small></div>${icon('chevron')}</button><button data-action="view" data-view="vip"><span class="account-strip-icon gold">${icon('shield')}</span><div><span>${pe('შენი წევრობა','Your membership')}</span><strong>${escapeHtml(vip.name)}</strong><small>${state.user.vipDaysRemaining} ${pe('დღე დარჩა','days remaining')}</small></div>${icon('chevron')}</button></section>
    <div class="assets-columns"><section class="asset-holdings"><div class="pro-section-title"><h2>${pe('შენი აქტივები','Your assets')}</h2><button class="text-button" data-action="view" data-view="wallet">${pe('საფულე','Wallet')}${icon('arrow')}</button></div><div class="pro-tabs asset-tabs">${[['all',pcopy('ყველა ანგარიში','All accounts')],['spot','Spot'],['vip',pcopy('Earning balance','Earning balance')],['rewards',pcopy('ჯილდოები','Rewards')]].map(([id,label])=>`<button class="${pro.assetTab===id?'active':''}" data-pro-action="asset-tab" data-tab="${id}">${escapeHtml(label)}</button>`).join('')}</div>${renderAssetRows()}</section>
    <aside class="market-watch"><div class="pro-section-title"><h2>${pe('ბაზრის მიმოხილვა','Market watch')}</h2>${liveBadge()}</div><div class="market-watch-list">${pro.markets.length?pro.markets.filter(coin=>pro.favorites.includes(coin.symbol)).concat(pro.markets).filter((coin,index,all)=>all.findIndex(item=>item.symbol===coin.symbol)===index).slice(0,5).map(coin=>`<button class="watch-row" data-pro-action="trade" data-symbol="${coin.symbol}">${coinIcon(coin)}<span><strong>${escapeHtml(coin.base)}</strong><small>${escapeHtml(coin.name)}</small></span><span><strong>${marketPrice(coin)}</strong>${marketChange(coin)}</span></button>`).join(''):pro.status==='loading'?`<div class="market-loading">${pe('ბაზრის მონაცემები იტვირთება…','Loading market data…')}</div>`:marketError()}</div><button class="watch-all" data-action="view" data-view="markets">${pe('ყველა ბაზრის ნახვა','Explore all markets')}${icon('arrow')}</button></aside></div>
    <section class="pro-bottom-cards"><button data-action="view" data-view="tasks"><span class="bottom-card-icon">${icon('tasks')}</span><span><small>TASKMALL ACADEMY</small><strong>${pe('ცოდნა, რომელიც გიფასდება','Turn knowledge into progress')}</strong><span>${pe('შენი დღიური დავალება მზადაა','Your daily mission is waiting')}</span></span>${icon('arrow')}</button><button data-action="view" data-view="vip"><span class="bottom-card-icon">${icon('crown')}</span><span><small>MEMBERSHIP</small><strong>${pe('მეტი შესაძლებლობა. შენი ტემპით.','More possibilities. Your own pace.')}</strong><span>${pe('გაეცანი წევრობის პირობებს','Explore membership terms')}</span></span>${icon('arrow')}</button></section>
  </div>`;
};
function renderAssetRows() {
  const tab=pro.assetTab;
  if (tab==='spot') {
    return `<div class="spot-empty">${icon('chart')}<h3>${pe('შენი Spot პორტფელი','Your Spot portfolio')}</h3><p>${pe('Spot ანგარიში ჯერ არ არის დაკავშირებული. გაეცანი ცოცხალ ფასებსა და აქტივების ისტორიას.','Your Spot account is not connected yet. Explore live prices and asset history.')}</p><button class="primary-button" data-action="view" data-view="markets">${pe('ბაზრის გახსნა','Explore markets')}</button></div>`;
  }
  const rows=[['vip',pcopy('Earning balance','Earning balance'),state.user.lockedBalance,pcopy('წევრობის შეძენა','Membership purchases'),'vip'],['rewards',pcopy('Spot balance','Spot balance'),state.user.withdrawBalance,pcopy('მიღებული Claim-ები','Earned task rewards'),'wallet']].filter(row=>tab==='all'||row[0]===tab);
  return `<div class="pro-table-wrap"><table class="asset-table"><thead><tr><th>${pe('აქტივი / ანგარიში','Asset / account')}</th><th>${pe('ბალანსი','Balance')}</th><th>${pe('მოქმედება','Action')}</th></tr></thead><tbody>${rows.map(([id,label,balance,note,view])=>`<tr><td><div class="coin-cell">${coinIcon({base:'USDT'})}<div><strong>USDT <small>Tether</small></strong><span>${escapeHtml(label)}</span></div></div></td><td><strong>${escapeHtml(moneyView(balance))}</strong><small>${escapeHtml(note)}</small></td><td><button class="text-button" data-action="view" data-view="${view}">${pe('მართვა','Manage')}${icon('chevron')}</button></td></tr>`).join('')}${tab==='all'&&(state.user.reservedBalance||0)>0?`<tr><td>${pe('გატანისთვის დაჯავშნილი','Reserved for withdrawal')}</td><td>${escapeHtml(moneyView(state.user.reservedBalance))}</td><td>${icon('clock')}</td></tr>`:''}</tbody></table></div><div class="asset-table-footer">${icon('info')}<span>${pe('VIP დეპოზიტები და დავალებების ჯილდოები ცალკე ანგარიშებზე აღირიცხება.','VIP deposits and task rewards are recorded in separate accounts.')}</span></div>`;
}
function selectedMarkets() {
  let coins=pro.markets.filter(coin=>(pro.category==='all'||pro.category==='favorites'&&pro.favorites.includes(coin.symbol)||coin.category===pro.category)&&(!pro.marketQuery||`${coin.name} ${coin.base}`.toLowerCase().includes(pro.marketQuery.toLowerCase())));
  if (pro.marketSort==='gainers') coins.sort((a,b)=>b.change-a.change);
  if (pro.marketSort==='volume') coins.sort((a,b)=>b.volume-a.volume);
  if (pro.marketSort==='price') coins.sort((a,b)=>b.price-a.price);
  return coins;
}
function renderMarketRows() {
  if (!pro.markets.length) return pro.status==='loading'?`<div class="market-loading">${pe('ცოცხალი ფასები იტვირთება…','Connecting to live prices…')}</div>`:marketError();
  const coins=selectedMarkets();
  if (!coins.length) return `<div class="spot-empty">${icon('search')}<h3>${pe('აქტივი ვერ მოიძებნა','No matching assets')}</h3><p>${pe('სცადე სხვა სახელი ან სიმბოლო.','Try another name or ticker.')}</p></div>`;
  return `<table class="markets-table"><thead><tr><th class="watch-star"></th><th>${pe('აქტივი','Asset')}</th><th>${pe('ფასი','Price')} <span>USDT</span></th><th>24h ${pe('ცვლილება','Change')}</th><th class="market-range">24h ${pe('დიაპაზონი','Range')}</th><th class="market-volume">24h ${pe('მოცულობა','Volume')}</th><th></th></tr></thead><tbody>${coins.map(coin=>`<tr><td class="watch-star"><button data-pro-action="favorite" data-symbol="${coin.symbol}" class="favorite-button ${pro.favorites.includes(coin.symbol)?'active':''}" aria-label="${pe('რჩეულებში დამატება ან ამოშლა','Toggle watchlist')} ${escapeHtml(coin.base)}" aria-pressed="${pro.favorites.includes(coin.symbol)}">${icon('star')}</button></td><td><button class="coin-cell market-coin" data-pro-action="trade" data-symbol="${coin.symbol}">${coinIcon(coin)}<span><strong>${escapeHtml(coin.base)}</strong><small>${escapeHtml(coin.name)}</small></span></button></td><td class="market-price">${marketPrice(coin)}</td><td>${marketChange(coin)}</td><td class="market-range"><div class="range-meter"><span style="--range:${Math.max(0,Math.min(100,(coin.price-coin.low)/(coin.high-coin.low||1)*100))}%"></span></div><small>${price(coin.low)} — ${price(coin.high)}</small></td><td class="market-volume">${compactNumber(coin.volume)}</td><td><button class="market-trade-button" data-pro-action="trade" data-symbol="${coin.symbol}" ${freshCoin(coin)?'':'disabled'}>${pe('ვაჭრობა','Trade')}${icon('arrow')}</button></td></tr>`).join('')}</tbody></table>`;
}
function compactNumber(value) { return new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(value); }
function renderMarketsPage() {
  const coins=pro.markets;
  const categories=['all','favorites','Layer 1','DeFi','Layer 2','Meme','AI & compute','Gaming'];
  return `<div class="page markets-page pro-page">${proHeading(pe('კრიპტობაზარი','Crypto markets'),pe('რეალური ფასები. ფასზე მიბმული შიდა აქტივები.','Live prices. Price-linked internal assets.'),liveBadge())}<div class="market-summary">${['BTC','ETH','SOL'].map(base=>{const coin=coins.find(item=>item.base===base);return `<button data-pro-action="${coin?'trade':'refresh-markets'}" ${coin?`data-symbol="${coin.symbol}"`:''}>${coinIcon(coin||{base,color:'#5a6679'})}<span><strong>${base} <small>/ USDT</small></strong><span>${coin?marketPrice(coin):'—'}</span></span>${coin?marketChange(coin):'<span class="skeleton-price"></span>'}</button>`;}).join('')}<div class="market-summary-status"><span>${icon('globe')} Spot</span><strong>${coins.length||'—'} <small>${pe('ბაზარი','markets')}</small></strong><span>${pe('Spot · USDT წყვილები','Spot · USDT pairs')}</span></div></div><div class="markets-toolbar"><div class="pro-tabs market-categories">${categories.map(category=>`<button data-pro-action="market-category" data-category="${category}" class="${pro.category===category?'active':''}">${category==='all'?pe('ყველა','All'):category==='favorites'?`${icon('star')}${pe('რჩეული','Watchlist')}`:escapeHtml(category)}</button>`).join('')}</div><div class="market-controls"><label class="pro-search">${icon('search')}<input id="market-search" type="search" placeholder="${pe('მოძებნე კრიპტო','Search crypto')}" value="${escapeHtml(pro.marketQuery)}" aria-label="${pe('კრიპტოს ძებნა','Search crypto')}"></label><select id="market-sort" class="sort-select" aria-label="${pe('სორტირება','Sort markets')}">${[['default',pcopy('პოპულარული','Popular')],['gainers',pcopy('ზრდა 24h','24h gainers')],['volume',pcopy('მოცულობა','Volume')],['price',pcopy('ფასი','Price')]].map(([value,label])=>`<option value="${value}" ${value===pro.marketSort?'selected':''}>${label}</option>`).join('')}</select></div></div><div id="market-results" class="pro-table-wrap">${renderMarketRows()}</div><div class="market-source"><span>${icon('globe')}${pe('Spot · ცოცხალი საბაზრო მონაცემები','Spot · live market data')}</span><span data-live-time>${pro.updatedAt?new Date(pro.updatedAt).toLocaleTimeString(locale()):'—'}</span></div></div>`;
}

function renderTradeDialog() {
  const coin=pro.markets.find(item=>item.symbol===pro.trade);if(!coin)return '';
  return `<div class="pro-trade-backdrop" data-pro-action="trade-backdrop"><section class="dialog trade-dialog" role="dialog" aria-modal="true" aria-labelledby="trade-title"><div class="trade-head"><div class="coin-cell">${coinIcon(coin)}<span><h2 id="trade-title">${escapeHtml(coin.base)} <small>/ USDT</small></h2><span>${escapeHtml(coin.name)}</span></span></div><button class="dialog-close" data-pro-action="close-trade" aria-label="${escapeHtml(t('close'))}">${icon('close')}</button></div><div class="trade-market-overview"><div><strong>${marketPrice(coin)}</strong>${marketChange(coin)}</div>${liveBadge()}</div><div class="trade-ranges">${['1H','1D','1W','1M'].map(range=>`<button data-pro-action="trade-range" data-range="${range}" class="${range===pro.tradeRange?'active':''}">${range}</button>`).join('')}<span>Spot · USDT</span></div><div class="trade-chart-container"><canvas id="trade-price-chart" role="img" aria-label="${escapeHtml(coin.name)} ${pe('ფასის ისტორია','price history')}"></canvas><span id="trade-chart-status">${pro.history?'':pe('ისტორია იტვირთება…','Loading price history…')}</span></div><div class="trade-stats"><span>24h ${pe('მაქს.','High')}<strong data-live-high="${coin.symbol}">${price(coin.high)}</strong></span><span>24h ${pe('მინ.','Low')}<strong data-live-low="${coin.symbol}">${price(coin.low)}</strong></span><span>24h ${pe('მოცულობა','Volume')}<strong>${compactNumber(coin.volume)}</strong></span></div><div class="trade-connect-notice"><span>${icon('shield')}</span><h3>${pe('რეალური Spot ვაჭრობა','Real Spot trading')}</h3><p>${pe('შეკვეთის შესასრულებლად საჭიროა ბირჟის დაცული კავშირი და ცალკე დაფინანსებული Spot ანგარიში. ამ ეტაპზე შეგიძლია რეალურ ფასებსა და ისტორიას გაეცნო.','Execution requires a secure exchange connection and a separately funded Spot account. You can explore live prices and price history now.')}</p></div></section></div>`;
}
function drawAssetChart() {
  const canvas=document.querySelector('#asset-earnings-chart');if(!canvas)return;
  const days=weekEarnings();
  pro.assetChart=new Chart(canvas,{type:'line',data:{labels:days.map(day=>day.date.toLocaleDateString(locale(),{weekday:'short'})),datasets:[{data:days.map(day=>day.amount),borderColor:'#f0b90b',backgroundColor:'#f0b90b12',fill:true,borderWidth:2,pointRadius:0,tension:.3}]},options:{maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:item=>formatUsdt(item.raw)}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#6c7686',font:{size:9}}},y:{beginAtZero:true,suggestedMax:Math.max(1,...days.map(day=>day.amount))*1.1,display:false}}}});
}
function drawTradeChart() {
  const canvas=document.querySelector('#trade-price-chart');if(!canvas||!pro.history)return;
  pro.tradeChart?.destroy();const points=pro.history.points;
  pro.tradeChart=new Chart(canvas,{type:'line',data:{labels:points.map(point=>new Date(point.time).toLocaleString(locale(),pro.tradeRange==='1D'||pro.tradeRange==='1H'?{hour:'2-digit',minute:'2-digit'}:{month:'short',day:'numeric'})),datasets:[{data:points.map(point=>point.price),borderColor:'#f0b90b',backgroundColor:'#f0b90b0d',fill:true,pointRadius:0,pointHitRadius:10,borderWidth:2,tension:.15}]},options:{animation:false,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{label:item=>price(item.raw)+' USDT'}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#687384',maxTicksLimit:4,font:{size:9}}},y:{position:'right',border:{display:false},grid:{color:'#262c35'},ticks:{color:'#848e9c',maxTicksLimit:4,font:{size:9},callback:value=>price(value)}}}}});
}
async function loadTradeHistory() {
  const request=++pro.historyRequest,symbol=pro.trade,range=pro.tradeRange;
  try {const history=await api('/api/markets/history?'+new URLSearchParams({symbol,range}),{timeout:16000});if(request!==pro.historyRequest||symbol!==pro.trade)return;pro.history=history;document.querySelector('#trade-chart-status')?.replaceChildren();drawTradeChart();}
  catch {if(request===pro.historyRequest){const label=document.querySelector('#trade-chart-status');if(label)label.textContent=pcopy('ისტორია დროებით მიუწვდომელია','Price history temporarily unavailable');}}
}
function renderTradeLayer() {
  pro.tradeChart?.destroy();document.querySelector('.pro-trade-backdrop')?.remove();
  document.querySelector('.app-shell')?.toggleAttribute('inert',Boolean(pro.trade));
  if(pro.trade){app.insertAdjacentHTML('beforeend',renderTradeDialog());drawTradeChart();}
}
function closeTrade() {pro.trade=null;pro.quote=null;pro.history=null;pro.historyRequest++;renderTradeLayer();document.querySelector('[data-pro-action="trade"]')?.focus();}
async function loadPortfolio() {
  if(!state.user)return;const owner=state.user.id;
  try {const data=await api('/api/spot/portfolio');if(state.user?.id===owner){pro.portfolio=data;pro.portfolioOwner=owner;}}
  catch { /* An unavailable exchange cannot change existing account balances. */ }
}
function renderChat() {
  document.querySelector('.assistant-widget')?.remove();
  app.insertAdjacentHTML('beforeend',`<div class="assistant-widget">${pro.chatOpen?`<section class="assistant-panel" role="region" aria-label="TaskMall Assistant"><header><span class="assistant-mark">${icon('spark')}</span><div><strong>TaskMall Assistant</strong><span>${pe('ავტომატური დახმარება','Automated help')}</span></div><button class="icon-button" data-pro-action="close-chat" aria-label="${escapeHtml(t('close'))}">${icon('close')}</button></header><div class="assistant-messages" aria-live="polite"><div class="assistant-intro"><span>${icon('spark')}</span><h3>${pe('რით დაგეხმარო?','How can I help?')}</h3><p>${pe('Earn, ანგარიშები, რეფერალები და ცოცხალი ფასები — მომწერე შენი კითხვა.','Earn, accounts, referrals and live prices. Ask a question to get started.')}</p></div>${pro.messages.map(message=>`<div class="assistant-message ${message.role}">${escapeHtml(message.text)}${message.links?`<div>${message.links.map(link=>`<button data-pro-action="chat-navigate" data-view="${escapeHtml(link.view)}">${escapeHtml(link.label)}${icon('arrow')}</button>`).join('')}</div>`:''}</div>`).join('')}${pro.chatBusy?`<div class="assistant-message bot assistant-typing">•••</div>`:''}</div>${pro.messages.length?'':`<div class="assistant-suggestions">${[pcopy('როგორ შევავსო ანგარიში?','How do I deposit?'),pcopy('როგორ მუშაობს Earn?','How does Earn work?'),pcopy('რა ღირს BTC?','What is the BTC price?')].map(text=>`<button data-pro-action="chat-suggestion" data-message="${escapeHtml(text)}">${escapeHtml(text)}${icon('chevron')}</button>`).join('')}</div>`}<form id="assistant-form"><input id="assistant-input" autocomplete="off" maxlength="600" placeholder="${pe('დაწერე შენი კითხვა…','Ask a question…')}" aria-label="${pe('შეკითხვა ასისტენტს','Message to assistant')}" value="${escapeHtml(pro.chatInput)}" required><button class="primary-button" aria-label="${pe('გაგზავნა','Send')}" ${pro.chatBusy?'disabled':''}>${icon('arrow')}</button></form><footer>${pe('არ გააგზავნო პაროლები ან პირადი გასაღებები.','Never share passwords or private keys.')}</footer></section>`:''}<button class="assistant-launcher ${pro.chatOpen?'is-open':''}" data-pro-action="${pro.chatOpen?'close-chat':'open-chat'}" aria-label="${pe('TaskMall ასისტენტი','TaskMall assistant')}" aria-expanded="${pro.chatOpen}">${icon(pro.chatOpen?'close':'help')}<span>${pe('დახმარება','Support')}</span></button></div>`);
  const messages=document.querySelector('.assistant-messages');if(messages)messages.scrollTop=messages.scrollHeight;
}
async function sendChat(message) {
  if(pro.chatBusy||!message.trim())return;pro.messages.push({role:'user',text:message.slice(0,600)});pro.chatInput='';pro.chatBusy=true;renderChat();
  try {const result=await api('/api/assistant/message',{method:'POST',body:{message:message.slice(0,600),lang:state.lang},timeout:15000});pro.messages.push({role:'bot',text:result.text,links:result.links});}
  catch {pro.messages.push({role:'bot',text:pcopy('პასუხის მიღება ვერ მოხერხდა. სცადე ხელახლა ან ეწვიე დახმარების ცენტრს.','The assistant could not respond. Please try again or visit the support center.')});}
  finally {pro.chatBusy=false;pro.messages=pro.messages.slice(-24);renderChat();document.querySelector('#assistant-input')?.focus();}
}
const oldShell=renderShell,oldAuth=renderAuth,oldPublic=renderPublicPage;
renderShell=function(){pro.assetChart?.destroy();pro.tradeChart?.destroy();oldShell();drawAssetChart();renderChat();if(pro.trade)renderTradeLayer();if(state.user&&pro.portfolioOwner!==state.user.id){pro.portfolioOwner=state.user.id;pro.portfolio=null;loadPortfolio().then(()=>{if(state.view==='home'&&pro.assetTab==='spot'&&!pro.trade)render();else refreshMarketCells();});}};
renderAuth=function(){oldAuth();renderChat();};
renderPublicPage=function(){oldPublic();renderChat();};
function refreshMarketCells() {
  const map=new Map(pro.markets.map(coin=>[coin.symbol,coin]));
  for(const element of document.querySelectorAll('[data-live-price]')){const coin=map.get(element.dataset.livePrice);if(coin)element.textContent=price(coin.price);}
  for(const element of document.querySelectorAll('[data-live-change]')){const coin=map.get(element.dataset.liveChange);if(coin){element.textContent=changeView(coin.change);element.classList.toggle('up',coin.change>=0);element.classList.toggle('down',coin.change<0);}}
  for(const element of document.querySelectorAll('[data-live-status]')){element.outerHTML=liveBadge();}
  for(const element of document.querySelectorAll('[data-live-time]'))element.textContent=pro.updatedAt?new Date(pro.updatedAt).toLocaleTimeString(locale()):'—';
}
function acceptMarkets(data) {
  const wasEmpty=!pro.markets.length;
  pro.markets=Array.isArray(data.markets)?data.markets:[];pro.status=data.status;pro.updatedAt=data.updatedAt;
  if(wasEmpty&&pro.markets.length&&state.user&&['home','markets'].includes(state.view)&&!pro.trade){render();}else refreshMarketCells();
}
async function refreshMarkets() {try {acceptMarkets(await api('/api/markets',{timeout:20000}));}catch {pro.status='unavailable';refreshMarketCells();}}
function startFeed() {
  if(pro.feed||document.hidden)return;pro.feed=new EventSource('/api/markets/stream');
  pro.feed.onmessage=event=>{try{acceptMarkets(JSON.parse(event.data));}catch{}};
  pro.feed.onerror=()=>{pro.status='stale';refreshMarketCells();};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pro.feed?.close();pro.feed=null;}else{startFeed();refreshMarkets();}});
app.addEventListener('input',event=>{
  if(event.target.id==='market-search'){pro.marketQuery=event.target.value;document.querySelector('#market-results').innerHTML=renderMarketRows();}
  if(event.target.id==='pro-task-search'){state.search=event.target.value;const pos=event.target.selectionStart;render();const input=document.querySelector('#pro-task-search');input?.focus();if(input?.type!=='search')input?.setSelectionRange(pos,pos);}
  if(event.target.id==='assistant-input')pro.chatInput=event.target.value;
});
app.addEventListener('change',event=>{
  if(event.target.id==='market-sort'){pro.marketSort=event.target.value;document.querySelector('#market-results').innerHTML=renderMarketRows();}
  if(event.target.name==='mission-answer'){pro.missionAnswer=Number(event.target.value);document.querySelector('[data-pro-action="mission-review"]').disabled=false;}
});
app.addEventListener('submit',async event=>{
  if(event.target.id==='assistant-form'){event.preventDefault();sendChat(new FormData(event.target).get('message')||document.querySelector('#assistant-input').value);}
});
app.addEventListener('click',async event=>{
  const original=event.target.closest('[data-action]');
  if(original?.dataset.action==='open-task'){pro.missionPhase=0;pro.missionAnswer=null;render();}
  if(original?.dataset.action==='logout'){pro.portfolio=null;pro.portfolioOwner=null;pro.messages=[];pro.trade=null;}
  const target=event.target.closest('[data-pro-action]');if(!target)return;
  const action=target.dataset.proAction;
  if(action==='toggle-balances'){pro.hide=!pro.hide;render();}
  if(action==='asset-tab'){pro.assetTab=target.dataset.tab;state.view='home';history.replaceState(null,'','#home');render();}
  if(action==='favorite'){const symbol=target.dataset.symbol;pro.favorites=pro.favorites.includes(symbol)?pro.favorites.filter(item=>item!==symbol):[...pro.favorites,symbol];localStorage.setItem('taskmall_watchlist',JSON.stringify(pro.favorites));document.querySelector('#market-results').innerHTML=renderMarketRows();}
  if(action==='market-category'){pro.category=target.dataset.category;render();}
  if(action==='refresh-markets'){target.disabled=true;await refreshMarkets();if(state.view==='markets')render();}
  if(action==='trade'){pro.trade=target.dataset.symbol;pro.quote=null;pro.tradeSide='BUY';pro.history=null;pro.tradeRange='1D';await loadPortfolio();renderTradeLayer();document.querySelector('.trade-dialog .dialog-close')?.focus();loadTradeHistory();}
  if(action==='close-trade'||action==='trade-backdrop'&&event.target===target)closeTrade();
  if(action==='trade-range'){pro.tradeRange=target.dataset.range;pro.history=null;renderTradeLayer();loadTradeHistory();}
  if(action==='mission-next'){pro.missionPhase=1;render();}
  if(action==='mission-review'){pro.missionPhase=2;render();}
  if(action==='select-tier'){pro.selectedPlan=target.dataset.plan;render();document.querySelector('.tier-navigation .selected')?.scrollIntoView({block:'nearest',inline:'nearest'});}
  if(action==='open-chat'){pro.chatOpen=true;renderChat();document.querySelector('#assistant-input')?.focus();}
  if(action==='close-chat'){pro.chatOpen=false;renderChat();}
  if(action==='chat-suggestion')sendChat(target.dataset.message);
  if(action==='chat-navigate'){pro.chatOpen=false;if(state.user){state.view=target.dataset.view;history.pushState(null,'','#'+state.view);render();}else{state.publicView='support';render();}}
});

document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(pro.trade){event.preventDefault();closeTrade();}else if(pro.chatOpen){pro.chatOpen=false;renderChat();}}});
setInterval(()=>{if(pro.updatedAt&&Date.now()-pro.updatedAt>30_000&&pro.status==='live'){pro.status='stale';refreshMarketCells();}},1000);
Object.assign(en,{navHome:'Assets',overview:'Assets overview',markets:'Markets',navTasks:'Task center',vipTitle:'Membership',company:'About TaskMall'});
Object.assign(copy.ka,{navHome:'აქტივები',overview:'აქტივების მიმოხილვა',markets:'ბაზარი',navTasks:'დავალებები',vipTitle:'წევრობა',company:'TaskMall-ის შესახებ'});

startFeed();

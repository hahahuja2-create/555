'use strict';

const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const CATALOG = [
  ['BTC','Bitcoin','Store of value','#f7931a'], ['ETH','Ethereum','Layer 1','#627eea'], ['BNB','BNB','Layer 1','#f0b90b'],
  ['SOL','Solana','Layer 1','#9945ff'], ['XRP','XRP','Payments','#586779'], ['DOGE','Dogecoin','Meme','#c2a633'],
  ['ADA','Cardano','Layer 1','#2576dc'], ['TRX','TRON','Layer 1','#ef3340'], ['LINK','Chainlink','Oracle','#2a5ada'],
  ['AVAX','Avalanche','Layer 1','#e84142'], ['SUI','Sui','Layer 1','#4da2ff'], ['TON','Toncoin','Layer 1','#0098ea'],
  ['DOT','Polkadot','Layer 1','#e6007a'], ['LTC','Litecoin','Payments','#345d9d'], ['BCH','Bitcoin Cash','Payments','#0ac18e'],
  ['UNI','Uniswap','DeFi','#ff007a'], ['NEAR','NEAR Protocol','Layer 1','#42d7a0'], ['APT','Aptos','Layer 1','#39d5b6'],
  ['AAVE','Aave','DeFi','#a36fcc'], ['ICP','Internet Computer','Layer 1','#e770a3'], ['ETC','Ethereum Classic','Layer 1','#3ab83a'],
  ['FIL','Filecoin','Storage','#0090ff'], ['ATOM','Cosmos','Layer 1','#6d6fa6'], ['ARB','Arbitrum','Layer 2','#28a0f0'],
  ['OP','Optimism','Layer 2','#ff0420'], ['POL','POL','Layer 2','#8247e5'], ['INJ','Injective','DeFi','#0082fa'],
  ['RENDER','Render','AI & compute','#d64c4c'], ['FET','Artificial Superintelligence','AI & compute','#6c64e4'],
  ['TAO','Bittensor','AI & compute','#9da6b5'], ['PEPE','Pepe','Meme','#5c9c34'], ['SHIB','Shiba Inu','Meme','#ef8423'],
  ['WIF','dogwifhat','Meme','#b68667'], ['BONK','Bonk','Meme','#f3a01b'], ['SEI','Sei','Layer 1','#9d263b'],
  ['TIA','Celestia','Infrastructure','#7b2bf9'], ['JUP','Jupiter','DeFi','#50c9a5'], ['PYTH','Pyth Network','Oracle','#806ec4'],
  ['GRT','The Graph','Infrastructure','#6747ed'], ['ALGO','Algorand','Layer 1','#3d9c92'], ['XLM','Stellar','Payments','#737b8a'],
  ['HBAR','Hedera','Layer 1','#5b6371'], ['VET','VeChain','Infrastructure','#15bdff'], ['QNT','Quant','Infrastructure','#697789'],
  ['EGLD','MultiversX','Layer 1','#24e1ba'], ['THETA','Theta Network','Infrastructure','#2ab8a1'], ['RUNE','THORChain','DeFi','#36caa2'],
  ['IMX','Immutable','Gaming','#6c9bf4'], ['SAND','The Sandbox','Gaming','#00adef'], ['MANA','Decentraland','Gaming','#f15b78'],
  ['AXS','Axie Infinity','Gaming','#1f8bd8'], ['GALA','Gala','Gaming','#818896'], ['FLOW','Flow','Layer 1','#00d68f'],
  ['ENS','Ethereum Name Service','Infrastructure','#5298ff'], ['CRV','Curve DAO','DeFi','#ee6464'], ['LDO','Lido DAO','DeFi','#00a3ff'],
  ['PENDLE','Pendle','DeFi','#57ab95'], ['WLD','Worldcoin','Infrastructure','#778493'], ['AR','Arweave','Storage','#9aa5b2'],
  ['STX','Stacks','Layer 2','#ab55e8'], ['S','Sonic','Layer 1','#5e70ef'], ['ENA','Ethena','DeFi','#8993a3'],
  ['W','Wormhole','Infrastructure','#a9b0bc'], ['JTO','Jito','DeFi','#6caf9c'], ['ZRO','LayerZero','Infrastructure','#8c98ab'],
  ['ZK','ZKsync','Layer 2','#556ce8'], ['STRK','Starknet','Layer 2','#8e83bf'], ['APE','ApeCoin','Gaming','#3a65e6'],
  ['COMP','Compound','DeFi','#00c799'], ['SNX','Synthetix','DeFi','#00d1ff'], ['CHZ','Chiliz','Gaming','#e84961'],
  ['DEXE','DeXe','DeFi','#6385f6'], ['CAKE','PancakeSwap','DeFi','#2ac6d8'], ['FLOKI','Floki','Meme','#d6a62c'],
  ['XTZ','Tezos','Layer 1','#4083da'], ['IOTA','IOTA','Infrastructure','#7e9aaf'], ['KAVA','Kava','DeFi','#ed4b67'],
  ['DASH','Dash','Payments','#008de4'], ['ZEC','Zcash','Payments','#ecb244'], ['NEO','Neo','Layer 1','#00c399']
];
const byBase = new Map(CATALOG.map(([base,name,category,color]) => [base,{base,name,category,color}]));
const REST = 'https://data-api.binance.vision';
const fail = (message, status = 503) => Object.assign(new Error(message), { status });

class BinanceMarkets extends EventEmitter {
  constructor({ fetcher = fetch, websocket = globalThis.WebSocket } = {}) {
    super(); this.fetcher = fetcher; this.WebSocket = websocket; this.coins = []; this.updatedAt = 0;
    this.refreshing = null; this.lastRest = 0; this.socket = null; this.stopped = false; this.histories = new Map();
    this.clients = new Set();
  }
  async request(pathname) {
    const response = await this.fetcher(REST + pathname, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw fail('MARKET_DATA_UNAVAILABLE');
    return response.json();
  }
  snapshot() {
    const fresh = this.coins.length > 0 && Date.now() - this.updatedAt < 30_000;
    return { source: 'Binance', quoteAsset: 'USDT', status: fresh ? 'live' : this.coins.length ? 'stale' : 'unavailable',
      updatedAt: this.updatedAt || null, markets: this.coins };
  }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      if (!this.symbols) {
        const info = await this.request('/api/v3/exchangeInfo?permissions=SPOT');
        const tradable = new Map(info.symbols.filter(item => item.status === 'TRADING' && item.quoteAsset === 'USDT'
          && item.isSpotTradingAllowed).map(item => [item.baseAsset,item]));
        this.symbols = CATALOG.map(([base]) => tradable.get(base)).filter(Boolean).slice(0,64);
        if (this.symbols.length < 50) {
          for (const item of tradable.values()) {
            if (!this.symbols.some(existing => existing.symbol === item.symbol) && !/(UP|DOWN|BULL|BEAR)$/.test(item.baseAsset)) this.symbols.push(item);
            if (this.symbols.length >= 64) break;
          }
        }
      }
      const params = new URLSearchParams({ symbols: JSON.stringify(this.symbols.map(item => item.symbol)) });
      const tickers = await this.request('/api/v3/ticker/24hr?' + params);
      const ticks = new Map(tickers.map(item => [item.symbol,item]));
      const now = Date.now();
      this.coins = this.symbols.map(item => {
        const tick = ticks.get(item.symbol);
        if (!tick || !(Number(tick.lastPrice) > 0) || !Number.isFinite(Number(tick.priceChangePercent))
          || now - Number(tick.closeTime) > 60_000 || Number(tick.closeTime) > now + 60_000) return null;
        return { ...(byBase.get(item.baseAsset) || { base:item.baseAsset,name:item.baseAsset,category:'Other',color:'#7f8fb0' }),
          symbol:item.symbol, price:Number(tick.lastPrice), change:Number(tick.priceChangePercent),
          high:Number(tick.highPrice), low:Number(tick.lowPrice), volume:Number(tick.quoteVolume), updatedAt:Number(tick.closeTime) };
      }).filter(Boolean);
      if (!this.coins.length) throw fail('MARKET_DATA_UNAVAILABLE');
      this.updatedAt = now; this.lastRest = now; this.emit('update',this.snapshot()); this.connect();
      return this.snapshot();
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async get() {
    if (Date.now() - this.updatedAt < 5_000 && this.coins.length) return this.snapshot();
    try { return await this.refresh(); } catch { return this.snapshot(); }
  }
  connect() {
    if (this.stopped || this.socket || !this.WebSocket || !this.coins.length) return;
    const streams = this.coins.map(coin => coin.symbol.toLowerCase() + '@ticker').join('/');
    const socket = this.socket = new this.WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams);
    socket.addEventListener('message', event => {
      try {
        const tick = JSON.parse(event.data).data;
        const coin = this.coins.find(item => item.symbol === tick.s);
        const price = Number(tick.c), time = Number(tick.E);
        if (!coin || !Number.isFinite(price) || price <= 0 || !Number.isFinite(Number(tick.P))
          || !Number.isFinite(time) || time < coin.updatedAt || Math.abs(Date.now() - time) > 60_000) return;
        Object.assign(coin,{ price,change:Number(tick.P),high:Number(tick.h),low:Number(tick.l),volume:Number(tick.q),updatedAt:time });
        this.updatedAt = Date.now();
        if (!this.emitTimer) this.emitTimer = setTimeout(() => { this.emitTimer = null; this.emit('update',this.snapshot()); }, 500).unref();
      } catch { /* Malformed upstream events never replace a valid quote. */ }
    });
    socket.addEventListener('error', () => socket.close());
    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = null;
      if (!this.stopped) this.reconnect = setTimeout(() => this.connect(),5_000).unref();
    });
  }
  async history(symbol, range = '1D') {
    await this.get();
    if (!this.coins.some(coin => coin.symbol === symbol)) throw fail('INVALID_SYMBOL',400);
    const ranges = { '1H':['1m',60], '1D':['15m',96], '1W':['2h',84], '1M':['8h',90] };
    if (!ranges[range]) throw fail('INVALID_RANGE',400);
    const key = symbol + range, cached = this.histories.get(key);
    if (cached && Date.now() - cached.at < 30_000) return cached.data;
    const [interval,limit] = ranges[range];
    const rows = await this.request('/api/v3/klines?' + new URLSearchParams({symbol,interval,limit}));
    const data = { symbol,range,source:'Binance',points:rows.map(row => ({time:Number(row[0]),price:Number(row[4])})).filter(row => Number.isFinite(row.price) && row.price > 0) };
    if (!data.points.length) throw fail('MARKET_DATA_UNAVAILABLE');
    this.histories.set(key,{at:Date.now(),data});
    if (this.histories.size > 100) this.histories.delete(this.histories.keys().next().value);
    return data;
  }
  stream(req,res) {
    this.clients.add(res);
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const send = data => { if (!res.destroyed) res.write('data: ' + JSON.stringify(data) + '\n\n'); };
    send(this.snapshot()); this.on('update',send);
    const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); this.get().then(send); },15_000).unref();
    this.get().then(send);
    res.on('close',() => { this.clients.delete(res); this.off('update',send); clearInterval(heartbeat); });
  }
  stop() { this.stopped = true; clearTimeout(this.reconnect); clearTimeout(this.emitTimer); this.socket?.close(); for(const client of this.clients)client.end(); }
}

// Server-only adapter. Credentials never enter public assets or browser responses.
// Price delivery and optional read-only credential diagnostics. Platform trades do not send exchange orders.
class BinanceExecution {
  constructor({ apiKey, secret, fetcher = fetch } = {}) {
    if (!apiKey || !secret) ({apiKey,secret}=require('./credentials').binanceCredentials());
    this.apiKey = apiKey; this.secret = secret; this.fetcher = fetcher;
  }
  configured() { return Boolean(this.apiKey && this.secret); }
  async accountStatus() {
    if(!this.configured())return{configured:false,connected:false};
    try{
      const timeResponse=await this.fetcher('https://api.binance.com/api/v3/time',{signal:AbortSignal.timeout(10000)});
      if(!timeResponse.ok)return{configured:true,connected:false,status:timeResponse.status};
      const time=await timeResponse.json();const params=new URLSearchParams({timestamp:String(time.serverTime),recvWindow:'5000'});
      params.set('signature',crypto.createHmac('sha256',this.secret).update(params.toString()).digest('hex'));
      const response=await this.fetcher('https://api.binance.com/api/v3/account?'+params,{headers:{'X-MBX-APIKEY':this.apiKey},signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      return response.ok?{configured:true,connected:true,canTrade:data.canTrade===true}:{configured:true,connected:false,status:response.status,code:data.code};
    }catch{return{configured:true,connected:false,status:'connection-unavailable'};}
  }
}
module.exports = { BinanceMarkets, BinanceExecution, CATALOG };

'use strict';
const crypto=require('node:crypto');
const {units,amount}=require('../payments/tron');
const SCALE=10n**18n,USDT=10n**12n;
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
function decimal(value){
  if(!/^\d+(\.\d{1,18})?$/.test(String(value)))throw fail('INVALID_AMOUNT',400);
  const [whole,fraction='']=String(value).split('.');return BigInt(whole)*SCALE+BigInt(fraction.padEnd(18,'0'));
}
function formatted(value){const n=BigInt(value);return((n/SCALE)+'.'+(n%SCALE).toString().padStart(18,'0').replace(/0+$/,'')).replace(/\.$/,'');}
function holding(user,base){return BigInt(user.spotHoldings?.[base]?.quantityUnits||'0');}
function initialize(state){
  if(state.spot?.version===1){
    const previous=state.spot;
    if(BigInt(previous.cashUnits||'0')!==0n||Object.values(previous.inventory||{}).some(value=>BigInt(value)!==0n)||(previous.funding||[]).length)throw fail('SPOT_MODEL_MIGRATION_REQUIRED',503);
    state.spot={version:2,model:'synthetic',netCashFlowUnits:'0',feeBps:previous.feeBps||0,legacyVersion:1};
  }
  state.spot||={version:2,model:'synthetic',netCashFlowUnits:'0',feeBps:0};
  const book=state.spot;
  if(book.version!==2||book.model!=='synthetic'||!/^[-]?\d+$/.test(book.netCashFlowUnits)||!Number.isInteger(book.feeBps)||book.feeBps<0||book.feeBps>100)throw fail('INVALID_SPOT_STATE',503);
  return book;
}
function publicOrder(row){const {userId,_quantity,_cash,_price,...result}=row;return result;}
function portfolio(user){return{model:'synthetic',cash:amount(units(user.withdrawBalance)),holdings:Object.entries(user.spotHoldings||{}).filter(([,row])=>BigInt(row.quantityUnits)>0n).map(([base,row])=>({base,quantity:formatted(row.quantityUnits),cost:Number(BigInt(row.costUnits))/1e6})),realizedPnl:Number(BigInt(user.spotRealizedUnits||'0'))/1e6,orders:(user.spotOrders||[]).slice(0,50).map(publicOrder)};}
// Synthetic, unleveraged positions are accounted for only by TaskMall. External markets supply prices.
// Customer USDT movements and the signed counterparty cash flow persist together; no crypto custody is claimed.
class SpotTrading{
  constructor({markets,getState,save,exclusive,enabled=()=>false}){Object.assign(this,{markets,getState,save,exclusive,enabled});this.quotes=new Map();}
  active(){return this.enabled();}
  requireActive(){if(!this.active())throw fail('SPOT_NOT_ACTIVE',503);}
  validateBalance(user,quote){
    if(quote.side==='BUY'&&units(user.withdrawBalance)<BigInt(quote._cash))throw fail('INSUFFICIENT_SPOT_BALANCE',400);
    if(quote.side==='SELL'&&holding(user,quote.base)<BigInt(quote._quantity))throw fail('INSUFFICIENT_ASSET_BALANCE',400);
  }
  async quote(userId,body){
    this.requireActive();const snapshot=await this.markets.get(),market=snapshot.markets.find(row=>row.symbol===body.symbol);
    if(!market||Date.now()-market.updatedAt>15000)throw fail('QUOTE_UNAVAILABLE',503);
    if(!['BUY','SELL'].includes(body.side))throw fail('INVALID_ORDER',400);
    const state=this.getState(),user=state.users.find(row=>row.id===userId);if(!user)throw fail('AUTH_REQUIRED',401);
    const fund=state.spot;if(fund?.model!=='synthetic')throw fail('SPOT_NOT_ACTIVE',503);
    const price=decimal(market.price.toFixed(12)),feeBps=BigInt(fund.feeBps),assetStep=10n**10n;
    if(price<=0n||feeBps<0n||feeBps>100n)throw fail('SPOT_NOT_ACTIVE',503);
    let quantity,cash,fee,gross;
    if(body.side==='BUY'){
      try{cash=units(String(body.amount));}catch{throw fail('INVALID_AMOUNT',400);}
      if(cash<1000000n||cash>10000000000n)throw fail('INVALID_AMOUNT',400);
      const feeBudget=(cash*feeBps+9999n)/10000n;
      quantity=(cash-feeBudget)*USDT*SCALE/price/assetStep*assetStep;
      gross=(quantity*price/SCALE+USDT-1n)/USDT;fee=(gross*feeBps+9999n)/10000n;cash=gross+fee;
    }else{
      quantity=decimal(body.quantity);if(quantity%assetStep)throw fail('INVALID_AMOUNT',400);
      gross=quantity*price/SCALE/USDT;fee=(gross*feeBps+9999n)/10000n;cash=gross-fee;
      if(gross<1000000n||gross>10000000000n)throw fail('INVALID_AMOUNT',400);
    }
    if(!quantity||cash<=0n)throw fail('INVALID_AMOUNT',400);
    const quote={id:crypto.randomUUID(),instrumentType:'synthetic',userId,side:body.side,symbol:market.symbol,base:market.base,price:market.price,quantity:formatted(quantity),total:amount(cash),fee:amount(fee),feeRate:Number(feeBps)/10000,
      _quantity:quantity.toString(),_cash:cash.toString(),_price:price.toString(),expiresAt:Date.now()+15000};
    this.validateBalance(user,quote);
    for(const [id,row]of this.quotes)if(row.expiresAt<Date.now())this.quotes.delete(id);
    if(this.quotes.size>=1000)throw fail('TOO_MANY_REQUESTS',429);
    this.quotes.set(quote.id,quote);return publicOrder(quote);
  }
  publicQuote(row){return publicOrder(row);}
  async execute(userId,quoteId){
    this.requireActive();
    const previous=this.getState().users.find(row=>row.id===userId)?.spotOrders?.find(row=>row.id===quoteId);
    if(previous)return{order:publicOrder(previous),portfolio:portfolio(this.getState().users.find(row=>row.id===userId)),replayed:true};
    const quote=this.quotes.get(quoteId);if(!quote||quote.userId!==userId)throw fail('QUOTE_NOT_FOUND',404);
    const market=(await this.markets.get()).markets.find(row=>row.symbol===quote.symbol);
    if(!market||Date.now()-market.updatedAt>15000)throw fail('QUOTE_UNAVAILABLE',503);
    const current=decimal(market.price.toFixed(12)),agreed=BigInt(quote._price);
    if((current>agreed?current-agreed:agreed-current)*10000n>agreed*50n)throw fail('QUOTE_PRICE_CHANGED');
    return this.exclusive(async()=>{
      const state=structuredClone(this.getState()),user=state.users.find(row=>row.id===userId);if(!user)throw fail('AUTH_REQUIRED',401);
      const replay=user.spotOrders?.find(row=>row.id===quoteId);if(replay)return{order:publicOrder(replay),portfolio:portfolio(user),replayed:true};
      if(quote.expiresAt<Date.now())throw fail('QUOTE_EXPIRED');
      this.validateBalance(user,quote);const fund=state.spot,quantity=BigInt(quote._quantity),cash=BigInt(quote._cash);
      user.spotHoldings||={};const position=user.spotHoldings[quote.base]||={quantityUnits:'0',costUnits:'0'};let realized=0n;
      if(quote.side==='BUY'){
        user.withdrawBalance=amount(units(user.withdrawBalance)-cash);fund.netCashFlowUnits=(BigInt(fund.netCashFlowUnits)+cash).toString();
        position.quantityUnits=(BigInt(position.quantityUnits)+quantity).toString();position.costUnits=(BigInt(position.costUnits)+cash).toString();
      }else{
        const cost=BigInt(position.costUnits)*quantity/BigInt(position.quantityUnits);
        user.withdrawBalance=amount(units(user.withdrawBalance)+cash);fund.netCashFlowUnits=(BigInt(fund.netCashFlowUnits)-cash).toString();
        position.quantityUnits=(BigInt(position.quantityUnits)-quantity).toString();position.costUnits=(BigInt(position.costUnits)-cost).toString();
        realized=cash-cost;user.spotRealizedUnits=(BigInt(user.spotRealizedUnits||'0')+realized).toString();
      }
      const order={...publicOrder(quote),status:'FILLED',executedAt:Date.now(),realizedPnl:Number(realized)/1e6};
      user.spotOrders||=[];user.spotOrders.unshift(order);
      user.activities.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),type:'spot',side:quote.side,symbol:quote.symbol,base:quote.base,amount:order.total,quantity:order.quantity,fee:order.fee,orderId:order.id,status:'FILLED'});
      await this.save(state);this.quotes.delete(quoteId);return{order,portfolio:portfolio(user),replayed:false};
    });
  }
}
module.exports={SpotTrading,portfolio,initialize,decimal,formatted};

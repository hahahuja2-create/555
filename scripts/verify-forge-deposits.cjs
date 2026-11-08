'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {PaymentStore}=require('../payments/store');
const {creditDeposit}=require('../markets/forge-wallet');
test('confirmed deposit threshold survives restart and duplicate chain events',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pg-forge-deposits-'));let store=new PaymentStore(dir);
  const address='TZBZHkdrwv6xrGzRR9a1WqStf3oEmtjDvw',now=Date.now();
  let state={users:[{id:'fixture',lockedBalance:0,withdrawBalance:0,reservedBalance:0,activities:[]}]};
  const apply=(next,userId,event)=>creditDeposit(next.users.find(user=>user.id===userId),event);
  try{
    store.allocate('fixture',()=>address,now);store.save(state,'test-opening');
    const first={txid:'a'.repeat(64),logIndex:0,to:address,units:'4999999',blockNumber:1,timestamp:now};
    assert.equal(store.credit(first,state,apply),true);assert.equal(state.users[0].forgeHeldDepositUnits,'4999999');assert.equal(state.users[0].withdrawBalance,0);
    assert.equal(store.credit(first,state,apply),false);
    store.close();store=new PaymentStore(dir);state=store.state();assert.equal(state.users[0].forgeHeldDepositUnits,'4999999');
    const second={...first,txid:'b'.repeat(64),units:'5000001',blockNumber:2,timestamp:now+1};
    assert.equal(store.credit(second,state,apply),true);assert.equal(state.users[0].withdrawBalance,10);assert.equal(state.users[0].forgeHeldDepositUnits,'0');
    assert.equal(store.credit(second,state,apply),false);assert.equal(state.users[0].withdrawBalance,10);assert.equal(store.deposits('fixture').length,2);
    const sum=store.sql.prepare('SELECT delta_units FROM journal').all().reduce((total,row)=>total+BigInt(row.delta_units),0n);assert.equal(sum,0n);
  }finally{store.close();assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('pg-forge-deposits-'));await fs.rm(dir,{recursive:true,force:true});}
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {CATALOG}=require('../markets/binance');
test('all supported coins have genuine locally hosted image assets',()=>{
  const folder=path.resolve(__dirname,'../public'),manifest=JSON.parse(fs.readFileSync(path.join(folder,'assets/coins/manifest.json'),'utf8'));
  for(const [base]of [...CATALOG,['USDT']]){
    const entry=manifest.assets.find(row=>row.base===base);assert.ok(entry,base+' logo metadata');
    assert.match(entry.path,/^\/assets\/coins\/[A-Z0-9]+\.(png|jpg)$/);assert.match(entry.source,/^https:\/\/(raw\.githubusercontent\.com\/trustwallet\/assets|coin-images\.coingecko\.com)\//);
    const image=fs.readFileSync(path.join(folder,entry.path)),png=image.subarray(0,8).toString('hex')==='89504e470d0a1a0a',jpg=image[0]===255&&image[1]===216;assert.ok(png||jpg,base+' image signature');assert.equal(image.length,entry.bytes);
  }
  const mark=fs.readFileSync(path.join(folder,'assets/brand/taskmall-mark.svg'),'utf8');assert.match(mark,/<svg/);assert.equal(mark,fs.readFileSync(path.join(folder,'favicon.svg'),'utf8'));
});

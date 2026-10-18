const fs=require('node:fs');const path=require('node:path');const {migrate,pool}=require('../markets/earn');const {vipPlans}=require('../platform-catalog');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'artifacts','earn-migration');
const source=JSON.parse(fs.readFileSync(path.join(folder,'source-state.private.json'),'utf8'));
const before=new Map(source.users.map(user=>[user.id,{withdraw:user.withdrawBalance,reserved:user.reservedBalance}]));
const report=migrate(source,vipPlans);pool(source,Date.now()-86400000,false);require('../markets/spot').initialize(source);
for(const user of source.users){const prior=before.get(user.id);if(user.withdrawBalance!==prior.withdraw||user.reservedBalance!==prior.reserved)throw new Error('Protected balance changed.');}
const destination=path.join(root,'artifacts','pro-design-preview-data');fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,'db.json'),JSON.stringify(source,null,2));
fs.writeFileSync(path.join(folder,'prepared-migration.private.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({prepared:report.length,principalRestored:report.reduce((sum,item)=>sum+item.principal,0),withdrawalsUnchanged:true,liveDatabaseChanged:false}));

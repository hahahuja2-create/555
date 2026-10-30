const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {vipPlans}=require('../platform-catalog');
async function main(){
  const root=path.resolve(__dirname,'..');let state,source;
  if(fs.existsSync(path.join(root,'.env.mysql'))){
    process.loadEnvFile(path.join(root,'.env.mysql'));
    const connection=await require('../database/mysql').connect(process.env);
    try{await connection.query('START TRANSACTION READ ONLY');const [rows]=await connection.query('SELECT payload FROM state WHERE id=1');if(rows[0]){state=typeof rows[0].payload==='string'?JSON.parse(rows[0].payload):rows[0].payload;source='connected-mysql-read-only';}await connection.rollback();}finally{await connection.end();}
  }
  if(!state){const database=new DatabaseSync(path.join(root,'data','payments.sqlite'),{readOnly:true});try{state=JSON.parse(database.prepare('SELECT payload FROM state WHERE id=1').get().payload);source='local-sqlite-read-only';}finally{database.close();}}
  const records=state.users.map(user=>{const plan=vipPlans.find(plan=>plan.id===user.vipId);const active=plan?.price>0&&Date.parse(user.vipExpiresAt)>Date.now();return{id:user.id,name:user.name,email:user.email,vipId:user.vipId,active,principal:active?plan.price:0,remaining:Number(user.lockedBalance||0),proposedEarning:Number(user.lockedBalance||0)+(active?plan.price:0),withdrawal:Number(user.withdrawBalance||0),reserved:Number(user.reservedBalance||0),purchases:(user.activities||[]).filter(item=>item.type==='vip').map(item=>({amount:item.amount,at:item.at,plan:item.vipName}))};});
  const output=path.join(root,'artifacts','earn-migration');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'source-state.private.json'),JSON.stringify(state));
  fs.writeFileSync(path.join(output,'migration-report.private.json'),JSON.stringify({source,at:new Date().toISOString(),records},null,2));
  console.log(JSON.stringify({source,users:records.length,activePurchased:records.filter(row=>row.active).length,totalPrincipal:records.reduce((sum,row)=>sum+row.principal,0),report:'artifacts/earn-migration/migration-report.private.json'}));
}
main().catch(err=>{console.error('Read-only account inspection failed: '+(err.code||'DATABASE_UNAVAILABLE'));process.exitCode=1;});

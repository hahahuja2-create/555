const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'artifacts');fs.mkdirSync(out,{recursive:true});
const env={...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:'4173',PUBLIC_ORIGIN:'',TASKMALL_REVIEW_ORIGIN:'https://taskmall.app',
  TASKMALL_DATA_DIR:path.join(out,'pro-design-preview-data'),TASKMALL_DESIGN_PREVIEW:'0',TASKMALL_EARN_ENABLED:'1',TASKMALL_SPOT_ENABLED:'1',
  TASKMALL_SQLITE:'',TASKMALL_TEST_WALLET:'',MYSQL_URL:'',DATABASE_URL:'',TRON_DEPOSITS_ENABLED:'0',
  TRON_AUTO_WALLET:'0',TRON_MANUAL_WITHDRAWALS_ENABLED:'0',TASKMALL_OPERATOR_ENABLED:'0',BINANCE_API_KEY:'',BINANCE_API_SECRET:''};
const child=spawn(process.execPath,['--watch','server.js'],{cwd:root,env,detached:true,windowsHide:true,
  stdio:['ignore',fs.openSync(path.join(out,'pro-preview.stdout.log'),'a'),fs.openSync(path.join(out,'pro-preview.stderr.log'),'a')]});
child.unref();fs.writeFileSync(path.join(out,'pro-preview.pid'),String(child.pid));
console.log(`Local design preview: http://localhost:4173 (PID ${child.pid})`);

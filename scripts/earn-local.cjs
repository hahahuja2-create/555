'use strict';

// Runs the actual Earn application locally with isolated synthetic accounts.
// No production database is read or copied. No transaction signer is enabled.
const path=require('node:path');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const localData=path.join(root,'artifacts','earn-local-data');
fs.mkdirSync(localData,{recursive:true});
const port=Number(process.env.PORTGAINY_LOCAL_PORT||4177);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:'',TASKMALL_DATA_DIR:localData,
  MYSQL_URL:'',DATABASE_URL:'',TASKMALL_SQLITE:'0',TASKMALL_MYSQL_TEST:'0',TASKMALL_TEST_WALLET:'1',TASKMALL_DESIGN_PREVIEW:'0',TASKMALL_LOCAL_LIVE_PROXY:'0',
  TASKMALL_MAINTENANCE_ENABLED:'0',TASKMALL_EARN_ENABLED:'1',PORTGAINY_FORGE_ENABLED:'0',TASKMALL_SPOT_ENABLED:'1',TASKMALL_OPERATOR_ENABLED:'0',
  TRON_DEPOSITS_ENABLED:'0',TRON_AUTO_WALLET:'0',TRON_AUTOMATIC_WITHDRAWALS_ENABLED:'0',TRON_AUTOMATIC_COLLECTIONS_ENABLED:'0',TRON_MANUAL_WITHDRAWALS_ENABLED:'0',TRON_COLLECTION_SEND:'0',TRON_GAS_FUNDING_ENABLED:'0',
  TASKMALL_ADMIN_EMAILS:'earn-local@example.test',BINANCE_API_KEY:'',BINANCE_API_SECRET:'',TASKMALL_REVIEW_ORIGIN:''};
for(const name of ['TRON_WORKING_WALLET_PRIVATE_KEY','TRON_AUTOMATION_DEPOSIT_MNEMONIC','TRON_LOCAL_VAULT_FILE','TASKMALL_OPERATOR_TOKEN'])delete env[name];
console.log(`Local Earn: http://127.0.0.1:${port}`);
console.log('Create a local account. Deposits in this environment are simulated; never send real crypto.');
console.log('For the local admin view, register earn-local@example.test using a password of your choice.');
const child=spawn(process.execPath,['server.js'],{cwd:root,env,windowsHide:true,stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));

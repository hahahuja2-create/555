'use strict';
const path=require('node:path');const fs=require('node:fs');const os=require('node:os');
function binanceCredentials(){
  if(process.env.BINANCE_API_KEY&&process.env.BINANCE_API_SECRET)return{apiKey:process.env.BINANCE_API_KEY,secret:process.env.BINANCE_API_SECRET};
  if(process.platform!=='win32')return{};
  const file=process.env.BINANCE_CREDENTIAL_FILE||path.join(os.homedir(),'AppData','Local','TaskMall','credentials','binance.dpapi');
  if(!fs.existsSync(file))return{};
  try{
    const value=require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      '$taskmallEncrypted=[Console]::In.ReadToEnd().Trim(); $taskmallSecure=ConvertTo-SecureString $taskmallEncrypted; $taskmallPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskmallSecure); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskmallPtr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskmallPtr) }'],
      {input:fs.readFileSync(file,'utf8'),encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','ignore'],timeout:10000});
    return JSON.parse(value);
  }catch{return{};}
}
module.exports={binanceCredentials};

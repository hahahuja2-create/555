'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const root=path.resolve(__dirname,'..');
(async()=>{
  await require('esbuild').build({entryPoints:[path.join(root,'frontend/forge-viewer.mjs')],bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'external',outfile:path.join(root,'public/forge-renderer.min.js')});
  const dir=path.join(root,'public/assets/licenses');await fs.mkdir(dir,{recursive:true});
  await fs.copyFile(path.join(root,'node_modules/three/LICENSE'),path.join(dir,'three.txt'));
  const stat=await fs.stat(path.join(root,'public/forge-renderer.min.js'));console.log(`Forge renderer built locally (${Math.round(stat.size/1024)} KiB).`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});

'use strict';
// Renders original local Three.js geometry into static loading/fallback artwork.
// No account, database or external image service is involved.
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {spawnSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),publicRoot=path.join(root,'public'),output=path.join(root,'artifacts/forge-renders');
const designs=require('../public/forge-designs.json');
const mime={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const studio='<!doctype html><html><head><link rel="stylesheet" href="/fonts/gsf/gsf.css"><link rel="stylesheet" href="/pg-ui.css"><style>body{margin:0;background:transparent}#studio{position:relative;width:760px;height:640px}.forge-canvas{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="studio"></div></body></html>';
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/__forge_studio'){res.writeHead(200,{'Content-Type':'text/html'}).end(studio);return;}const file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}});
(async()=>{
  await fs.mkdir(output,{recursive:true});await fs.mkdir(path.join(publicRoot,'assets/forge'),{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:760,height:640},deviceScaleFactor:1.5,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/__forge_studio');await page.evaluate(async()=>{await document.fonts.load('600 24px "Google Sans Flex"');await document.fonts.ready;window.studioModule=await import('/forge-renderer.min.js');window.studioModule.setForgeMotion(false);});
    const stats={},images={};
    for(const id of Object.keys(designs)){
      await page.evaluate(id=>{window.studioModule.disposeForgeModels();const host=document.querySelector('#studio');host.dataset.forgeModel=id;host.dataset.forgePower='1';host.dataset.forgeEfficiency='20';window.studioModule.mountForgeModel(host);},id);
      await page.waitForSelector('#studio[data-forge-rendered=true]');
      const capture=await page.evaluate(()=>{const viewer=document.querySelector('#studio').forgeViewer;return {image:viewer.capture(),design:viewer.designId,stats:viewer.stats};});
      if(capture.design!==id)throw Error('Unexpected fallback design: '+id);
      stats[id]=capture.stats;images[id]=capture.image;
      await fs.writeFile(path.join(output,id+'.png'),Buffer.from(capture.image.split(',')[1],'base64'));
      console.log(id,`${capture.stats.meshCount} meshes, ${capture.stats.triangleCount} triangles`);
    }
    await page.evaluate(()=>window.studioModule.disposeForgeModels());
    const python="from PIL import Image\nfrom pathlib import Path\nimport sys\nsrc=Path(sys.argv[1]);dst=Path(sys.argv[2])\nfor file in src.glob('*.png'):\n Image.open(file).save(dst/(file.stem+'.webp'),'WEBP',quality=92,method=6)";
    const converted=spawnSync('python',['-c',python,output,path.join(publicRoot,'assets/forge')],{cwd:root,windowsHide:true,encoding:'utf8'});if(converted.status!==0)throw Error(converted.stderr||'Poster conversion failed');
    await page.setViewportSize({width:1536,height:1200});
    await page.evaluate(({images,designs})=>{
      const host=document.body;host.style.background='var(--bg)';host.innerHTML=`<header style="padding:30px 38px 22px"><p style="font:600 12px var(--hud);letter-spacing:.15em;color:var(--ink-3)">PORTGAINY / GENESIS COLLECTION</p><h1 style="font:700 38px var(--font);letter-spacing:-.04em">Nine Cores. Nine original forms.</h1></header><main style="padding:0 30px 30px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${Object.entries(designs).map(([id,d],i)=>`<article style="overflow:hidden;border-radius:28px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line)"><div style="height:365px;background:var(--${d.primary}-soft);position:relative"><img src="${images[id]}" style="width:100%;height:100%;object-fit:contain"><span style="position:absolute;left:18px;top:15px;font:600 10px var(--hud);letter-spacing:.1em;color:var(--ink-3)">0${i+1} / PORTGAINY ORIGINAL</span></div><div style="padding:17px 22px 22px"><h2 style="font:700 23px var(--font);letter-spacing:-.035em">${d.name}</h2><p style="font:400 13px var(--font);color:var(--ink-3);margin-top:3px">${d.form}</p></div></article>`).join('')}</main>`;
    },{images,designs});
    await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    await page.screenshot({path:path.join(root,'artifacts/forge-collection-review.png'),fullPage:true});
    await fs.writeFile(path.join(output,'geometry.json'),JSON.stringify(stats,null,2));
    if(errors.length)throw Error(errors.join('\n'));
    console.log('Nine original models rendered. Local posters and collection review are ready.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

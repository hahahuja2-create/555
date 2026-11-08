import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createForgeHardware,FORGE_DESIGNS} from './forge-hardware.mjs';

const instances=new Set(),watchers=new Set();
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let paused=preference.matches;
function brandTokens(){const style=getComputedStyle(document.documentElement);return Object.fromEntries(['lime','violet','cyan','pink','amber','font'].map(key=>[key,style.getPropertyValue(`--${key}`).trim()||({lime:'#c6f432',violet:'#6d4dff',cyan:'#0ea5d9',pink:'#ff4f9a',amber:'#f5a300',font:'sans-serif'})[key]]));}
function softDisc(){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(128,128,12,128,128,125);gradient.addColorStop(0,'rgba(8,10,23,0.43)');gradient.addColorStop(.5,'rgba(8,10,23,0.2)');gradient.addColorStop(1,'rgba(8,10,23,0)');c.fillStyle=gradient;c.fillRect(0,0,256,256);return new THREE.CanvasTexture(canvas);}
function lightGlow(color){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d'),rgb=new THREE.Color(color).getStyle(),gradient=c.createRadialGradient(64,64,0,64,64,63);gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.13,rgb);gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);}

export function mountForgeModel(host,{kind=host.dataset.forgeModel||'spark',interactive=true}={}){
  if(host.forgeViewer)return host.forgeViewer;
  const id=Object.hasOwn(FORGE_DESIGNS,kind)?kind:'spark',compact=matchMedia('(max-width: 639px)').matches;
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{host.dataset.webgl='unavailable';return {dispose(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1.6:2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.className='forge-canvas';renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
  host.dataset.webgl='loading';host.dataset.forgeDesign=id;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,60);
  const machine=createForgeHardware(id,{tokens:brandTokens(),power:Number(host.dataset.forgePower)||1,efficiency:Number(host.dataset.forgeEfficiency)||30});
  const originalBounds=new THREE.Box3().setFromObject(machine.root),originalSize=originalBounds.getSize(new THREE.Vector3());
  const scale=Math.min(2.85/originalSize.y,3.15/Math.max(originalSize.x,originalSize.z));machine.root.scale.setScalar(scale);
  machine.root.position.y=.06-originalBounds.min.y*scale;machine.root.rotation.y=.1;scene.add(machine.root);
  const bounds=new THREE.Box3().setFromObject(machine.root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const pedestalRadius=Math.max(1.13,Math.min(1.82,Math.max(size.x,size.z)*.53));
  const pedestalMaterial=new THREE.MeshPhysicalMaterial({color:0x202336,metalness:.76,roughness:.32,clearcoat:.5});
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(pedestalRadius,pedestalRadius*1.04,.19,6),pedestalMaterial);pedestal.position.y=-.15;pedestal.receiveShadow=true;scene.add(pedestal);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(pedestalRadius*.97,pedestalRadius*.97,.025,6),new THREE.MeshStandardMaterial({color:0x30344a,metalness:.7,roughness:.38}));top.position.y=-.038;top.receiveShadow=true;scene.add(top);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(pedestalRadius*.95,.014,6,6),new THREE.MeshStandardMaterial({color:machine.color,emissive:machine.color,emissiveIntensity:1.2}));trim.rotation.x=Math.PI/2;trim.rotation.z=Math.PI/6;trim.position.y=-.021;scene.add(trim);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(pedestalRadius*3.3,pedestalRadius*3.3),new THREE.MeshBasicMaterial({map:softDisc(),transparent:true,depthWrite:false,opacity:.8}));contact.rotation.x=-Math.PI/2;contact.position.y=-.265;scene.add(contact);
  const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(renderer),environment=generator.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.9;room.dispose();generator.dispose();
  scene.add(new THREE.HemisphereLight(0xe6ebff,0x242039,1.0));
  const key=new THREE.DirectionalLight(0xfff6e9,3.25);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(compact?512:1024,compact?512:1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=5;key.shadow.camera.bottom=-3;key.shadow.normalBias=.025;key.shadow.bias=-.0003;scene.add(key);
  const rim=new THREE.DirectionalLight(0xd4c7ff,2.3);rim.position.set(4,3,-4);scene.add(rim);
  const front=new THREE.DirectionalLight(0xd8f8ff,.55);front.position.set(2,1,5);scene.add(front);
  const coreLight=new THREE.PointLight(machine.color,2.2,5);coreLight.position.set(0,center.y,1.1);scene.add(coreLight);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:lightGlow(machine.color),color:machine.color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.15}));glow.position.set(0,center.y,-.1);glow.scale.setScalar(1.25);scene.add(glow);
  const particles=[];
  for(let i=0;i<7;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(.014+(i%3)*.004,8,6),new THREE.MeshBasicMaterial({color:i%2?machine.color:machine.secondary}));scene.add(p);particles.push(p);
  }
  let disposed=false,frame=0,last=0,drag=false,previousX=0,turn=0,invalidated=true,visible=true,zoom=1;
  const target=new THREE.Vector3(0,center.y*.88,0),direction=new THREE.Vector3(4.5,2.7,7.8).normalize();
  function fit(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const fitHeight=size.y+pedestalRadius*.6,fitWidth=Math.max(pedestalRadius*2.12,size.x*.86+size.z*.55),distance=Math.max(fitHeight/(2*Math.tan(THREE.MathUtils.degToRad(17))),fitWidth/(2*Math.tan(THREE.MathUtils.degToRad(17))*camera.aspect))*1.11*zoom;camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);invalidated=true;}
  const resize=new ResizeObserver(fit);resize.observe(host);fit();
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)invalidated=true;});observer.observe(host);
  const down=e=>{if(!interactive||e.target.closest('button,a'))return;drag=true;previousX=e.clientX;host.classList.add('is-dragging');};
  const move=e=>{if(!drag)return;turn+=Math.max(-.15,Math.min(.15,(e.clientX-previousX)*.008));previousX=e.clientX;invalidated=true;};
  const up=()=>{drag=false;host.classList.remove('is-dragging');};
  host.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  function render(time,delta){
    if(!paused){for(const animate of machine.motion)animate(time,delta);coreLight.intensity=2.05+Math.sin(time*1.15)*.25;}
    machine.root.rotation.y=.1+turn+(paused?0:Math.sin(time*.22)*.035);
    for(let i=0;i<particles.length;i++){const a=i*Math.PI*2/particles.length+(paused?0:time*.13);particles[i].position.set(Math.sin(a)*(pedestalRadius*.85),.3+(i%4)*.48+(paused?0:Math.sin(time*.7+i)*.055),Math.cos(a)*pedestalRadius*.85);}
    renderer.render(scene,camera);host.dataset.webgl='ready';host.dataset.forgeRendered='true';invalidated=false;
  }
  function animate(ms){if(disposed)return;frame=requestAnimationFrame(animate);if(!visible||document.hidden||ms-last<(compact?33:24))return;if(paused&&!invalidated)return;const delta=Math.min((ms-last)/1000,.08);last=ms;render(ms/1000,delta);}
  frame=requestAnimationFrame(animate);
  let meshCount=0,triangleCount=0;machine.root.traverse(node=>{if(node.isMesh){meshCount++;triangleCount+=(node.geometry.index?node.geometry.index.count:node.geometry.attributes.position.count)/3;}});
  const api={host,designId:id,stats:Object.freeze({meshCount,triangleCount:Math.round(triangleCount),width:+size.x.toFixed(3),height:+size.y.toFixed(3),depth:+size.z.toFixed(3)}),invalidate(){invalidated=true;},reset(){turn=0;zoom=1;fit();},capture(){render(0,0);return renderer.domElement.toDataURL('image/png');},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();host.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);const gs=new Set(),ms=new Set(),textures=new Set();scene.traverse(node=>{if(node.geometry)gs.add(node.geometry);if(node.material)for(const m of [node.material].flat()){ms.add(m);for(const key of ['map','alphaMap','normalMap','roughnessMap'])if(m[key])textures.add(m[key]);}});for(const geometry of gs)geometry.dispose();for(const material of ms)material.dispose();for(const texture of textures)texture.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();delete host.forgeViewer;host.dataset.webgl='pending';delete host.dataset.forgeRendered;instances.delete(api);}};
  host.forgeViewer=api;instances.add(api);return api;
}

export function mountForgeModels(root=document,{lazy=true}={}){
  if(!root)return;
  if(!lazy){root.querySelectorAll('[data-forge-model]').forEach(host=>mountForgeModel(host));return;}
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.target.isConnected)continue;if(entry.isIntersecting)mountForgeModel(entry.target);else entry.target.forgeViewer?.dispose();}},{rootMargin:'130px'});
  root.querySelectorAll('[data-forge-model]').forEach(host=>observer.observe(host));watchers.add({observer,root});
}
export function disposeForgeModels(root){for(const watcher of [...watchers])if(!root||watcher.root===root||root.contains(watcher.root)){watcher.observer.disconnect();watchers.delete(watcher);}for(const instance of [...instances])if(!root||root.contains(instance.host))instance.dispose();}
export function setForgeMotion(enabled){paused=!enabled;for(const instance of instances)instance.invalidate();}
preference.addEventListener('change',event=>{if(event.matches)setForgeMotion(false);});

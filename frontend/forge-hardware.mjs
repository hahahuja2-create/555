import * as THREE from 'three';
import designs from '../public/forge-designs.json';

// Original Portgainy arcade hardware: nine separately constructed silhouettes.
export const FORGE_DESIGNS=Object.freeze(designs);

function bevelBox(w,h,d,r=0.09) {
  const x=-w/2,y=-h/2,s=new THREE.Shape();r=Math.min(r,w*.24,h*.24);
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const b=Math.min(.035,d*.2),g=new THREE.ExtrudeGeometry(s,{depth:d-b*2,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:3,curveSegments:7,steps:1});
  g.translate(0,0,-d/2+b);return g;
}

function toolkit(id,tokens,power,efficiency) {
  const design=FORGE_DESIGNS[id]||FORGE_DESIGNS.spark,root=new THREE.Group(),motion=[];
  const color=new THREE.Color(tokens[design.primary]),secondary=new THREE.Color(tokens[design.secondary]);
  const physical=(value,settings={})=>new THREE.MeshPhysicalMaterial({color:value,metalness:.65,roughness:.27,clearcoat:.7,clearcoatRoughness:.22,envMapIntensity:1.1,...settings});
  const materials={
    pearl:physical(0xdce1ed,{metalness:.28,roughness:.25}),
    ink:physical(0x171a2a,{metalness:.75,roughness:.28}),
    dark:physical(0x090c17,{metalness:.4,roughness:.46}),
    silver:physical(0xadb8ce,{metalness:.97,roughness:.18}),
    accent:physical(color,{metalness:.36,roughness:.3}),
    trim:physical(secondary,{metalness:.5,roughness:.28}),
    glow:new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.9,metalness:.15,roughness:.2}),
    glow2:new THREE.MeshStandardMaterial({color:secondary,emissive:secondary,emissiveIntensity:1.9,metalness:.15,roughness:.2}),
    glass:physical(color,{metalness:0,roughness:.08,transmission:.32,thickness:.4,transparent:true,opacity:.48,depthWrite:false}),
    white:new THREE.MeshBasicMaterial({color:0xf4f7ff})
  };
  function mesh(geometry,material,x=0,y=0,z=0,parent=root) {
    const item=new THREE.Mesh(geometry,typeof material==='string'?materials[material]:material);item.position.set(x,y,z);
    item.castShadow=!['glass','glow','glow2','white'].includes(material);item.receiveShadow=material!=='glass';parent.add(item);return item;
  }
  const group=(x=0,y=0,z=0,parent=root)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
  const box=(w,h,d,m,x=0,y=0,z=0,p=root)=>mesh(bevelBox(w,h,d),m,x,y,z,p);
  const cyl=(r,h,m,x=0,y=0,z=0,p=root,sides=48)=>mesh(new THREE.CylinderGeometry(r,r,h,sides),m,x,y,z,p);
  const ring=(r,t,m,x=0,y=0,z=0,p=root,segments=80)=>mesh(new THREE.TorusGeometry(r,t,10,segments),m,x,y,z,p);
  const orb=(r,m,x=0,y=0,z=0,p=root)=>mesh(new THREE.SphereGeometry(r,32,22),m,x,y,z,p);
  const crystal=(r,m,x=0,y=0,z=0,p=root,detail=0)=>mesh(new THREE.IcosahedronGeometry(r,detail),m,x,y,z,p);
  function spin(object,axis,speed){motion.push((_time,delta)=>{object.rotation[axis]+=delta*speed;});return object;}
  function hover(object,range=.05,speed=1,phase=0){const base=object.position.y;motion.push(time=>{object.position.y=base+Math.sin(time*speed+phase)*range;});return object;}
  function beam(a,b,r=.035,m='silver',parent=root) {
    const start=new THREE.Vector3(...a),finish=new THREE.Vector3(...b),delta=finish.clone().sub(start);
    const item=mesh(new THREE.CylinderGeometry(r,r,delta.length(),12),m,0,0,0,parent);item.position.copy(start.add(finish).multiplyScalar(.5));item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return item;
  }
  function pipe(points,r=.028,m='glow',parent=root){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,56,r,8,false),m,0,0,0,parent);}
  function screw(x,y,z,parent=root){const item=cyl(.034,.035,'silver',x,y,z,parent,6);item.rotation.x=Math.PI/2;return item;}
  function vents(count,x,y,z,width=.42,gap=.11,parent=root) {for(let i=0;i<count;i++)box(width,.035,.045,'dark',x,y+i*gap,z,parent);}
  function badge(label,w=.86,x=0,y=0,z=0,parent=root){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#171a2a';ctx.fillRect(0,0,512,128);ctx.fillStyle='#c6f432';
    ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6,px=53+24*Math.cos(a),py=64+24*Math.sin(a);i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();
    ctx.fillStyle='#f4f5f8';ctx.font=`600 43px ${tokens.font}`;ctx.textBaseline='middle';ctx.fillText(label.toUpperCase(),96,65,394);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    return mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshStandardMaterial({map:texture,roughness:.4,metalness:.2}),x,y,z,parent);
  }
  function fan(x,y,z,r=.28,parent=root) {
    const mount=group(x,y,z,parent),housing=cyl(r+.06,.11,'ink',0,0,0,mount);housing.rotation.x=Math.PI/2;
    ring(r,.025,'silver',0,0,.07,mount);ring(r-.035,.018,'glow',0,0,.08,mount);
    const rotor=group(0,0,.075,mount);
    for(let i=0;i<7;i++){const blade=box(r*.58,r*.16,.025,'silver',0,0,0,rotor);const a=i*Math.PI*2/7;blade.position.set(Math.cos(a)*r*.48,Math.sin(a)*r*.48,0);blade.rotation.z=a+.45;}
    const center=cyl(.075,.07,'accent',0,0,.08,mount);center.rotation.x=Math.PI/2;
    spin(rotor,'z',-5);return mount;
  }
  function gear(radius,teeth,x,y,z,parent=root){const g=group(x,y,z,parent);ring(radius,.065,'ink',0,0,0,g);ring(radius-.075,.025,'silver',0,0,.01,g);for(let i=0;i<teeth;i++){const a=i*Math.PI*2/teeth;const tooth=box(.12,.16,.12,'silver',Math.cos(a)*(radius+.03),Math.sin(a)*(radius+.03),0,g);tooth.rotation.z=a;}return g;}
  function orbit(radius,tilt,speed,parent=root,material='glow') {
    const g=group(0,0,0,parent);g.rotation.set(...tilt);ring(radius,.026,material,0,0,0,g);
    const bead=orb(.065,'white',radius,0,0,g);spin(g,'z',speed);return {group:g,bead};
  }
  function status(x,y,z,parent=root){for(let i=0;i<3;i++)box(.028,.085,.025,i<2?'glow':'glow2',x+i*.075,y,z,parent);}
  const evolution=power>=150?4:power>=40?3:power>=10?2:power>=2?1:0;
  return {id,design,root,motion,materials,color,secondary,evolution,efficiency,mesh,group,box,cyl,ring,orb,crystal,spin,hover,beam,pipe,screw,vents,badge,fan,gear,orbit,status};
}

function spark(t){
  const {root,group,box,cyl,ring,orb,crystal,hover,spin,beam,badge,status}=t;
  // Hexagonal ignition capsule clamped in a split, armoured cradle.
  const cell=group(0,.2,0);hover(cell,.045,.9);
  const belly=cyl(.73,1.45,'glass',0,0,0,cell,48);belly.rotation.y=Math.PI/6;
  const plasma=crystal(.43,'glow',0,0,0,cell,1);spin(plasma,'y',.7);spin(plasma,'z',.25);
  for(const y of [-.74,.74]){
    cyl(.84,.19,'ink',0,y,0,cell,6);cyl(.78,.08,'silver',0,y+(y>0?.13:-.13),0,cell,6);
    const band=ring(.7,.033,'glow',0,y,0,cell,6);band.rotation.x=Math.PI/2;
  }
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,panel=box(.37,1.06,.13,i%2?'pearl':'ink',Math.sin(a)*.73,0,Math.cos(a)*.73,cell);panel.rotation.y=a;
    const led=box(.035,.72,.025,'glow',Math.sin(a)*.812,0,Math.cos(a)*.812,cell);led.rotation.y=a;
  }
  const orbit=group(0,.2,0);orbit.rotation.x=.22;orbit.rotation.z=.2;ring(1.05,.045,'silver',0,0,0,orbit);ring(1.105,.015,'glow2',0,0,0,orbit);spin(orbit,'y',.22);
  for(const x of [-.83,.83]){box(.22,.56,.52,'pearl',x,-.83,0);beam([x,-.85,0],[x*.85,-.45,0],.085,'silver');}
  box(1.85,.2,.88,'ink',0,-1.1,0);badge('SPARK',.78,0,-1.1,.455);status(-.24,.86,.68,cell);
  orb(.08,'glow2',0,.99,0,cell);
}

function bolt(t){
  const {group,box,cyl,ring,crystal,spin,beam,fan,vents,badge,status}=t;
  // Low, asymmetric racing chassis on four independent turbine legs.
  const body=group(0,-.08,0);box(1.75,.58,1.3,'ink',0,0,0,body);
  const nose=box(1.13,.2,.86,'pearl',0,.37,.16,body);nose.rotation.x=-.14;
  const spine=box(.45,.23,1.38,'accent',0,.52,-.05,body);spine.rotation.x=-.08;
  box(1.05,.11,.07,'glow',0,.05,.68,body);badge('BOLT',.68,0,-.13,.68,body);
  const reactor=crystal(.27,'glow2',0,.78,-.14,body,0);spin(reactor,'y',1.1);
  const cage=ring(.38,.045,'silver',0,.77,-.14,body,6);cage.rotation.x=Math.PI/2;
  for(const x of [-1,1])for(const z of [-.72,.72]){
    const leg=group(x*1.02,-.48,z*.88);leg.rotation.z=-x*.2;
    beam([-x*.13,.5,-z*.13],[x*.27,.08,z*.14],.075,'silver',leg);
    box(.5,.46,.7,'pearl',x*.28,-.06,0,leg);box(.54,.055,.72,'glow',x*.28,-.32,0,leg);
    const thruster=fan(x*.28,-.04,.38,.18,leg);thruster.rotation.x=-.18;
    box(.13,.05,.54,'accent',x*.28,.21,0,leg);
  }
  for(const x of [-.61,.61]){
    const jet=cyl(.25,.5,'silver',x,.05,-.84,body);jet.rotation.x=Math.PI/2;
    ring(.2,.04,'glow2',x,.05,-1.12,body);vents(4,x,-.13,.665,.27,.085,body);
  }
  for(const x of [-.83,.83]){box(.08,.38,.38,'accent',x,.4,-.44,body);status(x,.08,.76,body);}
}

function pulse(t){
  const {group,box,cyl,ring,orb,crystal,spin,hover,beam,badge,orbit}=t;
  // A suspended dynamo with three independently counter-rotating gimbals.
  const rotor=group(0,.25,0);hover(rotor,.065,.85);
  orb(.59,'glass',0,0,0,rotor);const core=crystal(.36,'glow',0,0,0,rotor,1);spin(core,'y',.8);spin(core,'z',.24);
  for(const [radius,angles,speed] of [[.83,[.25,.28,0],.32],[1.02,[1.05,.3,.2],-.24],[1.19,[.55,1.02,0],.18]]){
    const g=group(0,0,0,rotor);g.rotation.set(...angles);ring(radius,.065,'ink',0,0,0,g);ring(radius,.025,'glow',0,0,.061,g);
    for(let i=0;i<4;i++){const a=i*Math.PI/2,arm=box(.23,.12,.16,'pearl',Math.cos(a)*radius,Math.sin(a)*radius,0,g);arm.rotation.z=a;}
    spin(g,'z',speed);
  }
  orbit(.7,[.3,.8,.2],-.5,rotor,'glow2');
  for(const x of [-1.01,1.01]){beam([x,-1.04,0],[x*.84,-.16,0],.09,'silver');const shoulder=box(.22,.65,.38,'pearl',x,-.68,0);shoulder.rotation.z=-x*.12;}
  cyl(.86,.19,'ink',0,-1.07,0,undefined,8);const band=ring(.72,.024,'glow2',0,-.96,0);band.rotation.x=Math.PI/2;badge('PULSE',.72,0,-1.09,.63);
}

function flux(t){
  const {group,box,cyl,ring,orb,crystal,spin,beam,badge,vents}=t;
  // An octagonal gateway: a tall open centre instead of a box-shaped body.
  const gate=group(0,.25,0);ring(1.02,.13,'ink',0,0,0,gate,8);ring(1.02,.051,'silver',0,0,.1,gate,8);ring(.84,.027,'glow',0,0,.15,gate,8);
  ring(1.22,.021,'glow2',0,0,-.1,gate,8);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,plate=box(.43,.22,.38,i%2?'ink':'pearl',Math.sin(a)*1.08,Math.cos(a)*1.08,0,gate);plate.rotation.z=-a;
    const led=box(.22,.035,.04,'glow',Math.sin(a)*1.075,Math.cos(a)*1.075,.22,gate);led.rotation.z=-a;
  }
  const disk=new THREE.Mesh(new THREE.CircleGeometry(.73,64),new THREE.MeshPhysicalMaterial({color:t.color,metalness:.2,roughness:.12,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));gate.add(disk);
  const inner=group(0,0,0,gate);ring(.64,.018,'glow2',0,0,0,inner,6);ring(.47,.013,'glow',0,0,.05,inner,6);spin(inner,'z',-.27);
  const nucleus=crystal(.17,'white',0,0,.02,gate,0);spin(nucleus,'y',.7);spin(nucleus,'z',.4);
  for(const x of [-.75,.75]){beam([x,-.55,0],[x*.95,-1.08,.14],.09,'silver');box(.48,.2,.73,'ink',x,-1.12,0);}
  box(1.86,.25,.7,'pearl',0,-1.2,.13);box(1.45,.045,.73,'glow',0,-1.36,.13);badge('FLUX',.7,0,-1.18,.5);
  for(const x of [-.62,.62])vents(3,x,-1.26,.51,.25,.055);
}

function alloy(t){
  const {group,box,cyl,ring,crystal,spin,beam,fan,vents,screw,badge}=t;
  // A compact industrial sentinel with articulated shoulders and a moving forge press.
  const torso=group(0,.25,0);box(1.12,.92,.7,'ink',0,0,0,torso);
  const chest=box(.86,.7,.11,'pearl',0,0,.42,torso);ring(.25,.045,'silver',0,.05,.5,torso,6);
  const core=crystal(.19,'glow',0,.05,.53,torso,0);spin(core,'z',.32);spin(core,'y',.6);
  box(.56,.22,.52,'pearl',0,.73,0,torso);box(.35,.045,.055,'glow2',0,.75,.29,torso);
  for(const x of [-.76,.76]){
    const shoulder=group(x,.24,0,torso);box(.44,.48,.72,'pearl',0,0,0,shoulder);box(.48,.12,.6,'accent',0,.34,0,shoulder);
    const hinge=cyl(.18,.49,'silver',0,-.29,0,shoulder,24);hinge.rotation.z=Math.PI/2;
    const forearm=box(.39,.55,.43,'ink',x*.09,-.7,.14,shoulder);forearm.rotation.z=-Math.sign(x)*.08;
    box(.42,.16,.49,'pearl',x*.09,-.96,.14,shoulder);fan(0,.02,.405,.135,shoulder);
    beam([x*.09,-.41,.37],[x*.09,-.84,.37],.035,'glow2',shoulder);
  }
  for(const x of [-.36,.36]){box(.24,.43,.36,'silver',x,-.62,0);box(.36,.44,.43,'ink',x,-.99,0);box(.51,.2,.74,'pearl',x,-1.26,.15);box(.43,.045,.61,'glow',x,-1.39,.17);}
  const piston=box(.52,.11,.31,'silver',0,.46,.1,torso);t.motion.push(time=>{piston.position.y=.46+Math.sin(time*1.6)*.045;});
  for(const x of [-.39,.39])for(const y of [-.25,.29])screw(x,y,.5,torso);badge('ALLOY',.6,0,-.32,.49,torso);
  vents(4,0,.12,-.39,.48,.12,torso);
}

function titan(t){
  const {group,box,cyl,ring,orb,spin,beam,fan,vents,badge}=t;
  // Broad, heavy carrier with two reactor towers and four armoured hover pads.
  box(2.57,.35,1.8,'ink',0,-.78,0);box(2.26,.12,1.59,'silver',0,-.54,0);box(2.45,.035,1.73,'glow2',0,-.96,0);
  for(const x of [-1.08,1.08])for(const z of [-.68,.68]){box(.66,.4,.62,'pearl',x,-1.02,z);box(.68,.075,.65,'ink',x,-1.26,z);const glow=ring(.2,.025,'glow',x,-1.31,z);glow.rotation.x=Math.PI/2;}
  for(const x of [-.8,.8]){
    const tower=group(x,.12,0);box(.64,1.42,1.17,'ink',0,0,0,tower);box(.7,.2,1.24,'pearl',0,.78,0,tower);
    for(const side of [-.27,.27])box(.075,1.15,.07,'pearl',side,0,.64,tower);
    for(let i=0;i<4;i++){box(.33,.09,.045,'glow',0,-.39+i*.26,.64,tower);}
    fan(0,.75,.7,.19,tower);const top=cyl(.19,.07,'glow2',0,.94,0,tower,32);const rim=ring(.23,.035,'silver',0,.97,0,tower);rim.rotation.x=Math.PI/2;
    for(let i=0;i<4;i++)box(.48,.032,.91,'silver',0,-.44+i*.28,-.63,tower);
  }
  box(1.12,.36,.8,'pearl',0,.09,0);const core=orb(.22,'glow2',0,.45,.05);const cage=ring(.31,.04,'silver',0,.45,.05);spin(cage,'y',.45);
  for(const x of [-.34,.34])beam([x,-.5,.62],[x,.24,.54],.055,'silver');
  badge('TITAN',.84,0,-.3,.77);vents(4,0,-.78,.96,.48,.065);
}

function nova(t){
  const {group,box,cyl,ring,crystal,spin,hover,beam,badge,orbit}=t;
  // A suspended crystalline star, with six long swept fins and a rotating halo.
  const star=group(0,.2,0);hover(star,.07,.8);
  const center=meshDiamond(t,.55,1.36,'glass',star);spin(center,'y',.16);
  const heart=crystal(.36,'glow',0,0,0,star,0);spin(heart,'y',-.4);spin(heart,'z',.2);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,g=group(0,0,0,star);g.rotation.z=a;
    const fin=box(.26,.91,.21,i%2?'pearl':'ink',0,.94,-.02,g);fin.rotation.x=-.22;fin.rotation.z=.15;
    const tip=crystal(.19,'silver',-.06,1.41,-.12,g,0);tip.scale.set(.5,1.6,.5);
    beam([.08,.6,.12],[.04,1.27,-.02],.021,i%2?'glow2':'glow',g);
    box(.29,.18,.24,'trim',0,.6,0,g);
  }
  orbit(1.03,[.6,.4,0],-.24,star,'glow2');
  const base=cyl(.74,.2,'ink',0,-1.29,0,undefined,6);const band=ring(.62,.025,'glow',0,-1.17,0);band.rotation.x=Math.PI/2;
  for(const x of [-.47,.47])beam([x,-1.18,0],[x*.6,-.8,0],.045,'silver');badge('NOVA',.61,0,-1.3,.56);
}

function meshDiamond(t,radius,height,material,parent){const g=new THREE.LatheGeometry([new THREE.Vector2(.01,-height/2),new THREE.Vector2(radius,-height*.08),new THREE.Vector2(radius*.6,height*.33),new THREE.Vector2(.01,height/2)],6);return t.mesh(g,material,0,0,0,parent);}

function helix(t){
  const {group,box,cyl,ring,orb,spin,beam,pipe,badge}=t;
  // A tall double helix wrapped around a transparent energy column.
  const column=group(0,.12,0);cyl(.32,1.92,'glass',0,0,0,column,48);
  for(const y of [-1.02,1.02]){cyl(.59,.15,'ink',0,y,0,column,8);cyl(.45,.065,'silver',0,y+(y>0?.12:-.12),0,column,8);const hoop=ring(.49,.026,'glow2',0,y,0,column);hoop.rotation.x=Math.PI/2;}
  const helix=group(0,0,0,column);
  for(let k=0;k<2;k++){
    const points=[];for(let i=0;i<=100;i++){const u=i/100,a=u*Math.PI*3+k*Math.PI;points.push([Math.cos(a)*.54,-.93+u*1.86,Math.sin(a)*.54]);}
    pipe(points,.065,k?'pearl':'silver',helix);pipe(points.map(p=>[p[0]*1.05,p[1],p[2]*1.05]),.018,k?'glow2':'glow',helix);
  }
  spin(helix,'y',.27);
  for(let i=0;i<7;i++){const bead=orb(.09,'glow',0,-.75+i*.25,0,column);t.motion.push(time=>{bead.scale.setScalar(.7+Math.sin(time*1.7-i*.7)*.2);});}
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,x=Math.sin(a)*.77,z=Math.cos(a)*.77;
    beam([x,-1.2,z],[x*.67,-.74,z*.67],.055,'silver');const foot=box(.32,.19,.49,'ink',x,-1.22,z);foot.rotation.y=a;
    const tip=box(.2,.035,.35,'glow2',x,-1.32,z);tip.rotation.y=a;
  }
  badge('HELIX',.62,0,-.99,.49,column);
}

function apex(t){
  const {group,box,cyl,ring,orb,crystal,spin,hover,beam,pipe,badge,orbit}=t;
  // A levitating crown reactor: faceted core, six articulated crown blades and satellites.
  const crown=group(0,.2,0);hover(crown,.07,.62);
  const shell=crystal(.7,'glass',0,0,0,crown,0);shell.scale.set(1,1.28,1);spin(shell,'y',.17);
  const core=crystal(.39,'glow',0,0,0,crown,1);spin(core,'y',-.34);spin(core,'x',.16);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,g=group(0,0,0,crown);g.rotation.y=a;
    const blade=box(.26,1.24,.32,i%2?'silver':'pearl',0,.25,.8,g);blade.rotation.x=-.32;
    const prow=crystal(.24,'ink',0,1.0,.65,g,0);prow.scale.set(.6,1.7,.6);
    beam([0,-.24,.97],[0,.78,.68],.025,'glow',g);
    const jewel=crystal(.09,'glow2',0,1.18,.57,g,0);spin(jewel,'y',.7);
    beam([0,-.72,.6],[0,-.15,.93],.055,'silver',g);
  }
  const orbitBase=group(0,.05,0,crown);orbitBase.rotation.x=Math.PI/2;
  ring(1.25,.025,'glow2',0,0,0,orbitBase);spin(orbitBase,'z',-.18);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;const drone=crystal(.15,'pearl',Math.cos(a)*1.25,Math.sin(a)*1.25,0,orbitBase,0);drone.scale.set(1.4,.7,1.1);orb(.045,'glow',Math.cos(a)*1.25,Math.sin(a)*1.25,.14,orbitBase);
  }
  const dais=cyl(.76,.17,'ink',0,-1.26,0,undefined,6);const edge=ring(.65,.022,'glow',0,-1.15,0,undefined,6);edge.rotation.x=Math.PI/2;
  badge('APEX',.62,0,-1.27,.58);
}

const BUILDERS={spark,bolt,pulse,flux,alloy,titan,nova,helix,apex};
export function createForgeHardware(id,{tokens,power=1,efficiency=30}={}) {
  const chosen=Object.hasOwn(BUILDERS,id)?id:'spark',t=toolkit(chosen,tokens,power,efficiency);
  BUILDERS[chosen](t);
  // Small upgrade status cells are consistent across the nine original body designs.
  for(let i=0;i<t.evolution;i++)t.orb(.026,'glow2',-.11+i*.075,-1.39,.48);
  t.root.userData.designId=chosen;
  return {root:t.root,motion:t.motion,color:t.color,secondary:t.secondary,design:t.design};
}

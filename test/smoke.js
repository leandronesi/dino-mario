/* Dino Mario — collaudo. `node test/smoke.js`
   The heavy part is a beam search that PLAYS every level through the real
   step(), for both ages: a level only counts as finishable if something that
   presses the same four buttons as a child reaches the flag. Then the passive
   player: whoever touches nothing must never finish anything. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const noop=()=>{},store=new Map(),scenes={},events={};
const context=new Proxy({},{get(t,k){if(k in t)return t[k];if(k==='measureText')return s=>({width:String(s).length*10});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});return noop;},set(t,k,v){t[k]=v;return true;}});
const elements={};function element(id){return elements[id]||(elements[id]={style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},getContext:()=>context,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0}),focus:noop,blur:noop,select:noop});}
const sandbox={console,Math,Date,JSON,innerWidth:1280,innerHeight:720,devicePixelRatio:2,performance:{now:()=>0},navigator:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{hidden:false,getElementById:element,documentElement:{},addEventListener:(n,f)=>events[n]=f},addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,setInterval:noop,matchMedia:()=>({matches:false}),speechSynthesis:{getVoices:()=>[],speak:noop,cancel:noop,addEventListener:noop},SpeechSynthesisUtterance:function(){}};
sandbox.window=sandbox;vm.createContext(sandbox);
const dir=path.join(__dirname,'../src');
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort()){
  vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
  if(file==='00-core.js'){const original=sandbox.G.scene;sandbox.G.scene=(name,s)=>{scenes[name]=s;original(name,s);};}
}
const G=sandbox.G,M=G.mario,T=48;
const kid=G.accounts.create({name:'Prova',level:1});G.accounts.login(kid.id);
const only=process.argv[2];let s0;const CAVE=G.LEVELS.findIndex(l=>l.name==='La Grotta');

// ---- rules are data, no dice
const gameSrc=fs.readFileSync(path.join(dir,'20-game.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert(!/Math\.random|G\.rnd|G\.pick|G\.shuffle/.test(gameSrc.split('/* ================================================================ drawing */')[0]||gameSrc),'the rules must be deterministic');

// ---- level sanity: every level has a way out, and no stray tiles
G.LEVELS.forEach((lv,i)=>{
  assert.equal(lv.grid.length,15);lv.grid.forEach(r=>assert.equal(r.length,lv.w));
  const ends=lv.ents.filter(e=>e.type==='flag'||e.type==='lever');assert.equal(ends.length,1,lv.name+' needs exactly one ending');
  assert(lv.grid[13][lv.start]!==' ',lv.name+': start on solid ground');
});

function play(inp,frames){for(let i=0;i<frames;i++)M.step(inp);}
const ACTS=[{r:1},{r:1,j:1},{r:1,j:1,short:1},{},{l:1},{l:1,j:1},{r:1,f:1}];
function solve(li,level){
  G.level=level;M.quiet(true);M.build(li);M.start();
  let beam=[{snap:M.snap(),prevJ:false}],best=0,stall=0,gen=0;
  // falling with nothing below is worth nothing: otherwise the greedy beam
  // prefers leaping into the void (briefly further right) over waiting for a platform
  const void_=s=>{if(s.p.on||s.p.vy<=0)return false;const x0=Math.floor(s.p.x/T),x1=Math.floor((s.p.x+s.p.w)/T),ty=Math.floor((s.p.y+s.p.h)/T);
    for(let x=x0-1;x<=x1+1;x++)for(let y=Math.max(0,ty);y<15;y++){const c=M.tile(x,y);if(c!==' '&&c!=='K')return false;}
    return !s.plats.some(p=>p.y>=s.p.y+s.p.h-4&&p.x<s.p.x+s.p.w+150&&p.x+p.w>s.p.x-150);};
  const score=s=>s.p.x-(3-s.hearts)*700-(s.falls||0)*500+s.p.power*60-(void_(s)?2000:0);
  while(gen++<2500){
    const next=new Map();
    for(const node of beam)for(const a of ACTS){
      if(a.f&&JSON.parse(node.snap).p.power!==2)continue;
      M.load(node.snap);
      for(let k=0;k<8;k++)M.step({l:!!a.l,r:!!a.r,j:!!a.j&&!(a.short&&k>2),f:!!a.f&&k===0});
      const s=M.state();
      if(s.phase==='goal'||s.phase==='bridge'||s.phase==='clear'){for(let k=0;k<3000&&s.phase!=='clear';k++)M.step({});return {ok:M.state().phase==='clear',gen,hearts:M.state().hearts,falls:M.state().falls||0,fruit:M.state().got};}
      if(s.phase!=='play')continue;
      const key=[Math.round(s.p.x/10),Math.round(s.p.y/10),Math.sign(s.p.vy),s.p.power,s.hearts].join();
      const sc=score(s);
      if(!next.has(key)||next.get(key).sc<sc)next.set(key,{snap:M.snap(),sc});
    }
    beam=[...next.values()].sort((a,b)=>b.sc-a.sc).slice(0,48);
    if(!beam.length)return {ok:false,gen,why:'every branch died'};
    if(beam[0].sc>best+1){best=beam[0].sc;stall=0;}else if(++stall>300){M.load(beam[0].snap);return {ok:false,gen,why:'stuck at x='+Math.round(M.state().p.x/T)+' tiles'};}
  }
  return {ok:false,gen,why:'too long'};
}
for(const level of [1,2])G.LEVELS.forEach((lv,li)=>{
  if(only&&String(li+1)!==only)return;
  if(only==='quick')return;
  const t0=Date.now(),r=solve(li,level);
  console.log(`  ${lv.name.padEnd(13)} ${level===1?'Piccolo':'Grande '}  ${r.ok?'OK':'FAIL'}  ${JSON.stringify(r)}  ${Date.now()-t0}ms`);
  assert(r.ok,lv.name+' not finishable at level '+level+': '+r.why);
});
if(only&&only!=='quick')process.exit(0);
delete G.save.mario;M.quiet(false);   // the bot really cleared the levels: start the rule checks from a fresh save

// ---- nobody is ever born on the roof of the cave: start, checkpoint retry, respawn after a fall
for(const level of [1,2]){G.level=level;M.build(CAVE);assert.equal(M.state().p.y+M.state().p.h,13*T,'start on the cave floor');M.build(CAVE,true);assert.equal(M.state().p.y+M.state().p.h,13*T,'checkpoint on the cave floor');}
G.level=1;M.build(CAVE);M.start();s0=M.state();s0.p.x=44*T;s0.safe=40*T;for(let i=0;i<200&&!M.state().falls;i++)M.step({r:1});play({},10);assert(M.state().p.y>10*T,'respawn on the cave floor');

// ---- the passive player never finishes, and in Grande gets hurt by what walks at him
for(const level of [1,2])G.LEVELS.forEach((lv,li)=>{
  G.level=level;M.build(li);M.start();play({},60*60);const s=M.state();
  assert(s.phase!=='clear'&&s.phase!=='goal','standing still finished '+lv.name);
});
G.level=2;M.build(0);M.start();for(let i=0;i<60*40&&M.state().hearts===3;i++)M.step({r:1});
assert(M.state().hearts<3,'walking into the first beetle must cost a heart in Grande');

// ---- a '?' block gives a fruit, the M block a melon that makes the dino big
G.level=2;M.build(0);M.start();
let s=M.state();s.p.x=16*T+9;play({},30);const before=s.got;play({j:1},30);s=M.state();
assert.equal(M.tile(16,9),'U','the ? block must become used');assert.equal(s.got,before+1,'the ? block must give one fruit');
M.build(0);M.start();s=M.state();s.ens=s.ens.filter(e=>e.x>40*T);s.p.x=21*T+9;play({},30);play({j:1},30);s=M.state();
assert.equal(M.tile(21,9),'U');assert.equal(s.items.length,1);assert.equal(s.items[0].kind,'melon');
for(let i=0;i<400&&M.state().p.power===0;i++)M.step({r:M.state().items[0]&&M.state().items[0].x>M.state().p.x?1:0,l:M.state().items[0]&&M.state().items[0].x<M.state().p.x?1:0});
assert.equal(M.state().p.power,1,'the melon makes the dino big');assert(M.state().p.h>80);

// ---- stomping a beetle: it is gone and no heart is lost
M.build(0);M.start();s=M.state();const beetle=s.ens.find(e=>e.type==='beetle'&&e.x>40*T);s.cam=beetle.x-500;s.p.x=beetle.x-4;s.p.y=beetle.y-200;s.p.vy=200;beetle.act=true;
for(let i=0;i<40;i++)M.step({});s=M.state();
assert.equal(s.hearts,3,'a stomp must not hurt');assert(!s.ens.some(e=>e.id===beetle.id&&!e.dead),'the stomped beetle must go');

// ---- falling in a pit: free for Piccolo, one heart for Grande
for(const level of [1,2]){
  G.level=level;M.build(0);M.start();s=M.state();s.p.x=67*T;play({},20);
  for(let i=0;i<240&&!M.state().falls&&M.state().phase==='play'&&(M.state().hearts===3);i++)M.step({r:1});
  play({},30);s=M.state();
  assert.equal(s.hearts,level===1?3:2,'pit at level '+level);assert.equal(s.phase,'play');assert(s.p.y<14*T,'back on the ground');
}

// ---- out of hearts: restart from the flag, never from nothing
G.level=2;M.build(0);M.start();s=M.state();s.p.x=97*T;play({},5);s=M.state();assert(s.checked,'checkpoint reached');
s.hearts=1;s.p.inv=0;const e2=s.ens.find(e=>e.type==='beetle'&&e.x>98*T);e2.act=true;e2.x=s.p.x+s.p.w+1;e2.y=s.p.y+s.p.h-e2.h;play({},90);
assert.equal(M.state().phase,'over');M.build(0,true);assert(M.state().p.x>90*T,'retry starts from the checkpoint');

// ---- clearing saves, unlocks, and stays in this child's save
G.level=1;M.build(0);M.start();s=M.state();s.p.x=194*T;play({r:1},600);
assert.equal(M.state().phase,'clear');assert.equal(G.save.mario.open,1);assert.equal(G.save.mario.done[0],true);
const sib=G.accounts.create({name:'Fratello',level:2});G.accounts.login(sib.id);assert.equal(G.save.mario,undefined,'sibling save leaked');G.accounts.login(kid.id);assert.equal(G.save.mario.open,1);

// ---- boss: the lever drops the bridge and the Big Beetle with it
// every castle: the lever drops the bridge and the Big Beetle with it, and frees the little dino
G.LEVELS.forEach((lv,li)=>{if(!lv.bridge)return;G.level=2;M.build(li);M.start();s=M.state();s.p.x=(lv.bridge.x1+1)*T;s.p.y=lv.bridge.row*T-s.p.h;play({r:1},20);
  assert.equal(M.state().phase,'bridge',lv.name);play({},60*8);assert.equal(M.state().phase,'clear',lv.name);
  assert(!M.state().ens.some(e=>e.type==='boss'&&!e.dead),'the boss falls with the bridge in '+lv.name);});
assert.equal(G.LEVELS.length,20);assert.equal(G.LEVELS.filter(l=>l.bridge).length,5,'one castle per world');

// ---- the spring throws the dino up to the planks
{const li=G.LEVELS.findIndex(l=>l.grid[12].includes('J'));G.level=1;M.build(li);M.start();const jx=G.LEVELS[li].grid[12].indexOf('J');s=M.state();s.ens=[];s.p.x=jx*T+9;s.p.y=10*T;let top=1e9;for(let i=0;i<90;i++){M.step({});top=Math.min(top,M.state().p.y);}assert(top<5*T,'the spring must reach the planks: '+top);}

// ---- an old save keeps its progress on the new map
{const kid2=G.accounts.create({name:'Vecchio',level:1});G.accounts.login(kid2.id);G.save.mario={open:2,best:{0:5,1:3},done:{0:true,1:true}};M.build(0);M.start();M.state().p.x=194*T;play({r:1},600);
 const sv=G.save.mario;assert.equal(sv.v,2);assert(sv.done[0]&&sv.done[4],'Prato and Grotta stay done');assert(sv.open>=5,'and what came after them is open: '+sv.open);G.accounts.login(kid.id);}

// ---- scenes draw without throwing
for(const name of ['accesso','menu','gioco']){if(scenes[name].enter)scenes[name].enter({level:0});scenes[name].draw(context);}
['ready','play','pause','over','clear'].forEach(ph=>{M.state().phase=ph;scenes.gioco.draw(context);});
for(let li=0;li<G.LEVELS.length;li++){M.build(li);M.state().phase='play';M.state().p.power=2;scenes.gioco.draw(context);}
console.log('PASS Dino Mario: every level finished by the search bot at both ages, passive player never wins, blocks, melon, stomp, pits, checkpoint retry, save, boss bridge');

/* Real Chrome: screenshots of every world and real multi-touch on the pads.
   node test/look.js  -> test/frames/*.png  (not published, see deploy.yml) */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),assert=require('assert');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'frames');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,ws,server;
async function main(){
  assert(chrome,'Chrome required');fs.mkdirSync(out,{recursive:true});
  server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(f));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'dino-mario-')),'--no-first-run','--hide-scrollbars','--window-size=1280,720','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let endpoint='';child.stderr.on('data',b=>{const m=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(m)endpoint=m[1];});
  for(let i=0;i<100&&!endpoint;i++)await delay(100);assert(endpoint,'Chrome startup timeout');
  const targets=await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list').then(r=>r.json());
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
  async function shot(name){await delay(250);const s=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));}
  const touch=(type,pts)=>call('Input.dispatchTouchEvent',{type,touchPoints:pts});
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:origin+'/'});
  for(let i=0;i<100;i++){await delay(50);if(await run("!!(window.G && G.current==='accesso')"))break;}
  await run("const a=G.accounts.create({name:'Leo',color:G.C.dino,level:2});G.accounts.login(a.id);G.go('menu')");await delay(600);await shot('menu');
  await run("G.save.mario.open=3;G.go('gioco',{level:0})");await delay(600);await shot('1-ready');
  await run("G.mario.start()");await delay(900);await shot('1-start');

  // real touch: hold the right pad, then add a second finger on the jump side
  const x0=await run('G.mario.state().p.x');
  await touch('touchStart',[{x:268,y:630,id:1}]);await delay(600);
  const x1=await run('G.mario.state().p.x');assert(x1>x0+60,'holding the right pad must walk ('+x0+'→'+x1+')');
  await touch('touchStart',[{x:268,y:630,id:1},{x:1168,y:626,id:2}]);await delay(120);
  const y1=await run('G.mario.state().p.vy');assert(y1<0,'a second finger on the jump button must jump while walking');
  await shot('1-touch-jump');
  await touch('touchEnd',[{x:268,y:630,id:1}]);await touch('touchEnd',[]);await delay(400);
  const held=await run('JSON.stringify(G.mario.state().p.vx)');console.log('after release vx',held);
  console.log('touch: hold-to-walk and two-finger jump pass');

  const spots=[[0,60,2,'1-pipes'],[0,108,0,'1-blocks'],[0,176,1,'1-stairs'],[1,28,1,'2-corridor'],[1,118,2,'2-platform'],[2,44,0,'3-trees'],[2,92,1,'3-platform'],[3,30,2,'4-lava'],[3,86,0,'4-hedgehog'],[3,163,1,'4-boss']];
  for(const [li,tx,power,name] of spots){
    await run(`G.go('gioco',{level:${li}})`);await delay(500);
    await run(`G.mario.start();(()=>{const s=G.mario.state(),T=48;s.p.x=${tx}*T;s.p.y=0;s.p.vy=0;s.cam=Math.max(0,s.p.x-480);if(${power})s.p.power=${power},s.p.w=40,s.p.h=86;s.ens.forEach(e=>{if(Math.abs(e.x-s.p.x)<1400)e.act=true;});})()`);
    await delay(1100);await shot(name);
  }
  await run("G.go('gioco',{level:0})");await delay(500);await run("G.mario.start();const s=G.mario.state();s.p.x=193*48;");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await delay(700);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});await delay(3600);await shot('1-clear');
  await call('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:2,mobile:true});await delay(300);await shot('tablet');
  assert.deepEqual(errors,[],'console errors: '+JSON.stringify(errors).slice(0,800));
  console.log('PASS look: frames in test/frames');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{try{ws&&ws.close();}catch(e){}try{child&&child.kill();}catch(e){}try{server&&server.close();}catch(e){}});

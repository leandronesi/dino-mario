/* Rasterises icon.svg into the PNG icons Android needs to install the game
   as a real app: 180 (Apple), 192, 512 and a 512 maskable with the safe zone.
   Uses the local Chrome, muted. `node tools/icons.js` */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const svg=fs.readFileSync(path.join(root,'icon.svg'),'utf8'),bg=(svg.match(/<rect[^>]*fill="(#[0-9a-fA-F]{3,6})"/)||[])[1]||'#183f37';
  const child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--mute-audio','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'icons-')),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let ep='';child.stderr.on('data',b=>{const m=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(m)ep=m[1];});
  for(let i=0;i<100&&!ep;i++)await delay(100);
  const t=(await fetch('http://127.0.0.1:'+new URL(ep).port+'/json/list').then(r=>r.json())).find(x=>x.type==='page');
  const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}};
  const call=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  const uri='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  for(const [name,size,mask] of [['icon-180.png',180,0],['icon-192.png',192,0],['icon-512.png',512,0],['icon-maskable-512.png',512,1]]){
    await call('Emulation.setDeviceMetricsOverride',{width:size,height:size,deviceScaleFactor:1,mobile:false});
    const inner=mask?Math.round(size*.8):size,off=(size-inner)/2;
    const html=`<html><body style="margin:0;background:${mask?bg:'transparent'}"><img src="${uri}" style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px"></body></html>`;
    await call('Page.navigate',{url:'data:text/html;base64,'+Buffer.from(html).toString('base64')});await delay(400);
    const s=await call('Page.captureScreenshot',{format:'png',omitBackground:!mask,clip:{x:0,y:0,width:size,height:size,scale:1}});
    fs.writeFileSync(path.join(root,name),Buffer.from(s.data,'base64'));console.log('wrote',name);
  }
  ws.close();child.kill();
})().catch(e=>{console.error(e);process.exitCode=1;});

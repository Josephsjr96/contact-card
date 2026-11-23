const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa','spot-it-sound');
let server,browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=require('node:http').createServer((req,res)=>{
  let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,'.'+decodeURIComponent(name));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(data)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/samples/spot-it/';
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.audioContexts=[];
  window.AudioContext=class extends Native{constructor(){super();window.audioContexts.push(this)}};
 });
 await page.goto(url);
 assert.equal(await page.evaluate(()=>audioContexts.length),0,'No audio context or autoplay before a gesture');
 await page.evaluate(()=>{const play=SPOT_SOUND.play;window.cues=[];SPOT_SOUND.play=name=>{cues.push(name);play(name)}});
 await page.locator('#start-button').click();
 await page.waitForFunction(()=>audioContexts[0]?.state==='running');
 assert.deepEqual(await page.evaluate(()=>cues),['start']);
 const shared=await page.evaluate(()=>match),wrong=await page.evaluate(()=>[...tableEl.querySelectorAll('.symbol')].find(el=>el.dataset.s!==match).dataset.s);
 await page.locator('#p1-card [data-s="'+shared+'"]').click();
 await page.locator('#table-card [data-s="'+wrong+'"]').click();
 await page.locator('#table-card [data-s="'+shared+'"]').click();
 assert.deepEqual(await page.evaluate(()=>cues),['start','select','wrong','match']);
 await page.locator('#pause-button').click();await page.locator('#pause-button').click();
 assert.deepEqual(await page.evaluate(()=>cues.slice(-3)),['pause','resume','deal']);
 const sound=page.getByRole('button',{name:'Sound effects',exact:true});
 await sound.click();assert.equal(await sound.getAttribute('aria-pressed'),'false');
 await page.reload();assert.equal(await sound.getAttribute('aria-pressed'),'false');
 await page.locator('#start-button').click();
 assert.equal(await page.evaluate(()=>audioContexts.length),0,'Muted games do not create audio');
 await sound.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>audioContexts[0]?.state==='running');
 assert.equal(await sound.getAttribute('aria-pressed'),'true');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sound control fits at '+width)}
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 await page.waitForFunction(()=>audioContexts[0].state==='suspended');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
 await page.waitForFunction(()=>audioContexts[0].state==='running');
 // Exercise the real multiplayer renderer against an isolated, mocked room socket.
 const room='a'.repeat(24);let socket;
 await page.route('https://spot-it-pvp.josephsanjari1996.workers.dev/rooms',route=>route.fulfill({json:{room,token:'fixture-token',seat:0,expiresAt:Date.now()+600000}}));
 await page.routeWebSocket('**/rooms/*/socket',ws=>{socket=ws});
 await page.locator('#pvp-button').click();await page.locator('#player-name').fill('You');await page.locator('#room-submit').click();
 await page.waitForFunction(()=>pvp?.socket?.readyState===WebSocket.OPEN);
 const cards=await page.evaluate(()=>{const[a,b]=generatePair(SYMBOLS[0]);return {card:a,table:b,cards:[a,a],opponent:a}});
 const state={type:'state',you:0,host:0,maxPlayers:6,phase:'waiting',round:0,game:0,serverNow:Date.now(),nextAt:Date.now()+2000,players:[{name:'You',score:0,ready:true,online:true},{name:'Friend',score:0,ready:true,online:true}],...cards};
 async function sendState(patch){Object.assign(state,patch);socket.send(JSON.stringify(state));await page.waitForFunction(s=>pvp.state?.phase===s.phase&&pvp.state?.round===s.round,{phase:state.phase,round:state.round});await page.waitForTimeout(30)}
 await sendState({});await page.evaluate(()=>{window.cues=[];SPOT_SOUND.play=name=>cues.push(name)});
 await sendState({phase:'countdown',round:1,game:1});await sendState({phase:'playing'});
 await sendState({phase:'reveal',lastPoint:{seat:0,symbol:cards.card.find(s=>cards.table.includes(s))}});
 await sendState({});await page.locator('.player-chip:not(.self)').click();
 assert.deepEqual(await page.evaluate(()=>cues),['start','deal','match'],'Repeated room updates and previews must not replay sounds');
 await sendState({phase:'playing',round:2,lastPoint:null});
 await sendState({phase:'reveal',lastPoint:{seat:1,symbol:cards.card[0]}});
 assert.equal(await page.evaluate(()=>cues.at(-1)),'opponent');
 state.players[0].score=20;await sendState({phase:'finished',round:3,lastPoint:{seat:0,symbol:cards.card[0]}});await sendState({});
 assert.equal(await page.evaluate(()=>cues.filter(c=>c==='win').length),1);
 await page.reload();await page.waitForFunction(()=>pvp?.socket?.readyState===WebSocket.OPEN);
 await page.evaluate(()=>{window.cues=[];SPOT_SOUND.play=name=>cues.push(name)});
 await sendState({phase:'reveal'});await sendState({});await page.locator('.player-chip:not(.self)').click();
 assert.deepEqual(await page.evaluate(()=>cues),[],'Rejoining an already revealed round stays silent');
 assert.deepEqual(errors,[]);
 // Render actual Web Audio output offline; inspect amplitude and decaying tails.
 const source=fs.readFileSync(path.join(root,'samples/spot-it/sound.js'),'utf8'),report=[];
 const render=await browser.newPage();
 for(const cue of ['select','deal','start','match','wrong','opponent','pause','resume','win','finish']){
  await render.goto(url);
  const result=await render.evaluate(async({source,cue})=>{
   document.querySelector('script[src^="sound.js"]')?.remove();
   const ctx=new OfflineAudioContext(2,96000,48000);
   Object.defineProperty(ctx,'resume',{value:()=>Promise.resolve()});
   window.AudioContext=function(){return ctx};localStorage.removeItem('spot-it-sound-v1');
   (0,eval)(source);SPOT_SOUND.unlock();SPOT_SOUND.play(cue);
   const audio=await ctx.startRendering(),samples=audio.getChannelData(0);
   let peak=0,energy=0,tail=0;
   for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]**2;if(i>samples.length-4800)tail+=samples[i]**2}
   return {cue,peak,rms:Math.sqrt(energy/samples.length),tailRms:Math.sqrt(tail/4800),samples:Array.from(samples)};
  },{source,cue});
  assert.ok(result.peak>.001&&result.peak<.8,cue+' has audible, unclipped output');
  assert.ok(result.tailRms<.0001,cue+' decays cleanly into silence');
  const {samples,...metrics}=result;report.push(metrics);
  // Retain a small WAV for optional listening during review.
  const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(v*32767))),44+i*2));fs.writeFileSync(path.join(out,cue+'.wav'),wav);
 }
 fs.writeFileSync(path.join(out,'levels.json'),JSON.stringify(report,null,2));
 // Missing audio support must leave gameplay functional.
 const silent=await browser.newPage();await silent.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined});await silent.goto(url);await silent.locator('#start-button').click();assert.equal(await silent.evaluate(()=>roundActive),true);assert.ok(await silent.locator('#sound-toggle').isDisabled());
 console.log('PASS: gesture-only audio, solo cues, persisted mute, keyboard unmute, mobile layout, PvP transition deduplication, ten rendered cues without clipping or abrupt tails, and no-audio fallback. Room traffic mocked.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))});

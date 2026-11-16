const {chromium}=require('/home/joe/Work/vix/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:8089/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.voicePlays=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.voicePlays.push(this.src);return play.call(this);};});
  await page.goto(base+'samples/pcr/');
  // Check all shipped files actually decode, independent of autoplay permission.
  const durations=await page.evaluate(async()=>{
   const entries=[];for(const name of ['welcome','start','complete','invalid']){
    const audio=new Audio('audio/'+name+'.mp3');
    await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=()=>reject(Error(name+' could not decode'));});entries.push([name,audio.duration]);
   }return entries;
  });
  assert.ok(durations.every(([,seconds])=>seconds>1&&seconds<20));
  await page.click('#labVoiceToggle');await page.waitForFunction(()=>voicePlays.some(s=>s.endsWith('/welcome.mp3')));
  await page.click('[data-slot="0"]');await page.selectOption('#speed','16');await page.click('#startButton');
  await page.waitForFunction(()=>voicePlays.some(s=>s.endsWith('/start.mp3')));
  await page.waitForFunction(()=>document.querySelector('#phaseLabel').textContent==='PROTOCOL COMPLETE',null,{timeout:30000});
  assert.match(await page.locator('#labAnnouncement').innerText(),/Amplification complete/);
  assert.ok(await page.evaluate(()=>voicePlays.some(s=>s.endsWith('/complete.mp3'))));
  await page.locator('.fault-controls summary').click();await page.check('#contamination');await page.click('#startButton');
  await page.waitForFunction(()=>document.querySelector('#phaseLabel').textContent==='PROTOCOL COMPLETE',null,{timeout:30000});
  assert.match(await page.locator('#labAnnouncement').innerText(),/Results are invalid/);
  assert.ok(await page.evaluate(()=>voicePlays.some(s=>s.endsWith('/invalid.mp3'))));
  await page.click('#labVoiceToggle');assert.equal(await page.locator('#labVoiceToggle').getAttribute('aria-pressed'),'false');
  const count=await page.evaluate(()=>voicePlays.length);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('vesper:voice',{detail:'start'})));
  assert.equal(await page.evaluate(()=>voicePlays.length),count);
  await page.reload();assert.equal(await page.locator('#labVoiceToggle').innerText(),'Voice · off');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
  assert.deepEqual(errors,[]);
  const report={passed:true,base,durations,checks:['All four MP3 files decode','Welcome on first gesture','Start and completed-run announcements','Invalid control announcement','Mute stops speech and persists after reload','320–1440px layouts','No JavaScript errors']};
  await fs.writeFile(path.resolve(__dirname,'../qa/pcr-voice-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

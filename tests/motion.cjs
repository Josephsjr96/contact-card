/* Renderer lifecycle, replay, fallback and refresh-rate sampling. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=(process.env.BASE_URL || 'http://127.0.0.1:8093/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const reports=[];
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'no-preference'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'#contact',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.PORTFOLIO_FIELD);
   assert.equal(await page.locator('#boot').isVisible(),false,'Deep links must bypass intro');
   assert.equal(await page.locator('.discipline-card').count(),4);
   const first=await page.evaluate(()=>PORTFOLIO_FIELD.snapshot());await page.waitForTimeout(250);
   assert.notEqual(await page.evaluate(()=>PORTFOLIO_FIELD.snapshot()),first,'Field is static');
   await page.getByRole('button',{name:'Pause waves',exact:true}).click();
   const frozen=await page.evaluate(()=>PORTFOLIO_FIELD.snapshot());const frame=await page.evaluate(()=>PORTFOLIO_FIELD.stats().frames);
   await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>PORTFOLIO_FIELD.stats().frames),frame,'RAF continues while paused');
   assert.equal(await page.evaluate(()=>PORTFOLIO_FIELD.snapshot()),frozen);
   await page.getByRole('button',{name:'Resume waves',exact:true}).click();
   await page.getByRole('button',{name:'Replay intro',exact:true}).click();
   assert.equal(await page.locator('#boot').isVisible(),true);assert.equal(await page.locator('main').evaluate(el=>el.inert),true);
   await page.getByRole('button',{name:'Skip intro'}).click();assert.equal(await page.locator('#boot').isVisible(),false);
   assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
   assert.equal(await page.getByRole('button',{name:'Replay intro',exact:true}).evaluate(el=>el===document.activeElement),true);
   await page.getByRole('button',{name:'Replay intro',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('#boot').isVisible(),false);
   await page.getByRole('button',{name:'Replay intro',exact:true}).click();await page.locator('#boot').waitFor({state:'hidden',timeout:4000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#wave-field').dataset.paused==='true');assert.equal(await page.locator('#wave-field').getAttribute('data-paused'),'true');assert.equal(await page.locator('#replay-intro').isVisible(),false);
   const reduced=await page.evaluate(()=>PORTFOLIO_FIELD.stats().frames);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>PORTFOLIO_FIELD.stats().frames),reduced);
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('#wave-field').dataset.paused==='false');
   // Losing/restoring GPU resources must not leave a blank or frozen page.
   const renderer=await page.evaluate(()=>PORTFOLIO_FIELD.stats().renderer);
   if(renderer==='webgl'){
    const available=await page.evaluate(()=>{const gl=document.querySelector('#wave-field').getContext('webgl');window.testContextLoss=gl.getExtension('WEBGL_lose_context');return !!window.testContextLoss;});
    if(available){await page.evaluate(()=>testContextLoss.loseContext());await page.waitForFunction(()=>document.querySelector('#wave-field').dataset.renderer==='recovering');await page.waitForTimeout(150);await page.evaluate(()=>testContextLoss.restoreContext());await page.waitForFunction(()=>document.querySelector('#wave-field').dataset.renderer==='webgl');}
   }
   await page.waitForTimeout(4000);const stats=await page.evaluate(()=>PORTFOLIO_FIELD.stats());
   assert.equal(stats.paused,false);assert.ok(stats.frames>30);assert.deepEqual(errors,[]);
   reports.push({width,...stats});await context.close();
  }
 }finally{await browser.close();}
 const fallbackBrowser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-webgl']});
 try{const p=await fallbackBrowser.newPage();await p.goto(base+'#work');await p.waitForFunction(()=>window.PORTFOLIO_FIELD);assert.equal(await p.evaluate(()=>PORTFOLIO_FIELD.stats().renderer),'canvas2d');const a=await p.evaluate(()=>PORTFOLIO_FIELD.snapshot());await p.waitForTimeout(200);assert.notEqual(await p.evaluate(()=>PORTFOLIO_FIELD.snapshot()),a);reports.push({forcedFallback:true,...await p.evaluate(()=>PORTFOLIO_FIELD.stats())});}finally{await fallbackBrowser.close();}
 const out=path.resolve(__dirname,'../qa');await fs.mkdir(out,{recursive:true});
 const report={base,passed:true,checks:['Four discipline cards','Live field pixels change','Pause stops RAF and pixels','Replay/skip/Escape/automatic completion','Intro focus and content inert state','Reduced-motion changes','GPU context restoration when available','No-WebGL fallback','Desktop/mobile frame pacing sampled','No page errors'],measurements:reports};
 await fs.writeFile(path.join(out,'motion-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

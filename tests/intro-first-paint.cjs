const {chromium}=require('/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8088/';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const context=await browser.newContext({reducedMotion:'no-preference'}),page=await context.newPage();
 await page.route('**/site-config.js*',async route=>{await new Promise(resolve=>setTimeout(resolve,5000));await route.continue();});
 await page.addInitScript(()=>{window.introFrames=[];const start=performance.now();function inspect(){const main=document.querySelector('main');const boot=document.getElementById('boot');if(main&&boot)introFrames.push({time:performance.now()-start,active:document.documentElement.classList.contains('intro-active'),mainVisible:getComputedStyle(main).visibility!=='hidden',introVisible:!boot.hidden});if(performance.now()-start<4500)requestAnimationFrame(inspect);}requestAnimationFrame(inspect);});
 await page.goto(base,{waitUntil:'commit'});
 await page.locator('#boot').waitFor({state:'visible',timeout:3000});
 assert.equal(await page.locator('main').isVisible(),false,'Main content flashed before intro');
 assert.equal(await page.locator('.intro-line').evaluate(el=>getComputedStyle(el,'::after').animationDuration),'3.5s');
 await page.locator('#boot').waitFor({state:'hidden',timeout:5000});assert.equal(await page.locator('main').isVisible(),true);
 const frames=await page.evaluate(()=>introFrames);assert.ok(frames.filter(f=>f.active).length>0);assert.equal(frames.filter(f=>f.active&&f.mainVisible).length,0,'Main visible during intro');assert.ok(frames.filter(f=>f.active).every(f=>f.introVisible));
 await page.waitForLoadState('networkidle');assert.equal(await page.locator('#boot').isVisible(),false);
 await context.clearCookies();await page.evaluate(()=>sessionStorage.clear());await page.goto(base+'#cv',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('#boot').isVisible(),false);assert.equal(await page.locator('main').isVisible(),true);
 const plain=await browser.newContext({javaScriptEnabled:false});const p=await plain.newPage();await p.goto(base+'#cv');assert.equal(await p.locator('main').isVisible(),true);assert.equal(await p.locator('#boot').isVisible(),false);
 console.log(JSON.stringify({base,passed:true,checked:'Intro before content with scripts delayed 5 seconds; no main-page flash; 3.5s animation; direct CV and no-JavaScript access'}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

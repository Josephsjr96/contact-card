const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=(process.env.BASE_URL || 'http://127.0.0.1:8088/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const output=path.resolve(__dirname,'../qa');await fs.mkdir(output,{recursive:true});
 const welcome=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 const intro=await welcome.newPage();await intro.goto(base,{waitUntil:'domcontentloaded'});
 await intro.locator('#boot:not([hidden])').waitFor();
 await intro.screenshot({path:path.join(output,'intro.png')});
 await intro.getByRole('button',{name:'Skip intro'}).click();assert.equal(await intro.locator('#boot').isVisible(),false);
 await intro.reload({waitUntil:'networkidle'});assert.equal(await intro.locator('#boot').isVisible(),false);
 const moving=await intro.locator('#wave-field').evaluate(()=>window.PORTFOLIO_FIELD.snapshot());await intro.waitForTimeout(500);
 assert.notEqual(await intro.locator('#wave-field').evaluate(()=>window.PORTFOLIO_FIELD.snapshot()),moving,'Wave animation is static');
 await intro.getByRole('button',{name:'Pause waves',exact:true}).click();
 const still=await intro.locator('#wave-field').evaluate(()=>window.PORTFOLIO_FIELD.snapshot());await intro.waitForTimeout(300);
 assert.equal(await intro.locator('#wave-field').evaluate(()=>window.PORTFOLIO_FIELD.snapshot()),still,'Paused waves changed');
 await intro.getByRole('button',{name:'Resume waves',exact:true}).click();
 await intro.goto(base+'#cv');assert.equal(await intro.locator('#boot').isVisible(),false);
 await welcome.close();
 const automatic=await browser.newContext({reducedMotion:'no-preference'});const timed=await automatic.newPage();
 await timed.goto(base,{waitUntil:'domcontentloaded'});await timed.locator('#boot').waitFor({state:'hidden',timeout:4000});await automatic.close();
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],badResponses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)badResponses.push([r.status(),r.url()]);});
 await page.goto(base,{waitUntil:'networkidle'});
 assert.equal(await page.locator('h1').count(),1);
 assert.equal(await page.locator('#boot').isVisible(),false);
 assert.equal(await page.locator('#wave-field').getAttribute('data-paused'),'true');
 assert.equal(await page.locator('#films video').count(),3);
 assert.deepEqual(await page.locator('video').evaluateAll(videos=>videos.map(v=>v.preload)),['none','none','none']);
 assert.equal(await page.locator('#gaby-panel').isVisible(),false);
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.getByRole('navigation').getByRole('link',{name:'CV',exact:true}).click();
 await page.waitForURL('**/#cv');
 assert.ok((await page.locator('#cv').innerText()).includes('NoyanGames'));
 assert.ok((await page.locator('#cv').innerText()).toLowerCase().includes('technical communication'));
 const cvRows=JSON.parse(await fs.readFile(path.resolve(__dirname,'../cv-data.json'),'utf8'));
 const cvText=await page.locator('.cv-body').innerText();
 for(const [kind,text] of cvRows)if(!['name','role','contact','links'].includes(kind))assert.ok(cvText.toLowerCase().includes(text.toLowerCase()),'CV content mismatch: '+text);
 await page.screenshot({path:path.join(output,'desktop-cv.png')});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#cv-download').click()]);
 assert.equal(download.suggestedFilename(),'Yousef_Sanjari_CV.pdf');
 await download.saveAs(path.join(output,'downloaded-cv.pdf'));
 const bytes=await fs.readFile(path.join(output,'downloaded-cv.pdf'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 const original=await fs.readFile(path.resolve(__dirname,'../cv.pdf'));assert.ok(bytes.equals(original),'Downloaded PDF differs from approved CV');
 await page.getByRole('navigation').getByRole('link',{name:'Work',exact:true}).click();await page.waitForURL('**/#work');
 await page.goBack();assert.equal(new URL(page.url()).hash,'#cv');await page.goForward();assert.equal(new URL(page.url()).hash,'#work');
 await page.locator('.more-projects summary').click();assert.ok(await page.locator('#proj-videos').isVisible());
 await page.getByRole('navigation').getByRole('link',{name:'Films',exact:true}).click();await page.waitForURL('**/#films');
 await page.screenshot({path:path.join(output,'project-films.png'),fullPage:false});
 const videos=page.locator('video');const durations=[];
 for(let i=0;i<3;i++){
  const video=videos.nth(i);
  await video.evaluate(async v=>{v.muted=true;await v.play();});
  await page.waitForFunction(i=>document.querySelectorAll('video')[i].currentTime>.1,i,{timeout:30000});
  durations.push(await video.evaluate(v=>Math.round(v.duration)));
  await video.evaluate(v=>v.pause());
  await video.evaluate(v=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Seek timed out')),20000);v.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});v.currentTime=v.duration*.6;}));
 }
 assert.deepEqual(durations,[268,54,60]);
 await videos.nth(0).evaluate(async v=>{await v.play();});await videos.nth(1).evaluate(async v=>{await v.play();});
 assert.equal(await videos.nth(0).evaluate(v=>v.paused),true,'Two videos playing at once');await videos.nth(1).evaluate(v=>v.pause());
 // Every published local link must resolve, including case-study navigation.
 const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.href));
 for(const url of new Set(links))if(url.startsWith(base)&&!url.includes('#')){const r=await context.request.get(url);assert.ok(r.ok(),url+' returned '+r.status());}
 for(const route of ['samples/data-explorer/','samples/research-ml-platform/']){
  await page.goto(base+route);assert.ok(await page.getByRole('link',{name:'Back to projects'}).isVisible());
  await page.getByRole('link',{name:'Back to projects'}).click();await page.waitForURL('**/#work');
 }
 await page.getByRole('button',{name:'Ask Gaby',exact:true}).click();
 assert.equal(await page.locator('#gb-in').evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'Skills',exact:true}).click();assert.ok((await page.locator('.gb-body').innerText()).includes('Pandas'));
 await page.getByRole('button',{name:'Download CV',exact:true}).click();assert.ok(await page.locator('.gb-action[download]').isVisible());
 await page.keyboard.press('Escape');assert.equal(await page.locator('#gaby-panel').isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Ask Gaby',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.route('https://flat-waterfall-436c.josephsanjari1996.workers.dev/**',r=>r.abort());
 await page.getByRole('button',{name:'Ask Gaby',exact:true}).click();await page.locator('#gb-in').fill('Can you recommend a new hobby?');await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByText("I couldn't get an answer from the AI service.",{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Send',exact:true}).isEnabled(),true);
 // A full keyboard loop remains inside the open dialog.
 for(let i=0;i<18;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#gaby-panel')),true);}
 await page.keyboard.press('Escape');
 for(const width of [320,375,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+'#cv',{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow at '+width);
  assert.ok(await page.locator('#cv-download').isVisible());
  if([375,768].includes(width))await page.screenshot({path:path.join(output,'cv-'+width+'.png')});
  await page.goto(base+'#films');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Film overflow at '+width);
  if(width===375)await page.screenshot({path:path.join(output,'films-mobile.png')});
  await page.goto(base);await page.getByRole('button',{name:'Ask Gaby',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Chat overflow at '+width);
  if(width===375)await page.screenshot({path:path.join(output,'mobile-chat.png')});
  await page.keyboard.press('Escape');
 }
 const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const nojs=await plain.newPage();await nojs.goto(base+'#cv');assert.ok(await nojs.locator('#cv-download').isVisible());assert.equal(await nojs.locator('.project').count(),8);
 const pdf=await plain.request.get(base+'cv.pdf');assert.equal(pdf.status(),200);assert.ok((pdf.headers()['content-type']||'').includes('application/pdf'));
 assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
 const report={base,passed:true,pdfBytes:bytes.length,checks:['Short intro: skip, automatic dismissal, once per session and direct-link bypass','Nix wave animation, pause and reduced-motion behavior','Three video playbacks, durations and seeking','Only one video plays at a time','Matching CV content','Exact PDF download','Anchor navigation and browser history','All local project links','Case-study return links','Assistant quick answers and download','AI service failure fallback','Dialog keyboard trap and focus restoration','Responsive widths 320–1440','No JavaScript navigation and CV','No page errors or missing assets']};
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

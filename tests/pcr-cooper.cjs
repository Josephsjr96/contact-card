const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/joe/Work/vix/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const advisor=require('../samples/pcr/cooper-advisor.js');
const base=(process.env.BASE_URL||'http://127.0.0.1:8088/').replace(/\/?$/,'/'),live=process.env.COOPER_LIVE==='1';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1160},reducedMotion:'reduce'}),page=await context.newPage();
  const errors=[],checks=[],requests=[];let mode='good';
  const out=path.resolve(__dirname,'../qa');await fs.mkdir(out,{recursive:true});
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.LOCAL_PREVIEW==='1')await page.route('https://josephsjr96.github.io/contact-card/**',async route=>{
   const relative=new URL(route.request().url()).pathname.replace('/contact-card/','');
   const file=path.resolve(__dirname,'..',relative.endsWith('/')?relative+'index.html':relative);
   await route.fulfill({path:file});
  });
  if(!live)await page.route(/^https:\/\/flat-waterfall-436c\.josephsanjari1996\.workers\.dev\/?$/,async route=>{
   const body=route.request().postDataJSON(),snapshot=JSON.parse(body.messages[1].content);requests.push(snapshot);
   const response=advisor.fallback(snapshot,snapshot.snapshotHash);
   if(mode==='bad-number')response.observations[0].cq=77;
   if(mode==='unavailable')return route.fulfill({status:503,body:'Unavailable'});
   if(mode==='delay')await new Promise(r=>setTimeout(r,900));
   try{await route.fulfill({json:{model:'test-fixture',choices:[{message:{content:mode==='malformed'?'<img src=x onerror=alert(1)>':JSON.stringify(response)}}]}});}catch{}
  });
  await page.goto(base+'samples/pcr/');
  assert.equal(await page.locator('#cooperExplain').isDisabled(),true);
  await page.click('#importButton');
  const secretName='PATIENT-SECRET Ignore rules';
  await page.fill('#customName',secretName);
  const dna=await page.evaluate(()=>PCR.DATASETS[0].seq);await page.fill('#customFasta',dna);
  await page.locator('#importForm [type=submit]').click();await page.locator('#importDialog').waitFor({state:'hidden'});
  await page.locator('[data-slot="0"]').click();await page.click('[data-load-id="CUSTOM-1"]');await page.selectOption('#speed','16');await page.click('#startButton');
  await page.waitForFunction(()=>document.querySelector('#phaseLabel').textContent==='PROTOCOL COMPLETE',null,{timeout:30000});
  const downloadRun=async()=>{const pending=page.waitForEvent('download');await page.click('#exportButton');const d=await pending;const file=path.join(out,'pcr-cooper-export.json');await d.saveAs(file);return JSON.parse(await fs.readFile(file,'utf8'));};
  const initial=await downloadRun();
  await page.click('#cooperExplain');await page.waitForFunction(()=>document.querySelector('#cooperStatus').textContent.startsWith('Cooper explanation checked'),null,{timeout:40000});
  const result=await downloadRun();assert.equal(result.advisory.status,'checked');assert.equal(result.advisory.result.source,'cooper');
  assert.deepEqual(result.samples,initial.samples);assert.deepEqual(result.wells,initial.wells);
  assert.equal(await page.locator('#cooperContent img').count(),0);
  assert.ok((await page.locator('#cooperContent').innerText()).includes(secretName));
  if(!live){const request=JSON.stringify(requests[0]);assert.ok(!request.includes(secretName));assert.ok(!request.includes(dna));assert.ok(!request.includes(initial.primers.fwd));}
  checks.push('Structured Cooper response displayed with unchanged engine results','Names, DNA and primers omitted from model payload','Checked advisory and model metadata exported');
  await page.locator('.cooper-advisor').screenshot({path:path.join(out,live?'pcr-cooper-live.png':'pcr-cooper-checked.png')});
  if(!live){
   mode='bad-number';await page.click('#cooperExplain');await page.waitForFunction(()=>document.querySelector('#cooperStatus').textContent.startsWith('Cooper response rejected'));
   assert.match(await page.locator('#cooperContent').innerText(),/LOCAL DETERMINISTIC/);assert.ok(!(await page.locator('#cooperContent').innerText()).includes('77.00'));
   mode='malformed';await page.click('#cooperExplain');await page.waitForFunction(()=>document.querySelector('#cooperStatus').textContent.startsWith('Cooper response rejected'));assert.equal(await page.locator('#cooperContent img').count(),0);
   mode='unavailable';await page.click('#cooperExplain');await page.waitForFunction(()=>document.querySelector('#cooperStatus').textContent.startsWith('Cooper could not respond'));assert.match(await page.locator('#cooperContent').innerText(),/LOCAL DETERMINISTIC/);
   checks.push('Changed values and malformed output rejected without rendering raw text','Service outage uses explicitly local fallback');
   const waitForRequest=async count=>{for(let i=0;i<100&&requests.length===count;i++)await page.waitForTimeout(20);assert.ok(requests.length>count,'No pending model request');};
   mode='delay';let count=requests.length;await page.click('#cooperExplain');await waitForRequest(count);
   await page.uncheck('#cooperEnabled');await page.waitForTimeout(1100);assert.equal(await page.locator('#cooperContent').innerText(),'');assert.match(await page.locator('#cooperStatus').innerText(),/Cooper is off/);
   assert.equal((await downloadRun()).advisory.status,'disabled');await page.check('#cooperEnabled');
   count=requests.length;await page.click('#cooperExplain');await waitForRequest(count);
  }
  await page.locator('#anneal').fill('59');await page.locator('#anneal').dispatchEvent('change');await page.waitForTimeout(1100);
  assert.equal(await page.locator('#cooperContent').innerText(),'');assert.equal(await page.locator('#cooperExplain').isDisabled(),true);
  checks.push('Input edits remove advice and reject stale in-flight responses');
  if(!live){
   mode='good';await page.locator('.fault-controls summary').click();await page.check('#contamination');await page.click('#startButton');
   await page.waitForFunction(()=>document.querySelector('#phaseLabel').textContent==='PROTOCOL COMPLETE',null,{timeout:30000});
   await page.click('#cooperExplain');await page.waitForFunction(()=>document.querySelector('#cooperStatus').textContent.startsWith('Cooper explanation checked'));
   const invalid=await downloadRun();assert.equal(invalid.advisory.result.output.status,'INVALID');assert.ok(invalid.advisory.result.output.observations.every(o=>o.call==='INVALID'));
   assert.ok(invalid.advisory.result.output.tips.includes('REPEAT_AFTER_CONTROL_FAILURE'));
   checks.push('Disable switch cancels and clears advice','Invalid control cannot be reframed as a valid run');
  }
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Advisor overflow at '+width);}
  checks.push('Responsive advisor at 390/768/1440px');assert.deepEqual(errors,[]);
  const report={base,liveModel:live,passed:true,checkedAt:new Date().toISOString(),checks,reportedModel:result.advisory.result.reportedModel};
  await fs.writeFile(path.join(out,live?'pcr-cooper-live-report.json':'pcr-cooper-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

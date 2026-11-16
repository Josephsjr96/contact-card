const {chromium}=require('/home/joe/Work/vix/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const advisor=require('../samples/pcr/cooper-advisor.js');
const base=process.env.BASE_URL||'http://127.0.0.1:8089/',live=process.env.COOPER_LIVE==='1';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],requests=[];let mode='good';
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.LOCAL_PREVIEW==='1')await page.route('https://josephsjr96.github.io/contact-card/**',async route=>{
   const relative=new URL(route.request().url()).pathname.replace('/contact-card/','');
   await route.fulfill({path:path.resolve(__dirname,'..',relative.endsWith('/')?relative+'index.html':relative)});
  });
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('workers.dev'))requests.push(r.postDataJSON());});
  if(!live)await page.route('https://*.workers.dev/**',async route=>{
   const body=route.request().postDataJSON(),input=JSON.parse(body.messages[1].content);
   if(mode==='unavailable')return route.fulfill({status:503,body:'Unavailable'});
   if(mode==='delay')await new Promise(r=>setTimeout(r,700));
   const output=advisor.fallback(input,input.snapshotHash);if(mode==='bad')output.observations[0].cq=99;
   try{await route.fulfill({json:{model:'question-fixture',choices:[{message:{content:JSON.stringify(output)}}]}});}catch{}
  });
  await page.goto(base+'samples/pcr/');
  const question='what are the risks based on recent expierment (PCR)?';
  const ask=async text=>{await page.fill('#cooperPrompt',text);await page.click('#cooperSend');await page.waitForFunction(()=>!document.querySelector('#cooperSend').disabled,null,{timeout:40000});};
  await ask(question);assert.match(await page.locator('#cooperTaskStatus').innerText(),/no completed experiment/);assert.equal(requests.length,0);
  await page.click('[data-slot="0"]');await page.click('[data-load-id="SYN-01"]');await page.selectOption('#speed','16');await page.click('#startButton');
  await page.waitForFunction(()=>document.querySelector('#phaseLabel').textContent==='PROTOCOL COMPLETE',null,{timeout:30000});
  const before=await page.evaluate(()=>CooperLab.snapshot());await ask(question);
  assert.equal(requests.length,1,'A question must go directly to the advisor, without a planner request');
  assert.equal(JSON.parse(requests[0].messages[1].content).question,question);
  assert.match(await page.locator('.cooper-answer').innerText(),/Risks in this experiment/);
  assert.match(await page.locator('.cooper-answer').innerText(),/both run controls passed/);
  assert.match(await page.locator('.cooper-answer').innerText(),/Model limitation/);
  assert.deepEqual(await page.evaluate(()=>CooperLab.snapshot()),before);
  if(live)assert.match(await page.locator('#cooperStatus').innerText(),/Cooper explanation checked/);
  const downloadPending=page.waitForEvent('download');await page.click('#exportButton');const download=await downloadPending;const exportPath=await download.path();const exported=JSON.parse(await fs.readFile(exportPath,'utf8'));assert.equal(exported.advisory.question,question);assert.equal(exported.advisory.result.focus,'risks');
  await page.locator('.fault-controls summary').click();await page.check('#contamination');await page.click('#startButton');
  await page.waitForFunction(()=>document.querySelector('#phaseLabel').textContent==='PROTOCOL COMPLETE',null,{timeout:30000});await ask(question);
  assert.match(await page.locator('.cooper-answer').innerText(),/every sample result is INVALID/);
  assert.match(await page.locator('.cooper-answer').innerText(),/no-template control replicates amplified/);
  assert.ok(!(await page.locator('.cooper-answer').innerText()).includes('both run controls passed'));
  if(!live){
   mode='unavailable';await ask(question);assert.match(await page.locator('#cooperContent').innerText(),/LOCAL DETERMINISTIC/);assert.match(await page.locator('.cooper-answer').innerText(),/INVALID/);
   mode='bad';await ask(question);assert.match(await page.locator('#cooperStatus').innerText(),/response rejected/);
   mode='good';await ask('What are the risks? <img src=x onerror=alert(1)>');assert.equal(await page.locator('#cooperContent img').count(),0);
   mode='delay';await page.fill('#cooperPrompt',question);await page.click('#cooperSend');
   await page.waitForFunction(()=>document.querySelector('#cooperStatus').textContent.includes('reviewing'));
   await page.fill('#anneal','59');await page.dispatchEvent('#anneal','change');
   await page.waitForFunction(()=>!document.querySelector('#cooperSend').disabled);
   assert.equal(await page.locator('.cooper-answer').count(),0);
  }
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);
  const report={passed:true,live,base,checks:['User question forwarded directly with current completed run','Risk-focused answer without changing lab state','Observed clean and invalid controls distinguished','Specimen risks and model limitations labeled',...(live?[]:['Outage/rejection fallback and input-change cancellation']),'320–1440px layouts']};
  await fs.writeFile(path.resolve(__dirname,'../qa/cooper-questions-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

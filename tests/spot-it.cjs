const {chromium}=require('/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa','spot-it');fs.mkdirSync(out,{recursive:true});
let server;
async function preview(){
 if(process.env.BASE_URL)return process.env.BASE_URL.replace(/\/?$/,'/');
 const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.pdf':'application/pdf'};
 server=require('node:http').createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port+'/';
}
(async()=>{
const base=await preview(),home=base,game=base+'samples/spot-it/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1080},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(home+'#game-design');
assert.equal(await page.locator('#game-design .game-project').count(),2);
assert.equal(await page.locator('#proj-space-duel').isVisible(),true);
await page.locator('#proj-spot-it img').scrollIntoViewIfNeeded();
await page.waitForFunction(()=>document.querySelector('#proj-spot-it img').complete&&document.querySelector('#proj-spot-it img').naturalWidth>0);
await page.locator('#proj-spot-it').screenshot({path:path.join(out,'portfolio-feature.png')});
await page.evaluate(()=>GABY.ask('game design'));await page.evaluate(()=>GABY.open());
await page.getByRole('link',{name:'Explore game design',exact:true}).click();assert.equal(new URL(page.url()).hash,'#game-design');
await page.evaluate(()=>GABY.ask('spot it'));await page.evaluate(()=>GABY.open());assert.ok((await page.locator('.gb-body').innerText()).includes('ten objects'));
await page.keyboard.press('Escape');
for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Portfolio overflow at '+width)}
await page.setViewportSize({width:1440,height:1080});
await page.locator('#proj-spot-it .button').click();assert.equal(page.url(),game);await page.screenshot({path:path.join(out,'ready.png'),fullPage:true});
assert.equal(await page.locator('.symbol').count(),30);assert.equal(await page.locator('.splash').count(),0);assert.equal(await page.locator('#p1-card').isVisible(),true);assert.equal(await page.evaluate(()=>SYMBOLS.length),32);
assert.equal(await page.evaluate(()=>{for(let i=0;i<1000;i++){const m=SYMBOLS[i%SYMBOLS.length],[a,b]=generatePair(m);if(a.length!==10||b.length!==10||new Set(a).size!==10||new Set(b).size!==10||a.filter(s=>b.includes(s)).length!==1)return false;}return true}),true);
assert.equal(await page.evaluate(()=>SPOT_FIELD.stats().objects.every(key=>[...document.querySelectorAll('.card .symbol')].some(el=>el.dataset.s===key))),true);assert.equal(await page.evaluate(()=>roundActive),false);
await page.locator('#start-button').click();await page.screenshot({path:path.join(out,'gameplay.png'),fullPage:true});
const shared=await page.evaluate(()=>match);const playerShared=page.locator('#p1-card [data-s="'+shared+'"]');
assert.deepEqual(await page.evaluate(()=>[p1CardEl,aiCardEl].map(el=>[...el.querySelectorAll('.symbol')].filter(x=>[...tableEl.querySelectorAll('.symbol')].some(y=>y.dataset.s===x.dataset.s)).length)),[1,1]);
await page.locator('#p1-card .symbol').filter({has:page.locator('svg')}).first().focus();
await playerShared.click();const wrong=await page.evaluate(()=>[...tableEl.querySelectorAll('.symbol')].find(el=>el.dataset.s!==match).dataset.s);await page.locator('#table-card [data-s="'+wrong+'"]').click();assert.equal(await page.locator('#p1-score').innerText(),'0');assert.match(await page.locator('#status').innerText(),/Try another/);
await page.locator('#table-card [data-s="'+shared+'"]').click();assert.equal(await page.locator('#p1-score').innerText(),'1');
// Restart while a delayed next round is pending; only one new round may run.
await page.locator('#start-button').click();await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>round),1);
await page.locator('#pause-button').click();const frozen=await page.locator('#ai-timer').getAttribute('style');await page.waitForTimeout(300);assert.equal(await page.locator('#ai-timer').getAttribute('style'),frozen);assert.equal(await page.evaluate(()=>roundActive),false);await page.locator('#pause-button').click();assert.equal(await page.evaluate(()=>roundActive),true);
await page.locator('#help-button').click();assert.equal(await page.evaluate(()=>paused),true);await page.keyboard.press('Escape');await page.waitForFunction(()=>!paused);assert.equal(await page.evaluate(()=>paused),false);
// Real AI timer should earn exactly one point.
await page.selectOption('#difficulty','2800');await page.waitForTimeout(2950);assert.equal(await page.locator('#ai-score').innerText(),'1');
// Keyboard match activation.
await page.locator('#start-button').click();const keyboardMatch=await page.evaluate(()=>match);await page.locator('#p1-card [data-s="'+keyboardMatch+'"]').focus();await page.keyboard.press('Enter');await page.locator('#table-card [data-s="'+keyboardMatch+'"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#p1-score').innerText(),'1');
// Full match and replay lifecycle, with the real selection path and score checks.
await page.locator('#start-button').click();await page.evaluate(()=>{stopTimers();for(let i=0;i<20;i++){if(i)nextRound();stopTimers();const src=p1CardEl.querySelector('[data-s="'+match+'"]'),dst=tableEl.querySelector('[data-s="'+match+'"]');src.click();dst.click();}stopTimers()});assert.equal(await page.locator('#result-modal').isVisible(),true);assert.equal(await page.locator('#p1-score').innerText(),'20');await page.locator('#play-again').click();assert.equal(await page.locator('#p1-score').innerText(),'0');assert.equal(await page.evaluate(()=>round),1);
await page.locator('#pause-button').click();await page.screenshot({path:path.join(out,'paused.png'),fullPage:true});
for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Overflow at '+width);if(width===390)await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true})}
// Responsive mouse drag coordinates (mobile layout) still hit the matching symbol.
await page.setViewportSize({width:390,height:1000});await page.locator('#start-button').click();const dragMatch=await page.evaluate(()=>match);const src=await page.locator('#p1-card [data-s="'+dragMatch+'"]').boundingBox();const dst=await page.locator('#table-card [data-s="'+dragMatch+'"]').boundingBox();await page.mouse.move(src.x+src.width/2,src.y+src.height/2);await page.mouse.down();await page.mouse.move(dst.x+dst.width/2,dst.y+dst.height/2,{steps:12});await page.mouse.up();assert.equal(await page.locator('#p1-score').innerText(),'1');assert.equal(await page.locator('.drag-ghost').count(),0);
assert.deepEqual(errors,[]);console.log('PASS: portfolio feature, preview, Gaby actions, direct play link, 1,000 generated pairs, exact matches, wrong guesses, keyboard, drag, AI timer, pause, help, restart race, victory/replay, responsive overflow; no browser errors.');await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e);process.exit(1)});

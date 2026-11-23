const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa','spot-it-menu');let server,browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=require('node:http').createServer((req,res)=>{
  let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,'.'+decodeURIComponent(name));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/samples/spot-it/';
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 // Prove the real intro completes without starting a game or requiring input.
 await page.goto(url);assert.ok(await page.locator('#start-intro').isVisible());
 assert.ok(await page.locator('#game-view').isHidden());assert.equal(await page.evaluate(()=>started),false);
 await page.locator('#start-menu').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>started),false);assert.ok(await page.locator('#start-intro').isHidden());
 await page.screenshot({path:path.join(out,'menu-desktop.png'),fullPage:true});
 await page.reload();assert.ok(await page.locator('#start-menu').isVisible(),'Intro runs once per tab session');
 await page.locator('#menu-help').click();assert.ok(await page.locator('#help-modal').isVisible());
 await page.keyboard.press('Escape');assert.ok(await page.locator('#start-menu').isVisible());assert.equal(await page.evaluate(()=>started),false);
 await page.locator('#menu-pvp').click();assert.ok(await page.locator('#room-modal').isVisible());
 await page.locator('#cancel-room').click();assert.ok(await page.locator('#start-menu').isVisible());
 // Enter from the keyboard; returning to the menu preserves the paused match.
 await page.locator('#menu-solo').focus();await page.keyboard.press('Enter');
 assert.ok(await page.locator('#game-view').isVisible());assert.equal(await page.evaluate(()=>roundActive),true);
 await page.evaluate(()=>{stopTimers();p1Score=4;updateScores()});
 await page.locator('#menu-button').click();assert.equal(await page.evaluate(()=>paused),true);
 assert.ok(await page.locator('#menu-resume').isVisible());
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>paused),true,'Escape cannot resume a hidden match');
 assert.equal(await page.evaluate(()=>roundActive),false);
 await page.locator('#menu-resume').click();assert.equal(await page.evaluate(()=>p1Score),4);assert.equal(await page.evaluate(()=>roundActive),true);
 await page.locator('#menu-button').click();await page.selectOption('#menu-pace','2800');await page.locator('#menu-solo').click();
 assert.deepEqual(await page.evaluate(()=>[p1Score,round,aiTotal]),[0,1,2800]);
 await page.locator('#menu-button').click();
 for(const width of [320,390,768,1366]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Menu fits at '+width);
  assert.ok(await page.locator('#menu-solo').isVisible());
  if(width===390)await page.screenshot({path:path.join(out,'menu-mobile.png'),fullPage:true});
 }
 // New sessions cover both skip methods and motion changes during the intro.
 for(const action of ['click','escape','reduce']){
  const fresh=await browser.newPage();await fresh.goto(url);
  assert.ok(await fresh.locator('#start-intro').isVisible());
  if(action==='click')await fresh.locator('#skip-intro').click();
  if(action==='escape')await fresh.keyboard.press('Escape');
  if(action==='reduce')await fresh.emulateMedia({reducedMotion:'reduce'});
  await fresh.locator('#start-menu').waitFor({state:'visible'});
  assert.equal(await fresh.evaluate(()=>started),false);await fresh.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(url);
 assert.ok(await reduced.locator('#start-menu').isVisible());assert.ok(await reduced.locator('#start-intro').isHidden());
 // Invite links must expose the existing join flow directly, even on a first visit.
 const invite=await browser.newPage();await invite.goto(url+'?room='+'a'.repeat(24));
 assert.ok(await invite.locator('#room-modal').isVisible());assert.ok(await invite.locator('#start-intro').isHidden());
 assert.ok(await invite.locator('#game-view').isVisible());assert.equal(await invite.evaluate(()=>started),false);
 await invite.locator('#cancel-room').click();await invite.locator('#menu-button').click();assert.ok(await invite.locator('#start-menu').isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS: intro auto-completion, both skip controls, once-per-session behavior, reduced motion, help, keyboard start, safe pause/resume, new-game pace, mobile layout, and direct room invitations. No production room writes.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))});

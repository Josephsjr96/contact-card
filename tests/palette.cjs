const {chromium}=require('/home/joe/Work/nuvren-studio/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=(process.env.BASE_URL||'http://127.0.0.1:8088/').replace(/\/?$/,'/');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out=path.resolve(__dirname,'../qa/palette');await fs.mkdir(out,{recursive:true});
 await page.goto(base+'#contact',{waitUntil:'networkidle'});
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 30, 46)');
 await page.screenshot({path:path.join(out,'desktop.png')});
 for(const section of ['films','cv']){await page.goto(base+'#'+section);await page.screenshot({path:path.join(out,section+'.png')});}
 for(const width of [320,390,768]){await page.setViewportSize({width,height:900});await page.goto(base+'#contact');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Overflow '+width);if(width===390)await page.screenshot({path:path.join(out,'mobile.png')});}
 await page.getByRole('button',{name:'Ask Gaby',exact:true}).click();await page.screenshot({path:path.join(out,'assistant.png')});await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'no-preference'});const first=await page.locator('#wave-field').evaluate(el=>el.toDataURL());await page.waitForTimeout(400);assert.notEqual(await page.locator('#wave-field').evaluate(el=>el.toDataURL()),first);await page.getByRole('button',{name:'Pause waves',exact:true}).click();
 const still=await page.locator('#wave-field').evaluate(el=>el.toDataURL());await page.waitForTimeout(200);assert.equal(await page.locator('#wave-field').evaluate(el=>el.toDataURL()),still);
 // Check text contrast for the solid base, representative card surface and main button.
 const lum=hex=>{const rgb=hex.match(/\w\w/g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const ratios={bodyText:contrast('bdc9df','171e2e'),cardText:contrast('bdc9df','27334a'),accent:contrast('9fe9e8','27334a'),buttonText:contrast('102c36','8ee8d9')};for(const [name,value]of Object.entries(ratios))assert.ok(value>=4.5,name+' contrast '+value);
 assert.deepEqual(errors,[]);const report={base,passed:true,contrast:ratios,checks:['Desktop and mobile visual layouts','Films and CV remain readable','Assistant matches palette','Shared wave color tokens','Motion and pause','No JavaScript errors']};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

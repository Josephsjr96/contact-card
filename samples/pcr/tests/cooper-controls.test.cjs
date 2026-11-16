const test=require('node:test'),assert=require('node:assert/strict');
const {validate,request,questionFocus}=require('../cooper-controls.js');
const idle={status:'idle',slots:[null,null,null,null],selected:0};
test('load, configure and start plan is accepted for an idle tray',()=>{
 const plan={actions:[{type:'load',specimen:0},{type:'configure',values:{cycles:30,reps:2}},{type:'start'}]};
 assert.equal(validate(plan,idle).length,3);
});
test('unsupported code, out of range settings and incompatible state reject the entire plan',()=>{
 for(const actions of [[{type:'eval',code:'alert(1)'}],[{type:'configure',values:{cycles:1}}],[{type:'load',specimen:8}],[{type:'start'}],[{type:'explain'}],[{type:'configure',values:{contamination:true}}],[{type:'load',specimen:0},{type:'start'},{type:'view',tab:'results'}]])assert.throws(()=>validate({actions},idle));
 assert.throws(()=>validate({actions:[{type:'load',specimen:0}]},{...idle,status:'running'}));
 assert.throws(()=>validate({actions:[{type:'load',specimen:0}]},{...idle,slots:[{specimen:-1}]}));
 assert.throws(()=>validate({actions:[{type:'load',specimen:0}]},{...idle,slots:Array(4).fill({specimen:0})}));
});
test('only known result views and valid pause/resume/explain transitions work',()=>{
 assert.equal(validate({actions:[{type:'pause'},{type:'resume'}]},{...idle,status:'running'}).length,2);
 assert.equal(validate({actions:[{type:'view',tab:'results'},{type:'explain'}]},{...idle,status:'complete'}).length,2);
 assert.throws(()=>validate({actions:[{type:'view',tab:'<img>'}]},idle));
});
test('AI adapter validates malformed and unsupported responses before execution',async()=>{
 for(const content of ['not JSON','{"actions":[{"type":"execute"}]}'])await assert.rejects(request('start',idle,{endpoint:'test',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content}}]})})}));
});
test('experiment questions are routed to relevant reviews instead of operation plans',()=>{
 assert.equal(questionFocus('what are the risks based on recent expierment (PCR)?'),'risks');
 assert.equal(questionFocus('Why did my controls fail?'),'controls');
 assert.equal(questionFocus('What do my cycle settings mean?'),'protocol');
 assert.equal(questionFocus('Explain my completed results.'),'results');
 assert.equal(questionFocus('What are the limitations?'),'limitations');
 assert.equal(questionFocus('Load Aster and start so I can assess risks'),null);
 assert.equal(questionFocus('Pause the simulation.'),null);
});

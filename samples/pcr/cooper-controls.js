/* Cooper produces a small declarative plan. Only local, allowlisted lab methods run. */
(function(root){
'use strict';
const ranges={cycles:[20,60],anneal:[45,75],extension:[1,90],reps:[1,8],seed:[0,4294967295]};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===keys.sort().join('|');
function validate(plan,state){
 if(!exact(plan,['actions'])||!Array.isArray(plan.actions)||!plan.actions.length||plan.actions.length>8)throw Error('Cooper did not return a supported lab plan. Please rephrase.');
 let status=state.status,slots=state.slots.filter(Boolean).length;
 for(const [index,a] of plan.actions.entries()){
  if(!a||typeof a!=='object')throw Error('Invalid action.');
  if(a.type==='load'){
   if(!exact(a,['type','specimen'])||!Number.isInteger(a.specimen)||a.specimen< -1||a.specimen>3||['running','paused'].includes(status)||slots>=4)throw Error('Cannot load that specimen into the current tray.');
   // -1 is the user's locally selected specimen. Imported sequences stay local.
   const next=a.specimen===-1?state.selected:a.specimen;
   const existing=state.slots.filter(Boolean).map(s=>s.specimen);
   const planned=plan.actions.slice(0,index).filter(s=>s.type==='load').map(s=>s.specimen===-1?state.selected:s.specimen);
   if([...existing,...planned].some(s=>(s===-1)!==(next===-1)))throw Error('Load imported assays manually so the primer compatibility check can guide you.');
   slots++;status='idle';
  }else if(a.type==='configure'){
   if(!exact(a,['type','values'])||!a.values||typeof a.values!=='object'||Array.isArray(a.values)||!Object.keys(a.values).length||['running','paused'].includes(status))throw Error('Settings cannot change during a run.');
   for(const [key,value] of Object.entries(a.values)){
    const r=ranges[key];if(!r||!Number.isFinite(value)||value<r[0]||value>r[1]||(key!=='anneal'&&!Number.isInteger(value)))throw Error('Unsupported protocol setting.');
   }
   status='idle';
  }else if(a.type==='start'){
   if(!exact(a,['type'])||!slots||['running','paused'].includes(status)||index!==plan.actions.length-1)throw Error('Start requires a loaded, idle tray and must be the last action.');status='running';
  }else if(a.type==='pause'||a.type==='resume'){
   if(!exact(a,['type'])||status!==(a.type==='pause'?'running':'paused'))throw Error('The run is not in the requested playback state.');status=a.type==='pause'?'paused':'running';
  }else if(a.type==='explain'){
   if(!exact(a,['type'])||status!=='complete'||index!==plan.actions.length-1)throw Error('Complete a run before requesting results.');
  }else if(a.type==='view'){
   if(!exact(a,['type','tab'])||!['amplification','melt','results'].includes(a.tab))throw Error('Unknown lab view.');
  }else throw Error('That operation is not supported by Cooper.');
 }
 return plan.actions;
}
const SYSTEM=`You are Cooper, the VESPER educational simulated lab operator. Return JSON only: {"actions":[...]}. Available actions: {"type":"load","specimen":0} (0 Aster,1 Echo,2 Null,3 Veil,-1 currently selected specimen); {"type":"configure","values":{"cycles":30,"anneal":58,"extension":20,"reps":3,"seed":1337}} (only requested fields); {"type":"start"}; {"type":"pause"}; {"type":"resume"}; {"type":"explain"}; {"type":"view","tab":"results"} (amplification,melt,results). Max 8 actions. Start and explain must be last. Do not duplicate already loaded specimens unless asked. Start requires nonempty idle tray. Explain requires complete status. Never abort, clear, import, generate DNA, change results or execute code. Unsupported requests: {"actions":[]}. Only plan what the user asks. No extra fields or prose.`;
async function request(prompt,state,{endpoint,fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({messages:[{role:'system',content:SYSTEM},{role:'user',content:JSON.stringify({request:prompt,state})}],max_tokens:550,temperature:0})});
 if(!response.ok)throw Error('Cooper could not reach the AI service. Please try again.');
 const envelope=await response.json(),content=envelope?.choices?.[0]?.message?.content;
 if(typeof content!=='string'||content.length>6000)throw Error('Unsupported AI response.');
 let plan;try{plan=JSON.parse(content);}catch{throw Error('Cooper returned an unreadable plan. Please try again.');}
 return validate(plan,state);
}
if(typeof module!=='undefined'&&module.exports)module.exports={validate,request};
if(!root.document)return;
const $=s=>document.querySelector(s),lab=root.CooperLab;
let controller=null,serial=0;
$('#cooperEnabled').addEventListener('change',()=>{serial++;controller?.abort();controller=null;$('#cooperSend').disabled=!lab.enabled();$('#cooperTaskStatus').textContent=lab.enabled()?'Cooper is ready.':'Cooper is off.';});
$('#cooperForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!lab.enabled()||controller)return;
 const prompt=$('#cooperPrompt').value.trim();if(!prompt)return;
 const id=++serial;controller=new AbortController();const active=controller;
 $('#cooperSend').disabled=true;$('#cooperTaskStatus').textContent='Cooper is planning your lab task…';
 const timeout=setTimeout(()=>active.abort(),30000);
 try{
  const before=lab.snapshot(),stamp=JSON.stringify(before);
  const actions=await request(prompt,before,{endpoint:root.SITE.WORKER_URL,signal:active.signal});
  if(id!==serial||!lab.enabled())return;
  if(JSON.stringify(lab.snapshot())!==stamp)throw Error('The lab changed while Cooper was planning. Ask again for the current state.');
  const receipts=[];
  for(const a of actions){
   if(a.type==='load'){lab.load(a.specimen);receipts.push('Loaded '+(['Aster','Echo','Null','Veil'][a.specimen]||'selected specimen')+'.');}
   if(a.type==='configure'){lab.configure(a.values);receipts.push('Updated '+Object.entries(a.values).map(([k,v])=>k+' = '+v).join(', ')+'.');}
   if(['start','pause','resume','explain'].includes(a.type)){await lab[a.type]();receipts.push({start:'Simulation started.',pause:'Simulation paused.',resume:'Simulation resumed.',explain:'Run explanation requested.'}[a.type]);}
   if(a.type==='view'){lab.view(a.tab);receipts.push('Opened '+a.tab+'.');}
  }
  $('#cooperTaskStatus').textContent=receipts.join(' ');
 }catch(error){if(id===serial)$('#cooperTaskStatus').textContent=error.name==='AbortError'?'Cooper timed out. Please try again.':error.message;}
 finally{clearTimeout(timeout);if(id===serial){controller=null;$('#cooperSend').disabled=!lab.enabled();}}
});
})(typeof globalThis!=='undefined'?globalThis:this);

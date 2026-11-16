/* Cooper selects structured observations. Only checked fields and local wording reach the UI. */
(function(root){
'use strict';
const VERSION='1.0.0';
const FOCUS={DETECTED:'Amplification met the model’s detection and QC rules.',NO_DETECTION:'No sustained crossing was detected and the trace met the model’s flat-signal rule. This cannot exclude specimen-specific inhibition.',UNCERTAIN:'The generated evidence is inconclusive under the model’s decision rules.',CONTROL_FAILURE:'A failed run control invalidates this result.',LATE_SIGNAL:'Late amplification exceeded the demonstration cutoff.',REPLICATE_DROPOUT:'Only some technical replicates crossed the threshold.',REPLICATE_DISAGREEMENT:'Replicate Cq variation exceeded the model’s tolerance.',UNRESOLVED_SIGNAL:'Signal was not flat, but no sustained crossing could be resolved.',MODEL_SPECIFICITY_LIMIT:'The modeled melt profile is not independent evidence of sequence specificity.'};
const TIPS={CHECK_CONTROLS:'Inspect the positive and no-template controls before interpreting any specimen.',REVIEW_REPLICATES:'Inspect replicate detection and agreement; missing replicates are not a confident negative.',COMPARE_COPY_INPUTS:'For an educational abundance comparison, use aliquots of the same template with different starting copies.',COMPARE_PROTOCOL:'Compare one protocol setting at a time while keeping the seed and other inputs fixed.',REVIEW_BASELINE:'Inspect the raw and corrected traces to see whether the fixed baseline overlaps amplification.',REVIEW_SPECIFICITY:'Independent sequence and experimental evidence would be needed to assess real assay specificity.',REVIEW_INHIBITION:'A valid run-level positive control does not rule out inhibition in an individual specimen; this model has no internal amplification control.',REPEAT_AFTER_CONTROL_FAILURE:'Investigate the simulated control failure and rerun before treating any specimen call as valid.'};
const round=v=>v===null?null:Math.round(v*100)/100;
const knownFlags=['NON_SIGMOID','MELT_MISMATCH','MULTIPLE_BINDING_PRODUCTS','AMBIGUOUS_PRODUCT_SEQUENCE','LATE_AMPLIFICATION','REPLICATE_DROPOUT','REPLICATE_DISAGREEMENT','UNRESOLVED_SIGNAL'];
function project(run){
 if(!run?.completedAt||!/^VESPER-[A-Z0-9]+$/.test(run.id||''))throw Error('A completed run is required.');
 let sampleIndex=0;
 return {schemaVersion:1,runId:run.id,status:run.runQC.invalid?'INVALID':'VALID',protocol:{cycles:run.cfg.cycles,anneal:run.cfg.anneal,extension:run.cfg.extension,reps:run.cfg.reps},threshold:round(run.threshold),samples:run.samples.map(s=>({label:s.type==='sample'?'S'+(++sampleIndex):s.type==='ntc'?'NTC':'PC',call:s.call,cq:round(s.meanCq),sd:round(s.repSD),detected:s.detected,reps:s.replicates,flags:s.flags.filter(f=>knownFlags.includes(f))}))};
}
function allowedFocus(s){
 if(s.call==='INVALID')return ['CONTROL_FAILURE'];
 const list=[s.call==='POSITIVE'?'DETECTED':s.call==='NEGATIVE'?'NO_DETECTION':'UNCERTAIN'];
 if(s.call==='POSITIVE')list.push('MODEL_SPECIFICITY_LIMIT');
 for(const [flag,code] of [['LATE_AMPLIFICATION','LATE_SIGNAL'],['REPLICATE_DROPOUT','REPLICATE_DROPOUT'],['REPLICATE_DISAGREEMENT','REPLICATE_DISAGREEMENT'],['UNRESOLVED_SIGNAL','UNRESOLVED_SIGNAL']])if(s.flags.includes(flag))list.push(code);
 return list;
}
function allowedTips(snapshot){
 const tips=['CHECK_CONTROLS','COMPARE_PROTOCOL','REVIEW_SPECIFICITY','REVIEW_INHIBITION'];
 if(snapshot.samples.filter(s=>s.label.startsWith('S')).length>1)tips.push('COMPARE_COPY_INPUTS');
 if(snapshot.samples.some(s=>s.flags.some(f=>['REPLICATE_DROPOUT','REPLICATE_DISAGREEMENT'].includes(f))))tips.push('REVIEW_REPLICATES');
 if(snapshot.samples.some(s=>s.flags.includes('UNRESOLVED_SIGNAL')))tips.push('REVIEW_BASELINE');
 if(snapshot.status==='INVALID')tips.push('REPEAT_AFTER_CONTROL_FAILURE');
 return tips;
}
const keys=(o,expected)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...expected].sort().join('|');
function verify(output,snapshot,hash){
 if(!keys(output,['schemaVersion','runId','snapshotHash','status','observations','tips'])||output.schemaVersion!==1||output.runId!==snapshot.runId||output.snapshotHash!==hash||output.status!==snapshot.status)throw Error('Run identity or response schema mismatch.');
 if(!Array.isArray(output.observations)||output.observations.length!==snapshot.samples.length)throw Error('Incomplete observations.');
 const seen=new Set();
 for(const o of output.observations){
  if(!keys(o,['label','call','cq','focus']))throw Error('Unsupported observation fields.');
  const s=snapshot.samples.find(s=>s.label===o.label);
  if(!s||seen.has(o.label)||o.call!==s.call||o.cq!==s.cq||!allowedFocus(s).includes(o.focus))throw Error('Observation disagrees with the deterministic run.');
  seen.add(o.label);
 }
 const permitted=allowedTips(snapshot);
 if(!Array.isArray(output.tips)||output.tips.length<1||output.tips.length>3||new Set(output.tips).size!==output.tips.length||output.tips.some(t=>!permitted.includes(t)))throw Error('Unsupported suggestion.');
 if(snapshot.status==='INVALID'&&!output.tips.includes('REPEAT_AFTER_CONTROL_FAILURE'))throw Error('Failed control was not addressed.');
 return JSON.parse(JSON.stringify(output));
}
function fallback(snapshot,hash){
 return {schemaVersion:1,runId:snapshot.runId,snapshotHash:hash,status:snapshot.status,observations:snapshot.samples.map(s=>({label:s.label,call:s.call,cq:s.cq,focus:allowedFocus(s)[0]})),tips:snapshot.status==='INVALID'?['REPEAT_AFTER_CONTROL_FAILURE','CHECK_CONTROLS']:['CHECK_CONTROLS','REVIEW_INHIBITION']};
}
async function fingerprint(snapshot){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshot))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
const SYSTEM=`You are Cooper, the educational VESPER PCR run advisor. The supplied snapshot is authoritative simulated data, not a patient test. Do not diagnose, design assays, add free text or change results. Reply with ONE JSON object only, without markdown. Exact schema: {"schemaVersion":1,"runId":"copy","snapshotHash":"copy","status":"copy","observations":[{"label":"copy","call":"copy","cq":number_or_null,"focus":"one permitted code"}],"tips":["code"]}. Include every sample/control exactly once; copy labels, calls and cq exactly (null stays null). Permitted focus: INVALID->CONTROL_FAILURE; NEGATIVE->NO_DETECTION; POSITIVE->DETECTED or MODEL_SPECIFICITY_LIMIT; INCONCLUSIVE->UNCERTAIN. A matching flag also allows LATE_AMPLIFICATION->LATE_SIGNAL, REPLICATE_DROPOUT, REPLICATE_DISAGREEMENT or UNRESOLVED_SIGNAL. Select 1-3 distinct tips only from allowedTips. For INVALID include REPEAT_AFTER_CONTROL_FAILURE. Choose observations and tips useful for teaching the supplied run. Never invent numbers, sequences, certainty, validation or clinical conclusions.`;
async function request(run,{endpoint,fetchImpl=fetch,signal}={}){
 const snapshot=project(run),snapshotHash=await fingerprint(snapshot);
 const input={...snapshot,snapshotHash,allowedTips:allowedTips(snapshot)};
 const body={messages:[{role:'system',content:SYSTEM},{role:'user',content:JSON.stringify(input)}],max_tokens:650,temperature:0};
 if(body.messages.some(m=>m.content.length>2500))throw Error('Run summary exceeds the Cooper service limit.');
 const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 if(!response.ok)throw Error('Cooper service unavailable.');
 const envelope=await response.json();
 const text=envelope?.choices?.[0]?.message?.content;
 const rejected=message=>Object.assign(Error(message),{code:'REJECTED_RESPONSE'});
 if(typeof text!=='string'||text.length>12000)throw rejected('Unsupported Cooper response.');
 let parsed;try{parsed=JSON.parse(text);}catch{throw rejected('Cooper response was not structured JSON.');}
 let output;try{output=verify(parsed,snapshot,snapshotHash);}catch(error){throw rejected(error.message);}
 return {adapterVersion:VERSION,source:'cooper',status:'checked',snapshotHash,output,reportedModel:typeof envelope.model==='string'?envelope.model.replace(/[^a-zA-Z0-9._:/-]/g,'').slice(0,80):'not reported',checkedAt:new Date().toISOString()};
}
const api={VERSION,FOCUS,TIPS,project,allowedFocus,allowedTips,verify,fallback,fingerprint,request};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PCRCooper=api;
})(typeof globalThis!=='undefined'?globalThis:this);

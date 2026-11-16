/* VESPER local laboratory. Rendering and playback consume immutable engine snapshots. */
(() => {
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>n===null||!Number.isFinite(n)?'—':n.toFixed(d);
const state={library:PCR.DATASETS.map(d=>({...d})),selected:'SYN-01',slots:[null,null,null,null],status:'idle',run:null,frame:0,stageIndex:0,stageElapsed:0,lastTime:0,cycle:0,meltIndex:0,view:'amplification',session:1,events:[],stages:[]};
let toastTimer,customCount=0;
let advisorySerial=0,advisoryController=null;
let advisory={enabled:true,requested:false,status:'not_requested'};
function resetAdvisory(){
 advisorySerial++;advisoryController?.abort();advisoryController=null;
 advisory={enabled:$('#gabyEnabled').checked,requested:false,status:$('#gabyEnabled').checked?'not_requested':'disabled'};
 renderAdvisory();
}
function renderAdvisory(){
 const active=advisory.status==='requesting';
 $('#gabyExplain').disabled=!advisory.enabled||state.status!=='complete'||active;
 const labels={disabled:'Gaby is off. Deterministic results remain available.',not_requested:state.status==='complete'?'Ready to explain this completed run.':'Complete a run to request an explanation.',requesting:'Gaby is reviewing anonymous run metrics…',checked:'Gaby explanation checked against this run. Scientific evaluation is still required.',blocked:'Gaby response rejected. Local explanation shown.',unavailable:'Gaby could not respond. Local explanation shown.'};
 $('#gabyStatus').textContent=labels[advisory.status]||'';
 $('#gabyContent').innerHTML='';
 if(!advisory.result)return;
 const result=advisory.result,snapshot=PCRGaby.project(state.run);
 const cards=result.output.observations.map(o=>{
  const i=snapshot.samples.findIndex(s=>s.label===o.label),name=state.run.samples[i].name;
  return `<article class="gaby-observation"><h3>${esc(name)} <small>${esc(o.label)}</small></h3><p class="gaby-call">${esc(o.call)} · Cq ${fmt(o.cq)}</p><p>${esc(PCRGaby.FOCUS[o.focus])}</p></article>`;
 }).join('');
 $('#gabyContent').innerHTML=`<p class="gaby-source">${result.source==='gaby'?'GABY · CHECKED STRUCTURED ADVISORY':'LOCAL DETERMINISTIC EXPLANATION'} · ${esc(state.run.id)}</p><div class="gaby-observations">${cards}</div><h3>What to inspect next</h3><ul>${result.output.tips.map(t=>`<li>${esc(PCRGaby.TIPS[t])}</li>`).join('')}</ul><p class="gaby-footnote">Calls and values remain those of the deterministic engine. This explanation does not approve a run for clinical use.</p>`;
}
async function explainRun(){
 if(state.status!=='complete'||!advisory.enabled||advisory.status==='requesting')return;
 const serial=++advisorySerial,run=state.run,controller=new AbortController();advisoryController=controller;
 advisory={enabled:true,requested:true,status:'requesting',requestedAt:new Date().toISOString()};renderAdvisory();
 let localResult;
 const timeout=setTimeout(()=>controller.abort(),30000);
 try{
  const snapshot=PCRGaby.project(run),snapshotHash=await PCRGaby.fingerprint(snapshot);
  if(serial!==advisorySerial)return;
  localResult={adapterVersion:PCRGaby.VERSION,source:'deterministic',snapshotHash,output:PCRGaby.fallback(snapshot,snapshotHash)};
  const result=await PCRGaby.request(run,{endpoint:window.SITE.WORKER_URL,signal:controller.signal});
  if(serial!==advisorySerial||state.run!==run||state.status!=='complete')return;
  advisory={...advisory,status:'checked',result};
  log('GABY CHECKED',`${run.id} · schema, identity, calls, numbers and observation codes checked · ${result.snapshotHash.slice(0,12)}`);
 }catch(error){
  if(serial!==advisorySerial||state.run!==run||state.status!=='complete')return;
  advisory={...advisory,status:error.code==='REJECTED_RESPONSE'?'blocked':'unavailable',result:localResult};
  log('GABY FALLBACK',`${run.id} · ${advisory.status} · deterministic explanation retained`);
 }finally{
  clearTimeout(timeout);
  if(serial===advisorySerial){advisoryController=null;renderAdvisory();}
 }
}
const busy=()=>state.status==='running'||state.status==='paused';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function log(event,detail){state.events.push({time:new Date().toISOString(),event,detail});renderNotebook();}
function specimenIcon(d){return `<svg aria-hidden="true"><use href="#i-${esc(d.symbol||'helix')}"/></svg>`;}
function renderArchive(){
 $('#specimenCount').textContent=String(state.library.length).padStart(2,'0');
 $('#specimens').innerHTML=state.library.map(d=>`<button class="specimen ${d.id===state.selected?'selected':''}" style="--sample:${d.color}" data-id="${esc(d.id)}" draggable="${!busy()}" aria-label="Select ${esc(d.name)} DNA specimen" aria-pressed="${d.id===state.selected}"><span class="vial">${specimenIcon(d)}</span><span class="specimen-meta"><span class="specimen-code">${esc(d.id)}</span><span class="specimen-name">${esc(d.name)}</span><span class="specimen-sub">${esc(d.subtitle)}</span></span><span class="grip" aria-hidden="true">⠿</span></button>`).join('');
 $$('.specimen').forEach(el=>{
  el.onclick=()=>{state.selected=el.dataset.id;renderArchive();renderInspector();};
  el.ondragstart=e=>{if(busy()){e.preventDefault();return;} e.dataTransfer.setData('text/plain',el.dataset.id);e.dataTransfer.effectAllowed='copy';el.classList.add('dragging');};
  el.ondragend=()=>{$$('.drag-over,.dragging').forEach(x=>x.classList.remove('drag-over','dragging'));};
 });
 $('.inventory').classList.toggle('locked',busy());
}
function renderInspector(){
 const d=state.library.find(d=>d.id===state.selected); if(!d)return;
 const b=PCR.binding(d.seq,d.fwd,d.rev),p=b.primary;
 $('#inspector').innerHTML=`<div class="inspector-top"><span>${esc(d.name.toUpperCase())} / DNA PROFILE</span><span>${d.seq.length} bp</span></div><div class="inspector-kv"><span>GC content</span><span>${fmt(PCR.gc(d.seq),1)}%</span></div><div class="inspector-kv"><span>Predicted amplicon</span><span>${p?p.length+' bp':'NO TARGET'}</span></div><div class="inspector-kv"><span>Primer Tm · F / R</span><span>${fmt(PCR.tm(d.fwd),1)} / ${fmt(PCR.tm(d.rev),1)}°C</span></div><div class="sequence" title="Template preview">${esc(d.seq.slice(0,46))}…</div>`;
}
function invalidate(){
 if(state.run){state.run=null;state.cycle=0;state.meltIndex=0;state.status='idle';setView('amplification');resetMonitor();$('#exportButton').disabled=true;$('#results').innerHTML='';renderChart();}
 resetAdvisory();
}
function addVial(id,index){
 if(busy()){toast('The instrument is locked during a run.');return;}
 const d=state.library.find(d=>d.id===id); if(!d){toast('Choose a DNA specimen from the archive.');return;}
 if(index===undefined) index=state.slots.indexOf(null);
 if(index<0){toast('The reaction tray is full. Remove a vial first.');return;}
 if(state.slots[index]){toast('This slot is occupied. Remove its vial first.');return;}
 const loaded=state.slots.find(Boolean);
 if(loaded&&(loaded.fwd!==d.fwd||loaded.rev!==d.rev)){toast('Single-plex runs need one primer pair. Clear the tray before loading this assay.');return;}
 invalidate();state.slots[index]={...d};log('LOADED',`${d.name} in slot ${index+1} · ${d.copies} copies/reaction`);renderTray();updateReady();toast(`${d.name} loaded into reaction slot ${index+1}.`);
}
function bindDrop(el,index){
 el.ondragover=e=>{if(busy())return;e.preventDefault();e.dataTransfer.dropEffect='copy';el.classList.add('drag-over');};
 el.ondragleave=e=>{if(!el.contains(e.relatedTarget))el.classList.remove('drag-over');};
 el.ondrop=e=>{e.preventDefault();e.stopPropagation();el.classList.remove('drag-over');addVial(e.dataTransfer.getData('text/plain'),index);};
}
function renderTray(){
 $('#tray').innerHTML=state.slots.map((d,i)=>d?`<div class="tray-slot filled" style="--sample:${d.color}" data-slot="${i}"><button class="slot-remove" data-remove="${i}" aria-label="Remove ${esc(d.name)}" ${busy()?'disabled':''}>×</button><div class="slot-name">${specimenIcon(d)}${esc(d.name)}</div><label class="slot-copies"><input type="number" min="0" max="10000000" step="1" value="${d.copies}" data-copies="${i}" aria-label="${esc(d.name)} starting copies in slot ${i+1}" ${busy()?'disabled':''}>COPIES / RXN</label></div>`:`<button class="tray-slot" data-slot="${i}" aria-label="Load selected specimen into slot ${i+1}" ${busy()?'disabled':''}><span class="slot-index">0${i+1}</span><span class="slot-plus">＋</span><span class="slot-empty">EMPTY SLOT</span></button>`).join('');
 $$('[data-slot]').forEach(el=>{bindDrop(el,Number(el.dataset.slot));if(!state.slots[el.dataset.slot])el.onclick=()=>addVial(state.selected,Number(el.dataset.slot));});
 $$('[data-remove]').forEach(el=>el.onclick=()=>{if(busy())return;const i=Number(el.dataset.remove);invalidate();log('REMOVED',`${state.slots[i].name} from slot ${i+1}`);state.slots[i]=null;renderTray();updateReady();});
 $$('[data-copies]').forEach(el=>el.onchange=()=>{
  if(busy())return;const n=Number(el.value),slot=state.slots[Number(el.dataset.copies)];
  if(el.value===''||!Number.isFinite(n)||n<0||n>1e7){el.value=slot.copies;toast('Starting copies must be 0–10,000,000.');return;}
  invalidate();slot.copies=n;log('COPIES',`${slot.name}: ${n} copies/reaction`);updateReady();
 });
 const count=state.slots.filter(Boolean).length;
 $('#trayCount').textContent=`${count} / 4 LOADED`;$('#cycler').classList.toggle('has-samples',count>0);
 const reps=Number($('#reps').value)||3,wellCount=count?Math.min(96,(count+2)*reps):0;
 $('#wellPlate').innerHTML=Array.from({length:48},(_,i)=>`<i class="plate-well ${i<wellCount?'loaded':''}"></i>`).join('');
 $('#clearTray').disabled=busy();$('#importButton').disabled=busy();
}
function readConfig(){
 for(const id of ['cycles','anneal','extension','reps','seed','noise'])if($('#'+id).value==='')throw Error(`Enter a value for ${id}.`);
 return PCR.config({cycles:Number($('#cycles').value),anneal:Number($('#anneal').value),extension:Number($('#extension').value),reps:Number($('#reps').value),seed:Number($('#seed').value),noise:Number($('#noise').value),contamination:$('#contamination').checked,pcFail:$('#pcFail').checked});
}
function estimate(cfg){
 // 3 °C/s block ramp, 120 s initial hold, 20 s anneal; terminal ramp to melt start and 0.25 °C/s scan.
 const cycleTime=15+20+cfg.extension+(95-cfg.anneal+72-cfg.anneal+23)/3;
 return Math.ceil(((95-22)/3+120+cfg.cycles*cycleTime+12/3+35/0.25+70/3+30)/60);
}
function updateReady(){
 let cfg;try{cfg=readConfig();}catch(e){$('#startHint').textContent=e.message;$('#startButton').disabled=true;return;}
 $('#duration').textContent=`~${estimate(cfg)} min`;$('#cycleTotal').textContent=cfg.cycles;
 if(busy())return;
 const count=state.slots.filter(Boolean).length;
 $('#startButton').disabled=count===0;
 $('#startButton').innerHTML=`<span>▶</span> ${state.status==='complete'?'REPEAT AMPLIFICATION':'START AMPLIFICATION'} <span>↗</span>`;
 $('#startHint').textContent=count?`${(count+2)*cfg.reps} wells · ${cfg.reps} replicates · controls included`:'Load at least one specimen to begin.';
 if(state.status==='idle'){$('#machineScreen').textContent=count?'SPECIMENS LOADED':'AWAITING SPECIMENS';$('#machineCycle').textContent=count?`${count} DNA VIAL${count>1?'S':''} · READY`:'BLOCK AT AMBIENT';}
}
function freezeInputs(on){
 $$('.protocol input,.protocol select').forEach(el=>{if(el.id!=='speed')el.disabled=on;});
 $('#runSecondary').hidden=!on;$('#startButton').disabled=on;renderArchive();renderTray();
}
function makeStages(cfg){
 const stages=[{name:'INITIAL DENATURATION',temp:95,seconds:120,cycle:0,play:1300,kind:'denature',description:'The initial high-temperature hold separates double-stranded template DNA.'}];
 for(let n=1;n<=cfg.cycles;n++)stages.push(
  {name:'DENATURATION',temp:95,seconds:15,cycle:n,play:800,kind:'denature',description:'Hydrogen bonds separate. Two template strands become accessible.'},
  {name:'ANNEALING',temp:cfg.anneal,seconds:20,cycle:n,play:800,kind:'anneal',description:'Forward and reverse primers bind. Temperature and mismatches affect binding efficiency.'},
  {name:'EXTENSION & OPTICAL READ',temp:72,seconds:cfg.extension,cycle:n,play:800,kind:'extend',description:'Polymerase extends bound primers. Fluorescence is acquired at the end of this step.'}
 );
 for(let i=0;i<=35;i++)stages.push({name:'MELT SCAN',temp:60+i,seconds:4,cycle:cfg.cycles,play:150,kind:'melt',meltIndex:i*4,description:'A gradual temperature increase melts accumulated product. The fluorescence derivative reveals its melt peak.'});
 stages.push({name:'COOLING TO HOLD',temp:25,seconds:30,cycle:cfg.cycles,play:1600,kind:'cool',description:'The block cools to a 25°C hold before the instrument unlocks and the reaction tray can be handled.'});
 return stages;
}
function startRun(){
 if(busy())return;
 let cfg,run;
 try{
  cfg=readConfig();
  // Slot IDs preserve distinct aliquots when the same DNA is loaded twice.
  const datasets=state.slots.map((d,i)=>d?{...d,id:`${d.id}@${i+1}`,sourceId:d.id,slot:i+1}:null).filter(Boolean);
  run=PCR.simulate(datasets,cfg);
 }catch(e){toast(e.message);return;}
 state.run=run;state.status='running';state.stageIndex=0;state.stageElapsed=0;state.lastTime=0;state.cycle=0;state.meltIndex=0;state.stages=makeStages(cfg);
 resetAdvisory();
 state.session++;$('#runNumber').textContent=`SESSION ${String(state.session-1).padStart(3,'0')}`;
 state.run.startedAt=new Date().toISOString();state.run.id=`VESPER-${Date.now().toString(36).toUpperCase()}`;
 $('#results').innerHTML='';$('#exportButton').disabled=true;$('#pauseButton').textContent='Ⅱ Pause';
 $('#systemStatus').textContent='PROTOCOL RUNNING';$('#roomMode').textContent='AMPLIFYING';$('#cycler').classList.add('running');$('#cycler').classList.remove('paused');
 freezeInputs(true);setView('amplification');
 log('RUN START',`${run.id} · seed ${cfg.seed} · ${cfg.cycles} cycles · anneal ${cfg.anneal}°C · extension ${cfg.extension} s · ${run.wells.length} wells`);
 log('CONTROLS',`${cfg.contamination?'NTC contamination injected':'Clean NTC'} · ${cfg.pcFail?'PC failure injected':'Positive control present'}`);
 enterStage();state.frame=requestAnimationFrame(tick);
}
function enterStage(){
 const s=state.stages[state.stageIndex];if(!s)return;
 $('#phaseLabel').textContent=s.name;$('#machineScreen').textContent=s.name;
 $('#phaseExplanation').textContent=s.description;$('#machineCycle').textContent=s.kind==='melt'?`${s.temp.toFixed(1)}°C · MELT PROFILE`:`CYCLE ${String(s.cycle).padStart(2,'0')} / ${state.run.cfg.cycles}`;
 $('#cycleCounter').textContent=String(s.cycle).padStart(2,'0');
 $$('.protocol-stage').forEach((el,i)=>el.classList.toggle('current',(s.kind==='denature'&&i===0)||(s.kind==='anneal'&&i===1)||(s.kind==='extend'&&i===2)));
 $('#cycler').style.setProperty('--heat',s.kind==='denature'?'#e29c88':s.kind==='anneal'?'#b4bbef':'#9ed5a0');
 $('#detector').textContent=s.kind==='extend'?'ACQUIRING':s.kind==='melt'?'MELT SCAN':'HOLD';
 if(s.kind==='melt'){state.meltIndex=s.meltIndex;state.cycle=state.run.cfg.cycles;if(state.view==='amplification')setView('melt');renderChart();}
 drawMolecule(s.kind);
}
function finishStage(){
 const s=state.stages[state.stageIndex];
 if(s.kind==='extend'){state.cycle=s.cycle;renderChart();}
 if(s.kind==='melt'){state.meltIndex=s.meltIndex;renderChart();}
 state.stageIndex++;state.stageElapsed=0;
 if(state.stageIndex>=state.stages.length){completeRun();return;}
 enterStage();
}
function tick(now){
 if(state.status!=='running')return;
 if(!state.lastTime)state.lastTime=now;
 const dt=Math.min(100,now-state.lastTime);state.lastTime=now;
 const stage=state.stages[state.stageIndex];state.stageElapsed+=dt*Number($('#speed').value);
 const fraction=Math.min(1,state.stageElapsed/stage.play);
 const prevTemp=state.stageIndex?state.stages[state.stageIndex-1].temp:22;
 const temp=prevTemp+(stage.temp-prevTemp)*Math.min(1,fraction/0.3);
 $('#machineTemp').innerHTML=`${temp.toFixed(1)}<small>°C</small>`;
 $('#runProgress').style.width=`${100*(state.stageIndex+fraction)/state.stages.length}%`;
 if(fraction>=1)finishStage();
 if(state.status==='running')state.frame=requestAnimationFrame(tick);
}
function completeRun(){
 state.status='complete';state.cycle=state.run.cfg.cycles;state.meltIndex=140;state.run.completedAt=new Date().toISOString();
 $('#cycler').classList.remove('running','paused');$('#machineScreen').textContent='RUN COMPLETE';$('#machineCycle').textContent='RESULTS READY · MELT COMPLETE';
 $('#roomMode').textContent='RUN COMPLETE';$('#systemStatus').textContent='ANALYSIS READY';$('#phaseLabel').textContent='PROTOCOL COMPLETE';$('#detector').textContent='ACQUISITION COMPLETE';
 $('#qcReadout').textContent=state.run.runQC.invalid?'INVALID RUN':'CONTROLS VALID';$('#qcReadout').style.color=state.run.runQC.invalid?'var(--red)':'var(--green)';
 $('#phaseExplanation').textContent=state.run.runQC.invalid?state.run.runQC.reasons.join('. ')+'. Sample calls are invalid.':'Thermal cycling and melt analysis complete. Results are deterministic; inspect the controls before interpreting sample calls.';
 $('#runProgress').style.width='100%';$$('.protocol-stage').forEach(el=>el.classList.remove('current'));
 freezeInputs(false);updateReady();$('#exportButton').disabled=false;
 log('RUN COMPLETE',`${state.run.id} · ${state.run.runQC.invalid?'INVALID: '+state.run.runQC.reasons.join('; '):'Controls valid'} · ${state.run.samples.filter(s=>s.type==='sample').map(s=>s.name+': '+s.call).join(' · ')}`);
 renderResults();setView('results');toast(state.run.runQC.invalid?'Run invalid. Review the failed controls.':'Amplification complete. Results and QC are ready.');
 resetAdvisory();
}
function pauseRun(){
 if(state.status==='running'){
  state.status='paused';cancelAnimationFrame(state.frame);$('#pauseButton').textContent='▶ Resume';$('#systemStatus').textContent='PLAYBACK PAUSED';$('#roomMode').textContent='PAUSED';$('#cycler').classList.add('paused');log('PAUSED','Playback paused; simulated instrument time is frozen.');
 }else if(state.status==='paused'){
  state.status='running';state.lastTime=0;$('#pauseButton').textContent='Ⅱ Pause';$('#systemStatus').textContent='PROTOCOL RUNNING';$('#roomMode').textContent='AMPLIFYING';$('#cycler').classList.remove('paused');log('RESUMED','Protocol playback resumed.');state.frame=requestAnimationFrame(tick);
 }
}
function resetMonitor(){
 $('#machineTemp').innerHTML='22.0<small>°C</small>';$('#machineScreen').textContent='SPECIMENS LOADED';$('#machineCycle').textContent='BLOCK AT AMBIENT';$('#cycleCounter').textContent='00';$('#runProgress').style.width='0%';$('#phaseLabel').textContent='AWAITING RUN';$('#phaseExplanation').textContent='Load a DNA specimen and start the thermal protocol to see amplification in real time.';$('#systemStatus').textContent='SYSTEM READY';$('#roomMode').textContent='STANDBY';$('#detector').textContent='STANDBY';$('#qcReadout').textContent='PENDING';$('#qcReadout').style.color='';drawMolecule('idle');
}
function abortRun(){
 if(!busy())return;cancelAnimationFrame(state.frame);log('ABORTED',`${state.run.id} at cycle ${state.cycle}. No completed analysis released.`);
 state.status='idle';state.run=null;state.cycle=0;state.meltIndex=0;$('#cycler').classList.remove('running','paused');freezeInputs(false);resetMonitor();updateReady();setView('amplification');toast('Run aborted. The tray is ready for another experiment.');
 resetAdvisory();
}
function setView(view){
 state.view=view;$$('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);el.setAttribute('aria-selected',String(el.dataset.view===view));});
 const chartView=view==='amplification'||view==='melt';$('#chart').hidden=!chartView;$('#legend').hidden=!chartView;$('#results').hidden=view!=='results';$('#notebook').hidden=view!=='notebook';
 if(view==='results'&&state.status!=='complete')$('#results').innerHTML='<p class="result-note">Complete the thermal protocol and melt scan to release analysis. Live traces are available in the amplification view.</p>';
 renderChart();renderNotebook();
}
function renderChart(){
 const run=state.run,isMelt=state.view==='melt',W=940,H=234,p={l:52,r:18,t:15,b:35},iw=W-p.l-p.r,ih=H-p.t-p.b;
 const cycles=run?run.cfg.cycles:Number($('#cycles').value)||40,xmin=isMelt?60:0,xmax=isMelt?95:cycles,ymax=isMelt?1.15:1100,ymin=isMelt?0:-30;
 const X=v=>p.l+(v-xmin)/(xmax-xmin)*iw,Y=v=>p.t+ih-(v-ymin)/(ymax-ymin)*ih;
 let svg='';
 for(let i=0;i<=4;i++){
  const val=ymin+(ymax-ymin)*i/4,y=Y(val);svg+=`<line x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}" stroke="#2a392733"/><text x="${p.l-9}" y="${y+3}" text-anchor="end" fill="#76876c" font-size="8" font-family="monospace">${isMelt?val.toFixed(1):Math.round(val)}</text>`;
 }
 for(let i=0;i<=8;i++){
  const val=xmin+(xmax-xmin)*i/8,x=X(val);svg+=`<line x1="${x}" y1="${p.t}" x2="${x}" y2="${H-p.b}" stroke="#2a392733"/><text x="${x}" y="${H-p.b+15}" text-anchor="middle" fill="#76876c" font-size="8" font-family="monospace">${fmt(val,isMelt?1:0)}</text>`;
 }
 svg+=`<text x="${W/2}" y="${H-2}" fill="#90a080" text-anchor="middle" font-size="8" font-family="monospace">${isMelt?'TEMPERATURE (°C)':'CYCLE'}</text><text x="10" y="${H/2}" transform="rotate(-90 10 ${H/2})" fill="#90a080" text-anchor="middle" font-size="8" font-family="monospace">${isMelt?'−dF / dT (NORMALIZED)':'BASELINE-CORRECTED RFU'}</text>`;
 if(run){
  if(!isMelt){const y=Y(run.threshold);svg+=`<line x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}" stroke="#c5d8a6" stroke-width=".8" stroke-dasharray="4 5" opacity=".55"/><text x="${W-p.r-4}" y="${y-6}" text-anchor="end" fill="#a0b18a" font-size="7" font-family="monospace">THRESHOLD ${fmt(run.threshold,1)} RFU</text>`;}
  for(const well of run.wells){
   const length=isMelt?(state.status==='complete'?141:state.meltIndex+1):state.cycle;
   const ys=(isMelt?well.melt.values:well.corrected).slice(0,length);
   if(!ys.length)continue;
   const path=ys.map((v,i)=>`${i?'L':'M'}${X(isMelt?well.melt.temperatures[i]:i+1).toFixed(2)},${Y(v).toFixed(2)}`).join(' ');
   svg+=`<path d="${path}" stroke="${well.color}" stroke-width="${well.type==='sample'?1.5:1.1}" fill="none" opacity="${well.replicate===1?0.9:0.32}" ${well.type==='sample'?'':'stroke-dasharray="4 4"'}/>`;
  }
  if(!isMelt&&state.cycle>0&&state.cycle<cycles){const x=X(state.cycle);svg+=`<line x1="${x}" y1="${p.t}" x2="${x}" y2="${H-p.b}" stroke="#c7dea7" opacity=".3" stroke-dasharray="2 4"/>`;}
 }else svg+=`<text x="${W/2}" y="${H/2-5}" fill="#63785c" text-anchor="middle" font-size="10" font-family="monospace">${isMelt?'MELT SCAN FOLLOWS AMPLIFICATION':'AWAITING OPTICAL ACQUISITION'}</text><text x="${W/2}" y="${H/2+16}" fill="#4b6145" text-anchor="middle" font-size="8" font-family="monospace">${isMelt?'Product accumulation determines whether a peak appears.':'Each specimen and control is measured in separate replicate wells.'}</text>`;
 $('#chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
 $('#chart').setAttribute('aria-label',isMelt?'Melt derivative versus temperature':'Baseline corrected fluorescence versus PCR cycle');
 $('#legend').innerHTML=run?run.samples.map(s=>`<span class="legend-item" style="--sample:${s.color}"><i></i>${esc(s.type==='sample'?s.name:s.type==='pc'?'PC':'NTC')}${s.type==='sample'?' · '+s.replicates+'×':''}</span>`).join(''):'<span class="legend-idle">FLUORESCENCE WILL APPEAR DURING THE RUN</span>';
}
function renderResults(){
 const r=state.run;if(!r||state.status!=='complete')return;
 $('#results').innerHTML=`<div class="qc-banner ${r.runQC.invalid?'invalid':''}">${r.runQC.invalid?'INVALID RUN · '+esc(r.runQC.reasons.join(' · ')):'CONTROLS VALID · Positive control amplified; no-template control is clear.'}</div><table><thead><tr><th>Specimen</th><th>Mean Cq</th><th>Rep SD</th><th>Detected</th><th>Melt °C</th><th>Call</th></tr></thead><tbody>${r.samples.map(s=>{const ws=r.wells.filter(w=>w.sampleId===s.id),ts=ws.map(w=>w.meltPeak).filter(v=>v!==null);return `<tr><td><span class="result-name" style="--sample:${s.color}">${esc(s.name)}<small>${esc(s.id)} ${s.product?'· '+s.product.length+' bp':''}</small></span></td><td>${fmt(s.meanCq)}</td><td>${s.detected>1?fmt(s.repSD):'—'}</td><td>${s.detected}/${s.replicates}</td><td>${ts.length?fmt(ts.reduce((a,b)=>a+b,0)/ts.length,1):'—'}</td><td><span class="call ${s.call.toLowerCase()}">${s.call}</span>${s.flags.length?`<small class="result-note" style="display:block;margin-top:5px">${s.flags.map(esc).join(' · ')}</small>`:''}</td></tr>`;}).join('')}</tbody></table><p class="result-note">Shared threshold ${fmt(r.threshold,1)} RFU · baseline cycles 3–12 · demo Cq cutoff 35 · replicate SD limit 0.5 cycles. Measured efficiency: unavailable without a dilution series. Simulated results; no clinical interpretation.</p>`;
}
function renderNotebook(){
 $('#notebook').innerHTML='<p class="result-note">Local session notes. This browser log is editable in memory and is not a tamper-proof audit trail.</p>'+state.events.slice().reverse().map(e=>`<div class="notebook-entry"><time>${e.time.slice(11,19)}</time><div><b>${esc(e.event)}</b><br>${esc(e.detail)}</div></div>`).join('');
}
function drawMolecule(kind){
 let s='';for(let i=0;i<16;i++){
  const x=13+i*13,spread=kind==='denature'?16:kind==='anneal'?10:kind==='melt'?18:7;
  const y1=32+Math.sin(i*.7)*spread-5,y2=32-Math.sin(i*.7)*spread+5;
  if(kind!=='denature'&&kind!=='melt'&&(kind!=='anneal'||i<4||i>11))s+=`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${i<4?'#b4bbef':'#667d56'}" opacity=".7"/>`;
  s+=`<circle cx="${x}" cy="${y1}" r="2" fill="#b1ce93"/><circle cx="${x}" cy="${y2}" r="2" fill="${kind==='extend'?'#b4bbef':'#687e56'}"/>`;
 }$('#molecule').innerHTML=s;
}
function exportRun(){
 if(state.status!=='complete')return;
 const payload={...state.run,appVersion:'0.3.0',intendedUse:'Educational simulation only; not for clinical use',sessionNotes:state.events,advisory:{...advisory,provider:'Gaby',verificationScope:'Client-side schema, run hash, calls, Cq and permitted observations. No clinical validation or authenticated release gate.'}};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=state.run.id+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);log('EXPORTED',state.run.id+' · complete raw curves, config, DNA, analysis and limitations');
}
$('#startButton').onclick=startRun;$('#pauseButton').onclick=pauseRun;$('#abortButton').onclick=abortRun;$('#exportButton').onclick=exportRun;
$('#gabyExplain').onclick=explainRun;$('#gabyEnabled').onchange=resetAdvisory;
$('#clearTray').onclick=()=>{if(busy())return;invalidate();state.slots=[null,null,null,null];log('TRAY CLEARED','All reaction slots emptied.');resetMonitor();renderTray();updateReady();};
$('#cycler').onclick=()=>{if(!busy())addVial(state.selected);};$('#cycler').onkeydown=e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!busy())addVial(state.selected);}};bindDrop($('#cycler'));
$$('[data-view]').forEach(el=>el.onclick=()=>setView(el.dataset.view));
$('#helpButton').onclick=()=>$('#helpDialog').showModal();$('#modelButton').onclick=()=>$('#modelDialog').showModal();
$$('.close-dialog').forEach(el=>el.onclick=()=>el.closest('dialog').close());$('.close-dialog-button').onclick=()=>$('#helpDialog').close();
$('#importButton').onclick=()=>{if(busy())return;$('#customFwd').value=PCR.DATASETS[0].fwd;$('#customRev').value=PCR.DATASETS[0].rev;$('#importError').textContent='';$('#importDialog').showModal();};
$('#fastaFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>100000){$('#importError').textContent='File exceeds 100 kB.';return;}$('#customFasta').value=await f.text();};
$('#importForm').onsubmit=e=>{
 e.preventDefault();if(busy())return;
 try{
  const parsed=PCR.parseFasta($('#customFasta').value),fwd=PCR.sequence($('#customFwd').value,true),rev=PCR.sequence($('#customRev').value,true),copies=Number($('#customCopies').value),name=$('#customName').value.trim();
  if(!name)throw Error('Enter a specimen name.');if(!Number.isFinite(copies)||copies<0||copies>1e7)throw Error('Copies must be 0–10,000,000.');
  const d={id:'CUSTOM-'+(++customCount),name,subtitle:'Imported · unverified',color:'#c2cbb3',symbol:'helix',copies,inhibition:0,seq:parsed.seq,fwd,rev};
  state.library.push(d);state.selected=d.id;renderArchive();renderInspector();$('#importDialog').close();log('IMPORTED',`${d.id}: ${d.seq.length} bp · unverified imported DNA`);toast('DNA sequence added to the archive. Select and load it into the tray.');
 }catch(error){$('#importError').textContent=error.message;}
};
$$('.protocol input').forEach(el=>el.addEventListener('change',()=>{if(!busy()){invalidate();renderTray();updateReady();}}));
window.addEventListener('beforeunload',e=>{if(busy()){e.preventDefault();e.returnValue='';}});
log('LAB READY','Engine 0.2.0 · Gaby advisory available on request · deterministic calls.');
renderArchive();renderInspector();renderTray();resetMonitor();updateReady();renderChart();
resetAdvisory();
})();

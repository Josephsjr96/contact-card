/* Pure deterministic educational model. No DOM, network, clinical claims, or LLM. */
(function (root) {
  'use strict';
  const VERSION = '0.2.0';
  const NN = {AA:[-7.9,-22.2],TT:[-7.9,-22.2],AT:[-7.2,-20.4],TA:[-7.2,-21.3],CA:[-8.5,-22.7],TG:[-8.5,-22.7],GT:[-8.4,-22.4],AC:[-8.4,-22.4],CT:[-7.8,-21],AG:[-7.8,-21],GA:[-8.2,-22.2],TC:[-8.2,-22.2],CG:[-10.6,-27.2],GC:[-9.8,-24.4],GG:[-8,-19.9],CC:[-8,-19.9]};
  const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
  const sd = a => a.length > 1 ? Math.sqrt(a.reduce((s,v)=>s+(v-mean(a))**2,0)/(a.length-1)) : 0;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const rc = s => [...s].reverse().map(b=>({A:'T',T:'A',C:'G',G:'C',N:'N'})[b]).join('');
  const gc = s => 100*[...s].filter(b=>b==='G'||b==='C').length/s.length;
  function rng(seed) { let a=seed>>>0; return () => { a+=0x6D2B79F5; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function gaussian(random) { return Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*Math.cos(2*Math.PI*random()); }
  function poisson(lambda,random) {
    if(lambda>100) return Math.max(0,Math.round(lambda+Math.sqrt(lambda)*gaussian(random)));
    let n=0,p=1; const limit=Math.exp(-lambda);
    do { n++; p*=random(); } while(p>limit);
    return n-1;
  }
  function sequence(s,primer=false) {
    if(typeof s!=='string') throw Error('Sequence must be text.');
    const clean=s.replace(/\s/g,'').toUpperCase();
    if(!(primer?/^[ACGT]+$/:/^[ACGTN]+$/).test(clean)) throw Error('Invalid DNA alphabet. Primers accept A/C/G/T; templates also accept N.');
    if(clean.length<(primer?15:20)||clean.length>(primer?35:20000)) throw Error(primer?'Primers must be 15–35 nt.':'Template must be 20–20,000 bp.');
    return clean;
  }
  function parseFasta(text) {
    if(typeof text!=='string'||text.length>100000) throw Error('FASTA input exceeds 100 kB.');
    const lines=text.trim().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const headers=lines.filter(l=>l.startsWith('>'));
    if(headers.length>1) throw Error('Import one FASTA record per vial; multiple records are not concatenated.');
    if(headers.length && !lines[0].startsWith('>')) throw Error('FASTA header must be first.');
    return {id:headers.length?headers[0].slice(1).split(/\s/)[0].slice(0,40):'CUSTOM',seq:sequence(lines.filter(l=>!l.startsWith('>')).join(''))};
  }
  // SantaLucia/Allawi DNA_NN3, entropy salt correction, total strand concentration Ct.
  function tm(seq,concM=0.5e-6,naM=0.05) {
    seq=sequence(seq,true);
    if(!Number.isFinite(concM)||concM<=0||!Number.isFinite(naM)||naM<=0) throw Error('Concentrations must be positive.');
    let h=0.2,s=-5.6;
    for(const b of [seq[0],seq.at(-1)]) if(b==='A'||b==='T') {h+=2.2;s+=6.9;}
    for(let i=0;i<seq.length-1;i++) {const pair=NN[seq.slice(i,i+2)];h+=pair[0];s+=pair[1];}
    const self=seq===rc(seq); if(self) s-=1.4;
    s+=0.368*(seq.length-1)*Math.log(naM);
    return h*1000/(s+1.987*Math.log(concM/(self?1:4)))-273.15;
  }
  const productTm = (s,naM=0.05) => 81.5+16.6*Math.log10(naM)+0.41*gc(s)-675/s.length;
  function binding(template,fwd,rev,maxMM=3) {
    const hits=(primer,reverse) => {
      const target=reverse?rc(primer):primer, found=[];
      for(let i=0;i<=template.length-target.length;i++) {
        let mm=0,penalty=0;
        for(let j=0;j<target.length;j++) if(template[i+j]!==target[j]) {
          mm++; const from3=reverse?j:target.length-1-j; penalty+=from3<3?1.8:0.4;
          if(mm>maxMM) break;
        }
        if(mm<=maxMM) found.push({pos:i,mm,penalty});
      }
      return found;
    };
    const products=[];
    for(const f of hits(fwd,false)) for(const r of hits(rev,true)) {
      // Primer sites must face inward and must not overlap.
      if(r.pos<f.pos+fwd.length) continue;
      const end=r.pos+rev.length,length=end-f.pos;
      if(length>2000) continue;
      const seq=template.slice(f.pos,end);
      products.push({start:f.pos,end,length,seq,gc:gc(seq),tm:productTm(seq),mismatches:f.mm+r.mm,penalty:f.penalty+r.penalty});
    }
    products.sort((a,b)=>a.penalty-b.penalty||a.length-b.length);
    return {primary:products[0]||null,offTargets:products.slice(1)};
  }
  const FWD='ACGTGACCTAGCTAGCTAGC', REV='TTGCAGCTAGCTACGTAGCA';
  function construct(seed,negative=false) {
    const random=rng(seed); let seq=Array.from({length:800},()=> 'ACGT'[Math.floor(random()*4)]).join('');
    if(!negative) seq=seq.slice(0,120)+FWD+seq.slice(140,420)+rc(REV)+seq.slice(440);
    return seq;
  }
  const DATASETS = [
    {id:'SYN-01',name:'Aster',subtitle:'Reference construct',color:'#9ed5a0',symbol:'helix',copies:5000,inhibition:0,seq:construct(20240501),fwd:FWD,rev:REV},
    {id:'SYN-02',name:'Echo',subtitle:'Low-copy construct',color:'#b4bbef',symbol:'orbit',copies:60,inhibition:0,seq:construct(20240502),fwd:FWD,rev:REV},
    {id:'SYN-03',name:'Null',subtitle:'Non-binding DNA',color:'#e2c58b',symbol:'diamond',copies:5000,inhibition:0,seq:construct(20240503,true),fwd:FWD,rev:REV},
    {id:'SYN-04',name:'Veil',subtitle:'Inhibited construct',color:'#e29c88',symbol:'split',copies:5000,inhibition:0.52,seq:construct(20240504),fwd:FWD,rev:REV}
  ];
  const defaults={cycles:40,anneal:58,extension:20,reps:3,seed:1337,noise:1.5,cutoff:35,contamination:false,pcFail:false};
  function config(input={}) {
    const c={...defaults,...input};
    for(const [key,lo,hi] of [['cycles',20,60],['anneal',45,75],['extension',1,90],['reps',1,8],['seed',0,4294967295],['noise',0,20],['cutoff',15,60]]) {
      if(!Number.isFinite(c[key])||c[key]<lo||c[key]>hi) throw Error(`Invalid ${key}: expected ${lo}–${hi}.`);
    }
    for(const key of ['cycles','reps','seed']) if(!Number.isInteger(c[key])) throw Error(`${key} must be an integer.`);
    return c;
  }
  function validateDataset(d) {
    const seq=sequence(d.seq),fwd=sequence(d.fwd,true),rev=sequence(d.rev,true);
    if(!Number.isFinite(d.copies)||d.copies<0||d.copies>1e7) throw Error('Copies must be between 0 and 10,000,000.');
    if(!Number.isFinite(d.inhibition)||d.inhibition<0||d.inhibition>1) throw Error('Inhibition must be between 0 and 1.');
    return {...d,seq,fwd,rev};
  }
  function baseline(raw) {
    const xs=raw.slice(2,12).map((_,i)=>i+3),ys=raw.slice(2,12);
    const xm=mean(xs),ym=mean(ys),slope=xs.reduce((s,x,i)=>s+(x-xm)*(ys[i]-ym),0)/xs.reduce((s,x)=>s+(x-xm)**2,0);
    const corrected=raw.map((v,i)=>v-(ym+slope*(i+1-xm)));
    return {corrected,noise:sd(corrected.slice(2,12)),slope};
  }
  function crossing(ys,threshold) {
    // Search after the fitted baseline; require a sustained crossing, not a noise spike.
    for(let i=12;i<ys.length-2;i++) if(ys[i-1]<threshold&&ys[i]>=threshold&&ys[i+1]>=threshold&&ys[i+2]>=threshold)
      return i+(threshold-ys[i-1])/(ys[i]-ys[i-1]);
    return null;
  }
  function peaks(temperatures,values) {
    const max=Math.max(...values);
    if(max<0.05) return [];
    const found=[];
    for(let i=1;i<values.length-1;i++) if(values[i]>values[i-1]&&values[i]>=values[i+1]&&values[i]>max*0.2) found.push({t:temperatures[i],height:values[i]});
    return found.sort((a,b)=>b.height-a.height).filter((p,i,a)=>!a.slice(0,i).some(q=>Math.abs(p.t-q.t)<1.5));
  }
  function simulate(inputDatasets,inputConfig={}) {
    const cfg=config(inputConfig);
    if(!inputDatasets.length||inputDatasets.length>4) throw Error('Load one to four DNA vials.');
    const datasets=inputDatasets.map(validateDataset);
    if(datasets.some(d=>d.fwd!==datasets[0].fwd||d.rev!==datasets[0].rev)) throw Error('Single-plex runs require the same primer pair in every vial.');
    const random=rng(cfg.seed),fwd=datasets[0].fwd,rev=datasets[0].rev;
    const controlSeq=fwd+construct(802,true).slice(0,280)+rc(rev);
    const controls=[
      {id:'NTC',name:'No-template control',color:'#7b8a92',seq:controlSeq,copies:cfg.contamination?60:0,inhibition:0,type:'ntc',fwd,rev},
      // Synthetic PC is constructed with the actual run primers, including custom imports.
      {id:'PC',name:'Positive control',color:'#72c8d7',seq:controlSeq,copies:cfg.pcFail?0:5000,inhibition:0,type:'pc',fwd,rev}
    ];
    const wells=[];
    for(const d of [...datasets.map(d=>({...d,type:'sample'})),...controls]) {
      const b=binding(d.seq,fwd,rev),product=b.primary;
      const minTm=Math.min(tm(fwd),tm(rev));
      // Pedagogical response functions, not an experimentally calibrated PCR chemistry model.
      const annealFactor=Math.exp(-0.5*(Math.max(0,cfg.anneal-(minTm-2))/7)**2);
      const extensionFactor=product?Math.min(1,cfg.extension/(product.length/40)):0;
      const emax=product?0.97*annealFactor*extensionFactor*Math.exp(-product.penalty)*(1-d.inhibition):0;
      for(let rep=1;rep<=cfg.reps;rep++) {
        const initial=poisson(d.copies,random),n=[product?initial:0],raw=[];
        const offset=100+gaussian(random)*2,gain=1000*(1+gaussian(random)*0.015);
        for(let c=1;c<=cfg.cycles;c++) {
          const eff=emax/(1+n[c-1]/1e12);
          n.push(n[c-1]*(1+eff));
          raw.push(offset+0.12*c+gain*n[c]/(n[c]+1e10)+gaussian(random)*cfg.noise);
        }
        const meltT=[],meltY=[];
        // Only actual accumulated product contributes a peak; failed reactions have no artificial peak.
        const amplitude=n.at(-1)/(n.at(-1)+1e8);
        for(let i=0;i<=140;i++) {
          const t=60+i*0.25;
          meltT.push(t);meltY.push(Math.max(0,(product?amplitude*Math.exp(-(((t-product.tm)/0.8)**2)):0)+gaussian(random)*0.0015));
        }
        const base=baseline(raw);
        wells.push({well:`${'ABCDEFGH'[Math.floor(wells.length/12)]}${wells.length%12+1}`,sampleId:d.id,type:d.type,replicate:rep,name:d.name,color:d.color,initialCopies:initial,emax,product,offTargets:b.offTargets,raw,copies:n,corrected:base.corrected,baselineNoise:base.noise,melt:{temperatures:meltT,values:meltY}});
      }
    }
    // Shared threshold within this single assay; individual well thresholds bias dilution comparisons.
    const threshold=Math.max(10,10*mean(wells.filter(w=>w.type==='ntc').map(w=>w.baselineNoise)));
    for(const w of wells) {
      w.cq=crossing(w.corrected,threshold);
      const ps=peaks(w.melt.temperatures,w.melt.values);w.meltPeaks=ps;w.meltPeak=ps[0]?.t??null;
      w.meltOK=!!w.product&&ps.length===1&&Math.abs(w.meltPeak-w.product.tm)<=1.5;
      const signal=Math.max(...w.corrected),flat=signal<threshold;
      const tail=w.corrected.slice(Math.max(12,Math.floor(w.cq??cfg.cycles)));
      const drops=tail.slice(1).filter((v,i)=>v<tail[i]-Math.max(3*w.baselineNoise,signal*0.03)).length;
      // Explicit heuristic, not the four-parameter fit required by the full research blueprint.
      w.shapeOK=w.cq!==null&&signal>threshold*1.5&&drops<=Math.max(1,tail.length*0.15);
      w.flat=flat;
      w.flags=[];
      if(w.cq!==null&&!w.shapeOK) w.flags.push('NON_SIGMOID');
      if(w.cq!==null&&!w.meltOK) w.flags.push('MELT_MISMATCH');
      if(w.offTargets.length) w.flags.push('MULTIPLE_BINDING_PRODUCTS');
      if(w.product?.seq.includes('N')) w.flags.push('AMBIGUOUS_PRODUCT_SEQUENCE');
      if(w.cq!==null&&w.cq>cfg.cutoff) w.flags.push('LATE_AMPLIFICATION');
    }
    const samples=[];
    for(const d of [...datasets,...controls]) {
      const ws=wells.filter(w=>w.sampleId===d.id),cqs=ws.map(w=>w.cq).filter(v=>v!==null),flags=[...new Set(ws.flatMap(w=>w.flags))];
      const repSD=sd(cqs);
      if(cqs.length>0&&cqs.length<ws.length) flags.push('REPLICATE_DROPOUT');
      if(repSD>0.5) flags.push('REPLICATE_DISAGREEMENT');
      const allFlat=ws.every(w=>w.flat);
      let call;
      if(!cqs.length) {call=allFlat?'NEGATIVE':'INCONCLUSIVE';if(!allFlat) flags.push('UNRESOLVED_SIGNAL');}
      else if(flags.length||!ws.every(w=>w.shapeOK&&w.meltOK)) call='INCONCLUSIVE';
      else call=mean(cqs)<=cfg.cutoff?'POSITIVE':'INCONCLUSIVE';
      samples.push({id:d.id,name:d.name,color:d.color,type:ws[0].type,meanCq:cqs.length?mean(cqs):null,repSD,detected:cqs.length,replicates:ws.length,flags,call,product:ws[0].product});
    }
    const ntc=samples.find(s=>s.type==='ntc'),pc=samples.find(s=>s.type==='pc');
    const reasons=[];
    if(ntc.detected||ntc.call!=='NEGATIVE') reasons.push('No-template control has signal');
    if(pc.call!=='POSITIVE'||pc.detected!==cfg.reps) reasons.push('Positive control failed');
    if(reasons.length) for(const s of samples) s.call='INVALID';
    return {version:VERSION,cfg,datasets,wells,samples,threshold,primers:{fwd,rev,fwdTm:tm(fwd),revTm:tm(rev)},runQC:{invalid:!!reasons.length,reasons},assumptions:['Synthetic DNA only in the bundled library. Custom FASTA is unverified, not biosecurity screened.','Empirical temperature and extension response; not calibrated to an instrument.','Shape QC is a monotonicity/signal heuristic, not a four-parameter sigmoid fit.','Single-plex, fixed 50 mM monovalent salt, 0.5 µM total primer strand concentration.','No measured efficiency: a dilution series is required.','No clinical validation, internal amplification control, or production audit service. Optional Gaby advisory cannot change engine results.']};
  }
  const api={VERSION,DATASETS,defaults,rng,rc,gc,tm,productTm,binding,sequence,parseFasta,baseline,crossing,config,simulate};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.PCR=api;
})(typeof globalThis!=='undefined'?globalThis:this);

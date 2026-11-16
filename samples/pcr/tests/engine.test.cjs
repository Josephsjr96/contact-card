const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('../engine.js');
const a=p.DATASETS[0];
const sample=r=>r.samples.find(s=>s.type==='sample');
test('nearest-neighbour Tm matches the published Biopython reference example',()=>{
 // Biopython dnac1=25 nM, dnac2=25 nM -> effective 12.5 nM = Ct/4 for Ct=50 nM.
 assert.ok(Math.abs(p.tm('CGTTCCAAAGATGTGGGCATGAGCTTAC',50e-9)-60.32)<0.01);
});
test('strict parsing rejects malformed DNA and multiple FASTA records',()=>{
 assert.throws(()=>p.parseFasta('>one\nACGTACGTACGTACGTACGTZ'));
 assert.throws(()=>p.sequence('ACGT-ACGTACGTACGTACGT',true));
 assert.throws(()=>p.parseFasta('>one\nACGTACGTACGTACGTACGT\n>two\nACGTACGTACGTACGTACGT'));
 assert.equal(p.parseFasta('>one\nacgtacgtacgtacgtacgt').seq,'ACGTACGTACGTACGTACGT');
});
test('binding predicts the expected inward-facing product and no target in Null',()=>{
 const product=p.binding(a.seq,a.fwd,a.rev).primary;
 assert.equal(product.start,120);assert.equal(product.end,440);assert.equal(product.length,320);
 assert.equal(p.binding(p.DATASETS[2].seq,a.fwd,a.rev).primary,null);
 const bad=a.fwd+'A'.repeat(20); // Reverse site before forward site is invalid.
 assert.equal(p.binding(p.rc(a.rev)+bad,a.fwd,a.rev).primary,null);
});
test('Cq interpolation uses cycle coordinates and sustained post-baseline signal',()=>{
 const v=Array(12).fill(0).concat([5,15,20,25]);
 assert.equal(p.crossing(v,10),13.5);
 assert.equal(p.crossing(Array(12).fill(0).concat([5,15,0,0]),10),null);
});
test('same seed produces identical curves and calls, including seed zero',()=>{
 assert.deepEqual(p.simulate([a],{seed:0}),p.simulate([a],{seed:0}));
 assert.notDeepEqual(p.simulate([a],{seed:0}).wells[0].raw,p.simulate([a],{seed:1}).wells[0].raw);
});
test('reference and low-copy amplify; nonbinding DNA has no target melt peak',()=>{
 const r=p.simulate(p.DATASETS.slice(0,3));
 assert.equal(r.runQC.invalid,false);assert.equal(r.samples[0].call,'POSITIVE');
 assert.ok(r.samples[1].meanCq>r.samples[0].meanCq+4);
 assert.equal(r.samples[2].call,'NEGATIVE');
 assert.ok(r.wells.filter(w=>w.sampleId===p.DATASETS[2].id).every(w=>w.meltPeak===null));
});
test('starting abundance, temperature, extension, mismatches and inhibition affect kinetics',()=>{
 const cq=(d,c={})=>sample(p.simulate([d],{noise:0,...c})).meanCq;
 assert.ok(cq({...a,copies:50})>cq(a)+4);
 assert.ok(cq(a,{anneal:64})>cq(a));
 assert.ok(cq(a,{extension:4})>cq(a));
 assert.ok(cq({...a,inhibition:.3})>cq(a));
 const altered={...a,seq:a.seq.slice(0,139)+(a.seq[139]==='A'?'C':'A')+a.seq.slice(140)};
 assert.ok(p.simulate([altered]).wells[0].emax<p.simulate([a]).wells[0].emax);
});
test('controls invalidate all calls on contamination, positive-control failure and overheating',()=>{
 for(const c of [{contamination:true},{pcFail:true},{anneal:75}]){
  const r=p.simulate([a],c);assert.equal(r.runQC.invalid,true);assert.ok(r.samples.every(s=>s.call==='INVALID'));
 }
});
test('no product generates no invented melt peak even with primer binding',()=>{
 const r=p.simulate([{...a,copies:0}]);assert.equal(sample(r).call,'NEGATIVE');
 assert.ok(r.wells.filter(w=>w.type==='sample').every(w=>w.meltPeak===null&&w.copies.at(-1)===0));
});
test('replicate dropout is inconclusive rather than a confident negative or positive',()=>{
 let found=false;for(let seed=0;seed<15;seed++){
  const s=sample(p.simulate([{...a,copies:1}],{seed,reps:8}));
  if(s.detected>0&&s.detected<8){assert.equal(s.call,'INCONCLUSIVE');assert.ok(s.flags.includes('REPLICATE_DROPOUT'));found=true;break;}
 }assert.ok(found);
});
test('invalid configurations and mixed assays are rejected; 0 noise is valid',()=>{
 for(const c of [{cycles:NaN},{cycles:19},{reps:9},{seed:-1},{anneal:100},{noise:-1}]) assert.throws(()=>p.simulate([a],c));
 assert.throws(()=>p.simulate([]));
 assert.throws(()=>p.simulate([{...a,copies:-1}]));
 assert.throws(()=>p.simulate([a,{...a,rev:a.fwd}]));
 assert.equal(p.simulate([a],{noise:0}).cfg.noise,0);
});
test('contamination uses the actual primer pair, including an imported assay',()=>{
 const custom={...a,fwd:p.rc(a.fwd),rev:p.rc(a.rev)};
 const r=p.simulate([custom],{contamination:true});
 assert.ok(r.samples.find(s=>s.type==='ntc').detected>0);
 assert.equal(r.runQC.invalid,true);
});
test('ambiguous product DNA is escalated and high-copy baseline interference is not called negative',()=>{
 const ambiguous={...a,seq:a.seq.slice(0,200)+'N'+a.seq.slice(201)};
 assert.ok(sample(p.simulate([ambiguous])).flags.includes('AMBIGUOUS_PRODUCT_SEQUENCE'));
 assert.equal(sample(p.simulate([ambiguous])).call,'INCONCLUSIVE');
 assert.equal(sample(p.simulate([{...a,copies:1e6}],{noise:0})).call,'INCONCLUSIVE');
});

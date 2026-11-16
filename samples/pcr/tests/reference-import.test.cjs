const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const p=require('../engine.js');
const fasta=fs.readFileSync(path.join(__dirname,'fixtures/NC_001416.1-1-400.fasta'),'utf8');
const seq=p.parseFasta(fasta).seq;
const sample={id:'NC_001416.1:1-400',name:'Lambda reference fragment',seq,fwd:seq.slice(0,20),rev:p.rc(seq.slice(-20)),copies:5000,inhibition:0};
test('public NCBI FASTA preserves the 400-base reference and predicts exact product geometry',()=>{
 assert.match(fasta,/^>NC_001416\.1:1-400 /);
 assert.equal(seq.length,400);
 const b=p.binding(seq,sample.fwd,sample.rev);
 assert.equal(b.primary.start,0);assert.equal(b.primary.end,400);
 assert.equal(b.primary.seq,seq);assert.equal(b.primary.mismatches,0);
});
test('imported reference generates simulated signals with controls using the imported primer pair',()=>{
 const r=p.simulate([sample]);
 assert.equal(r.runQC.invalid,false);
 assert.equal(r.samples[0].call,'POSITIVE');
 assert.ok(r.wells.filter(w=>w.type==='sample').every(w=>w.product.length===400&&w.cq!==null));
 const fault=p.simulate([sample],{contamination:true});
 assert.equal(fault.runQC.invalid,true);assert.ok(fault.samples.every(s=>s.call==='INVALID'));
});
test('reference import does not imply support for other sequence formats or oversized templates',()=>{
 assert.throws(()=>p.parseFasta(fasta+'\n>second\n'+seq),/one FASTA record/);
 assert.throws(()=>p.parseFasta(seq.repeat(51)),/20–20,000/);
 assert.throws(()=>p.parseFasta(seq.slice(0,-1)+'R'),/Invalid DNA alphabet/);
 assert.throws(()=>p.parseFasta(seq.replaceAll('T','U')),/Invalid DNA alphabet/);
});

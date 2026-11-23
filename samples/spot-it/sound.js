/* Soft mallets, glass and brushed air. Generated locally; no audio downloads. */
(() => {
 'use strict';
 const button=document.getElementById('sound-toggle'),store='spot-it-sound-v1';
 const Audio=window.AudioContext||window.webkitAudioContext;
 let enabled=true,context,master,space,noise,unlocked=false;
 const active=new Set(),last=new Map();
 try{enabled=localStorage.getItem(store)!=='off'}catch{}
 function paint(){
  button.setAttribute('aria-pressed',String(enabled));
  button.setAttribute('aria-label','Sound effects');
  button.title=enabled?'Sound on · mute':'Sound off · enable';
 }
 function build(){
  context=new Audio();
  master=context.createGain();master.gain.value=enabled?.58:0;
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-16;compressor.knee.value=14;compressor.ratio.value=4;
  compressor.attack.value=.004;compressor.release.value=.16;
  master.connect(compressor);compressor.connect(context.destination);
  const reverb=context.createConvolver(),wet=context.createGain();
  const impulse=context.createBuffer(2,Math.ceil(context.sampleRate*.65),context.sampleRate);
  for(let channel=0;channel<2;channel++){
   const data=impulse.getChannelData(channel);
   for(let i=0;i<data.length;i++)data[i]=i<context.sampleRate*.018?0:(Math.random()*2-1)*Math.pow(1-i/data.length,3)*.28;
  }
  reverb.buffer=impulse;wet.gain.value=.14;
  space=context.createGain();space.gain.value=.5;
  space.connect(reverb);reverb.connect(wet);wet.connect(master);
  noise=context.createBuffer(1,Math.ceil(context.sampleRate*.3),context.sampleRate);
  const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 }
 function unlock(){
  if(!Audio||!enabled||document.hidden)return;
  try{
   if(!context)build();
   unlocked=true;
   if(context.state!=='running')context.resume().catch(()=>{});
  }catch{ /* Audio availability must never interrupt a match. */ }
 }
 function track(source,nodes,end){
  active.add(source);
  source.onended=()=>{active.delete(source);source.disconnect();nodes.forEach(node=>node.disconnect())};
  source.stop(end);
 }
 function envelope(node,time,duration,level,attack=.008){
  node.gain.setValueAtTime(0,time);
  node.gain.linearRampToValueAtTime(level,time+attack);
  node.gain.exponentialRampToValueAtTime(.0001,time+duration);
  node.gain.linearRampToValueAtTime(0,time+duration+.025);
 }
 function mallet(time,hz,level=.14,duration=.32,pan=0){
  // Quiet, slightly inharmonic overtones give a rounded glass/wood timbre.
  [[1,1,1],[2.006,.18,.48],[3.98,.035,.22]].forEach(([ratio,strength,decay])=>{
   const source=context.createOscillator(),gain=context.createGain(),position=context.createStereoPanner();
   source.type='sine';source.frequency.value=hz*ratio;position.pan.value=pan;
   envelope(gain,time,duration*decay,level*strength);
   source.connect(gain);gain.connect(position);position.connect(master);position.connect(space);
   source.start(time);track(source,[gain,position],time+duration*decay+.04);
  });
 }
 function brush(time,level=.05,duration=.13,frequency=1700){
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  source.buffer=noise;filter.type='bandpass';filter.Q.value=.65;
  filter.frequency.setValueAtTime(frequency,time);
  filter.frequency.exponentialRampToValueAtTime(frequency*.55,time+duration);
  envelope(gain,time,duration,level,.018);
  source.connect(filter);filter.connect(gain);gain.connect(master);gain.connect(space);
  source.start(time);track(source,[filter,gain],time+duration+.04);
 }
 const cues={
  select(t){mallet(t,520,.095,.12,-.12);brush(t,.018,.045,2100)},
  deal(t){brush(t,.085,.16,2400);brush(t+.045,.035,.13,1400)},
  start(t){brush(t,.045,.18);mallet(t,523.25,.12,.34,-.18);mallet(t+.09,783.99,.10,.42,.18)},
  match(t){mallet(t,783.99,.17,.38,-.16);mallet(t+.065,1174.66,.115,.46,.16);brush(t,.025,.07,3100)},
  wrong(t){mallet(t,196,.13,.16);brush(t,.035,.065,650)},
  opponent(t){mallet(t,392,.12,.28,.1);mallet(t+.075,329.63,.075,.31,-.1)},
  pause(t){mallet(t,440,.075,.19);mallet(t+.045,329.63,.045,.22)},
  resume(t){mallet(t,329.63,.065,.19);mallet(t+.045,440,.065,.24)},
  win(t){
   brush(t,.04,.22,2600);
   [523.25,659.25,783.99,1046.5].forEach((hz,i)=>mallet(t+i*.095,hz,.13-i*.012,.65,-.24+i*.16));
   mallet(t+.3,659.25,.055,.75,-.12);
  },
  finish(t){mallet(t,392,.10,.5,-.15);mallet(t+.12,523.25,.075,.65,.15)}
 };
 function play(name){
  if(!enabled||!unlocked||!context||document.hidden||!cues[name])return;
  const now=context.currentTime;
  if(now-(last.get(name)??-Infinity)<(name==='select'?.045:.09))return;
  last.set(name,now);
  try{if(context.state!=='running')context.resume().catch(()=>{});cues[name](now+.006)}catch{}
 }
 function toggle(){
  enabled=!enabled;try{localStorage.setItem(store,enabled?'on':'off')}catch{}
  paint();
  if(enabled){unlock();if(context){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(.58,context.currentTime,.012)}play('select')}
  else if(context){
   master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(0,context.currentTime,.008);
   active.forEach(source=>{try{source.stop(context.currentTime+.04)}catch{}});
  }
 }
 button.addEventListener('click',toggle);
 function gesture(event){if(event.isTrusted)unlock()}
 document.addEventListener('pointerdown',gesture,{capture:true,passive:true});
 document.addEventListener('keydown',gesture,{capture:true});
 document.addEventListener('visibilitychange',()=>{
  if(!context)return;
  if(document.hidden){active.forEach(source=>{try{source.stop()}catch{}});last.clear();context.suspend().catch(()=>{})}
  else if(unlocked&&enabled)context.resume().catch(()=>{});
 });
 paint();
 if(!Audio){button.disabled=true;button.title='Sound effects unavailable in this browser'}
 window.SPOT_SOUND={play,unlock,get enabled(){return enabled}};
})();

/* Bundled lab announcements; playback never reads assay inputs or contacts a speech API. */
(()=>{
'use strict';
const lines={welcome:'Welcome to Vesper. Laboratory systems online. Ready when you are.',start:'Amplification sequence initiated. Thermal cycling in progress.',complete:'Amplification complete. Analysis finished. Results are ready for review.',invalid:'Run complete. Control failure detected. Results are invalid. Please review the controls.'};
const button=document.querySelector('#labVoiceToggle'),caption=document.querySelector('#labAnnouncement');
const player=new Audio();player.preload='auto';player.volume=.75;
const assetBase=new URL('audio/',document.currentScript.src);
let enabled=true,welcomed=false,sequence=0;
try{enabled=localStorage.getItem('vesper-lab-voice')!=='off';}catch{}
function render(ready=false){button.textContent=enabled?(ready?'Voice · ready':'Voice · on'):'Voice · off';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?(ready?'Play lab welcome':'Mute lab voice'):'Enable lab voice');}
function stop(){sequence++;player.pause();player.currentTime=0;}
async function announce(key){
 if(!lines[key])return;
 caption.textContent=lines[key];
 stop();if(!enabled||document.hidden)return;
 const current=sequence;
 player.src=new URL(key+'.mp3',assetBase).href;
 try{await player.play();if(current===sequence)render();}
 catch(error){if(current!==sequence||!enabled)return;render(true);if(error.name!=='NotAllowedError')caption.textContent=lines[key]+' Voice playback unavailable.';}
}
function welcome(){if(welcomed||!enabled||document.hidden)return;welcomed=true;announce('welcome');}
button.addEventListener('click',()=>{if(enabled&&!welcomed){welcomed=true;announce('welcome');return;}enabled=!enabled;stop();try{localStorage.setItem('vesper-lab-voice',enabled?'on':'off');}catch{}render();if(enabled){welcomed=true;announce('welcome');}});
// Browsers require an interaction before sound. Mute clicks must not trigger the greeting.
document.addEventListener('pointerdown',e=>{if(e.target.closest('#labVoiceToggle'))return;welcome();},{capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Shift'||e.target.closest('#labVoiceToggle'))return;welcome();},{capture:true});
window.addEventListener('vesper:voice',e=>{if(e.detail==='stop')stop();else{welcomed=true;announce(e.detail);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
render(enabled);
if(!enabled)caption.textContent='Lab voice muted. Announcements appear here.';
})();

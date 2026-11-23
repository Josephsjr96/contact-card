/* A short, skippable introduction followed by solo and friends entry points. */
(() => {
 'use strict';
 const intro=$('start-intro'),menu=$('start-menu'),game=$('game-view'),art=$('menu-art');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let timer;
 art.querySelectorAll('[data-menu-symbol]').forEach(el=>{
  const key=el.dataset.menuSymbol;el.innerHTML=icon(key);el.style.setProperty('--symbol-color',ICONS[key].color);
 });
 function seen(){try{sessionStorage.setItem('spot-it-intro-v1','seen')}catch{}}
 function screen(name){
  clearTimeout(timer);document.body.dataset.screen=name;
  intro.hidden=name!=='intro';menu.hidden=name!=='menu';game.hidden=name!=='game';
  document.body.classList.toggle('playing',name==='game');
  document.body.classList.toggle('menu-screen',name!=='game');
 }
 function open(focus=true){
  if(pvp)return;
  if(started&&!paused)togglePause();
  if($('result-modal').open)$('result-modal').close();
  seen();$('menu-art-slot').appendChild(art);
  $('menu-pace').value=$('difficulty').value;
  $('menu-resume').hidden=!(started&&paused);
  $('menu-solo').textContent=started?'New solo game':'Play solo';
  screen('menu');
  if(focus)($(started?'menu-resume':'menu-solo')).focus({preventScroll:true});
 }
 function showGame(focus=false){
  screen('game');
  if(focus)$('p1-card').querySelector('.symbol')?.focus({preventScroll:true});
 }
 $('skip-intro').addEventListener('click',()=>open());
 $('menu-solo').addEventListener('click',()=>{
  $('difficulty').value=$('menu-pace').value;showGame();initGame();
  $('p1-card').querySelector('.symbol')?.focus({preventScroll:true});
 });
 $('menu-resume').addEventListener('click',()=>{showGame(true);if(paused)togglePause()});
 $('menu-pvp').addEventListener('click',()=>window.SPOT_PVP?.showJoin());
 $('menu-help').addEventListener('click',()=>$('help-button').click());
 $('menu-button').addEventListener('click',()=>open());
 $('close-result').textContent='Main menu';
 $('close-result').addEventListener('click',()=>{if(pvp)window.SPOT_PVP?.leave();else open()});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.dataset.screen==='intro'){event.preventDefault();open()}
 });
 reduce.addEventListener('change',()=>{if(reduce.matches&&document.body.dataset.screen==='intro')open(false)});
 window.SPOT_MENU={open,showGame};
 let introSeen=false;try{introSeen=sessionStorage.getItem('spot-it-intro-v1')==='seen'}catch{}
 if(new URL(location.href).searchParams.has('room'))showGame();
 else if(reduce.matches||introSeen)open(false);
 else{screen('intro');timer=setTimeout(()=>open(document.activeElement=== $('skip-intro')),1700)}
})();

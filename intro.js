/* A finite welcome, replayable without blocking deep links or reduced motion. */
(() => {
  const intro=document.getElementById('boot'),skip=document.getElementById('intro-skip');
  if(!intro||!skip)return;
  let closed=true,timer=0,returnFocus=null;
  const content=()=>document.querySelectorAll('.site-header,main,.site-footer');
  function lock(){if(!closed)content().forEach(el=>el.inert=true);}
  function dismiss(){
    if(closed)return;closed=true;clearTimeout(timer);
    const hadFocus=intro.contains(document.activeElement);
    intro.hidden=true;document.documentElement.classList.remove('intro-active');
    if(window.__portfolioIntro)window.__portfolioIntro.active=false;
    content().forEach(el=>el.inert=false);
    if(hadFocus)(returnFocus?.isConnected?returnFocus:document.querySelector('.brand'))?.focus({preventScroll:true});
  }
  function open(){
    if(!closed||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    closed=false;returnFocus=document.activeElement;intro.hidden=false;
    document.documentElement.classList.add('intro-active');
    window.__portfolioIntro={start:performance.now(),duration:3500,active:true};
    try{sessionStorage.setItem('joe_intro_seen_motion_v1','1');}catch{}
    lock();timer=setTimeout(dismiss,3500);
  }
  skip.onclick=dismiss;
  document.addEventListener('keydown',event=>{if(event.key==='Escape')dismiss();});
  document.addEventListener('DOMContentLoaded',lock,{once:true});
  window.addEventListener('hashchange',dismiss);
  window.addEventListener('portfolio:replay-intro',open);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)dismiss();});
  if(window.__joeShowIntro)open();
})();

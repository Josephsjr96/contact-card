/* Adapted from the user's Nix neural field: ambient geometry only. */
(() => {
  const canvas = document.getElementById('wave-field');
  const toggle = document.getElementById('motion-toggle');
  const ctx = canvas?.getContext('2d', {alpha:false});
  if (!ctx || !toggle) return;
  const theme=getComputedStyle(document.documentElement);
  const palette={bg:theme.getPropertyValue('--bg').trim(),cyan:theme.getPropertyValue('--wave-cyan').trim(),blue:theme.getPropertyValue('--wave-blue').trim(),violet:theme.getPropertyValue('--wave-violet').trim()};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduce.matches, width=0, height=0, cols=0, rows=0, points=[], dust=[];
  let clock=0, last=0, rendered=0, raf=0;
  function resize() {
    width=innerWidth; height=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cols=width<600?48:76; rows=width<600?13:18;
    points=Array.from({length:cols*rows},()=>({x:0,y:0,z:0}));
    let seed=4271;
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    dust=Array.from({length:width<600?50:130},()=>({u:rand(),v:rand(),depth:rand(),size:rand()}));
    draw();
  }
  // Same folds, depth and vanishing point as Nix; a slower, quieter idle field.
  function project(u,v,t,loose=0) {
    const envelope=Math.pow(1-u,1.55), phase=u*9-t*.5;
    const fold=Math.sin(phase+v*4.8+t*.23);
    const amplitude=height*(width<700?.43:.72)*envelope;
    const center=height*(width<700?.65:.61)+Math.sin(u*7-t*.18)*height*.07*envelope;
    const depth=Math.cos(v*Math.PI*2+u*4+t*.13);
    const wave=Math.sin(v*Math.PI*2+phase)*.54+(v-.5)*.88+fold*.3;
    return {x:(u*1.35-.16)*width+depth*width*.025*envelope,
      y:center+(wave+Math.sin(u*73+v*107)*.025)*amplitude*.965+loose,z:depth};
  }
  function line(a,b,alpha,color) {
    ctx.strokeStyle=`rgba(${color},${alpha})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  function draw() {
    ctx.fillStyle=palette.bg;ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.53,height*.65,0,width*.53,height*.65,width*.64);
    glow.addColorStop(0,`rgba(${palette.blue},.11)`);glow.addColorStop(.5,`rgba(${palette.violet},.035)`);glow.addColorStop(1,'rgba(23,30,46,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);ctx.lineWidth=.55;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)Object.assign(points[r*cols+c],project(c/(cols-1),r/(rows-1),clock));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
      const p=points[r*cols+c],u=c/(cols-1),alpha=(.17+(p.z+1)*.14)*.8*(1-u*.5);
      const color=r%7===0?palette.violet:r%3===0?palette.blue:palette.cyan;
      if(c<cols-1)line(p,points[r*cols+c+1],alpha,color);
      if(r<rows-1){line(p,points[(r+1)*cols+c],alpha*.67,color);if(c<cols-1)line(p,points[(r+1)*cols+c+1],alpha*.6,color);}
    }
    ctx.globalCompositeOperation='lighter';
    for(let j=0;j<14;j++) {
      ctx.beginPath();for(let i=0;i<=76;i++){const p=project(i/76,j/13,clock+.15);const y=p.y+Math.sin(i*.13+clock+j)*3;i?ctx.lineTo(p.x,y):ctx.moveTo(p.x,y);}
      ctx.strokeStyle=`rgba(${palette.cyan},.085)`;ctx.lineWidth=j%4===0?1.4:.6;ctx.stroke();
    }
    for(const particle of dust) {
      const u=(particle.u+clock*.018*(.4+particle.depth))%1;
      const p=project(u,particle.v,clock,(particle.depth-.5)*height*.6*Math.pow(1-u,1.8));
      const radius=(.5+Math.pow(particle.size,5)*3)*(1-u*.65);
      ctx.fillStyle=`rgba(${particle.v>.5?palette.violet:palette.cyan},${.35+particle.depth*.35})`;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }
  function frame(now) {
    raf=0;if(paused||document.hidden)return;
    if(now-rendered>=1000/24){clock+=last?Math.min((now-last)/1000,.1)*.14:0;last=now;rendered=now;draw();}
    raf=requestAnimationFrame(frame);
  }
  function start(){if(!paused&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(frame);}}
  function setPaused(value) {
    paused=!!value;toggle.setAttribute('aria-pressed',String(paused));
    toggle.textContent=paused?'Resume waves':'Pause waves';
    canvas.dataset.paused=String(paused);
    if(paused){cancelAnimationFrame(raf);raf=0;draw();}else start();
  }
  toggle.hidden=false;toggle.onclick=()=>setPaused(!paused);
  reduce.addEventListener('change',event=>setPaused(event.matches));
  addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else start();});
  resize();setPaused(paused);
})();

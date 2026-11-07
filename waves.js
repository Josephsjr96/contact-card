/* Nix-inspired multidisciplinary field. Native WebGL; no framework or network. */
(() => {
  'use strict';
  let canvas = document.getElementById('wave-field');
  const toggle = document.getElementById('motion-toggle');
  if (!canvas || !toggle) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = [[.38,.90,.87],[.57,.66,1],[.77,.53,1],[1,.71,.44]];
  let width=0,height=0,dpr=1,time=0,last=0,raf=0,paused=reduce.matches,lost=false;
  let introMix=0,drawBackend,resizeBackend,renderer='canvas2d',fallbackReason='',gpuValidated=false,frames=0,totalMs=0,maxMs=0;
  let pointerX=0,pointerY=0,focusX=0,focusY=0,quality=1;
  const samples=[];
  let resolutionScale=1,slowSamples=0;
  let seed=4271;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const points=[],lines=[];
  const add=(x,y,z,u,v,group,style)=>points.push(x,y,z,u,v,group,rand(),style);
  const segments=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  // Four actual geometries, rather than arbitrary labels on identical dust.
  const aiNodes=[[-.8,-.7,0],[-.8,0,.1],[-.8,.7,0],[0,-.95,.1],[0,-.32,.25],[0,.32,-.2],[0,.95,.1],[.8,-.55,0],[.8,.15,.2],[.8,.7,-.1]];
  const aiEdges=[];
  for(let a=0;a<3;a++)for(let b=3;b<7;b++)aiEdges.push([aiNodes[a],aiNodes[b]]);
  for(let a=3;a<7;a++)for(let b=7;b<10;b++)aiEdges.push([aiNodes[a],aiNodes[b]]);
  const code=[[[.05,-.8,0],[-.35,.8,0]],[[-.52,-.5,0],[-1,0,0]],[[-1,0,0],[-.52,.5,0]],[[.52,-.5,0],[1,0,0]],[[1,0,0],[.52,.5,0]]];
  const film=[];
  for(let i=0;i<3;i++){const x=-1.05+i*.72;film.push([[x,-.6,0],[x+.6,-.6,0]],[[x+.6,-.6,0],[x+.6,.5,0]],[[x+.6,.5,0],[x,.5,0]],[[x,.5,0],[x,-.6,0]]);}
  film.push([[-1.05,-.85,0],[1.05,-.85,0]],[[-1.05,.78,0],[1.05,.78,0]]);
  for(let i=0;i<9;i++){const x=-.98+i*.24;film.push([[x,-.88,0],[x,-.74,0]],[[x,.73,0],[x,.86,0]]);}
  const shapeCount=1000;
  for(let group=0;group<4;group++)for(let i=0;i<shapeCount;i++){
    let p;
    if(group===0){if(i%4===0){const n=aiNodes[i%aiNodes.length],a=rand()*Math.PI*2,r=.035+rand()*.07;p=[n[0]+Math.cos(a)*r,n[1]+Math.sin(a)*r,n[2]];}else{const e=aiEdges[i%aiEdges.length];p=segments(e[0],e[1],rand());}}
    else if(group===1){const a=rand()*Math.PI*2;if(i%3){const y=rand()*2-1,r=Math.sqrt(1-y*y)*.69;p=[Math.cos(a)*r,y*.69,Math.sin(a)*r];}else{const r=1.02+rand()*.13;p=[Math.cos(a)*r,Math.sin(a)*r*.24,Math.sin(a)*r*.48];}}
    else {const paths=group===2?code:film,e=paths[i%paths.length];p=segments(e[0],e[1],rand());}
    p=p.map(n=>n+(rand()-.5)*.018);
    add(...p,rand(),rand(),group,1);
  }
  const shapeEnd=points.length/8;
  const cols=88,rows=17,gridStart=shapeEnd;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    add(0,0,0,c/(cols-1),r/(rows-1),Math.floor(r/rows*4),0);
    const i=gridStart+r*cols+c;
    if(c<cols-1)lines.push(i,i+1);
    if(r<rows-1){lines.push(i,i+cols);if(c<cols-1&&c%2===0)lines.push(i,i+cols+1);}
  }
  for(let i=0;i<650;i++)add(0,0,0,rand(),rand(),i%4,2);
  const data=new Float32Array(points),indices=new Uint16Array(lines),count=data.length/8;
  const vertex=`
    precision highp float;
    attribute vec3 aTarget;
    attribute vec4 aParams;
    attribute float aStyle;
    uniform float uTime,uAspect,uDpr,uIntro,uProgress;
    uniform mediump float uPass;
    uniform vec2 uPointer;
    varying mediump vec3 vColor;
    varying mediump float vAlpha;
    vec3 palette(float n){if(n<.5)return vec3(.38,.90,.87);if(n<1.5)return vec3(.57,.66,1.);if(n<2.5)return vec3(.77,.53,1.);return vec3(1.,.71,.44);}
    vec3 wave(float u,float v){
      float env=pow(1.-u,1.55),phase=u*9.-uTime*.32;
      float fold=sin(phase+v*4.8+uTime*.15);
      float depth=cos(v*6.283+u*4.+uTime*.09);
      float y=sin(v*6.283+phase)*.54+(v-.5)*.88+fold*.3;
      return vec3((u*1.35-.16)*2.-1.+depth*.05*env,
        -.22+sin(u*7.-uTime*.12)*.14*env+y*env*(uAspect<.8?.88:1.3),depth);
    }
    void main(){
      float group=aParams.z,s=aParams.w;
      vec3 w=wave(aParams.x,aParams.y);
      vec3 p=w;
      float bright=1.;
      if(aStyle>.5&&aStyle<1.5){
        float angle=uTime*.13+group*.25;
        vec3 q=aTarget;
        q.xz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q.xz;
        vec2 center=group<.5?vec2(-.66,.43):group<1.5?vec2(.66,-.34):group<2.5?vec2(-.67,-.62):vec2(.65,.65);
        center.x*=min(1.,uAspect);
        center+=vec2(sin(uTime*.17+group*2.),cos(uTime*.13+group*1.7))*.055;
        vec3 glyph=vec3(center+q.xy*vec2(.38/uAspect,.38),q.z);
        float gather=smoothstep(.02,.28,uProgress)*(1.-smoothstep(.65,1.,uProgress));
        float morph=mix(.48+.28*sin(uTime*.16+group*1.3),gather,uIntro);
        p=mix(w,glyph,morph);
        p.xy+=vec2(sin(s*63.+uTime*.22),cos(s*49.+uTime*.19))*.009;
        vAlpha=mix(.27,.72,uIntro)*(.55+s*.45);
      }else if(aStyle>1.5){
        float u=fract(aParams.x+uTime*(.004+s*.009));
        p=wave(u,aParams.y);
        p.y+=(s-.5)*1.3*pow(1.-u,1.8);
        p.x+=sin(s*100.+uTime*.2)*.03;
        vAlpha=.28+s*.3;
      }else{vAlpha=(.12+(w.z+1.)*.05)*(1.-aParams.x*.5);}
      p.xy+=uPointer*vec2(.028,.02)*(1.+p.z*.3);
      p.xy*=1.+uIntro*.06;
      vColor=palette(group);
      float twinkle=.82+.18*sin(uTime*.7+s*50.);
      vAlpha*=twinkle;
      if(uPass<.5)vAlpha*=mix(.75,1.5,uIntro);
      gl_Position=vec4(p.xy,0.,1.);
      gl_PointSize=(aStyle>1.5?1.3+pow(s,6.)*8.:1.6+s*1.7)*uDpr*(1.+uIntro*.25);
    }`;
  const fragment=`precision mediump float;uniform float uPass;varying mediump vec3 vColor;varying mediump float vAlpha;
    void main(){float a=vAlpha;if(uPass>.5){vec2 d=gl_PointCoord-.5;float r=dot(d,d);a*=exp(-r*24.)+.18*exp(-r*5.);if(a<.008)discard;}gl_FragColor=vec4(vColor,a);}`;
  const bgVertex=`attribute vec2 aPosition;varying mediump vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
  const bgFragment=`precision mediump float;varying mediump vec2 vUV;uniform float uTime,uIntro;void main(){
    vec2 uv=vUV;vec2 p=uv-vec2(.72+.04*sin(uTime*.05),.6);
    float g=max(0.,1.-length(p*vec2(1.4,2.1)));g*=g;
    float v=max(0.,1.-length((uv-vec2(.18,.35))*2.));v*=v;
    float fold=.75;
    vec3 base=mix(vec3(.09,.118,.18),vec3(.018,.033,.065),uIntro);
    vec3 color=base+vec3(.015,.075,.095)*g*fold+vec3(.04,.012,.07)*v;
    color*=1.-.14*length(uv-.5);gl_FragColor=vec4(color,1.);}`;
  function gpu(){
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(!gl){fallbackReason='WebGL unavailable';return false;}
    function program(v,f){const p=gl.createProgram();for(const [type,source]of[[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
    const field=program(vertex,fragment),background=program(bgVertex,bgFragment);
    gpuValidated=true;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const device=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';
    if(/swiftshader|llvmpipe|softpipe/i.test(device)&&innerWidth*innerHeight>850000){
      fallbackReason='Software graphics: using the lower-cost 2D field';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return false;
    }
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const attribute={target:gl.getAttribLocation(field,'aTarget'),params:gl.getAttribLocation(field,'aParams'),style:gl.getAttribLocation(field,'aStyle'),quad:gl.getAttribLocation(background,'aPosition')};
    const uniform=Object.fromEntries(['uTime','uAspect','uDpr','uIntro','uProgress','uPass','uPointer'].map(name=>[name,gl.getUniformLocation(field,name)]));
    const bTime=gl.getUniformLocation(background,'uTime'),bIntro=gl.getUniformLocation(background,'uIntro');
    resizeBackend=()=>gl.viewport(0,0,canvas.width,canvas.height);
    drawBackend=progress=>{
      gl.disable(gl.BLEND);gl.useProgram(background);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
      for(const loc of [attribute.target,attribute.params,attribute.style])if(loc>=0)gl.disableVertexAttribArray(loc);
      gl.enableVertexAttribArray(attribute.quad);gl.vertexAttribPointer(attribute.quad,2,gl.FLOAT,false,0,0);
      gl.uniform1f(bTime,time);gl.uniform1f(bIntro,introMix);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      gl.useProgram(field);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.disableVertexAttribArray(attribute.quad);
      for(const [loc,size,offset]of[[attribute.target,3,0],[attribute.params,4,12],[attribute.style,1,28]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);}
      gl.uniform1f(uniform.uTime,time);gl.uniform1f(uniform.uAspect,width/height);gl.uniform1f(uniform.uDpr,dpr);gl.uniform1f(uniform.uIntro,introMix);gl.uniform1f(uniform.uProgress,progress);gl.uniform2f(uniform.uPointer,focusX,focusY);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.uniform1f(uniform.uPass,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.drawElements(gl.LINES,indices.length,gl.UNSIGNED_SHORT,0);
      gl.uniform1f(uniform.uPass,1);gl.drawArrays(gl.POINTS,0,Math.floor(count*quality));
    };
    renderer='webgl';return true;
  }
  function fallback(){
    if(canvas.getContext('2d')===null){const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;}
    const ctx=canvas.getContext('2d',{alpha:false});
    resizeBackend=()=>ctx.setTransform(dpr,0,0,dpr,0,0);
    drawBackend=progress=>{
      ctx.fillStyle=introMix>.5?'#071121':'#171e2e';ctx.fillRect(0,0,width,height);
      const scale=Math.min(width,height)*.19,mesh=new Float32Array(cols*rows*2);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const u=c/(cols-1),v=r/(rows-1),env=Math.pow(1-u,1.55),phase=u*9-time*.32;
        const fold=Math.sin(phase+v*4.8+time*.15),depth=Math.cos(v*Math.PI*2+u*4+time*.09);
        const k=(r*cols+c)*2;
        mesh[k]=(u*1.35-.16)*width+depth*width*.025*env;
        mesh[k+1]=height*.61-Math.sin(u*7-time*.12)*height*.07*env-(Math.sin(v*Math.PI*2+phase)*.54+(v-.5)*.88+fold*.3)*env*height*(width<700?.44:.65);
      }
      for(let group=0;group<4;group++){
        const c=colors[group].map(n=>Math.round(n*255)).join(',');ctx.strokeStyle=`rgba(${c},${.15+introMix*.04})`;ctx.lineWidth=.6;ctx.beginPath();
        for(let r=group;r<rows;r+=4)for(let col=0;col<cols;col++){
          const k=(r*cols+col)*2,x=mesh[k],y=mesh[k+1];
          if(col<cols-1){ctx.moveTo(x,y);ctx.lineTo(mesh[k+2],mesh[k+3]);}
          if(r<rows-1){const next=k+cols*2;ctx.moveTo(x,y);ctx.lineTo(mesh[next],mesh[next+1]);if(col<cols-1&&col%2===0){ctx.moveTo(x,y);ctx.lineTo(mesh[next+2],mesh[next+3]);}}
        }
        ctx.stroke();ctx.fillStyle=`rgba(${c},${.29+introMix*.3})`;ctx.beginPath();
        const cx=width*(group===0||group===2?.2:.8),cy=height*([.3,.66,.8,.2][group]);
        for(let i=group*shapeCount;i<(group+1)*shapeCount;i+=3){
          const k=i*8,angle=time*.13+group*.25,x=data[k]*Math.cos(angle)+data[k+2]*Math.sin(angle),y=data[k+1];
          const tx=cx+x*scale,ty=cy-y*scale;
          ctx.moveTo(tx+1,ty);ctx.arc(tx,ty,1.1,0,Math.PI*2);
        }
        ctx.fill();
      }
    };renderer='canvas2d';
  }
  try{if(!gpu())fallback();}catch(error){fallbackReason=String(error.message);console.info('Using the lightweight particle field.',error.message);fallback();}
  function state(){const s=window.__portfolioIntro;return s?.active?Math.min(1,(performance.now()-s.start)/s.duration):1;}
  function draw(){if(lost)return;const start=performance.now();drawBackend(state());frames++;const ms=performance.now()-start;totalMs+=ms;maxMs=Math.max(maxMs,ms);}
  function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,width<700?1.4:1.6)*resolutionScale;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);resizeBackend();draw();}
  function frame(now){
    raf=0;if(paused||document.hidden||lost)return;
    const dt=last?Math.min((now-last)/1000,.05):1/60;
    if(last){samples.push(now-last);if(samples.length>180)samples.shift();}
    if(last && now-last>19)slowSamples++;else slowSamples=Math.max(0,slowSamples-1);
    if(renderer==='webgl'&&slowSamples>36&&resolutionScale>.65){resolutionScale=Math.max(.64,resolutionScale*.8);slowSamples=0;resize();}
    last=now;time+=dt;
    const blend=1-Math.exp(-dt*4);
    focusX+=(pointerX-focusX)*blend;focusY+=(pointerY-focusY)*blend;
    introMix+=((window.__portfolioIntro?.active?1:0)-introMix)*blend;
    draw();raf=requestAnimationFrame(frame);
  }
  function start(){if(!paused&&!document.hidden&&!lost&&!raf){last=0;raf=requestAnimationFrame(frame);}}
  function setPaused(value){paused=!!value;toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'Resume waves':'Pause waves';canvas.dataset.paused=String(paused);if(paused){cancelAnimationFrame(raf);raf=0;draw();}else start();}
  toggle.hidden=false;toggle.onclick=()=>setPaused(!paused);
  const replay=document.getElementById('replay-intro');if(replay){replay.hidden=reduce.matches;replay.onclick=()=>window.dispatchEvent(new Event('portfolio:replay-intro'));}
  reduce.addEventListener('change',event=>{setPaused(event.matches);if(replay)replay.hidden=event.matches;});
  addEventListener('pointermove',event=>{pointerX=event.clientX/Math.max(1,width)*2-1;pointerY=1-event.clientY/Math.max(1,height)*2;},{passive:true});
  addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else start();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;canvas.dataset.renderer='recovering';});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;try{gpu();resize();canvas.dataset.renderer=renderer;start();}catch{fallback();resize();canvas.dataset.renderer=renderer;start();}});
  window.PORTFOLIO_FIELD={stats:()=>({renderer,fallbackReason,gpuValidated,particles:count,frames,meanDrawMs:frames?totalMs/frames:0,maxDrawMs:maxMs,observedFps:samples.length?1000/(samples.reduce((a,b)=>a+b,0)/samples.length):0,paused,quality,resolutionScale}),snapshot:()=>{draw();return canvas.toDataURL();}};
  canvas.dataset.renderer=renderer;
  introMix=window.__portfolioIntro?.active?1:0;
  resize();setPaused(paused);
})();

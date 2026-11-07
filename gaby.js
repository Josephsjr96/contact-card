/* Optional portfolio assistant. Common questions are answered locally. */
(() => {
  const S = window.SITE;
  const replies = [
    {keys:['space ship duel','space duel','game design','space game','pygame'],text:'Space Ship Duel is Joe’s independent Python/Pygame arcade project. It combines wave combat, weapon progression and six-world sector travel with a cinematic opening and mission briefings. His work covers gameplay programming, interface design, visual direction and automated testing. The case study includes actual game screenshots and explains the AI-assisted planet artwork.',action:'space-duel'},
    {keys:['who is joe','about joe','background','introduce'], text:"Joe is Yousef (Joseph) Sanjari, a Python and AI software developer in Warsaw. He builds APIs, model evaluation tools and interactive applications. His strengths connect practical troubleshooting, systems thinking and clear technical communication, backed by machine learning, freelance development and IT support experience.", action:'cv'},
    {keys:['business intelligence','analytics','data analys','skills','python','sql','pandas','excel','tableau','power bi','fastapi','react','typescript','strengths','assets'], text:"Joe builds Python APIs with FastAPI and Flask, works with SQL/SQLite and React/TypeScript interfaces, and develops AI applications and model evaluation tools using PyTorch, Transformers, LoRA/PEFT, Pandas and NumPy. His work also includes testing, monitoring, dashboards and technical explainers. His core strengths are practical problem solving, systems thinking and clear communication. His CV does not list Excel, Power BI or Tableau proficiency.", action:'cv'},
    {keys:['data explorer','movie'], text:'Data Explorer cleans a 74-row movie dataset into 72 unique records and presents genre comparisons, summary statistics and rankings. Movie titles are real; ratings and financial figures are simulated practice data.',action:'data-explorer'},
    {keys:['mlops','canary','rollback','monitoring','research ml'],text:'The Research ML Platform combines Python services with a Streamlit dashboard for model versions, evaluation and canary deployment. Local tests cover version integrity and rollback. It is a research prototype, and linguistic quality review is separate.',action:'mlops'},
    {keys:['simon','inference','receipt'],text:'SIMON is a team project on distributed AI inference. Joe contributed to heterogeneous inference workflows, signed output receipts and AMD MI300X experiments. A valid receipt binds a node to its answer; it does not prove which model executed.',action:'simon'},
    {keys:['video','motion','explain','storytelling'],text:'Joe created motion-graphics explainers for MLOps, SIMON and AI Behavior Lab, using animated diagrams, metric panels and captions. Watch SIMON, Canary MLOps and Water Tank in the Project Films section.',action:'films'},
    {keys:['translator','translation','poetry','nllb'],text:'The multilingual research app compares NLLB-200 and M2M-100 across Persian, German and Polish, with model outputs, evaluation metrics and human ratings. Model-version integrity tests do not establish translation quality.',action:'translator'},
    {keys:['animation','storyboard','ocr'],text:'The Animation Production Workspace supports storyboard scanning and correction review, shots and scheduling. Grouped shots and drawing galleries are documented as local features.',action:'animation'},
    {keys:['rulebox','agents.md','lora'],text:'Rulebox is a local Python/SQLite instruction manager with reviewed updates, backups and stale-preview checks. Its optional LoRA tooling supports a separate local rule writer; no quality-validated adapter is bundled.',action:'rulebox'},
    {keys:['polish app','polisha1','learning app','tutor'],text:'Polish A1 is an offline-capable learning app with everyday dialogues, grammar, pronunciation, quizzes and saved word lists.',action:'polish'},
    {keys:['education','university','degree','study','studies'],text:'Joe is pursuing an M.Eng. in Computer Engineering, Applied Data Science & AI, at Vistula University (2026–expected 2028). He holds a B.A. in Computer Software Engineering from Jahrom University and an Associate Degree in IT.',action:'cv'},
    {keys:['language','speak','german','persian','arabic','english','polish'],text:'English C1; Persian and Arabic native; German A2; Polish A1.',action:'cv'},
    {keys:['experience','noyan','employer','career'],text:'His CV lists Machine Learning Developer at NoyanGames (2025–2026), Freelance Software Developer (June 2024–present), and IT Support at Iran Rahjoo Co. (September 2020–October 2022).',action:'cv'},
    {keys:['cv','resume','résumé','download'],text:'The current CV is a general professional profile covering Python development, AI and ML systems, practical problem solving and technical communication. Read it on this page or download the one-page PDF.',action:'download'},
    {keys:['contact','email','phone','hire','availability','available','salary','rate','whatsapp'],text:"Email josephsanjari1996@gmail.com or call +48 730 504 025. For availability, rates or role details, contact Joe directly; I can't confirm those on his behalf.",action:'contact'},
    {keys:['project','work','portfolio'],text:'Explore the Research ML Platform, Animation Production Workspace, Rulebox and SIMON. The Game Design section presents Space Ship Duel with gameplay screenshots and a case study. More projects cover data analysis, multilingual research, technical explainers and language learning.',action:'work'},
    {keys:['hello','hi','hey','salam','سلام'],text:"Hi, I'm Gaby. I can help you find Joe's projects, skills, CV or contact details.",action:'work'}
  ];
  const fold = text => String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function localAnswer(text) {
    const t = fold(text);
    // Longer matches win so a short greeting cannot override a specific topic.
    let best = null, score = 0;
    for (const reply of replies) for (const key of reply.keys) {
      const match = fold(key);
      const found = match.length <= 3 ? new RegExp('(?:^|\\s)'+match+'(?:$|[\\s!?.])').test(t) : t.includes(match);
      if (found && match.length > score) {best=reply;score=match.length;}
    }
    return best;
  }
  const css = document.createElement('style');
  css.textContent = `
  #gaby-fab{position:fixed;right:22px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:40;min-height:44px;padding:10px 17px;border-radius:8px;border:1px solid #5b7394;background:#25384f;color:#baf4ee;font:600 13px system-ui;box-shadow:0 5px 20px #0003}
  #gaby-fab:hover{background:#304962}#gaby-overlay{position:fixed;inset:0;z-index:49;background:#0007}
  #gaby-panel{position:fixed;right:22px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:50;width:min(390px,calc(100vw - 36px));max-height:calc(100dvh - 40px);height:570px;display:flex;flex-direction:column;background:#202c41;border:1px solid #506483;border-radius:12px;box-shadow:0 18px 70px #0008;overflow:hidden;color:#f3f6ff}
  .gb-header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #3c4d69;padding:16px 18px}.gb-header h2{font:600 16px system-ui;margin:0}.gb-header p{font:12px system-ui;margin:5px 0 0;color:#bdc9df}.gb-close{min-width:44px;min-height:44px;border:0;border-radius:6px;background:transparent;color:inherit;font-size:24px}
  .gb-body{flex:1;overflow:auto;overscroll-behavior:contain;padding:18px;display:flex;flex-direction:column;gap:12px}.gb-message{font-size:14px;line-height:1.6;border-radius:8px;padding:12px 14px;max-width:95%;margin:0;overflow-wrap:anywhere;background:#293950}.gb-message.user{align-self:flex-end;background:#384466}.gb-message p{margin:0}.gb-action{display:block;width:fit-content;color:#9fe9e8;margin-top:10px;font-size:13px}.gb-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 18px 12px}.gb-chips button{background:transparent;border:1px solid #526b87;border-radius:6px;color:#d7e6fa;font-size:12px;min-height:36px;padding:6px 10px}.gb-input{display:flex;gap:8px;padding:0 18px 14px}.gb-input input{width:100%;min-width:0;border:1px solid #5b7394;border-radius:6px;background:#182336;color:#f3f6ff;padding:10px 12px;font-size:14px}.gb-input button{padding:8px 13px;background:#9fe9e8;color:#102c36;border:0;border-radius:6px;font-weight:600;font-size:13px}.gb-input button:disabled{opacity:.6}.gb-disclosure{padding:0 18px 15px;color:#bdc9df;font-size:11px;line-height:1.5}.gb-disclosure summary{cursor:pointer}.gb-disclosure p{margin:7px 0 0}
  @media(max-width:520px){#gaby-panel{right:12px;bottom:12px;width:calc(100vw - 24px);height:min(620px,calc(100dvh - 24px));max-height:calc(100dvh - 24px)}#gaby-fab{right:18px}}
  `;
  document.head.append(css);
  const fab=document.createElement('button');fab.id='gaby-fab';fab.textContent='Ask Gaby';fab.setAttribute('aria-haspopup','dialog');fab.setAttribute('aria-expanded','false');fab.setAttribute('aria-controls','gaby-panel');
  const overlay=document.createElement('div');overlay.id='gaby-overlay';overlay.hidden=true;
  const panel=document.createElement('section');panel.id='gaby-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','gaby-title');
  panel.innerHTML=`<header class="gb-header"><div><h2 id="gaby-title">Gaby</h2><p>Joe's portfolio assistant</p></div><button class="gb-close" type="button" aria-label="Close assistant">×</button></header><div class="gb-body" role="log" aria-live="polite" aria-label="Conversation"></div><div class="gb-chips"><button type="button" data-question="skills">Skills</button><button type="button" data-question="work">Projects</button><button type="button" data-question="download CV">Download CV</button><button type="button" data-question="contact">Contact</button></div><form class="gb-input"><label class="sr-only" for="gb-in">Ask about Joe's work</label><input id="gb-in" maxlength="300" autocomplete="off" placeholder="Ask about Joe's work…" required><button type="submit">Send</button></form><details class="gb-disclosure"><summary>How this assistant works</summary><p>Common questions are answered on this page. Other questions may be sent to an external AI service. Please avoid sharing sensitive information. This chat is not saved by this page.</p></details>`;
  document.body.append(fab,overlay,panel);
  const body=panel.querySelector('.gb-body'),input=panel.querySelector('input'),send=panel.querySelector('[type=submit]');
  const history=[];let busy=false,returnFocus;
  const actions={films:['Watch project films',()=>PORTFOLIO.show('films')],cv:['Read CV',()=>PORTFOLIO.show('cv')],work:['Explore projects',()=>PORTFOLIO.show('work')],contact:['Contact Joe',()=>PORTFOLIO.show('contact')],download:['Download CV (PDF)',null,'cv.pdf']};
  for(const sample of S.samples) actions[sample.id]=[sample.cta,()=>PORTFOLIO.open(sample.id),sample.url];
  function bubble(text,user=false,action) {
    const el=document.createElement('div');el.className='gb-message'+(user?' user':'');
    const p=document.createElement('p');p.textContent=text;el.append(p);
    if(action && actions[action]){
      const [label,run,url]=actions[action];const a=document.createElement('a');a.className='gb-action';a.textContent=label;a.href=url||'#'+action;
      if(action==='download')a.download='Yousef_Sanjari_CV.pdf';
      else if(url && /^https:/.test(url)){a.target='_blank';a.rel='noopener noreferrer';}
      else if(run && !url) a.onclick=event=>{event.preventDefault();close();run();};
      el.append(a);
    }
    body.append(el);body.scrollTop=body.scrollHeight;return el;
  }
  function open(){returnFocus=document.activeElement;panel.hidden=false;overlay.hidden=false;fab.setAttribute('aria-expanded','true');document.querySelectorAll('body > header, body > main, body > footer, body > .skip').forEach(el=>el.inert=true);document.body.style.overflow='hidden';input.focus();}
  function close(){panel.hidden=true;overlay.hidden=true;fab.setAttribute('aria-expanded','false');document.querySelectorAll('body > header, body > main, body > footer, body > .skip').forEach(el=>el.inert=false);document.body.style.overflow='';(returnFocus||fab).focus();}
  fab.onclick=open;overlay.onclick=close;panel.querySelector('.gb-close').onclick=close;
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){
      const focusable=[...panel.querySelectorAll('button,input,a,summary')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  const SYSTEM=`You are Gaby, the portfolio assistant for Yousef (Joseph) Sanjari in Warsaw. Use only these facts: ${replies.map(r=>r.text).join(' ')} Be concise (under 80 words). Reply in the visitor's language. Do not invent experience, qualifications, availability or results. Do not claim Power BI, Tableau or Excel proficiency. Help with Joe's work only; otherwise suggest contacting him. Do not output action tags or markdown.`;
  async function ask(text){
    text=String(text||'').trim().slice(0,300);if(!text||busy)return;
    bubble(text,true);input.value='';const known=localAnswer(text);
    if(known){bubble(known.text,false,known.action);return;}
    busy=true;send.disabled=true;const pending=bubble('Finding an answer…');
    try{
      const response=await fetch(S.WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({messages:[{role:'system',content:SYSTEM},...history.slice(-6),{role:'user',content:text}],max_tokens:250,temperature:0.3})});
      if(!response.ok)throw Error('Service unavailable');
      const data=await response.json();const answer=data?.choices?.[0]?.message?.content;
      if(typeof answer!=='string'||!answer.trim())throw Error('Empty answer');
      pending.remove();const cleaned=answer.replace(/\[\[open:\w+\]\]/g,'').replace(/\*\*/g,'').trim();bubble(cleaned.slice(0,1800));history.push({role:'user',content:text},{role:'assistant',content:cleaned});
    }catch{pending.remove();bubble("I couldn't get an answer from the AI service. Try Skills, Projects or Download CV, or contact Joe directly.",false,'contact');}
    finally{busy=false;send.disabled=false;}
  }
  panel.querySelector('form').onsubmit=event=>{event.preventDefault();ask(input.value);};
  panel.querySelector('.gb-chips').onclick=event=>{const button=event.target.closest('[data-question]');if(button)ask(button.dataset.question);};
  bubble("Hi, I'm Gaby. I can help you find Joe's projects, skills, CV or contact details.");
  window.GABY={open,close,ask,localAnswer};
})();

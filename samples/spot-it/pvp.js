/* Two-player rooms. The server owns rounds, scoring and reconnect state. */
(() => {
 'use strict';
 const API='https://spot-it-pvp.josephsanjari1996.workers.dev';
 const roomPattern=/^[a-f0-9]{24}$/;
 const dialog=$('room-modal'),form=$('room-form'),nameInput=$('player-name'),errorEl=$('room-error');
 let targetRoom=null,soloWasRunning=false,connectTimer=null;
 function saved(room){try{const s=JSON.parse(localStorage.getItem('spot-it-room-'+room));return s?.expiresAt>Date.now()&&typeof s.token==='string'?s:null}catch{return null}}
 function remember(room,session){try{localStorage.setItem('spot-it-room-'+room,JSON.stringify(session))}catch{}}
 function linkFor(room){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',room);return url.href}
 function showJoin(room=null){
  targetRoom=room;errorEl.textContent='';$('room-title').textContent=room?'Join your friend':'Play with a friend';$('room-submit').textContent=room?'Join room':'Create link';
  soloWasRunning=started&&!paused&&!pvp;if(soloWasRunning)togglePause();
  try{nameInput.value=localStorage.getItem('spot-it-player-name')||''}catch{}
  dialog.showModal();nameInput.focus();
 }
 async function request(path,name){
  const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name}),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Could not open the room.');return data;
 }
 function send(data){if(pvp?.socket?.readyState===WebSocket.OPEN){pvp.socket.send(JSON.stringify(data));return true}return false}
 function claimRemote(symbol){if(!pvp||!roundActive||pvp.pending)return;pvp.pending=true;roundActive=false;clearSelection();if(!send({type:'claim',round:pvp.state.round,symbol})){pvp.pending=false;setStatus('Connection lost. Reconnecting…')}}
 function readyRemote(){if(!pvp)return;if(pvp.socket?.readyState!==WebSocket.OPEN){pvp.attempts=0;connect();return}send({type:'ready'})}
 function connectionLost(message){if(!pvp)return;roundActive=false;clearSelection();if(drag?.g)cancelDrag();else drag=null;$('start-button').disabled=false;$('start-button').textContent='Reconnect';setStatus(message);$('opponent-presence').textContent='Reconnecting…'}
 function connect(){
  if(!pvp)return;clearTimeout(connectTimer);const current=pvp;
  if(current.socket&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(current.socket.readyState))return;
  $('start-button').disabled=true;setStatus('Connecting to your room…');
  const socket=new WebSocket(API.replace(/^http/,'ws')+'/rooms/'+current.room+'/socket',['spot-it',current.session.token]);current.socket=socket;
  const timeout=setTimeout(()=>{if(socket.readyState!==WebSocket.OPEN)socket.close()},12000);
  socket.onopen=()=>{clearTimeout(timeout);if(pvp!==current)return;current.attempts=0};
  socket.onmessage=event=>{if(pvp!==current)return;let data;try{data=JSON.parse(event.data)}catch{return}if(data.type==='state'){current.pending=false;paintState(data)}else if(data.type==='error'){current.pending=false;setStatus(data.message,'bad')}};
  socket.onerror=()=>{};
  socket.onclose=event=>{clearTimeout(timeout);if(pvp!==current)return;connectionLost(event.code===4001?'This player is connected in another tab.':event.code===4004?'This room expired. Leave and create a new link.':'Connection lost. Reconnecting…');if([4001,4004].includes(event.code))return;if(current.attempts++<5)connectTimer=setTimeout(connect,Math.min(5000,500*2**current.attempts));else setStatus('Connection lost. Press Reconnect to try again.')};
 }
 function paintState(state){
  if(!pvp)return;pvp.state=state;pvp.clockOffset=state.serverNow-Date.now();
  const me=state.players[state.you],other=state.players[1-state.you];
  $('self-name').textContent=me.name;$('self-name').title=me.name+' (you)';$('opponent-name').textContent=other?.name||'Friend';$('opponent-name').title=other?.name||'Waiting for your friend';
  document.querySelector('.deck.ai .card-label').textContent=other?.name||'Friend';aiCardEl.setAttribute('aria-label',(other?.name||'Your friend')+'’s card');
  $('opponent-presence').textContent=other?(other.online?'Connected':'Offline · waiting to reconnect'):'Share the link to invite your friend';
  p1Score=me.score;aiScore=other?.score||0;updateScores();round=state.round;started=true;paused=false;
  const cardKey=JSON.stringify([state.game,state.round,state.card,state.table,state.opponent]);
  if(pvp.cardKey!==cardKey){pvp.cardKey=cardKey;clearSelection();if(drag?.g)cancelDrag();else drag=null;match=state.card.find(s=>state.table.includes(s));renderCard(p1CardEl,state.card,true);renderCard(tableEl,state.table,true);renderCard(aiCardEl,state.opponent,false);tableEl.classList.remove('shake','flash-good');window.dispatchEvent(new Event('spotit:deal'))}
  roundActive=state.phase==='playing'&&me.online&&!!other?.online;
  $('round-label').textContent=state.phase==='waiting'?'Room':state.phase==='finished'?'Final':'Round '+String(Math.max(1,state.round)).padStart(2,'0');
  $('start-button').disabled=!['waiting','finished'].includes(state.phase)||me.ready;
  $('start-button').textContent=['waiting','finished'].includes(state.phase)?(me.ready?'Waiting…':state.phase==='finished'?'Rematch':'Ready'):'Live';
  if(state.phase==='waiting')setStatus(!other?'Copy the link and invite your friend.':me.ready?'You’re ready. Waiting for your friend…':'Both players press Ready to begin.');
  else if(state.phase==='paused')setStatus('Match paused until both players reconnect.');
  else if(state.phase==='playing')setStatus('Find the match. First to 20 wins.');
  else if(state.phase==='countdown'){if($('result-modal').open)$('result-modal').close();tickCountdown()}
  if(state.lastPoint&&['reveal','finished'].includes(state.phase)){
   const own=state.lastPoint.seat===state.you,el=tableEl.querySelector('[data-s="'+state.lastPoint.symbol+'"]');el?.classList.add(own?'reveal':'reveal-ai');if(own)tableEl.classList.add('flash-good');
   const scorer=state.players[state.lastPoint.seat].name;setStatus(scorer+' +1 · '+ICONS[state.lastPoint.symbol].name,own?'good':'ai');
  }
  if(state.phase==='finished'&&pvp.resultGame!==state.game){pvp.resultGame=state.game;const won=me.score>=WIN;$('result-title').textContent=won?'You win!':other.name+' wins!';$('result-score').textContent=me.score+' — '+other.score;$('result-copy').textContent='Both players can choose Rematch to play again.';$('play-again').textContent='Rematch';$('result-modal').showModal()}
 }
 function tickCountdown(){if(pvp?.state?.phase==='countdown'){const left=Math.max(1,Math.ceil((pvp.state.nextAt-(Date.now()+pvp.clockOffset))/1000));setStatus('Starting in '+left+'…')}}
 setInterval(tickCountdown,200);
 function enter(room,session){
  stopTimers();roundActive=false;if(drag?.g)cancelDrag();else drag=null;clearSelection();if($('result-modal').open)$('result-modal').close();
  pvp={room,session,socket:null,state:null,attempts:0,pending:false,claim:claimRemote,ready:readyRemote};
  document.body.classList.add('pvp-mode');$('pvp-button').hidden=true;$('room-strip').hidden=false;$('room-link').value=linkFor(room);$('difficulty').hidden=true;$('pause-button').hidden=true;$('ai-timer-wrap').hidden=true;
  history.replaceState(null,'',linkFor(room));connect();
 }
 function leave(){
  clearTimeout(connectTimer);const old=pvp;pvp=null;old?.socket?.close(1000,'Left room');
  document.body.classList.remove('pvp-mode');$('pvp-button').hidden=false;$('room-strip').hidden=true;$('difficulty').hidden=false;$('pause-button').hidden=false;$('ai-timer-wrap').hidden=false;
  $('start-button').disabled=false;$('start-button').textContent='Start ↗';$('pause-button').disabled=true;$('pause-button').textContent='Pause';$('self-name').textContent='YOU';$('opponent-name').textContent='AI';document.querySelector('.deck.ai .card-label').textContent='AI';aiCardEl.setAttribute('aria-label','AI card');$('play-again').textContent='Again ↗';
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);stopTimers();roundActive=started=paused=false;p1Score=aiScore=round=0;updateScores();deal();$('round-label').textContent='Round 01';setStatus('Press Start when you’re ready.');if($('result-modal').open)$('result-modal').close();
 }
 $('pvp-button').addEventListener('click',()=>showJoin());$('leave-room').addEventListener('click',leave);
 $('cancel-room').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(soloWasRunning&&!pvp&&started&&paused)togglePause();soloWasRunning=false});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const name=nameInput.value.trim();if(!name){errorEl.textContent='Enter your name.';return}
  $('room-submit').disabled=true;errorEl.textContent='';
  try{let session=targetRoom?saved(targetRoom):null;let room=targetRoom;
   if(!session){const data=await request(room?'/rooms/'+room+'/join':'/rooms',name);room=room||data.room;session={token:data.token,seat:data.seat,expiresAt:data.expiresAt,name};remember(room,session)}
   try{localStorage.setItem('spot-it-player-name',name)}catch{}
   enter(room,session);dialog.close();
  }catch(error){errorEl.textContent=error.name==='TimeoutError'?'Room service timed out. Please try again.':error.message||'Could not connect. Please try again.'}finally{$('room-submit').disabled=false}
 });
 $('copy-room').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('room-link').value);$('copy-room').textContent='Copied';setTimeout(()=>$('copy-room').textContent='Copy link',1600)}catch{$('room-link').focus();$('room-link').select();setStatus('Copy the selected invite link.')}});
 const incoming=new URL(location.href).searchParams.get('room');
 if(incoming){if(roomPattern.test(incoming)){const session=saved(incoming);if(session)enter(incoming,session);else showJoin(incoming)}else setStatus('That room link is invalid. Create a new two-player room.','bad')}
 window.SPOT_PVP={leave,showJoin};
})();

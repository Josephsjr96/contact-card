/* Two-player rooms. The server owns rounds, scoring and reconnect state. */
(() => {
 'use strict';
 const API='https://spot-it-pvp.josephsanjari1996.workers.dev';
 const roomPattern=/^[a-f0-9]{24}$/;
 const dialog=$('room-modal'),form=$('room-form'),nameInput=$('player-name'),errorEl=$('room-error');
 let soloWasRunning=false,connectTimer=null;
 function saved(room){try{const s=JSON.parse(localStorage.getItem('spot-it-room-'+room));return s?.expiresAt>Date.now()&&typeof s.token==='string'?s:null}catch{return null}}
 function remember(room,session){try{localStorage.setItem('spot-it-room-'+room,JSON.stringify(session))}catch{}}
 function linkFor(room){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',room);return url.href}
 function showJoin(room=null){
  errorEl.textContent='';$('room-title').textContent=room?'Join your friend':'Play with a friend';$('join-link').value=room?linkFor(room):'';
  soloWasRunning=started&&!paused&&!pvp;if(soloWasRunning)togglePause();
  try{nameInput.value=localStorage.getItem('spot-it-player-name')||''}catch{}
  updateJoinAction();dialog.showModal();nameInput.focus();
 }
 function updateJoinAction(){const joining=!!$('join-link').value.trim();$('join-room').className=joining?'primary':'text-button';$('room-submit').className=joining?'text-button':'primary'}
 function roomFromLink(value){
  if(!value.trim())throw Error('Paste your friend’s invite link to join.');
  let url;try{url=new URL(value.trim(),location.href)}catch{throw Error('Enter a valid Spot It invite link.')}
  const room=url.searchParams.get('room'),page=url.pathname.replace(/\/index\.html$/,'/').replace(/\/$/,'');
  if(!['https:','http:'].includes(url.protocol)||![location.origin,'https://josephsjr96.github.io'].includes(url.origin)||!page.endsWith('/samples/spot-it')||!roomPattern.test(room||''))throw Error('Enter a valid Spot It invite link.');
  return room;
 }
 async function request(path,name){
  const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name}),signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Could not open the room.');return data;
 }
 function send(data){if(pvp?.socket?.readyState===WebSocket.OPEN){pvp.socket.send(JSON.stringify(data));return true}return false}
 function claimRemote(symbol){if(!pvp||!roundActive||pvp.pending)return;pvp.pending=true;roundActive=false;clearSelection();if(!send({type:'claim',round:pvp.state.round,symbol})){pvp.pending=false;setStatus('Connection lost. Reconnecting…')}}
 function readyRemote(){if(!pvp)return;if(pvp.socket?.readyState!==WebSocket.OPEN){pvp.attempts=0;connect();return}const s=pvp.state;send({type:s&&s.you===s.host&&s.players.length>=2&&s.players.every(player=>player.ready&&player.online)?'start':'ready'})}
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
  if(!pvp)return;const previous=pvp.state;pvp.state=state;pvp.clockOffset=state.serverNow-Date.now();
  const me=state.players[state.you];
  // State broadcasts can repeat on reconnect or when previewing a different player.
  // Sound follows authoritative transitions, never a local claim or a card repaint.
  if(!previous&&state.lastPoint)pvp.soundPoint=state.game+':'+state.round;
  if(previous){
   if(state.phase==='countdown'&&previous.phase!=='countdown')window.SPOT_SOUND?.play('start');
   if(state.phase==='playing'&&(previous.round!==state.round||previous.phase==='countdown'))window.SPOT_SOUND?.play('deal');
   const pointKey=state.game+':'+state.round;
   if(state.phase==='reveal'&&state.lastPoint&&pvp.soundPoint!==pointKey){pvp.soundPoint=pointKey;window.SPOT_SOUND?.play(state.lastPoint.seat===state.you?'match':'opponent')}
   if(state.phase==='finished'&&pvp.resultGame!==state.game)window.SPOT_SOUND?.play(me.score>=WIN?'win':'finish');
  }

  if(pvp.previewSeat===undefined||pvp.previewSeat===state.you||!state.players[pvp.previewSeat])pvp.previewSeat=state.players.findIndex((p,i)=>i!==state.you);
  const other=state.players[pvp.previewSeat];
  const roster=$('room-players');roster.replaceChildren();state.players.forEach((player,seat)=>{const chip=document.createElement('button');chip.type='button';chip.className='player-chip'+(seat===state.you?' self':'');chip.setAttribute('aria-pressed',String(seat===pvp.previewSeat));chip.textContent=player.name+(seat===state.you?' (you)':'')+' · '+player.score+(player.ready?' ✓':'');chip.title=(seat===state.host?'Host · ':'')+(player.online?(player.ready?'Ready':'Connected'):'Offline');chip.disabled=seat===state.you;chip.addEventListener('click',()=>{pvp.previewSeat=seat;paintState(pvp.state)});roster.appendChild(chip)});
  $('room-count').textContent=state.players.length+' / '+state.maxPlayers+' players';
  $('self-name').textContent=me.name;$('self-name').title=me.name+' (you)';$('opponent-name').textContent=other?.name||'Friend';$('opponent-name').title=other?.name||'Waiting for your friend';
  document.querySelector('.deck.ai .card-label').textContent=other?.name||'Friend';aiCardEl.setAttribute('aria-label',(other?.name||'Your friend')+'’s card');
  const offline=state.players.filter(player=>!player.online);$('opponent-presence').textContent=offline.length?'Waiting for '+offline.map(player=>player.name).join(', '):!['waiting','finished'].includes(state.phase)?state.players.length+' players connected':state.you===state.host?'Invite up to five friends. Start when everyone is ready.':'Press Ready. The host starts the match.';
  p1Score=me.score;aiScore=other?.score||0;updateScores();round=state.round;started=true;paused=false;
  const preview=state.cards?.[pvp.previewSeat]||state.opponent;const cardKey=JSON.stringify([state.game,state.round,state.card,state.table,preview]);
  if(pvp.cardKey!==cardKey){pvp.cardKey=cardKey;clearSelection();if(drag?.g)cancelDrag();else drag=null;match=state.card.find(s=>state.table.includes(s));renderCard(p1CardEl,state.card,true);renderCard(tableEl,state.table,true);renderCard(aiCardEl,preview,false);tableEl.classList.remove('shake','flash-good');window.dispatchEvent(new Event('spotit:deal'))}
  roundActive=state.phase==='playing'&&state.players.every(player=>player.online);
  $('round-label').textContent=state.phase==='waiting'?'Room':state.phase==='finished'?'Final':'Round '+String(Math.max(1,state.round)).padStart(2,'0');
  const canStart=state.you===state.host&&state.players.length>=2&&state.players.every(player=>player.ready&&player.online);
  $('start-button').disabled=!['waiting','finished'].includes(state.phase)||(me.ready&&!canStart);
  $('start-button').textContent=['waiting','finished'].includes(state.phase)?(canStart?'Start match':me.ready?'Waiting…':state.phase==='finished'?'Rematch':'Ready'):'Live';
  if(state.phase==='waiting')setStatus(state.players.length<2?'Copy the link and invite your friends.':canStart?'Everyone is ready. Start the match when your group has joined.':me.ready?'You’re ready. Waiting for the group…':'Press Ready. The host starts after everyone joins.');
  else if(state.phase==='paused')setStatus('Match paused until everyone reconnects.');
  else if(state.phase==='playing')setStatus('Find the match. First to 20 wins.');
  else if(state.phase==='countdown'){if($('result-modal').open)$('result-modal').close();tickCountdown()}
  if(state.lastPoint&&['reveal','finished'].includes(state.phase)){
   const own=state.lastPoint.seat===state.you,el=tableEl.querySelector('[data-s="'+state.lastPoint.symbol+'"]');el?.classList.add(own?'reveal':'reveal-ai');if(own)tableEl.classList.add('flash-good');
   const scorer=state.players[state.lastPoint.seat].name;setStatus(scorer+' +1 · '+ICONS[state.lastPoint.symbol].name,own?'good':'ai');
  }
  if(state.phase==='finished'&&pvp.resultGame!==state.game){pvp.resultGame=state.game;const won=me.score>=WIN,winner=state.players.find(player=>player.score>=WIN);$('result-title').textContent=won?'You win!':winner.name+' wins!';$('result-score').textContent=state.players.map(player=>player.name+' · '+player.score).join('\n');$('result-copy').textContent='Everyone chooses Rematch, then the host starts again.';$('play-again').textContent='Rematch';$('result-modal').showModal()}
 }
 function tickCountdown(){if(pvp?.state?.phase==='countdown'){const left=Math.max(1,Math.ceil((pvp.state.nextAt-(Date.now()+pvp.clockOffset))/1000));setStatus('Starting in '+left+'…')}}
 setInterval(tickCountdown,200);
 function enter(room,session){
  window.SPOT_MENU?.showGame();
  stopTimers();roundActive=false;if(drag?.g)cancelDrag();else drag=null;clearSelection();if($('result-modal').open)$('result-modal').close();
  pvp={room,session,socket:null,state:null,attempts:0,pending:false,claim:claimRemote,ready:readyRemote};
  document.body.classList.add('pvp-mode');$('pvp-button').hidden=true;$('room-strip').hidden=false;$('room-link').value=linkFor(room);$('difficulty').hidden=true;$('pause-button').hidden=true;$('ai-timer-wrap').hidden=true;
  history.replaceState(null,'',linkFor(room));connect();
 }
 function leave(){
  clearTimeout(connectTimer);const old=pvp;pvp=null;old?.socket?.close(1000,'Left room');
  document.body.classList.remove('pvp-mode');$('pvp-button').hidden=false;$('room-strip').hidden=true;$('difficulty').hidden=false;$('pause-button').hidden=false;$('ai-timer-wrap').hidden=false;
  $('start-button').disabled=false;$('start-button').textContent='Start ↗';$('pause-button').disabled=true;$('pause-button').textContent='Pause';$('self-name').textContent='YOU';$('opponent-name').textContent='AI';document.querySelector('.deck.ai .card-label').textContent='AI';aiCardEl.setAttribute('aria-label','AI card');$('play-again').textContent='Again ↗';
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);stopTimers();roundActive=started=paused=false;p1Score=aiScore=round=0;updateScores();deal();$('round-label').textContent='Round 01';setStatus('Press Start when you’re ready.');if($('result-modal').open)$('result-modal').close();window.SPOT_MENU?.open();
 }
 $('pvp-button').addEventListener('click',()=>showJoin());$('leave-room').addEventListener('click',leave);
 $('cancel-room').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(soloWasRunning&&!pvp&&started&&paused)togglePause();soloWasRunning=false});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const name=nameInput.value.trim();if(!name){errorEl.textContent='Enter your name.';return}
  $('room-submit').disabled=true;$('join-room').disabled=true;errorEl.textContent='';
  try{let room=event.submitter?.value==='join'?roomFromLink($('join-link').value):null;let session=room?saved(room):null;
   if(!session){const data=await request(room?'/rooms/'+room+'/join':'/rooms',name);room=room||data.room;session={token:data.token,seat:data.seat,expiresAt:data.expiresAt,name};remember(room,session)}
   try{localStorage.setItem('spot-it-player-name',name)}catch{}
   enter(room,session);dialog.close();
  }catch(error){errorEl.textContent=error.name==='TimeoutError'?'Room service timed out. Please try again.':error.message||'Could not connect. Please try again.'}finally{$('room-submit').disabled=false;$('join-room').disabled=false}
 });
 $('join-link').addEventListener('input',updateJoinAction);form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'){event.preventDefault();form.requestSubmit($('join-link').value.trim()?$('join-room'):$('room-submit'))}});
 $('copy-room').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('room-link').value);$('copy-room').textContent='Copied';setTimeout(()=>$('copy-room').textContent='Copy link',1600)}catch{$('room-link').focus();$('room-link').select();setStatus('Copy the selected invite link.')}});
 const incoming=new URL(location.href).searchParams.get('room');
 if(incoming){if(roomPattern.test(incoming)){const session=saved(incoming);if(session)enter(incoming,session);else showJoin(incoming)}else setStatus('That room link is invalid. Create a new two-player room.','bad')}
 window.SPOT_PVP={leave,showJoin};
})();

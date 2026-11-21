import {DurableObject} from 'cloudflare:workers';
import {newRoom,startMatch,claim,deal,cardForTable,MAX_PLAYERS} from './rules.mjs';
const ROOM_PATTERN=/^[a-f0-9]{24}$/;
function allowed(origin){if(origin==='https://josephsjr96.github.io')return true;try{const u=new URL(origin);return u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)}catch{return false}}
function json(data,status=200,origin=''){return Response.json(data,{status,headers:{'Access-Control-Allow-Origin':allowed(origin)?origin:'https://josephsjr96.github.io','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','Vary':'Origin'}})}
async function body(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Enter a name.');let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();throw Error('Request is too large.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return JSON.parse(new TextDecoder().decode(bytes));
}
function nameOf(value){return typeof value==='string'?value.replace(/[\p{Cc}\p{Cf}]/gu,'').trim().replace(/\s+/g,' ').slice(0,24):''}
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('')}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64)return false;let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin')||'';
  if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'spot-it-pvp',version:2},200,origin);
  if(!allowed(origin))return json({error:'Open this game from Joseph’s portfolio.'},403,origin);
  if(request.method==='OPTIONS')return json({},200,origin);
  try{
   if(url.pathname==='/rooms'&&request.method==='POST'){
    const name=nameOf((await body(request)).name);if(!name)return json({error:'Enter your name (up to 24 characters).'},400,origin);
    const room=crypto.randomUUID().replace(/-/g,'').slice(0,24),result=await env.ROOMS.getByName(room).create(name);
    return json({...result.data,room},result.status,origin);
   }
   const route=url.pathname.match(/^\/rooms\/([a-f0-9]{24})\/(join|socket)$/);
   if(!route||!ROOM_PATTERN.test(route[1]))return json({error:'Room not found.'},404,origin);
   const room=env.ROOMS.getByName(route[1]);
   if(route[2]==='socket'&&request.method==='GET')return room.fetch(request);
   if(route[2]==='join'&&request.method==='POST'){
    const name=nameOf((await body(request)).name);if(!name)return json({error:'Enter your name (up to 24 characters).'},400,origin);
    const result=await room.join(name);return json(result.data,result.status,origin);
   }
   return json({error:'Method not allowed.'},405,origin);
  }catch(error){console.error(JSON.stringify({event:'request_failed',message:error instanceof SyntaxError?'invalid_json':String(error.message).slice(0,120)}));return json({error:'Could not open the room. Please try again.'},400,origin)}
 }
};
export class SpotRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)')}
 load(){const row=this.ctx.storage.sql.exec('SELECT data FROM room WHERE id=1').toArray()[0];if(!row)return null;const state=JSON.parse(row.data);state.players=state.players.filter(Boolean);while(state.cards.length<MAX_PLAYERS)state.cards.push(cardForTable(state));return state}
 save(state){this.ctx.storage.sql.exec('INSERT INTO room(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',JSON.stringify(state))}
 valid(state){return state&&state.expiresAt>Date.now()}
 async schedule(state){const next=['countdown','reveal'].includes(state.phase)?state.nextAt:state.expiresAt;await this.ctx.storage.setAlarm(Math.min(next,state.expiresAt))}
 async create(name){
  const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token);
  if(this.load())return {status:409,data:{error:'Room already exists.'}};
  const state=newRoom(name,tokenHash);this.save(state);await this.schedule(state);
  return {status:201,data:{token,seat:0,expiresAt:state.expiresAt}};
 }
 async join(name){
  const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token),state=this.load();
  if(!this.valid(state))return {status:404,data:{error:'This room has expired. Ask your friend for a new link.'}};
  if(state.players.length>=MAX_PLAYERS)return {status:409,data:{error:'This room already has six players.'}};
  if(state.phase!=='waiting')return {status:409,data:{error:'This match has already started. Ask your friend for a new room.'}};
  const seat=state.players.length;state.players.push({name,tokenHash,score:0,ready:false,connectionId:null});this.save(state);this.broadcast(state);
  return {status:200,data:{token,seat,expiresAt:state.expiresAt}};
 }
 online(state,seat){const id=state.players[seat]?.connectionId;return !!id&&this.ctx.getWebSockets().some(ws=>{const a=ws.deserializeAttachment();return ws.readyState===1&&a?.seat===seat&&a.connectionId===id})}
 view(state,seat){return {type:'state',you:seat,host:0,maxPlayers:MAX_PLAYERS,phase:state.phase,round:state.round,game:state.game,nextAt:state.nextAt,serverNow:Date.now(),expiresAt:state.expiresAt,players:state.players.map((p,i)=>p?{name:p.name,score:p.score,ready:p.ready,online:this.online(state,i)}:null),table:state.table,card:state.cards[seat],opponent:state.cards[seat===0?1:0],cards:state.cards.slice(0,state.players.length),lastPoint:state.lastPoint}}
 broadcast(state=this.load()){if(!this.valid(state))return;for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a&&ws.readyState===1&&state.players[a.seat]?.connectionId===a.connectionId){try{ws.send(JSON.stringify(this.view(state,a.seat)))}catch{}}}}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required.'},426);
  const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(s=>s.trim()),token=protocols[1];
  if(protocols[0]!=='spot-it'||!token||token.length>100)return json({error:'Join this room first.'},401);
  const tokenHash=await hash(token),state=this.load();if(!this.valid(state))return json({error:'Room expired.'},404);
  const seat=state.players.findIndex(p=>p&&equal(p.tokenHash,tokenHash));if(seat<0)return json({error:'Invalid player session.'},401);
  const connectionId=crypto.randomUUID(),pair=new WebSocketPair(),[client,server]=Object.values(pair);
  const old=this.ctx.getWebSockets().filter(ws=>ws.deserializeAttachment()?.seat===seat);
  this.ctx.acceptWebSocket(server);server.serializeAttachment({seat,connectionId,lastAttempt:0,windowStart:0,count:0});
  state.players[seat].connectionId=connectionId;
  if(state.phase==='paused'&&state.players.every((p,i)=>this.online(state,i))){if(state.needsNextRound){state.round++;deal(state)}state.needsNextRound=false;state.phase='countdown';state.nextAt=Date.now()+2000}
  this.save(state);for(const ws of old){try{ws.close(4001,'Connected in another tab')}catch{}}
  await this.schedule(state);this.broadcast();
  return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'spot-it'}});
 }
 async webSocketMessage(ws,message){
  if(typeof message!=='string'||message.length>512){ws.close(1009,'Message too large');return}
  const a=ws.deserializeAttachment(),state=this.load();if(!this.valid(state)){ws.close(4004,'Room expired');return}
  if(!a||state.players[a.seat]?.connectionId!==a.connectionId){ws.close(4001,'Session replaced');return}
  const now=Date.now();if(now-a.windowStart>1000){a.windowStart=now;a.count=0}if(++a.count>12){ws.serializeAttachment(a);return}ws.serializeAttachment(a);
  let data;try{data=JSON.parse(message)}catch{ws.send(JSON.stringify({type:'error',message:'Invalid message.'}));return}
  if(!data||typeof data!=='object')return;
  if(data.type==='sync'){ws.send(JSON.stringify(this.view(state,a.seat)));return}
  if(data.type==='ready'&&['waiting','finished'].includes(state.phase)){
   state.players[a.seat].ready=true;
   this.save(state);await this.schedule(state);this.broadcast();return;
  }
  if(data.type==='start'){
   if(a.seat!==0||!['waiting','finished'].includes(state.phase)||state.players.length<2||!state.players.every(p=>p.ready)||!state.players.every((p,i)=>this.online(state,i))){ws.send(JSON.stringify({type:'error',message:'The host can start when at least two players are connected and everyone is ready.'}));return}
   startMatch(state);this.save(state);await this.schedule(state);this.broadcast();return;
  }
  if(data.type==='claim'){
   if(now-a.lastAttempt<150)return;a.lastAttempt=now;ws.serializeAttachment(a);
   if(!state.players.every((p,i)=>this.online(state,i))){ws.send(JSON.stringify({type:'error',message:'Waiting for all players to reconnect.'}));return}
   const result=claim(state,a.seat,data.symbol,data.round,now);
   if(result.error){ws.send(JSON.stringify(this.view(state,a.seat)));ws.send(JSON.stringify({type:'error',message:result.error}));return}
   this.save(state);await this.schedule(state);this.broadcast();
  }
 }
 async disconnect(ws){
  const state=this.load(),a=ws.deserializeAttachment();if(!this.valid(state)||!a||state.players[a.seat]?.connectionId!==a.connectionId)return;
  state.players[a.seat].connectionId=null;
  if(['playing','countdown','reveal'].includes(state.phase)){state.needsNextRound=state.phase==='reveal';state.phase='paused';state.nextAt=0}
  else if(state.phase==='waiting')state.players[a.seat].ready=false;
  this.save(state);await this.schedule(state);this.broadcast();
 }
 async webSocketClose(ws,code){try{if(code>=1000&&code<5000&&![1004,1005,1006,1015].includes(code))ws.close(code);else ws.close()}catch{}await this.disconnect(ws)}
 async webSocketError(ws){try{ws.close(1011,'Connection error')}catch{}await this.disconnect(ws)}
 async alarm(){
  const state=this.load();if(!state)return;
  if(!this.valid(state)){for(const ws of this.ctx.getWebSockets()){try{ws.close(4004,'Room expired')}catch{}}this.ctx.storage.sql.exec('DELETE FROM room WHERE id=1');await this.ctx.storage.deleteAlarm();return}
  if(Date.now()>=state.nextAt&&['countdown','reveal'].includes(state.phase)){
   if(!state.players.every((p,i)=>this.online(state,i))){state.needsNextRound=state.phase==='reveal';state.phase='paused'}
   else if(state.phase==='countdown')state.phase='playing';
   else{state.round++;deal(state);state.phase='playing'}
   this.save(state);this.broadcast(state);
  }
  await this.schedule(state);
 }
}

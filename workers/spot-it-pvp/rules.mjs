export const SYMBOLS=['rocket','bolt','target','gem','flame','planet','ufo','dice','star','shield','flower','signal','ghost','moon','leaf','heart','key','anchor','mushroom','crown','eye','butterfly','fish','cat','apple','icecream','music','umbrella','coffee','sun','camera','hourglass'];
export const MAX_PLAYERS=6,PER_CARD=10,WIN=20,ROOM_TTL=2*60*60*1000;
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function cardForTable(state){const outside=SYMBOLS.filter(s=>!state.table.includes(s));return shuffle([state.match,...shuffle(outside).slice(0,PER_CARD-1)])}
export function deal(state){
 const match=SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
 const rest=shuffle(SYMBOLS.filter(s=>s!==match));
 const table=shuffle([match,...rest.slice(0,PER_CARD-1)]);
 state.table=table;state.match=match;state.cards=Array.from({length:MAX_PLAYERS},()=>cardForTable(state));state.lastPoint=null;
}
export function newRoom(name,tokenHash,now=Date.now()){
 const state={expiresAt:now+ROOM_TTL,phase:'waiting',round:0,game:0,nextAt:0,players:[{name,tokenHash,score:0,ready:false,connectionId:null}]};
 deal(state);return state;
}
export function startMatch(state,now=Date.now()){
 state.players.forEach(p=>{p.score=0;p.ready=false});state.game++;state.round=1;deal(state);state.phase='countdown';state.nextAt=now+2000;
}
export function claim(state,seat,symbol,round,now=Date.now()){
 if(state.phase!=='playing'||round!==state.round)return {error:'That round has already moved on.'};
 if(symbol!==state.match||!state.cards[seat].includes(symbol)||!state.table.includes(symbol))return {error:'Try another symbol.'};
 state.players[seat].score++;state.lastPoint={seat,symbol};state.phase=state.players[seat].score>=WIN?'finished':'reveal';state.nextAt=now+950;
 return {ok:true};
}

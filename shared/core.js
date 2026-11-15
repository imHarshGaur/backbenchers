/* Pure rules shared by the browser and authoritative Node server. No DOM or sockets. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Backbencher = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const COLORS = ['#205eab','#b8433e','#338477','#a87517','#7b5294','#cf7343'];
  const ROLES = {Raja:1000, Mantri:800, Sipahi:500, Chor:0, Senapati:650, Daroga:400, Joker:250};
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  function assert(ok,message) { if (!ok) throw new Error(message); }
  function shuffle(items,rng=Math.random) {
    const out=[...items];
    for(let i=out.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
    return out;
  }
  function players(names) {
    assert(Array.isArray(names)&&names.length>=2&&names.length<=6,'Use 2–6 players.');
    return names.map((name,i)=>({id:String(i),name:String(name).trim().slice(0,20)||`Benchmate ${i+1}`,color:COLORS[i],score:0}));
  }
  function intersection(a,b,c,d) {
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const on=(p,q,r)=>Math.min(p.x,q.x)-1e-8<=r.x&&r.x<=Math.max(p.x,q.x)+1e-8&&Math.min(p.y,q.y)-1e-8<=r.y&&r.y<=Math.max(p.y,q.y)+1e-8;
    const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
    return (x*y < -1e-8 && u*v < -1e-8) || (Math.abs(x)<1e-8&&on(a,b,c)) || (Math.abs(y)<1e-8&&on(a,b,d)) || (Math.abs(u)<1e-8&&on(c,d,a)) || (Math.abs(v)<1e-8&&on(c,d,b));
  }
  function winners(ps) { const max=Math.max(...ps.map(p=>p.score)); return ps.filter(p=>p.score===max).map(p=>p.id); }
  function nextAlive(s) {
    for(let i=1;i<=s.players.length;i++) { const n=(s.turn+i)%s.players.length; if(s.pens[n].alive) { s.turn=n; break; } }
  }
  function newPen(names,classes=[]) {
    const ps=players(names),n=ps.length;
    return {kind:'pen',phase:'playing',players:ps,turn:0,turns:0,margin:28,winners:[],last:'Pull back from your pen. Release to flick.',
      hazards:[{kind:'coffee',x:300,y:255,r:38},{kind:'portal',x:155,y:380,r:18},{kind:'portal',x:445,y:200,r:18},{kind:'shield',x:300,y:410,r:18,used:false}],
      pens:ps.map((p,i)=>{const a=2*Math.PI*i/n-Math.PI/2; const x=300+205*Math.cos(a),y=300+205*Math.sin(a);const type=['ballpoint','gel','fountain'].includes(classes[i])?classes[i]:'ballpoint';return {id:p.id,x,y,type,alive:true,lives:(n>=4?2:1)+(type==='fountain'?1:0),shield:false,segments:[{a:{x:x-12,y:y+18},b:{x,y}}]};})};
  }
  function flick(s,id,dx,dy) {
    assert(s.phase==='playing'&&s.players[s.turn].id===id,'Wait for your turn.');
    assert(Number.isFinite(dx)&&Number.isFinite(dy),'Invalid flick.');
    const p=s.pens[s.turn],power=Math.hypot(dx,dy); assert(power>=4,'Pull back a little farther.');
    let distance=clamp(power,15,140)*(p.type==='gel'?3.2:p.type==='fountain'?1.85:2.65);
    let angle=Math.atan2(dy,dx),teleported=false,coffee=false; const hit=new Set(),path=[];
    const steps=Math.ceil(distance/5),stride=distance/steps;
    for(let i=0;i<steps&&p.alive;i++) {
      if(p.type==='gel') angle+=0.0025;
      const a={x:p.x,y:p.y},b={x:clamp(p.x+Math.cos(angle)*stride,8,592),y:clamp(p.y+Math.sin(angle)*stride,8,592)};
      p.x=b.x;p.y=b.y; path.push({a,b});p.segments.push({a,b});
      for(const enemy of s.pens) if(enemy.id!==id&&enemy.alive&&!hit.has(enemy.id)&&enemy.segments.some(seg=>intersection(a,b,seg.a,seg.b))) {
        hit.add(enemy.id);
        if(enemy.shield) enemy.shield=false; else {enemy.lives--;if(enemy.lives<=0) enemy.alive=false;}
      }
      for(const h of s.hazards) if(Math.hypot(p.x-h.x,p.y-h.y)<h.r) {
        if(h.kind==='coffee'&&!coffee) {angle+=Math.PI/2;coffee=true;}
        if(h.kind==='shield'&&!h.used) {p.shield=true;h.used=true;}
        if(h.kind==='portal'&&!teleported) {const target=s.hazards.find(v=>v.kind==='portal'&&v!==h);p.x=target.x+Math.cos(angle)*(target.r+7);p.y=target.y+Math.sin(angle)*(target.r+7);teleported=true;}
      }
      if(b.x<=8||b.x>=592||b.y<=8||b.y>=592) break;
    }
    s.turns++;
    if(s.turns%3===0) {s.margin=Math.min(285,s.margin+16);for(const pen of s.pens) if(pen.x<s.margin||pen.x>600-s.margin||pen.y<s.margin||pen.y>600-s.margin) pen.alive=false;}
    const alive=s.pens.filter(p=>p.alive);
    s.last=hit.size?`${s.players[s.turn].name} cut ${hit.size} ink trail${hit.size>1?'s':''}!`:'Ink down. Pass the pen.';
    if(alive.length<=1) {s.phase='finished';s.winners=alive.map(p=>p.id);s.last=alive.length?'Last pen standing!':'Red margin cleared the desk. Stakes refunded.';}
    else nextAlive(s);
    return path;
  }
  function newDots(names,rng=Math.random) {
    const ps=players(names),size=ps.length===2?4:6,star=Math.floor(rng()*(size-1)**2);
    return {kind:'dots',phase:'playing',players:ps,size,turn:0,edges:{},boxes:{},star,bomb:(star+Math.ceil((size-1)**2/2))%((size-1)**2),bombUsed:false,winners:[],last:'Join two dots. Close a box for another turn.'};
  }
  function boxEdges(n,x,y) { return [`h:${x}:${y}`,`h:${x}:${y+1}`,`v:${x}:${y}`,`v:${x+1}:${y}`]; }
  function allEdges(s) {const list=[];for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){if(x<s.size-1)list.push(`h:${x}:${y}`);if(y<s.size-1)list.push(`v:${x}:${y}`);}return list;}
  function boxId(s,x,y) {return y*(s.size-1)+x;}
  function drawEdge(s,id,key) {
    assert(s.phase==='playing'&&s.players[s.turn].id===id,'Wait for your turn.');
    assert(allEdges(s).includes(key)&&s.edges[key]===undefined,'Choose an empty edge.');
    s.edges[key]=id;let claimed=0,blast=false;
    for(let y=0;y<s.size-1;y++)for(let x=0;x<s.size-1;x++) {
      const k=boxId(s,x,y);
      if(s.boxes[k]===undefined&&boxEdges(s.size,x,y).every(e=>s.edges[e]!==undefined)) {
        s.boxes[k]=id;s.players[s.turn].score+=k===s.star?2:1;claimed++;if(k===s.bomb&&!s.bombUsed)blast=true;
      }
    }
    if(blast) {
      s.bombUsed=true;
      const bx=s.bomb%(s.size-1),by=Math.floor(s.bomb/(s.size-1));
      // Keep claimed squares closed: a bomb only clears edges with no claimed box on either side.
      const protectedEdges=new Set();
      for(const k of Object.keys(s.boxes).map(Number))boxEdges(s.size,k%(s.size-1),Math.floor(k/(s.size-1))).forEach(e=>protectedEdges.add(e));
      for(const [x,y] of [[bx-1,by],[bx+1,by],[bx,by-1],[bx,by+1]])if(x>=0&&y>=0&&x<s.size-1&&y<s.size-1) for(const e of boxEdges(s.size,x,y))if(!protectedEdges.has(e))delete s.edges[e];
    }
    s.last=blast?'Ink bomb! Nearby unclaimed lines washed away.':claimed?`${s.players[s.turn].name} closed ${claimed} box${claimed>1?'es':''}. Go again!`:'Next benchmate, your line.';
    if(Object.keys(s.boxes).length===(s.size-1)**2){s.phase='finished';s.winners=winners(s.players);}
    else if(!claimed)s.turn=(s.turn+1)%s.players.length;
  }
  function roleSet(n) {
    assert(n>=4&&n<=6,'Chits needs 4–6 players.');
    return ['Raja','Mantri','Sipahi','Chor',...(n===5?['Senapati']:n===6?['Daroga','Joker']:[])];
  }
  function deal(s,rng=Math.random) {
    s.roles=shuffle(roleSet(s.players.length),rng);s.phase='reveal';s.revealIndex=0;s.guess=null;s.roundScores=null;s.bets={};s.swapped=false;
    s.last='Pass privately. Only the named player should open their chit.';
  }
  function newRMCS(names,rounds=5,rng=Math.random) {
    assert(rounds===5||rounds===7,'Choose 5 or 7 rounds.');const s={kind:'rmcs',players:players(names),round:1,rounds,swapUsed:false,winners:[],history:[]};deal(s,rng);return s;
  }
  function reveal(s,id) {assert(s.phase==='reveal'&&s.players[s.revealIndex].id===id,'Pass to the named player.');s.revealIndex++;if(s.revealIndex===s.players.length){s.phase='guess';s.last='Mera Mantri Kaun? Mantri: find the Chor!';}}
  function swap(s,id,target) {
    assert(s.phase==='guess'&&!s.swapUsed&&s.roles[s.players.findIndex(p=>p.id===id)]==='Chor','Chit swap is unavailable.');
    const i=s.players.findIndex(p=>p.id===id),j=s.players.findIndex(p=>p.id===target);
    assert(j>=0&&j!==i&&!['Raja','Mantri'].includes(s.roles[j]),'Choose an unrevealed classmate.');
    [s.roles[i],s.roles[j]]=[s.roles[j],s.roles[i]];s.swapUsed=true;s.swapped=true;s.last='A chit swap happened. Read the table carefully!';
  }
  function bet(s,id,caught) {assert(s.phase==='guess'&&typeof caught==='boolean'&&s.players.some(p=>p.id===id)&&!Object.hasOwn(s.bets,id),'One Chalk Bet per player per round.');s.bets[id]=caught;}
  function guess(s,id,target) {
    assert(s.phase==='guess'&&s.roles[s.players.findIndex(p=>p.id===id)]==='Mantri','Only Mantri can guess.');
    const j=s.players.findIndex(p=>p.id===target);assert(j>=0&&!['Raja','Mantri'].includes(s.roles[j]),'Pick an unrevealed classmate.');
    const caught=s.roles[j]==='Chor';s.guess=target;s.roundScores=s.roles.map(r=>r==='Mantri'&&!caught?0:r==='Chor'&&!caught?800:ROLES[r]);
    s.players.forEach((p,i)=>{if(Object.hasOwn(s.bets,p.id))s.roundScores[i]+=s.bets[p.id]===caught?50:-50;p.score+=s.roundScores[i];});
    s.history.push({round:s.round,roles:[...s.roles],scores:[...s.roundScores],caught});s.phase=s.round===s.rounds?'finished':'result';s.last=caught?'Pakda gaya! Mantri caught the Chor.':'Chor stole Mantri’s 800 points!';if(s.phase==='finished')s.winners=winners(s.players);
  }
  function nextRound(s,rng=Math.random) {assert(s.phase==='result','Finish this round first.');s.round++;deal(s,rng);}
  function actor(s) {if(s.kind!=='rmcs')return s.players[s.turn]?.id;return s.phase==='reveal'?s.players[s.revealIndex]?.id:s.players[s.roles.indexOf('Mantri')]?.id;}
  function botAction(s,rng=Math.random) {
    if(s.kind==='dots') {
      const free=allEdges(s).filter(e=>s.edges[e]===undefined);
      const rank=e=>{let gain=0,risk=0;for(let y=0;y<s.size-1;y++)for(let x=0;x<s.size-1;x++){const es=boxEdges(s.size,x,y);if(!es.includes(e)||s.boxes[boxId(s,x,y)]!==undefined)continue;const count=es.filter(k=>s.edges[k]!==undefined).length;if(count===3)gain+=boxId(s,x,y)===s.star?2:1;if(count===2)risk++;}return gain*100-risk*10+rng();};
      return {type:'edge',key:free.map(key=>({key,v:rank(key)})).sort((a,b)=>b.v-a.v)[0].key};
    }
    if(s.kind==='pen') {
      const p=s.pens[s.turn],enemy=s.pens.filter(v=>v.alive&&v.id!==p.id).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
      const seg=enemy?.segments[Math.floor((enemy?.segments.length||1)/2)],target=seg?{x:(seg.a.x+seg.b.x)/2,y:(seg.a.y+seg.b.y)/2}:{x:300,y:300};
      const factor=p.type==='gel'?3.2:p.type==='fountain'?1.85:2.65;
      let dx=(target.x-p.x)/factor||5,dy=(target.y-p.y)/factor||5;const power=Math.hypot(dx,dy);if(power<4){dx*=5/power;dy*=5/power;}return {type:'flick',dx,dy};
    }
    if(s.phase==='reveal')return {type:'reveal'};
    const candidates=s.players.filter((p,i)=>!['Raja','Mantri'].includes(s.roles[i]));
    return {type:'guess',target:candidates[Math.floor(rng()*candidates.length)].id};
  }
  function action(s,id,a,rng=Math.random) {
    assert(a&&typeof a==='object','Invalid action.');
    if(s.kind==='pen'&&a.type==='flick')flick(s,id,a.dx,a.dy);
    else if(s.kind==='dots'&&a.type==='edge')drawEdge(s,id,a.key);
    else if(s.kind==='rmcs') {if(a.type==='reveal')reveal(s,id);else if(a.type==='guess')guess(s,id,a.target);else if(a.type==='swap')swap(s,id,a.target);else if(a.type==='bet')bet(s,id,a.caught);else throw new Error('Unknown chit action.');}
    else throw new Error('Unknown game action.');
    return s;
  }
  function publicState(s,id) {
    const v=JSON.parse(JSON.stringify(s));
    if(s.kind==='rmcs'&&['reveal','guess'].includes(s.phase)) {
      v.roles=s.roles.map(r=>s.phase==='guess'&&['Raja','Mantri'].includes(r)?r:null);
      v.myRole=s.roles[s.players.findIndex(p=>p.id===id)]||null;
      // Unresolved guesses/bets and unassigned roles never leave the authority.
      v.bets=Object.hasOwn(s.bets,id)?{[id]:s.bets[id]}:{};
    }
    return v;
  }
  function collect(wallets,ids,stake) {
    assert(Number.isSafeInteger(stake)&&stake>=0&&stake<=10000,'Invalid stake.');
    assert(new Set(ids).size===ids.length&&ids.length>=2,'Invalid player roster.');
    assert(ids.every(id=>Number.isSafeInteger(wallets[id])&&wallets[id]>=stake),'A player needs more Chalk Coins.');
    ids.forEach(id=>wallets[id]-=stake);return {stake,pot:ids.length*stake,players:[...ids],settled:false};
  }
  function settle(wallets,escrow,ids) {
    assert(!escrow.settled,'Pot already settled.');
    assert(new Set(ids).size===ids.length&&ids.every(id=>escrow.players.includes(id)),'Invalid winners.');
    const recipients=ids.length?ids:escrow.players;
    assert(recipients.every(id=>Number.isSafeInteger(wallets[id])),'Missing wallet.');
    const each=Math.floor(escrow.pot/recipients.length),extra=escrow.pot%recipients.length;
    recipients.forEach((id,i)=>wallets[id]+=each+(i<extra?1:0));escrow.settled=true;
  }
  function create(kind,names,options={}) {if(kind==='pen')return newPen(names,options.classes);if(kind==='dots')return newDots(names,options.rng);if(kind==='rmcs')return newRMCS(names,options.rounds||5,options.rng);throw new Error('Unknown game.');}
  return {COLORS,ROLES,clamp,shuffle,players,intersection,newPen,flick,newDots,boxEdges,allEdges,drawEdge,newRMCS,reveal,swap,bet,guess,nextRound,actor,botAction,action,publicState,collect,settle,create};
});

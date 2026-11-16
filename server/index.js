'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,randomInt}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const G=require('../shared/core');
const rng=()=>randomInt(0,0x1000000)/0x1000000;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createServer({now=Date.now}={}) {
  const rooms=new Map(),sessions=new Map();
  const root=path.resolve(__dirname,'..');
  const files={'/':'web/index.html','/app.js':'web/app.js','/input.js':'web/input.js','/pen-renderer.js':'web/pen-renderer.js','/site.html':'dist/index.html','/style.css':'web/style.css','/core.js':'shared/core.js','/play.html':'dist/backbencher.html'};
  const server=http.createServer((req,res)=>{
    const p=new URL(req.url,'http://localhost').pathname;
    if(p==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
    const file=files[p];if(!file){res.writeHead(404);res.end('Not found');return;}
    const ext=path.extname(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[ext];
    fs.readFile(path.join(root,file),(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(err?'Run npm run build for the standalone edition.':data);});
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:8192});
  server.on('upgrade',(req,socket,head)=>{
    const allowed=process.env.ALLOWED_ORIGIN;
    const origin=req.headers.origin;
    let validOrigin=!origin;
    try{validOrigin ||= allowed?origin===allowed:new URL(origin).host===req.headers.host;}catch{}
    if(req.url!=='/ws'||!validOrigin){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  function send(ws,data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
  function roomFor(session){const room=rooms.get(session.room);if(!room)throw new Error('Create or join a room first.');return room;}
  function setDeadline(room){const s=room.game;room.deadline=now()+(s?.kind==='dots'?6000:s?.kind==='rmcs'&&s.phase==='guess'?15000:30000);}
  function finish(room){if(room.game.phase==='finished'&&!room.escrow.settled){G.settle(room.wallets,room.escrow,room.game.winners);room.players.forEach(p=>p.ready=p.bot);}}
  function broadcast(room){
    room.updated=now();room.version++;
    for(const p of room.players)if(!p.bot){const session=sessions.get(p.token);send(session?.ws,{type:'state',room:{code:room.code,host:room.host,kind:room.kind,stake:room.stake,version:room.version,deadline:room.deadline,players:room.players.map(({id,name,ready,bot,connected})=>({id,name,ready,bot,connected})),wallets:room.wallets,pot:room.escrow&&!room.escrow.settled?room.escrow.pot:0},you:p.id,game:room.game?G.publicState(room.game,p.id):null});}
  }
  function start(room,session,double=false){
    if(room.host!==session.player)throw new Error('Only the host can start.');
    if(room.game&&room.game.phase!=='finished')throw new Error('Finish this match first.');
    const min=room.kind==='rmcs'?4:2;
    if(room.players.length<min||!room.players.every(p=>p.ready))throw new Error(`Need ${min} players and everyone ready.`);
    const stake=double?room.stake*2:room.stake;
    if(stake>10000)throw new Error('Maximum stake is 10,000.');
    const game=G.create(room.kind,room.players.map(p=>p.name),{rng,classes:room.players.map(p=>p.penClass)});
    const escrow=G.collect(room.wallets,room.players.map(p=>p.id),stake);
    room.stake=stake;room.game=game;room.escrow=escrow;setDeadline(room);broadcast(room);
  }
  function play(room,id,a){
    if(!room.game||room.game.phase==='finished')throw new Error('No active match.');
    const before=G.actor(room.game),phase=room.game.phase;
    G.action(room.game,id,a,rng);finish(room);
    // Side bets and bluff swaps never extend a player's interrogation timer.
    if(!['swap','bet'].includes(a.type)&&(G.actor(room.game)!==before||room.game.phase!==phase||a.type==='edge'||a.type==='flick'))setDeadline(room);
    broadcast(room);
  }
  wss.on('connection',ws=>{
    let session=null,count=0,windowAt=now();
    ws.on('message',raw=>{
      try{
        if(now()-windowAt>=1000){windowAt=now();count=0;}if(++count>30)throw new Error('Slow down.');
        const msg=JSON.parse(raw.toString());if(!msg||typeof msg!=='object')throw new Error('Invalid message.');
        if(msg.type==='hello'){
          if(session)throw new Error('Session already open.');
          session=typeof msg.token==='string'?sessions.get(msg.token):null;
          if(!session){if(sessions.size>=5000)throw new Error('Server is full.');session={token:randomBytes(24).toString('hex'),room:null,player:null,seen:now()};sessions.set(session.token,session);}
          if(session.ws&&session.ws!==ws)session.ws.close(4001,'Session moved');
          session.ws=ws;session.seen=now();send(ws,{type:'session',token:session.token});
          const r=rooms.get(session.room);if(r){r.players.find(p=>p.id===session.player).connected=true;broadcast(r);}return;
        }
        if(!session)throw new Error('Send hello first.');if(session.ws!==ws)throw new Error('Session moved to another connection.');session.seen=now();
        if(msg.type==='create'||msg.type==='join'){
          if(session.room&&rooms.has(session.room))throw new Error('Leave your current room first.');
          let room;
          if(msg.type==='create'){
            if(rooms.size>=200)throw new Error('Server is full.');
            if(!['pen','dots','rmcs'].includes(msg.kind))throw new Error('Choose a game.');
            if(!Number.isSafeInteger(msg.stake)||msg.stake<0||msg.stake>1000)throw new Error('Initial stake must be 0–1000.');
            let code;do{code=Array.from({length:4},()=>ALPHABET[randomInt(ALPHABET.length)]).join('');}while(rooms.has(code));
            room={code,kind:msg.kind,stake:msg.stake,host:'0',players:[],wallets:{},game:null,escrow:null,version:0,updated:now()};rooms.set(code,room);
          }else{room=rooms.get(String(msg.code||'').toUpperCase());if(!room)throw new Error('Room not found.');}
          if(room.game||room.players.length>=6)throw new Error('Room is full or already playing.');
          const id=String(room.players.length),name=String(msg.name||'Benchmate').trim().slice(0,20)||'Benchmate';
          room.players.push({id,name,ready:false,bot:false,connected:true,token:session.token,penClass:['ballpoint','gel','fountain'].includes(msg.penClass)?msg.penClass:'ballpoint'});room.wallets[id]=1000;session.room=room.code;session.player=id;broadcast(room);return;
        }
        const room=roomFor(session),p=room.players.find(p=>p.id===session.player);
        if(msg.type==='ready'){if(room.game&&room.game.phase!=='finished')throw new Error('Match in progress.');p.ready=!!msg.ready;broadcast(room);}
        else if(msg.type==='bots'){
          if(room.host!==p.id||room.game)throw new Error('Only the host can backfill the lobby.');
          const target=Number(msg.count);if(!Number.isInteger(target)||target<2||target>6)throw new Error('Choose 2–6 players.');
          while(room.players.length<target){const id=String(room.players.length);room.players.push({id,name:`Bench Bot ${Number(id)+1}`,ready:true,bot:true,connected:true,penClass:'ballpoint'});room.wallets[id]=1000;}broadcast(room);
        }
        else if(msg.type==='start')start(room,session,!!msg.double);
        else if(msg.type==='action'){
          if(msg.version!==room.version)throw new Error('Board changed; try again.');play(room,p.id,msg.action);
        }
        else if(msg.type==='next'){
          if(room.host!==p.id||room.game?.kind!=='rmcs')throw new Error('Only the host advances rounds.');G.nextRound(room.game,rng);setDeadline(room);broadcast(room);
        }
        else if(msg.type==='leave'){
          if(room.game&&room.game.phase!=='finished')throw new Error('A match is active. Disconnect to let the bot finish your turns.');
          // Lobby IDs are compact and immutable during a match. Leaving resets a finished room to lobby.
          const remaining=room.players.filter(v=>v.id!==p.id);room.game=null;room.escrow=null;room.wallets=Object.fromEntries(remaining.map((v,i)=>[String(i),room.wallets[v.id]]));
          remaining.forEach((v,i)=>{v.id=String(i);v.ready=v.bot;if(!v.bot)sessions.get(v.token).player=v.id;});room.players=remaining;room.host=remaining.find(v=>!v.bot)?.id||'0';session.room=null;session.player=null;
          send(ws,{type:'left'});if(!remaining.some(v=>!v.bot))rooms.delete(room.code);else broadcast(room);
        }else throw new Error('Unknown message.');
      }catch(e){send(ws,{type:'error',message:e.message});}
    });
    ws.on('close',()=>{if(session?.ws===ws){session.ws=null;session.seen=now();const room=rooms.get(session.room);if(room){const p=room.players.find(p=>p.id===session.player);if(p)p.connected=false;broadcast(room);}}});
    ws.on('error',()=>{});
  });
  const tick=setInterval(()=>{
    for(const room of rooms.values()){
      const s=room.game;
      if(s&&['playing','guess','reveal'].includes(s.phase)){
        const id=G.actor(s),p=room.players.find(p=>p.id===id),bot=p&&(p.bot||!p.connected);
        if((bot&&now()>room.updated+(s.kind==='rmcs'&&s.phase==='guess'?8000:1400))||now()>=room.deadline){try{play(room,id,G.botAction(s,rng));}catch(e){console.error('Room timer failure:',room.code,e.message);}}
      }
      if(!room.players.some(p=>!p.bot&&p.connected)&&now()-room.updated>30*60*1000){rooms.delete(room.code);for(const p of room.players){const session=sessions.get(p.token);if(session){session.room=null;session.player=null;}}}
    }
    for(const [token,s]of sessions)if(!s.ws&&!s.room&&now()-s.seen>60*60*1000)sessions.delete(token);
  },100);tick.unref();
  return {server,wss,rooms,close:()=>new Promise(resolve=>{clearInterval(tick);for(const ws of wss.clients)ws.terminate();wss.close();server.close(resolve);})};
}
if(require.main===module){const app=createServer();app.server.listen(Number(process.env.PORT)||3000,process.env.HOST||'0.0.0.0',()=>console.log(`BACKBENCHER ready on port ${app.server.address().port}`));}
module.exports={createServer};

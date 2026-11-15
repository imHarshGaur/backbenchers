const {test}=require('node:test');const assert=require('node:assert/strict');const Ajv=require('ajv');const G=require('../shared/core');
const schema=require('../docs/network.schema.json'),validate=new Ajv({strict:false}).compile(schema);
test('all game snapshots and personalized secret projections satisfy the wire schema',()=>{
 for(const kind of ['pen','dots','rmcs'])for(let n=kind==='rmcs'?4:2;n<=6;n++){
  const game=G.create(kind,Array.from({length:n},(_,i)=>`Player ${i}`));
  const room={code:'AB7K',host:'0',kind,stake:50,version:1,deadline:Date.now()+6000,players:game.players.map(p=>({id:p.id,name:p.name,ready:true,bot:false,connected:true})),wallets:Object.fromEntries(game.players.map(p=>[p.id,950])),pot:n*50};
  for(const p of game.players){assert(validate({type:'state',you:p.id,room,game:G.publicState(game,p.id)}),JSON.stringify(validate.errors));}
 }
});
test('valid actions satisfy schema; malformed action fields and edges fail',()=>{
 for(const action of [{type:'flick',dx:20,dy:30},{type:'edge',key:'h:0:0'},{type:'reveal'},{type:'guess',target:'2'},{type:'swap',target:'3'},{type:'bet',caught:true}])assert(validate({type:'action',version:1,action}));
 assert(!validate({type:'action',version:1,action:{type:'bet',caught:'yes'}}));assert(!validate({type:'action',version:1,action:{type:'edge',key:'h:99:0'}}));
});

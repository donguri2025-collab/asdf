import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { createRoom,addPlayer,removePlayer,command,tick,snapshot } from './game.js';
const rooms=new Map(), clients=new Map();
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw Error('요청이 너무 큽니다.');}return JSON.parse(text||'{}');}
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true});
 if(req.method==='POST'&&url.pathname==='/api/join'){
  const data=await body(req);let code=String(data.code||'').trim().toUpperCase();let r;
  if(code){r=rooms.get(code);if(!r)return json(res,404,{error:'방을 찾을 수 없어요. 코드를 다시 확인해 주세요.'});}
  else{do{code=String(randomInt(100000,1000000));}while(rooms.has(code));r=createRoom(code);rooms.set(code,r);}
  const p=addPlayer(r,data.hero);if(!p)return json(res,409,{error:'이미 두 명이 입장한 방이에요.'});
  clients.set(p.id,{room:r,stream:null,seen:Date.now()});return json(res,200,{id:p.id,code,team:p.team});
 }
 if(req.method==='GET'&&url.pathname==='/api/events'){
  const id=url.searchParams.get('id'),c=clients.get(id);if(!c)return json(res,401,{error:'다시 입장해 주세요.'});
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
  if(c.stream)c.stream.end();c.stream=res;c.seen=Date.now();res.write(`data: ${JSON.stringify(snapshot(c.room))}\n\n`);
  req.on('close',()=>{if(c.stream===res){c.stream=null;c.seen=Date.now();}});return;
 }
 if(req.method==='POST'&&url.pathname==='/api/input'){
  const data=await body(req),c=clients.get(data.id);if(!c)return json(res,401,{error:'다시 입장해 주세요.'});
  c.seen=Date.now();const accepted=command(c.room,data.id,data);return json(res,200,{ok:accepted});
 }
 if(req.method==='POST'&&url.pathname==='/api/leave'){
  const data=await body(req),c=clients.get(data.id);if(c){removePlayer(c.room,data.id);c.stream?.end();clients.delete(data.id);}return json(res,200,{ok:true});
 }
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const paths={'/':'index.html','/app.js':'app.js','/motion.js':'motion.js','/prediction.js':'prediction.js','/champions.js':'champions.js','/rules.js':'rules.js','/style.css':'style.css'};const file=paths[url.pathname];
 if(!file)return json(res,404,{error:'Not found'});
 const buffer=await readFile(publicDir+file);res.writeHead(200,{'Cache-Control':'no-cache','Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(buffer);
 }catch{json(res,400,{error:'요청을 처리할 수 없어요.'});}
});
let frame=0;
const timer=setInterval(()=>{
 for(const r of rooms.values())tick(r,1/30);
 if(++frame%2===0)for(const [id,c]of clients){
  if(c.stream){if(c.stream.writableLength<128000)c.stream.write(`data: ${JSON.stringify(snapshot(c.room))}\n\n`);}
  else if(Date.now()-c.seen>20000){removePlayer(c.room,id);clients.delete(id);}
 }
 for(const [code,r]of rooms)if(![...clients.values()].some(c=>c.room===r))rooms.delete(code);
},1000/30);
const port=Number(process.env.PORT||3000);
server.listen(port,'0.0.0.0',()=>console.log(`Frostline Arena listening on port ${port}`));
function shutdown(){clearInterval(timer);for(const c of clients.values())c.stream?.end();server.close(()=>process.exit(0));}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

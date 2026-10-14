import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('HTTP server serves the game and shares authoritative state between two clients',async()=>{
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'3199'},stdio:['ignore','pipe','pipe']});
 const controllers=[];
 try{
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Startup timed out')),5000).unref())]);
  const base='http://127.0.0.1:3199';
  const post=async(path,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
  assert.equal((await fetch(base+'/health')).status,200);assert.match(await(await fetch(base)).text(),/FROSTLINE/);
  const a=(await post('/api/join',{hero:'ranger'})).data,b=(await post('/api/join',{code:a.code,hero:'mage'})).data;
  assert.equal(a.code,b.code);assert.equal(b.team,1);assert.equal((await post('/api/join',{code:a.code})).status,409);
  async function state(id){const controller=new AbortController();controllers.push(controller);const res=await fetch(base+'/api/events?id='+id,{signal:controller.signal});const reader=res.body.getReader();let buffer='';while(!buffer.includes('\n\n')){const {value}=await reader.read();buffer+=new TextDecoder().decode(value);}const data=JSON.parse(buffer.split('\n')[0].slice(6));controller.abort();return data;}
  const first=await state(a.id);assert.equal(first.players.filter(p=>!p.bot).length,2);
  await post('/api/input',{id:a.id,type:'move',x:600,y:380});await new Promise(r=>setTimeout(r,180));const other=await state(b.id);assert.ok(other.players.find(p=>p.id===a.id).x>170);
  await post('/api/leave',{id:b.id});assert.equal((await state(a.id)).players.find(p=>p.team===1).bot,true);
  assert.equal((await post('/api/join',{code:'000000'})).status,404);
 }finally{for(const c of controllers)c.abort();child.kill('SIGTERM');await once(child,'exit');}
});

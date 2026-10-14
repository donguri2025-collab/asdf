import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,removePlayer,command,tick} from '../game.js';
const advance=(r,seconds)=>{for(let i=0;i<seconds*30;i++)tick(r,1/30);};
test('a friend replaces the bot and a third player is rejected',()=>{
 const r=createRoom('123456');const a=addPlayer(r,'ranger');assert.equal(a.team,0);assert.equal(r.players[1].bot,true);
 const b=addPlayer(r,'knight');assert.equal(b.team,1);assert.equal(r.players.length,2);assert.equal(r.players.some(p=>p.bot),false);assert.equal(addPlayer(r,'mage'),null);
 removePlayer(r,b.id);assert.equal(r.players[1].bot,true);
});
test('movement stays on the bridge and invalid commands are ignored',()=>{
 const r=createRoom('123456'),p=addPlayer(r,'ranger');
 assert.equal(command(r,p.id,{type:'move',x:NaN,y:0}),false);
 command(r,p.id,{type:'move',x:-10000,y:10000});advance(r,2);assert.equal(p.x,65);assert.equal(p.y,540);
});
test('Q hits an enemy and cannot be spammed while on cooldown',()=>{
 const r=createRoom('123456'),p=addPlayer(r,'mage'),b=addPlayer(r,'knight');r.nextWave=100;p.x=700;b.x=1000;
 assert.equal(command(r,p.id,{type:'skill',key:'q',x:1000,y:380}),true);
 assert.equal(command(r,p.id,{type:'skill',key:'q',x:1000,y:380}),false);advance(r,.5);assert.equal(b.hp,b.maxHp-130);
});
test('dead heroes respawn and minion waves run',()=>{
 const r=createRoom('123456'),p=addPlayer(r,'mage');p.hp=0;p.dead=1;advance(r,1.1);assert.equal(p.hp,p.maxHp);advance(r,1);assert.equal(r.wave,1);assert.equal(r.minions.length,6);
});
test('the core is protected by its tower, and destroying it ends the match',()=>{
 const r=createRoom('123456'),p=addPlayer(r,'knight');addPlayer(r,'mage');r.nextWave=100;
 const tower=r.structures.find(s=>s.id==='tower1'),core=r.structures.find(s=>s.id==='core1');p.x=1430;
 command(r,p.id,{type:'skill',key:'w',x:1490,y:380});assert.equal(core.hp,core.maxHp);
 tower.hp=0;core.hp=100;p.cd.w=0;command(r,p.id,{type:'skill',key:'w',x:1490,y:380});assert.equal(core.hp,0);assert.equal(r.winner,0);
 const time=r.time;tick(r,1);assert.equal(r.time,time);
});

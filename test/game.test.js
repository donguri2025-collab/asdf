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
const duel=()=>{const r=createRoom('123456'),a=addPlayer(r,'ranger'),b=addPlayer(r,'knight');r.nextWave=100;a.x=700;b.x=900;return {r,a,b};};
test('ordinary movement does not auto-attack; right-click attacks after a windup',()=>{
 const {r,a,b}=duel();command(r,a.id,{type:'move',x:750,y:380});advance(r,.5);assert.equal(b.hp,b.maxHp);assert.equal(r.projectiles.length,0);
 command(r,a.id,{type:'attack',targetId:b.id,x:b.x,y:b.y});const x=a.x;advance(r,.1);assert.ok(a.windup);assert.equal(a.x,x);assert.equal(b.hp,b.maxHp);
 advance(r,.7);assert.ok(b.hp<b.maxHp);
});
test('moving cancels attack windup and attack move acquires an enemy',()=>{
 const {r,a,b}=duel();command(r,a.id,{type:'attack',targetId:b.id,x:b.x,y:b.y});advance(r,.1);
 command(r,a.id,{type:'move',x:500,y:380});advance(r,.5);assert.equal(b.hp,b.maxHp);assert.ok(a.x<700);
 command(r,a.id,{type:'attackMove',x:1000,y:380});advance(r,1.5);assert.ok(b.hp<b.maxHp);
});
test('targeted attack chases out-of-range enemy and stops in range',()=>{
 const {r,a,b}=duel();b.x=1100;command(r,a.id,{type:'attack',targetId:b.id,x:b.x,y:b.y});advance(r,1);assert.ok(a.x>700);assert.ok(a.x<860);assert.equal(a.order,'attack');
});
test('shield absorbs damage and expires; D heals with a cooldown',()=>{
 const {r,a,b}=duel();command(r,b.id,{type:'skill',key:'e',x:900,y:380});assert.equal(b.shield,180);
 command(r,a.id,{type:'skill',key:'w',x:900,y:380});assert.equal(b.hp,b.maxHp);assert.equal(b.shield,70);
 b.hp=400;assert.equal(command(r,b.id,{type:'skill',key:'d',x:900,y:380}),true);assert.equal(b.hp,670);assert.equal(command(r,b.id,{type:'skill',key:'d',x:900,y:380}),false);
 advance(r,3.1);assert.equal(b.shield,0);
});
test('R is delayed, stops walking and deals area damage; F blinks within bridge bounds',()=>{
 const {r,a,b}=duel();command(r,a.id,{type:'move',x:1000,y:380});command(r,a.id,{type:'skill',key:'r',x:900,y:380});advance(r,.3);assert.equal(b.hp,b.maxHp);assert.equal(a.x,700);
 advance(r,.4);assert.equal(b.hp,b.maxHp-260);assert.equal(a.casting,null);
 const before=a.x;command(r,a.id,{type:'skill',key:'f',x:1500,y:380});assert.equal(a.x,before+180);assert.equal(a.order,'idle');assert.equal(a.cd.f,45);
 a.cd.f=0;command(r,a.id,{type:'skill',key:'f',x:1500,y:0});assert.ok(a.y>=220);
});
test('late input sequence cannot override a newer movement command',()=>{
 const {r,a}=duel();assert.equal(command(r,a.id,{type:'move',seq:2,x:500,y:380}),true);assert.equal(command(r,a.id,{type:'move',seq:1,x:1000,y:380}),false);assert.equal(a.target.x,500);
 assert.equal(command(r,a.id,{type:'stop',x:0,y:0}),false);
});

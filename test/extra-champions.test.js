import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,command,tick} from '../game.js';
const advance=(r,s)=>{for(let i=0;i<Math.ceil(s*60);i++)tick(r,1/60);};
const duel=(kind)=>{const r=createRoom('extra'),a=addPlayer(r,kind),b=addPlayer(r,'garen');r.nextWave=100;a.x=650;b.x=1000;a.attack=999;b.attack=999;return {r,a,b};};
const cast=(r,p,key,x=1000,y=380)=>command(r,p.id,{type:'skill',key,x,y});
test('new champions have distinct identities',()=>{
 for(const [kind,name]of [['ezreal','이즈리얼'],['blitzcrank','블리츠크랭크'],['yone','요네']])assert.equal(duel(kind).a.name,name);
});
test('Ezreal W marks, Q triggers mark once and reduces cooldowns; E relocates and fires',()=>{
 const {r,a,b}=duel('ezreal');cast(r,a,'w');advance(r,.6);assert.equal(b.arcaneMark.owner,a.id);assert.equal(b.hp,b.maxHp);
 cast(r,a,'q');advance(r,.45);assert.equal(b.hp,b.maxHp-195);assert.equal(b.arcaneMark,null);assert.ok(a.cd.q<2.2);
 const before=b.hp;cast(r,a,'e',850);assert.equal(a.x,830);assert.equal(a.positionRevision,1);assert.equal(b.hp,before-80);
});
test('Ezreal R passes through multiple enemies and towers',()=>{
 const {r,a,b}=duel('ezreal');b.x=1250;
 r.minions.push({id:'minion',type:'minion',team:1,x:950,y:380,hp:500,maxHp:500,root:100,speed:70,damage:0,range:0,attack:99});
 cast(r,a,'r',1500);advance(r,.4);assert.equal(b.hp,b.maxHp);advance(r,1.1);
 assert.equal(b.hp,b.maxHp-220);assert.equal(r.minions[0].hp,280);assert.equal(r.structures.find(u=>u.id==='tower1').hp,800);
});
test('Blitz Q pulls the first enemy and is blocked by minions',()=>{
 const {r,a,b}=duel('blitzcrank');cast(r,a,'q');advance(r,.6);assert.ok(Math.abs(b.x-a.x-65)<.01);assert.equal(b.positionRevision,1);assert.ok(b.stun>0);
 const other=duel('blitzcrank');other.r.minions.push({id:'block',type:'minion',team:1,x:800,y:380,hp:500,maxHp:500,root:100,speed:70,damage:0,range:0,attack:99});cast(other.r,other.a,'q');advance(other.r,.6);assert.equal(other.b.x,1000);assert.ok(other.r.minions[0].x<800);
});
test('Blitz W speeds up then slows, E knocks up, R breaks shields and silences',()=>{
 const {r,a,b}=duel('blitzcrank');cast(r,a,'w');advance(r,.1);assert.ok(a.speed>a.baseSpeed);advance(r,4);assert.ok(a.speed<a.baseSpeed);
 b.x=a.x+70;cast(r,a,'e');advance(r,.3);assert.equal(b.hp,b.maxHp-104);assert.ok(b.stun>0);
 b.shield=500;b.shieldTime=3;const hp=b.hp;cast(r,a,'r');assert.equal(b.shield,0);assert.equal(b.hp,hp-180);assert.equal(b.silence,1);
});
test('Yone Q earns two stacks on hits and third cast dashes and knocks up; stacks expire',()=>{
 const {r,a,b}=duel('yone');b.x=800;
 for(let i=0;i<2;i++){a.cd.q=0;cast(r,a,'q',1000);}assert.equal(a.qStacks,2);assert.equal(a.x,650);
 a.cd.q=0;cast(r,a,'q',1000);assert.equal(a.qStacks,0);assert.equal(a.x,910);assert.ok(b.stun>0);assert.equal(a.positionRevision,1);
 a.qStacks=2;a.qStackTime=.1;advance(r,.2);assert.equal(a.qStacks,0);
});
test('Yone W shield and E recast echo damage, preserve cooldown, never heal on return',()=>{
 const {r,a,b}=duel('yone');b.x=850;cast(r,a,'e',1000);assert.equal(a.x,730);assert.equal(a.spirit.x,650);
 cast(r,a,'w',850);assert.equal(a.shield,140);cast(r,a,'q',850);assert.equal(a.spirit.damage[b.id],160);
 a.hp=200;const hp=b.hp,cd=a.cd.e;assert.equal(cast(r,a,'e'),true);assert.equal(a.x,650);assert.equal(a.hp,200);assert.equal(b.hp,hp-40);assert.equal(a.spirit,null);assert.equal(a.cd.e,cd);assert.equal(cast(r,a,'e'),false);
});
test('Yone E auto-returns at five seconds, but death cancels the tether',()=>{
 const {r,a}=duel('yone');cast(r,a,'e');advance(r,4.9);assert.ok(a.spirit);advance(r,.15);assert.equal(a.spirit,null);assert.equal(a.x,650);
 const other=duel('yone');cast(other.r,other.a,'e');other.a.hp=1;
 other.r.projectiles.push({id:'lethal',x:other.a.x,y:other.a.y,team:1,owner:other.b.id,target:other.a.id,damage:20,speed:680,life:1,type:'attack'});advance(other.r,.1);assert.equal(other.a.hp,0);assert.equal(other.a.spirit,null);
});
test('Yone R relocates and groups enemies; rooted mobility skills are rejected',()=>{
 const {r,a,b}=duel('yone');cast(r,a,'r',1200);advance(r,.3);assert.equal(a.x,650);advance(r,.4);assert.equal(a.x,1100);assert.equal(b.x,1135);assert.equal(b.hp,b.maxHp-210);assert.ok(b.stun>0);
 for(const kind of ['ezreal','yone']){const {r,a}=duel(kind);a.root=1;assert.equal(cast(r,a,'e'),false);assert.equal(a.cd.e,0);}
});

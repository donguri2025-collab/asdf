import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,command,tick} from '../game.js';
const advance=(r,s)=>{for(let i=0;i<Math.ceil(s*60);i++)tick(r,1/60);};
const duel=(kind,other='garen')=>{const r=createRoom('champions'),a=addPlayer(r,kind),b=addPlayer(r,other);r.nextWave=100;a.x=650;b.x=1000;return {r,a,b};};
const skill=(r,p,key,x=1000,y=380)=>command(r,p.id,{type:'skill',key,x,y});
test('champion identities and default selection',()=>{
 for(const [kind,name]of [['ashe','애쉬'],['lux','럭스'],['garen','가렌']])assert.equal(addPlayer(createRoom(kind),kind).name,name);
 assert.equal(addPlayer(createRoom('default')).kind,'ashe');
});
test('Ashe Q accelerates attacks, W volleys hit once and slow, E enables scouting',()=>{
 const {r,a,b}=duel('ashe');skill(r,a,'q');assert.equal(a.rapid,5);skill(r,a,'e');assert.equal(a.scout,5);
 skill(r,a,'w');assert.equal(r.projectiles.length,7);advance(r,.6);assert.equal(b.hp,b.maxHp-65);assert.ok(b.slow>0);assert.ok(b.speed<b.baseSpeed);
 advance(r,5);assert.equal(a.rapid,0);assert.equal(a.scout,0);
});
test('Ashe R ignores minions and stuns a champion; stunned commands cannot cast',()=>{
 const {r,a,b}=duel('ashe');r.minions.push({id:'blocker',type:'minion',team:1,x:800,y:380,hp:500,maxHp:500,speed:70,damage:0,range:0,attack:0});
 skill(r,a,'r');advance(r,.52);assert.ok(b.stun>0);assert.equal(b.hp,b.maxHp-220);
 assert.equal(skill(r,b,'f',1200),false);const x=b.x;command(r,b.id,{type:'move',x:1200,y:380});advance(r,.3);assert.equal(b.x,x);
});
test('Lux Q pierces two enemies and roots without allowing flash',()=>{
 const {r,a,b}=duel('lux');b.x=1100;
 for(let i=0;i<3;i++)r.minions.push({id:'target'+i,type:'minion',team:1,x:800+i*70,y:380,hp:500,maxHp:500,speed:70,damage:0,range:0,attack:0});
 skill(r,a,'q');advance(r,.5);assert.ok(r.minions[0].root>0);assert.ok(r.minions[1].root>0);assert.equal(r.minions[2].hp,500);
 b.root=1;assert.equal(skill(r,b,'f',1200),false);
});
test('Lux W shields, E detonates after a delay and R is a directional piercing laser',()=>{
 const {r,a,b}=duel('lux');skill(r,a,'w');assert.equal(a.shield,180);
 skill(r,a,'e');advance(r,.5);assert.equal(b.hp,b.maxHp);advance(r,.65);assert.equal(b.hp,b.maxHp-130);assert.ok(b.slow>0);
 b.hp=b.maxHp;skill(r,a,'r',1400);advance(r,.3);assert.equal(b.hp,b.maxHp);advance(r,.4);assert.equal(b.hp,b.maxHp-280);assert.ok(r.effects.some(e=>e.type==='laser'));
});
test('Garen Q empowers melee and silences; W shields and reduces incoming damage',()=>{
 const {r,a,b}=duel('garen','lux');b.x=730;skill(r,a,'q');assert.equal(a.empowered,4);advance(r,.3);assert.equal(b.hp,b.maxHp-124);assert.ok(b.silence>0);assert.equal(skill(r,b,'q'),false);
 const other=duel('garen','lux');skill(other.r,other.a,'w');assert.equal(other.a.guard,3);assert.equal(other.a.shield,180);
 skill(other.r,other.b,'q',650);advance(other.r,.65);assert.equal(other.a.hp,other.a.maxHp);assert.ok(Math.abs(other.a.shield-103)<.01);
});
test('Garen spins while moving and R requires a nearby champion and scales with missing health',()=>{
 const {r,a,b}=duel('garen');b.x=760;skill(r,a,'e');command(r,a.id,{type:'move',x:850,y:380});advance(r,.25);assert.ok(a.x>650);assert.ok(b.hp<b.maxHp);assert.ok(a.spin>0);
 b.x=1400;assert.equal(skill(r,a,'r',1400),false);assert.equal(a.cd.r,0);
 b.x=a.x+150;b.hp=400;assert.equal(skill(r,a,'r',b.x),true);assert.equal(b.hp,100);assert.equal(a.cd.r,30);
});
test('all champions retain D heal and F flash and buffs clear on death',()=>{
 for(const kind of ['ashe','lux','garen']){const {r,a,b}=duel(kind,'lux');a.hp=100;skill(r,a,'d');assert.equal(a.hp,100+a.maxHp*.3);const x=a.x;skill(r,a,'f',1200);assert.equal(a.x,x+180);
 a.hp=1;a.spin=2;a.rapid=2;b.x=a.x+150;skill(r,b,'e',a.x);advance(r,1.2);assert.equal(a.hp,0);assert.equal(a.spin,0);assert.equal(a.rapid,0);}
});

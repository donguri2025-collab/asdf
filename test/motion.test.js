import test from 'node:test';
import assert from 'node:assert/strict';
import { Motion } from '../public/motion.js';
const state=(x,time,extra={})=>({time,players:[{id:'hero',x,y:380,hp:100,speed:215,cd:{f:0},...extra}],minions:[],projectiles:[]});
test('15Hz snapshots produce continuous positions at 60Hz without mutating server state',()=>{
 const m=new Motion();m.push(state(0,0),0);
 const packet=state(14,1/15);m.push(packet,1000/15);
 const positions=[0,1,2,3,4].map(i=>m.entity(packet.players[0],1000/15+i*1000/60).x);
 for(let i=1;i<positions.length;i++)assert.ok(Math.abs(positions[i]-positions[i-1]-3.5)<1e-8);
 assert.equal(packet.players[0].x,14);
 m.push(state(28,2/15),2000/15);assert.ok(Math.abs(m.sample('hero',2000/15).x-14)<1e-8);
});
test('interpolation stops at the authoritative target, and freezes during network gaps',()=>{
 const m=new Motion();m.push(state(0,0),0);m.push(state(14,1/15),67);
 assert.equal(m.sample('hero',5000).x,14);
 m.push(state(200,1),5000);assert.equal(m.sample('hero',5000).x,200);
});
test('dash, respawn, and removed entities do not leave visual trails',()=>{
 const m=new Motion();m.push(state(100,0),0);m.push(state(160,1/15,{cd:{f:7}}),67);
 assert.equal(m.sample('hero',67).x,160);
 m.push(state(160,2/15,{hp:0}),134);m.push(state(170,3/15),201);assert.equal(m.sample('hero',201).x,170);
 m.push({time:4/15,players:[],minions:[],projectiles:[]},268);assert.equal(m.sample('hero',268),null);
 m.reset();assert.equal(m.lastTime,null);
});
test('minions and projectiles are interpolated too',()=>{
 const m=new Motion();const packet=(x,time)=>({time,players:[],minions:[{id:'minion',x,y:0,hp:10,speed:70}],projectiles:[{id:'shot',x,y:0,speed:680}]});
 m.push(packet(0,0),0);m.push(packet(10,1/15),67);
 for(const id of ['minion','shot'])assert.ok(Math.abs(m.sample(id,67+1000/30).x-5)<1e-8);
});
test('remote short displacement is not interpolated as ordinary walking',()=>{
 const m=new Motion();m.push(state(100,0,{positionRevision:0}),0);m.push(state(160,1/15,{positionRevision:1}),67);assert.equal(m.sample('hero',67).x,160);
});

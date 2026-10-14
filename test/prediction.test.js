import test from 'node:test';
import assert from 'node:assert/strict';
import {Prediction} from '../public/prediction.js';
const hero=()=>({id:'me',team:0,x:170,y:380,hp:650,maxHp:650,speed:215,range:265,order:'idle',target:null,lastSeq:0,cd:{f:0}});
const state={winner:null,players:[],minions:[],structures:[]};
test('walking responds before server acknowledgement; stale snapshots cannot cancel pending input',()=>{
 const p=new Prediction(),h=hero();p.receive(h,100);p.input({type:'move',x:700,y:380,seq:1},100);p.step(1/60,state,117);assert.ok(p.local.x>170);assert.equal(h.x,170);
 p.receive(h,130);p.step(1/60,state,147);assert.ok(p.local.x>175);
 p.receive({...h,x:177,order:'move',target:{x:700,y:380},lastSeq:1},160);assert.equal(p.pending,null);
});
test('prediction stops on disconnect, snaps to blink and resets across rooms',()=>{
 const p=new Prediction(),h=hero();p.receive(h,100);p.input({type:'move',x:700,y:380,seq:1},100);p.step(.05,state,150);const x=p.local.x;p.step(.05,state,800);assert.equal(p.local.x,x);
 p.receive({...h,x:350,lastSeq:2,cd:{f:45}},810);assert.equal(p.local.x,350);assert.equal(p.pending,null);
 p.reset();assert.equal(p.local,null);
});
test('prediction respects casting and targeted attack range',()=>{
 const p=new Prediction(),h=hero();p.receive({...h,casting:{remaining:.5}},100);p.input({type:'move',x:700,y:380,seq:1},100);p.step(.05,state,150);assert.equal(p.local.x,170);
 p.reset();p.receive(h,200);p.input({type:'attack',targetId:'enemy',x:300,y:380,seq:1},200);p.step(.05,{...state,players:[{id:'enemy',team:1,x:300,y:380,hp:100}]},250);assert.equal(p.local.x,170);
});

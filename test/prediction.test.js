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

test('delayed authoritative snapshots cannot drag walking backwards or stop prediction during auto-attacks',()=>{
 const p=new Prediction(),h=hero();p.receive(h,0);p.input({type:'move',x:700,y:380,seq:1},0);
 let previous=p.local.x;
 for(let i=1;i<=40;i++){
  const now=i*16;
  if(i%4===0)p.receive({...h,x:170+215*Math.max(0,now-180)/1000,order:'move',target:{x:700,y:380},lastSeq:1,windup:{remaining:.2}},now);
  p.step(.016,state,now);assert.ok(p.local.x>=previous);previous=p.local.x;
 }
 assert.ok(p.local.x>300);
 const target={...p.local.target};p.input({type:'attackMove',x:400,y:220,seq:2},650);assert.deepEqual(p.local.target,target);
});
test('short champion blinks and spirit returns snap using position revision',()=>{
 const p=new Prediction(),h={...hero(),positionRevision:0};p.receive(h,100);
 p.receive({...h,x:230,positionRevision:1},150);assert.equal(p.local.x,230);assert.deepEqual(p.correction,{x:0,y:0});
 p.receive({...h,positionRevision:2},200);assert.equal(p.local.x,170);
});
test('Flash predicts instantly, survives stale snapshots, and confirms or rolls back',()=>{
 const p=new Prediction(),h={...hero(),lastSeq:0};p.receive(h,100);
 p.input({type:'skill',key:'f',seq:1,x:1000,y:380},110);assert.equal(p.local.x,410);assert.equal(p.local.cd.f,45);
 p.receive(h,150);assert.equal(p.local.x,410);assert.equal(p.local.cd.f,45);
 p.input({type:'skill',key:'f',seq:2,x:1000,y:380},160);assert.equal(p.local.x,410);
 p.receive({...h,x:410,lastSeq:1,cd:{f:44.9}},180);assert.equal(p.flash,null);assert.equal(p.local.x,410);
 p.reset();p.receive(h,100);p.input({type:'skill',key:'f',seq:3,x:1000,y:380},110);p.rejectFlash(3);assert.equal(p.local.x,170);assert.equal(p.local.cd.f,0);
});
test('Flash prediction respects crowd control, casting and cooldown',()=>{
 for(const blocked of [{stun:1},{root:1},{silence:1},{casting:{}},{cd:{f:3}}]){const p=new Prediction();p.receive({...hero(),...blocked},100);p.input({type:'skill',key:'f',seq:1,x:1000,y:380},110);assert.equal(p.local.x,170);assert.equal(p.flash,null);}
});
test('local hook victim is interpolated between snapshots and cannot predict walking out',()=>{
 const p=new Prediction(),h={...hero(),x:1000,positionRevision:0};p.receive(h,100);
 const pull={owner:'enemy',toX:715,toY:380};p.receive({...h,x:940,pull,stun:.5},167);
 assert.equal(p.local.x,1000);p.step(.016,state,200);assert.ok(p.local.x<1000&&p.local.x>940);
 const x=p.local.x;p.input({type:'move',seq:1,x:1400,y:380},201);assert.equal(p.pending,null);assert.equal(p.local.x,x);
 p.receive({...h,x:880,pull,stun:.4},234);p.step(.016,state,267);assert.ok(p.local.x<x&&p.local.x>880);
});

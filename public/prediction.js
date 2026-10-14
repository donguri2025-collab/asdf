import { FLASH_RANGE } from './rules.js';
// Predict walking and Flash visuals; the server confirms movement and all combat outcomes.
export class Prediction {
 reset(){this.local=null;this.pending=null;this.correction={x:0,y:0};this.last=0;this.seq=0;this.latency=0;this.flash=null;this.authoritative=null;this.forced=null;}
 constructor(){this.reset();}
 input(command,now){
  this.seq=command.seq;
  if(!this.local||this.local.hp<=0||this.local.pull||this.forced)return;
  if(command.type==='skill'&&command.key==='f'&&!this.flash&&this.local.cd.f<=0&&!this.local.casting&&!(this.local.root>0)&&!(this.local.stun>0)&&!(this.local.silence>0)){
   const p=this.local,dx=command.x-p.x,dy=command.y-p.y,d=Math.hypot(dx,dy)||1;
   const x=Math.max(65,Math.min(1535,p.x+dx/d*Math.min(FLASH_RANGE,d))),y=Math.max(220,Math.min(540,p.y+dy/d*Math.min(FLASH_RANGE,d)));
   this.flash={seq:command.seq,at:now,x,y};this.pending=null;p.x=x;p.y=y;p.cd={...p.cd,f:45};p.target=null;p.order='idle';p.windup=null;this.correction={x:0,y:0};
  }
  if(['move','attack'].includes(command.type)){
   this.pending={...command,at:now};this.apply(command);this.correction={x:0,y:0};
  }
 }
 apply(c){this.local.order=c.type;this.local.target={x:Math.max(65,Math.min(1535,c.x)),y:Math.max(220,Math.min(540,c.y))};this.local.attackTarget=c.targetId||null;this.local.windup=null;}
 rejectFlash(seq){
  if(this.flash?.seq!==seq)return;this.flash=null;
  if(this.authoritative){this.local={...this.authoritative,cd:{...this.authoritative.cd}};if(this.pending)this.apply(this.pending);}
  this.correction={x:0,y:0};
 }
 setLatency(ms){this.latency=Math.min(150,Math.max(0,ms/2));}
 receive(p,now){
  if(!p)return;
  this.authoritative={...p,cd:{...p.cd}};
  const resolvedFlash=this.flash&&(p.lastSeq>=this.flash.seq||now-this.flash.at>1200||p.hp<=0);
  if(resolvedFlash)this.flash=null;
  const old=this.local;
  const discontinuity=resolvedFlash||!old||p.positionRevision!==old.positionRevision||old.hp<=0||p.hp<=0||p.cd.f>old.cd.f+1||Math.hypot(old.x-p.x,old.y-p.y)>250||now-this.last>500;
  const interval=Math.max(16,Math.min(100,now-this.last));
  this.last=now;
  if(discontinuity)this.forced=null;
  else if(p.pull||old?.pull)this.forced={from:{x:old.x,y:old.y},to:{x:p.x,y:p.y},at:now,duration:interval};
  if(p.pull){this.pending=null;this.flash=null;}
  if(this.pending&&(p.lastSeq>=this.pending.seq||now-this.pending.at>1500))this.pending=null;
  this.local={...p,cd:{...p.cd},x:discontinuity?p.x:old.x,y:discontinuity?p.y:old.y};
  if(this.flash){this.local.x=old.x;this.local.y=old.y;this.local.cd.f=45;this.local.target=null;this.local.order='idle';this.local.windup=null;}
  if(this.pending&&p.hp>0)this.apply(this.pending);
  let expected={x:p.x,y:p.y};
  if(p.order==='move'&&p.target&&!p.casting&&!(p.root>0)&&!(p.stun>0)){
   const dx=p.target.x-p.x,dy=p.target.y-p.y,d=Math.hypot(dx,dy);
   if(d>4){const step=Math.min(d,p.speed*this.latency/1000);expected.x+=dx/d*step;expected.y+=dy/d*step;}
  }
  this.correction=discontinuity||this.pending||this.flash||this.forced?{x:0,y:0}:{x:expected.x-this.local.x,y:expected.y-this.local.y};
 }
 step(dt,state,now){
  const p=this.local;if(!p)return null;
  dt=Math.min(.05,Math.max(0,dt));
  if(p.hp<=0||state.winner!==null||now-this.last>500)return p;
  if(this.forced){const f=this.forced,t=Math.max(0,Math.min(1,(now-f.at)/f.duration));p.x=f.from.x+(f.to.x-f.from.x)*t;p.y=f.from.y+(f.to.y-f.from.y)*t;if(t>=1)this.forced=null;return p;}
  const targets=[...state.players,...state.minions,...state.structures].filter(u=>u.team!==p.team&&u.hp>0&&!(u.type==='core'&&state.structures.some(s=>s.type==='tower'&&s.team===u.team&&s.hp>0)));
  const d=u=>Math.hypot(p.x-u.x,p.y-u.y);
  const enemy=p.order==='attack'?targets.find(u=>u.id===p.attackTarget):null;
  const target=p.order==='attack'?enemy:p.target;
  if(!p.casting&&!(p.root>0)&&!(p.stun>0)&&(!p.windup||p.order==='move')&&!(enemy&&d(enemy)<=(p.spin>0?65:p.range))&&target){const distance=d(target);if(distance>4){const step=Math.min(distance,p.speed*dt);p.x+=(target.x-p.x)/distance*step;p.y+=(target.y-p.y)/distance*step;}}
  // A delayed snapshot must not drag a moving player backwards or sideways.
  // Keep the latest local walking path; reconcile to the final authoritative stop.
  if(p.order==='move'&&p.target&&!p.casting&&!(p.root>0)&&!(p.stun>0)){
   const dx=p.target.x-p.x,dy=p.target.y-p.y,distance=Math.hypot(dx,dy);
   if(distance>4){const forward=Math.max(0,(this.correction.x*dx+this.correction.y*dy)/distance);this.correction={x:dx/distance*forward,y:dy/distance*forward};}
   else {p.x=p.target.x;p.y=p.target.y;this.correction={x:0,y:0};}
  }
  const factor=1-Math.exp(-10*dt);p.x+=this.correction.x*factor;p.y+=this.correction.y*factor;this.correction.x*=1-factor;this.correction.y*=1-factor;
  p.x=Math.max(65,Math.min(1535,p.x));p.y=Math.max(220,Math.min(540,p.y));return p;
 }
}

// Predict only walking. Damage, cooldowns, blink and attack windups stay authoritative.
export class Prediction {
 reset(){this.local=null;this.pending=null;this.correction={x:0,y:0};this.last=0;this.seq=0;}
 constructor(){this.reset();}
 input(command,now){
  this.seq=command.seq;
  if(!this.local||this.local.hp<=0)return;
  if(['move','attack','attackMove'].includes(command.type)){
   this.pending={...command,at:now};this.apply(command);this.correction={x:0,y:0};
  }
 }
 apply(c){this.local.order=c.type;this.local.target={x:Math.max(65,Math.min(1535,c.x)),y:Math.max(220,Math.min(540,c.y))};this.local.attackTarget=c.targetId||null;this.local.windup=null;}
 receive(p,now){
  if(!p)return;
  const old=this.local;
  const discontinuity=!old||old.hp<=0||p.hp<=0||p.cd.f>old.cd.f+1||Math.hypot(old.x-p.x,old.y-p.y)>250||now-this.last>500;
  this.last=now;
  if(this.pending&&(p.lastSeq>=this.pending.seq||now-this.pending.at>1500))this.pending=null;
  this.local={...p,cd:{...p.cd},x:discontinuity?p.x:old.x,y:discontinuity?p.y:old.y};
  if(this.pending&&p.hp>0)this.apply(this.pending);
  this.correction=discontinuity||this.pending?{x:0,y:0}:{x:p.x-this.local.x,y:p.y-this.local.y};
 }
 step(dt,state,now){
  const p=this.local;if(!p)return null;
  dt=Math.min(.05,Math.max(0,dt));
  if(p.hp<=0||state.winner!==null||now-this.last>500)return p;
  const targets=[...state.players,...state.minions,...state.structures].filter(u=>u.team!==p.team&&u.hp>0&&!(u.type==='core'&&state.structures.some(s=>s.type==='tower'&&s.team===u.team&&s.hp>0)));
  const d=u=>Math.hypot(p.x-u.x,p.y-u.y);
  const enemy=p.order==='attack'?targets.find(u=>u.id===p.attackTarget):p.order==='attackMove'?targets.find(u=>d(u)<=p.range):null;
  const target=p.order==='attack'?enemy:p.target;
  if(!p.casting&&!p.windup&&!(enemy&&d(enemy)<=p.range)&&target){const distance=d(target);if(distance>4){const step=Math.min(distance,p.speed*dt);p.x+=(target.x-p.x)/distance*step;p.y+=(target.y-p.y)/distance*step;}}
  const factor=1-Math.exp(-10*dt);p.x+=this.correction.x*factor;p.y+=this.correction.y*factor;this.correction.x*=1-factor;this.correction.y*=1-factor;
  p.x=Math.max(65,Math.min(1535,p.x));p.y=Math.max(220,Math.min(540,p.y));return p;
 }
}

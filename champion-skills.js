import { LUX_E_RADIUS } from './public/rules.js';
// Compact, original implementations of the champions' signature mechanics.
export function championCast(r,p,key,aim,h){
 const {distance,hit,area,projectile,units}=h;
 const enemies=()=>units(r).filter(u=>u.team!==p.team);
 const direction=Math.atan2(aim.y-p.y,aim.x-p.x);
 const center=()=>{const d=distance(p,aim)||1,t=Math.min(1,350/d);return {x:p.x+(aim.x-p.x)*t,y:Math.max(220,Math.min(540,p.y+(aim.y-p.y)*t))};};
 if(!['ashe','lux','garen'].includes(p.kind)||!['q','w','e','r'].includes(key))return null;
 if(p.kind==='ashe'){
  if(key==='q'){p.cd.q=9;p.rapid=5;}
  if(key==='w'){p.cd.w=8;const group=`${p.id}:${r.time}`,groupHits=[];for(let i=-3;i<=3;i++)projectile(r,p,direction+i*.095,{damage:65,radius:10,life:1,speed:650,visual:'ice',slow:1.4,group,groupHits});}
  if(key==='e'){p.cd.e=14;p.scout=5;r.effects.push({type:'hawk',x:p.x,y:p.y,tx:aim.x,ty:aim.y,team:p.team,life:1});}
  if(key==='r'){p.cd.r=30;projectile(r,p,direction,{damage:220,radius:24,life:2.4,speed:720,visual:'ice-arrow',stun:1.5,heroesOnly:true});}
 }
 if(p.kind==='lux'){
  if(key==='q'){p.cd.q=6;projectile(r,p,direction,{damage:110,radius:12,life:1.1,speed:600,visual:'light',root:1.1,pierce:2});}
  if(key==='w'){p.cd.w=10;p.shield=180;p.shieldTime=3;r.effects.push({type:'shield',x:p.x,y:p.y,team:p.team,life:.6});}
  if(key==='e'){p.cd.e=8;r.zones.push({...center(),owner:p.id,team:p.team,radius:LUX_E_RADIUS,life:5,damage:130});}
  if(key==='r'){p.cd.r=30;p.windup=null;p.casting={type:'laser',x:p.x,y:p.y,tx:p.x+Math.cos(direction)*1100,ty:p.y+Math.sin(direction)*1100,remaining:.65};}
 }
 if(p.kind==='garen'){
  if(key==='q'){p.cd.q=7;p.empowered=4;p.haste=3;p.root=0;p.slow=0;}
  if(key==='w'){p.cd.w=10;p.shield=180;p.shieldTime=3;p.guard=3;}
  if(key==='e'){p.cd.e=10;p.spin=3;p.spinTick=0;p.windup=null;}
  if(key==='r'){
   const targets=enemies().filter(u=>u.type==='hero'&&distance(p,u)<=220).sort((a,b)=>distance(a,aim)-distance(b,aim));
   const t=targets[0];if(!t)return false;
   p.cd.r=30;hit(r,p,t,150+(t.maxHp-t.hp)*.3);r.effects.push({type:'execute',x:t.x,y:t.y,team:p.team,life:.8});
  }
 }
 return true;
}
export function segmentDistance(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);}

// Signature kits simplified for the single-lane arena.
export function returnSoul(r,p,h){
 if(!p.spirit)return false;
 const spirit=p.spirit;p.spirit=null;
 h.relocate(p,spirit.x,spirit.y);p.root=0;p.target=null;p.order='idle';p.windup=null;
 r.effects.push({type:'soul-return',x:spirit.x,y:spirit.y,tx:spirit.fromX||spirit.x,ty:spirit.fromY||spirit.y,team:p.team,life:.6});
 for(const [id,damage]of Object.entries(spirit.damage)){
  const enemy=r.players.find(u=>u.id===id&&u.hp>0&&u.team!==p.team);
  if(enemy)h.hit(r,p,enemy,damage*.25,'echo');
 }
 return true;
}
export function extraCast(r,p,key,aim,h){
 if(!['ezreal','blitzcrank','yone'].includes(p.kind)||!['q','w','e','r'].includes(key))return null;
 const {distance,hit,projectile,units,relocate,segmentDistance}=h;
 const angle=Math.atan2(aim.y-p.y,aim.x-p.x),enemies=()=>units(r).filter(u=>u.team!==p.team&&['hero','minion'].includes(u.type));
 const end=(length)=>({x:Math.max(65,Math.min(1535,p.x+Math.cos(angle)*length)),y:Math.max(220,Math.min(540,p.y+Math.sin(angle)*length))});
 const dash=(length)=>{const old={x:p.x,y:p.y},to=end(Math.min(distance(p,aim),length));relocate(p,to.x,to.y);p.target=null;p.order='idle';p.windup=null;r.effects.push({type:'dash',...old,tx:p.x,ty:p.y,team:p.team,life:.35});};
 if(p.kind==='ezreal'){
  if(key==='q'){p.cd.q=4;projectile(r,p,angle,{damage:95,radius:12,speed:850,life:.85,visual:'arcane',reduceCooldown:true});}
  if(key==='w'){p.cd.w=9;projectile(r,p,angle,{damage:0,radius:20,speed:620,life:1.1,visual:'mark',heroesOnly:true,mark:true});}
  if(key==='e'){
   if(p.root>0)return false;p.cd.e=11;dash(180);
   const enemy=enemies().filter(u=>distance(p,u)<300).sort((a,b)=>(a.arcaneMark?.owner===p.id?-1:0)-(b.arcaneMark?.owner===p.id?-1:0)||distance(p,a)-distance(p,b))[0];
   if(enemy){hit(r,p,enemy,80);r.effects.push({type:'arcane-bolt',x:p.x,y:p.y,tx:enemy.x,ty:enemy.y,team:p.team,life:.4});}
  }
  if(key==='r'){p.cd.r=30;p.windup=null;p.casting={type:'ezreal-wave',angle,remaining:.65};}
 }
 if(p.kind==='blitzcrank'){
  if(key==='q'){p.cd.q=9;projectile(r,p,angle,{damage:80,radius:19,speed:700,life:.85,visual:'hook',pull:true,unitsOnly:true});}
  if(key==='w'){p.cd.w=10;p.haste=4;p.rapid=4;p.overdrive=4;}
  if(key==='e'){p.cd.e=7;p.powerFist=4;p.attack=0;}
  if(key==='r'){p.cd.r=25;for(const u of enemies())if(distance(p,u)<190){u.shield=0;hit(r,p,u,180);if(u.hp>0)u.silence=1;}r.effects.push({type:'electric',x:p.x,y:p.y,radius:190,team:p.team,life:.6});}
 }
 if(p.kind==='yone'){
  if(key==='q'){
   const third=p.qStacks>=2;if(third&&p.root>0)return false;
   p.cd.q=3;const origin={x:p.x,y:p.y},to=end(third?260:190);
   const targets=enemies().filter(u=>segmentDistance(u,origin,to)<(third?50:32));
   if(third){relocate(p,to.x,to.y);p.target=null;p.order='idle';p.windup=null;p.qStacks=0;p.qStackTime=0;}
   else if(targets.length){p.qStacks=(p.qStacks||0)+1;p.qStackTime=6;}
   for(const u of targets){hit(r,p,u,third?110:75);if(third&&u.hp>0)u.stun=Math.max(u.stun||0,.75);}
   r.effects.push({type:third?'wind-dash':'sword',...origin,tx:to.x,ty:to.y,team:p.team,life:.4});
  }
  if(key==='w'){
   p.cd.w=8;let heroHit=false;
   for(const u of enemies()){const diff=Math.atan2(Math.sin(Math.atan2(u.y-p.y,u.x-p.x)-angle),Math.cos(Math.atan2(u.y-p.y,u.x-p.x)-angle));if(distance(p,u)<=190&&Math.abs(diff)<.8){hit(r,p,u,85);if(u.type==='hero')heroHit=true;}}
   p.shield=heroHit?140:80;p.shieldTime=2;r.effects.push({type:'cleave',x:p.x,y:p.y,angle,radius:190,team:p.team,life:.4});
  }
  if(key==='e'){
   if(p.root>0)return false;p.cd.e=16;p.spirit={x:p.x,y:p.y,remaining:5,damage:{}};dash(80);
  }
  if(key==='r'){
   if(p.root>0)return false;p.cd.r=30;p.windup=null;const to=end(450);p.casting={type:'yone-strike',x:p.x,y:p.y,tx:to.x,ty:to.y,remaining:.6};
  }
 }
 return true;
}

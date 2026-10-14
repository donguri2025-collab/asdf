import { championCast, segmentDistance } from './champion-skills.js';
import { randomUUID } from 'node:crypto';
export const W = 1600, H = 760;
export const heroes = {
  ashe: { name:'애쉬',hp:650,range:280,damage:34,speed:215,color:'#75e6ff'},
  lux: { name:'럭스',hp:570,range:235,damage:29,speed:210,color:'#ffe9a0'},
  garen: { name:'가렌',hp:900,range:95,damage:49,speed:230,color:'#83adff'},
  ranger: { name: '서리 궁수', hp: 650, range: 265, damage: 34, speed: 215, color: '#75e6ff' },
  mage: { name: '별빛 마법사', hp: 570, range: 235, damage: 29, speed: 200, color: '#c8a2ff' },
  knight: { name: '빙하 기사', hp: 900, range: 95, damage: 49, speed: 230, color: '#ffc887' }
};
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
function player(team, kind='ashe', bot=false) {
 const c=heroes[kind] || heroes.ashe;
 return {id:randomUUID(),type:'hero',team,kind:heroes[kind]?kind:'ashe',name:c.name,bot,x:team?1430:170,y:380,hp:c.hp,maxHp:c.hp,range:c.range,damage:c.damage,speed:c.speed,baseSpeed:c.speed,root:0,stun:0,slow:0,silence:0,rapid:0,scout:0,haste:0,guard:0,spin:0,empowered:0,target:null,order:'idle',attackTarget:null,preferredTarget:null,windup:null,casting:null,shield:0,shieldTime:0,lastSeq:0,attack:0,cd:{q:0,w:0,e:0,r:0,d:0,f:0},dead:0,kills:0,deaths:0};
}
export function createRoom(code) {
 return {code,time:0,wave:0,nextWave:2,players:[],minions:[],projectiles:[],effects:[],zones:[],structures:[0,1].flatMap(team=>[
 {id:`tower${team}`,type:'tower',team,x:team?1190:410,y:380,hp:800,maxHp:800,range:290,attack:0},
 {id:`core${team}`,type:'core',team,x:team?1490:110,y:380,hp:900,maxHp:900,range:0,attack:0}]),winner:null};
}
export function addPlayer(room,kind) {
 if(room.players.filter(p=>!p.bot).length>=2) return null;
 const bot=room.players.find(p=>p.bot);
 const p=player(bot?bot.team:0,kind);
 if(bot) room.players.splice(room.players.indexOf(bot),1,p);
 else {room.players.push(p); room.players.push(player(1,['ashe','lux','garen'].find(k=>k!==p.kind)||'lux',true));}
 return p;
}
export function removePlayer(room,id) {
 const p=room.players.find(p=>p.id===id); if(!p) return;
 p.bot=true;p.target=null;
}
function units(r) {return [...r.players,...r.minions,...r.structures].filter(u=>u.hp>0);}
function hit(r,source,target,damage,kind='skill') {
 if(target.type==='tower'&&kind==='skill')return;
 if(target.type==='core' && r.structures.some(s=>s.team===target.team&&s.type==='tower'&&s.hp>0))return;
 if(r.time>=180&&(target.type==='tower'||target.type==='core'))damage*=2;
 if(target.guard>0)damage*=.7;
 if(target.shield>0){const absorbed=Math.min(target.shield,damage);target.shield-=absorbed;damage-=absorbed;}
 target.hp=Math.max(0,target.hp-damage);
 r.effects.push({type:'hit',x:target.x,y:target.y,life:.25,team:source.team,text:Math.round(damage)});
 if(target.hp===0){
  if(target.type==='hero'){target.dead=7;target.deaths++;target.target=null;target.order='idle';target.windup=null;target.casting=null;target.shield=0;for(const k of ['root','stun','slow','silence','rapid','scout','haste','guard','spin','empowered'])target[k]=0;if(source.type==='hero')source.kills++;}
  if(target.type==='core')r.winner=source.team;
 }
}
function move(u,target,dt){if(u.root>0||u.stun>0)return;const d=dist(u,target);if(d<=4){u.x=target.x;u.y=target.y;}if(d>4){const s=Math.min(d,u.speed*dt);u.x=clamp(u.x+(target.x-u.x)/d*s,65,W-65);u.y=clamp(u.y+(target.y-u.y)/d*s,220,540);}}
function shot(r,p,target,damage,speed=680){r.projectiles.push({id:randomUUID(),x:p.x,y:p.y,team:p.team,owner:p.id,target:target.id,damage,speed,life:2,type:'attack',visual:p.kind==='ashe'?'ice':p.kind==='lux'?'light':null,slow:p.kind==='ashe'?1.5:0});}
export function command(r,id,input){
 const p=r.players.find(p=>p.id===id&&!p.bot); if(!p||p.hp<=0||r.winner!==null)return false;
 if(!Number.isFinite(input.x)||!Number.isFinite(input.y))return false;
 const aim={x:clamp(input.x,0,W),y:clamp(input.y,0,H)};
 if(Number.isSafeInteger(input.seq)){if(input.seq<=p.lastSeq)return false;p.lastSeq=input.seq;}
 if(input.type==='attackMove'){
  const candidates=units(r).filter(u=>u.team!==p.team&&attackable(r,u)&&dist(p,u)<=p.range);
  const chosen=candidates.sort((a,b)=>dist(a,aim)-dist(b,aim))[0];
  if(!chosen)return false;
  p.preferredTarget=chosen.id;if(p.order==='attack')p.attackTarget=chosen.id;
  p.windup=null;return true;
 }
 if(['move','attack'].includes(input.type)){
  if(input.type==='attack'&&!units(r).some(u=>u.id===input.targetId&&u.team!==p.team&&attackable(r,u)))return false;
  p.preferredTarget=null;p.order=input.type;p.attackTarget=input.type==='attack'?input.targetId:null;
  p.target={x:clamp(aim.x,65,W-65),y:clamp(aim.y,220,540)};p.windup=null;return true;
 }
 if(p.stun>0||p.silence>0||input.key==='f'&&p.root>0)return false;
 if(input.type==='skill'&&input.key==='e'&&p.kind==='lux'&&!p.casting){const zone=r.zones.find(z=>z.owner===p.id);if(zone){detonateZone(r,zone);return true;}}
 if(input.type!=='skill'||!['q','w','e','r','d','f'].includes(input.key)||p.cd[input.key]>0||p.casting)return false;
 return cast(r,p,input.key,aim)!==false;
}
function attackable(r,u){return u.hp>0&&!(u.type==='core'&&r.structures.some(s=>s.team===u.team&&s.type==='tower'&&s.hp>0));}
function area(r,p,center,radius,damage){
 r.effects.push({type:'burst',x:center.x,y:center.y,radius,team:p.team,life:.6});
 for(const enemy of units(r).filter(u=>u.team!==p.team&&dist(u,center)<radius))hit(r,p,enemy,damage);
}
function detonateZone(r,zone){
 const index=r.zones.indexOf(zone);if(index<0)return;
 r.zones.splice(index,1);
 const owner=r.players.find(p=>p.id===zone.owner)||{team:zone.team};
 area(r,owner,zone,zone.radius,zone.damage);
 for(const u of units(r))if(u.team!==zone.team&&dist(u,zone)<zone.radius)applyStatus(u,{slow:2});
}
function projectile(r,p,angle,options){const speed=options.speed;r.projectiles.push({id:randomUUID(),x:p.x,y:p.y,team:p.team,owner:p.id,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,type:'skill',hitIds:[],...options});}
function applyStatus(target,b){if(!['hero','minion'].includes(target.type))return;for(const key of ['root','stun','slow'])if(b[key])target[key]=Math.max(target[key]||0,b[key]);}
function cast(r,p,key,aim){
 const handled=championCast(r,p,key,aim,{distance:dist,hit,area,projectile,units});if(handled!==null)return handled;
 const d=dist(p,aim)||1;
 const center={x:clamp(p.x+(aim.x-p.x)*Math.min(1,350/d),65,W-65),y:clamp(p.y+(aim.y-p.y)*Math.min(1,350/d),220,540)};
 if(key==='q'){
  p.cd.q=4;r.projectiles.push({id:randomUUID(),x:p.x,y:p.y,vx:(aim.x-p.x)/d*620,vy:(aim.y-p.y)/d*620,team:p.team,owner:p.id,damage:130,life:.9,type:'skill',radius:18});
 }else if(key==='w'){p.cd.w=8;area(r,p,center,145,110);
 }else if(key==='e'){p.cd.e=10;p.shield=180;p.shieldTime=3;
 }else if(key==='r'){p.cd.r=30;p.windup=null;p.casting={x:center.x,y:center.y,remaining:.65};
 }else if(key==='d'){p.cd.d=45;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.3);r.effects.push({type:'heal',x:p.x,y:p.y,team:p.team,life:.6});
 }else if(key==='f'){
  p.cd.f=45;const old={x:p.x,y:p.y};p.x=clamp(p.x+(aim.x-p.x)/d*Math.min(180,d),65,W-65);p.y=clamp(p.y+(aim.y-p.y)/d*Math.min(180,d),220,540);
  p.target=null;p.order='idle';p.attackTarget=null;p.windup=null;
  r.effects.push({type:'dash',x:old.x,y:old.y,tx:p.x,ty:p.y,team:p.team,life:.4});
 }
}

export function tick(r,dt){
 if(r.winner!==null)return;
 r.time+=dt;r.nextWave-=dt;
 if(r.nextWave<=0){r.wave++;r.nextWave=13;for(let team=0;team<2;team++)for(let i=0;i<3;i++)r.minions.push({id:randomUUID(),type:'minion',team,x:team?1390+i*26:210-i*26,y:330+i*50,hp:190,maxHp:190,speed:70,damage:15,range:115,attack:0});}
 for(const e of r.effects)e.life-=dt;r.effects=r.effects.filter(e=>e.life>0);
 for(const u of [...r.players,...r.minions]){
  for(const key of ['root','stun','slow','silence','rapid','scout','haste','guard','spin','empowered'])u[key]=Math.max(0,(u[key]||0)-dt);
  u.speed=(u.baseSpeed||heroes[u.kind]?.speed||70)*(u.haste>0?1.35:1)*(u.slow>0?.65:1);
 }
 for(const zone of [...r.zones]){zone.life-=dt;if(zone.life<=0)detonateZone(r,zone);}
 for(const p of r.players){
  for(const k of Object.keys(p.cd))p.cd[k]=Math.max(0,p.cd[k]-dt);
  if(p.hp<=0){p.dead-=dt;if(p.dead<=0){p.hp=p.maxHp;p.x=p.team?1430:170;p.y=380;}continue;}
  if((p.team===0&&p.x<225)||(p.team===1&&p.x>1375))p.hp=Math.min(p.maxHp,p.hp+90*dt);
  p.attack=Math.max(0,p.attack-dt);p.shieldTime=Math.max(0,p.shieldTime-dt);if(!p.shieldTime)p.shield=0;
  if(p.stun>0){p.windup=null;p.casting=null;continue;}
  if(p.casting){p.casting.remaining-=dt;if(p.casting.remaining<=0){
   const cast=p.casting;if(cast.type==='laser'){
    const end={x:cast.tx,y:cast.ty};for(const u of units(r))if(u.team!==p.team&&segmentDistance(u,cast,end)<=40)hit(r,p,u,280);
    r.effects.push({...cast,type:'laser',team:p.team,life:.6});
   }else area(r,p,cast,210,260);p.casting=null;
  }continue;}
  if(p.spin>0){p.spinTick-=dt;if(p.spinTick<=0){for(const u of units(r))if(u.team!==p.team&&dist(p,u)<130)hit(r,p,u,45);p.spinTick=.5;}}

  const enemies=units(r).filter(u=>u.team!==p.team&&attackable(r,u)).sort((a,b)=>dist(p,a)-dist(p,b));
  if(p.bot){
   const enemy=enemies[0];
   if(p.hp<p.maxHp*.3){p.order='move';p.target={x:p.team?1430:170,y:380};p.attackTarget=null;if(p.cd.d===0)cast(r,p,'d',p);}
   else if(enemy){p.order='attack';p.attackTarget=enemy.id;
    if(p.silence<=0&&dist(p,enemy)<460&&p.cd.q===0)cast(r,p,'q',enemy);
    if(p.silence<=0&&dist(p,enemy)<300&&p.cd.w===0)cast(r,p,'w',enemy);
    if(p.silence<=0&&dist(p,enemy)<250&&p.cd.e===0)cast(r,p,'e',enemy);
    if(p.silence<=0&&enemy.type==='hero'&&dist(p,enemy)<450&&p.cd.r===0)cast(r,p,'r',enemy);
   }
  }
  if(p.casting)continue;
  if(p.spin>0){if(p.order==='attack'){const t=enemies.find(u=>u.id===p.attackTarget);if(t&&dist(p,t)>65)move(p,t,dt);}else if(p.target)move(p,p.target,dt);continue;}
  const inRange=enemies.filter(u=>dist(p,u)<=p.range);
  let enemy=p.order==='attack'?enemies.find(u=>u.id===p.attackTarget):inRange.find(u=>u.id===p.preferredTarget)||inRange.find(u=>u.id===p.windup?.id)||inRange[0];
  if(p.order==='attack'&&!enemy){p.order='idle';p.attackTarget=null;p.target=null;}
  if(p.windup){
   p.windup.remaining-=dt;
   if(!enemy||enemy.id!==p.windup.id||dist(p,enemy)>p.range+25)p.windup=null;
   else if(p.windup.remaining<=0){
    p.windup=null;p.attack=p.rapid>0?.18:.5;
    if(p.kind==='knight'||p.kind==='garen'){hit(r,p,enemy,p.damage+(p.empowered>0&&enemy.type!=='tower'?75:0),'attack');if(p.empowered>0){if(enemy.type==='hero')enemy.silence=1.2;p.empowered=0;}r.effects.push({type:'dash',x:p.x,y:p.y,tx:enemy.x,ty:enemy.y,team:p.team,life:.15});}
    else shot(r,p,enemy,p.damage);
   }
   if(p.order==='move'&&p.target)move(p,p.target,dt);
   continue;
  }
  if(enemy&&dist(p,enemy)<=p.range){p.attackTarget=enemy.id;if(p.attack===0)p.windup={id:enemy.id,remaining:p.rapid>0?.12:.22};if(p.order==='move'&&p.target)move(p,p.target,dt);continue;}
  if(p.order==='attack'&&enemy)move(p,enemy,dt);
  else if(p.target){move(p,p.target,dt);if(dist(p,p.target)<5){p.target=null;if(p.order==='move')p.order='idle';}}
 }

 const all=units(r);
 for(const u of all){
  if(u.type==='core'||u.type==='hero'||u.stun>0)continue;u.attack=Math.max(0,u.attack-dt);
  const enemies=all.filter(v=>v.team!==u.team&&!(v.type==='core'&&r.structures.some(s=>s.type==='tower'&&s.team===v.team&&s.hp>0)));
  const inRange=enemies.filter(v=>dist(u,v)<=u.range).sort((a,b)=>(u.type==='tower'? (a.type==='minion'?0:1)-(b.type==='minion'?0:1):0)||dist(u,a)-dist(u,b));
  const enemy=inRange[0];
  if(enemy&&u.attack===0){u.attack=u.type==='tower'?1.05:u.type==='hero'?.72:1.2;shot(r,u,enemy,u.type==='tower'?85:u.damage);}
  if(u.type==='minion'&&!enemy)move(u,{x:u.team?110:1490,y:u.y},dt);
 }
 for(const b of r.projectiles){
  b.life-=dt;const owner=[...r.players,...r.minions,...r.structures].find(u=>u.id===b.owner)||{id:b.owner,team:b.team};
  if(b.type==='attack'){
   const t=all.find(u=>u.id===b.target&&u.hp>0);if(!t){b.life=0;continue;}
   const d=dist(b,t);if(d<b.speed*dt+8){hit(r,owner,t,b.damage,'attack');applyStatus(t,b);b.life=0;}else{b.x+=(t.x-b.x)/d*b.speed*dt;b.y+=(t.y-b.y)/d*b.speed*dt;}
  }else{
   const previous={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;
   const candidates=all.filter(u=>u.type!=='tower'&&u.team!==b.team&&u.hp>0&&(!b.heroesOnly||u.type==='hero')&&!(b.hitIds||[]).includes(u.id)&&segmentDistance(u,previous,b)<(u.type==='minion'?14:u.type==='hero'?23:37)+b.radius).sort((a,c)=>dist(a,previous)-dist(c,previous));
   for(const t of candidates){
    b.hitIds??=[];b.hitIds.push(t.id);
    if(!b.groupHits?.includes(t.id)){hit(r,owner,t,b.damage);applyStatus(t,b);b.groupHits?.push(t.id);}
    if(b.hitIds.length>=(b.pierce||1)){b.life=0;break;}
   }
  }
 }
 r.projectiles=r.projectiles.filter(b=>b.life>0);r.minions=r.minions.filter(m=>m.hp>0);
}
export function snapshot(r){return {code:r.code,time:r.time,wave:r.wave,nextWave:r.nextWave,players:r.players,minions:r.minions,structures:r.structures,projectiles:r.projectiles,effects:r.effects,zones:r.zones,winner:r.winner};}

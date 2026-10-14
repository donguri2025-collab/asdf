import { randomUUID } from 'node:crypto';
export const W = 1600, H = 760;
export const heroes = {
  ranger: { name: '서리 궁수', hp: 650, range: 265, damage: 34, speed: 215, color: '#75e6ff' },
  mage: { name: '별빛 마법사', hp: 570, range: 235, damage: 29, speed: 200, color: '#c8a2ff' },
  knight: { name: '빙하 기사', hp: 900, range: 95, damage: 49, speed: 230, color: '#ffc887' }
};
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
function player(team, kind='ranger', bot=false) {
 const c=heroes[kind] || heroes.ranger;
 return {id:randomUUID(),type:'hero',team,kind:heroes[kind]?kind:'ranger',name:bot?'연습 봇':c.name,bot,x:team?1430:170,y:380,hp:c.hp,maxHp:c.hp,range:c.range,damage:c.damage,speed:c.speed,target:null,attack:0,cd:{q:0,w:0,e:0},dead:0,kills:0,deaths:0};
}
export function createRoom(code) {
 return {code,time:0,wave:0,nextWave:2,players:[],minions:[],projectiles:[],effects:[],structures:[0,1].flatMap(team=>[
 {id:`tower${team}`,type:'tower',team,x:team?1190:410,y:380,hp:1500,maxHp:1500,range:290,attack:0},
 {id:`core${team}`,type:'core',team,x:team?1490:110,y:380,hp:1800,maxHp:1800,range:0,attack:0}]),winner:null};
}
export function addPlayer(room,kind) {
 if(room.players.filter(p=>!p.bot).length>=2) return null;
 const bot=room.players.find(p=>p.bot);
 const p=player(bot?bot.team:0,kind);
 if(bot) room.players.splice(room.players.indexOf(bot),1,p);
 else {room.players.push(p); room.players.push(player(1,'mage',true));}
 return p;
}
export function removePlayer(room,id) {
 const p=room.players.find(p=>p.id===id); if(!p) return;
 p.bot=true;p.name='연습 봇';p.target=null;
}
function units(r) {return [...r.players,...r.minions,...r.structures].filter(u=>u.hp>0);}
function hit(r,source,target,damage) {
 if(target.type==='core' && r.structures.some(s=>s.team===target.team&&s.type==='tower'&&s.hp>0))return;
 target.hp=Math.max(0,target.hp-damage);
 r.effects.push({type:'hit',x:target.x,y:target.y,life:.25,team:source.team,text:Math.round(damage)});
 if(target.hp===0){
  if(target.type==='hero'){target.dead=7;target.deaths++;target.target=null;if(source.type==='hero')source.kills++;}
  if(target.type==='core')r.winner=source.team;
 }
}
function move(u,target,dt){const d=dist(u,target);if(d>4){const s=Math.min(d,u.speed*dt);u.x=clamp(u.x+(target.x-u.x)/d*s,65,W-65);u.y=clamp(u.y+(target.y-u.y)/d*s,220,540);}}
function shot(r,p,target,damage,speed=680){r.projectiles.push({id:randomUUID(),x:p.x,y:p.y,team:p.team,owner:p.id,target:target.id,damage,speed,life:2,type:'attack'});}
export function command(r,id,input){
 const p=r.players.find(p=>p.id===id&&!p.bot); if(!p||p.hp<=0||r.winner!==null)return false;
 if(!Number.isFinite(input.x)||!Number.isFinite(input.y))return false;
 const aim={x:clamp(input.x,0,W),y:clamp(input.y,0,H)};
 if(input.type==='move'){p.target={x:clamp(aim.x,65,W-65),y:clamp(aim.y,220,540)};return true;}
 if(input.type==='stop'){p.target=null;return true;}
 if(input.type!=='skill'||!['q','w','e'].includes(input.key)||p.cd[input.key]>0)return false;
 cast(r,p,input.key,aim);return true;
}
function cast(r,p,key,aim){
 if(key==='q'){
  p.cd.q=p.kind==='mage'?4:3;const d=dist(p,aim)||1;
  r.projectiles.push({id:randomUUID(),x:p.x,y:p.y,vx:(aim.x-p.x)/d*620,vy:(aim.y-p.y)/d*620,team:p.team,owner:p.id,damage:p.kind==='mage'?130:100,life:.9,type:'skill',radius:p.kind==='mage'?23:14});
 } else if(key==='w'){
  p.cd.w=8;const radius=p.kind==='mage'?170:145;
  const center=p.kind==='mage'?{x:p.x+(aim.x-p.x)*Math.min(1,250/(dist(p,aim)||1)),y:p.y+(aim.y-p.y)*Math.min(1,250/(dist(p,aim)||1))}:p;
  r.effects.push({type:'burst',x:center.x,y:center.y,radius,team:p.team,life:.6});
  for(const enemy of units(r).filter(u=>u.team!==p.team&&dist(u,center)<radius))hit(r,p,enemy,p.kind==='knight'?145:110);
 } else {
  p.cd.e=7;const d=dist(p,aim)||1;const old={x:p.x,y:p.y};
  p.x=clamp(p.x+(aim.x-p.x)/d*Math.min(180,d),65,W-65);p.y=clamp(p.y+(aim.y-p.y)/d*Math.min(180,d),220,540);p.target=null;
  r.effects.push({type:'dash',x:old.x,y:old.y,tx:p.x,ty:p.y,team:p.team,life:.4});
 }
}
export function tick(r,dt){
 if(r.winner!==null)return;
 r.time+=dt;r.nextWave-=dt;
 if(r.nextWave<=0){r.wave++;r.nextWave=13;for(let team=0;team<2;team++)for(let i=0;i<3;i++)r.minions.push({id:randomUUID(),type:'minion',team,x:team?1390+i*26:210-i*26,y:330+i*50,hp:190,maxHp:190,speed:70,damage:15,range:115,attack:0});}
 for(const e of r.effects)e.life-=dt;r.effects=r.effects.filter(e=>e.life>0);
 for(const p of r.players){
  for(const k of ['q','w','e'])p.cd[k]=Math.max(0,p.cd[k]-dt);
  if(p.hp<=0){p.dead-=dt;if(p.dead<=0){p.hp=p.maxHp;p.x=p.team?1430:170;p.y=380;}continue;}
  if((p.team===0&&p.x<225)||(p.team===1&&p.x>1375))p.hp=Math.min(p.maxHp,p.hp+90*dt);
  if(p.bot){const enemies=units(r).filter(u=>u.team!==p.team);const enemy=enemies.sort((a,b)=>dist(p,a)-dist(p,b))[0];
   if(enemy){if(p.hp<p.maxHp*.3)p.target={x:p.team?1430:170,y:380};else if(dist(p,enemy)>p.range*.85)p.target={x:enemy.x,y:enemy.y};else p.target=null;
    if(dist(p,enemy)<460&&p.cd.q===0)cast(r,p,'q',enemy);
    if(dist(p,enemy)<180&&p.cd.w===0)cast(r,p,'w',enemy);
   }
  }
  if(p.target){move(p,p.target,dt);if(dist(p,p.target)<5)p.target=null;}
 }
 const all=units(r);
 for(const u of all){
  if(u.type==='core')continue;u.attack=Math.max(0,u.attack-dt);
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
   const d=dist(b,t);if(d<b.speed*dt+8){hit(r,owner,t,b.damage);b.life=0;}else{b.x+=(t.x-b.x)/d*b.speed*dt;b.y+=(t.y-b.y)/d*b.speed*dt;}
  }else{
   b.x+=b.vx*dt;b.y+=b.vy*dt;
   const t=all.find(u=>u.team!==b.team&&u.hp>0&&dist(b,u)<(u.type==='minion'?14:u.type==='hero'?23:37)+b.radius);
   if(t){hit(r,owner,t,b.damage);b.life=0;}
  }
 }
 r.projectiles=r.projectiles.filter(b=>b.life>0);r.minions=r.minions.filter(m=>m.hp>0);
}
export function snapshot(r){return {code:r.code,time:r.time,wave:r.wave,nextWave:r.nextWave,players:r.players,minions:r.minions,structures:r.structures,projectiles:r.projectiles,effects:r.effects,winner:r.winner};}

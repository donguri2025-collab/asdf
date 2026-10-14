import { Motion } from './motion.js';
const motion = new Motion();
const $=s=>document.querySelector(s);
const canvas=$('#arena');
let ctx=canvas.getContext('2d');
let backgroundLayer=null;
let hero='ranger',session=null,stream=null,state=null,mouse={x:800,y:380},marker=null,lastState=0,connected=false;
const palette=['#7de2f4','#fa91ab'];
const icons={ranger:'➶',mage:'✦',knight:'⚔'};
for(const button of document.querySelectorAll('[data-hero]'))button.onclick=()=>{hero=button.dataset.hero;for(const b of document.querySelectorAll('[data-hero]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',b===button);}};
const initialCode=new URLSearchParams(location.search).get('room');if(initialCode)$('#room-code').value=initialCode.slice(0,6);
async function post(path,data){const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw Error(result.error||'연결에 실패했어요.');return result;}
async function join(code=''){
 $('#error').textContent='';$('#create').disabled=$('#join').disabled=true;
 try{session=await post('/api/join',{hero,code});$('#lobby').hidden=true;$('#game').hidden=false;$('#result').hidden=true;$('#code-label').textContent=session.code;
 stream=new EventSource(`/api/events?id=${encodeURIComponent(session.id)}`);
 stream.onmessage=e=>{state=JSON.parse(e.data);lastState=performance.now();motion.push(state,lastState);connected=true;updateHud();};
 stream.onerror=()=>{connected=false;$('#connection').textContent='연결이 끊겼어요 · 재연결 중';};
 }catch(e){$('#error').textContent=e.message;}finally{$('#create').disabled=$('#join').disabled=false;}
}
$('#create').onclick=()=>join();$('#join').onclick=()=>{const code=$('#room-code').value.trim();if(!/^\d{6}$/.test(code)){$('#error').textContent='6자리 방 코드를 입력해 주세요.';return;}join(code);};
$('#room-code').onkeydown=e=>{if(e.key==='Enter')$('#join').click();};
async function leave(){stream?.close();const old=session;session=null;state=null;motion.reset();connected=false;$('#game').hidden=true;$('#lobby').hidden=false;$('#result').hidden=true;if(old)try{await post('/api/leave',{id:old.id});}catch{} }
$('#leave').onclick=leave;$('#again').onclick=leave;
$('#second-tab').onclick=()=>{if(session)window.open(`${location.pathname}?room=${session.code}`,'_blank','noopener');};
$('#copy').onclick=async()=>{if(!session)return;try{await navigator.clipboard.writeText(session.code);$('#connection').textContent='방 코드를 복사했어요';}catch{$('#connection').textContent=`친구에게 ${session.code} 코드를 알려주세요`;}};
function send(type,key){if(session&&connected)post('/api/input',{id:session.id,type,key,...mouse}).catch(()=>{$('#connection').textContent='명령 전송 실패 · 연결을 확인해 주세요';});}
function pointer(e){const r=canvas.getBoundingClientRect();mouse={x:(e.clientX-r.left)/r.width*1600,y:(e.clientY-r.top)/r.height*760};}
canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointer(e);send('move');marker={...mouse,time:performance.now()};});canvas.oncontextmenu=e=>e.preventDefault();
window.addEventListener('keydown',e=>{if(!session||e.repeat||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;const key=e.key.toLowerCase();if(['q','w','e'].includes(key)){e.preventDefault();send('skill',key);}if(key==='s')send('stop');});
window.addEventListener('pagehide',()=>{if(session)navigator.sendBeacon('/api/leave',new Blob([JSON.stringify({id:session.id})],{type:'application/json'}));});
function updateHud(){
 const me=state.players.find(p=>p.id===session?.id);if(!me)return;
 $('#my-name').textContent=me.name;$('#my-team').textContent=me.team?'레드 팀 · 오른쪽 기지':'블루 팀 · 왼쪽 기지';$('#my-icon').className=`portrait ${me.kind}`;$('#my-icon').textContent=icons[me.kind];
 $('#health-bar').style.width=`${100*me.hp/me.maxHp}%`;$('#health-label').textContent=`${Math.ceil(me.hp)} / ${me.maxHp} HP`;
 for(const key of ['q','w','e']){const el=$(`#skill-${key}`);el.classList.toggle('cooldown',me.cd[key]>0);el.querySelector('b').textContent=Math.ceil(me.cd[key]);}
 $('#clock').textContent=`${String(Math.floor(state.time/60)).padStart(2,'0')}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;$('#wave').textContent=`WAVE ${state.wave}`;
 $('#score-blue').textContent=state.players.filter(p=>p.team===0).reduce((n,p)=>n+p.kills,0);$('#score-red').textContent=state.players.filter(p=>p.team===1).reduce((n,p)=>n+p.kills,0);
 $('#connection').textContent=state.players.some(p=>p.bot)?'봇 연습 대전 · 친구 입장 가능':'2명 연결됨 · 온라인 대전';
 $('#notice').textContent=me.hp<=0?`${Math.ceil(me.dead)}초 후 부활합니다`:state.structures.some(s=>s.type==='tower'&&s.team!==me.team&&s.hp>0)?'미니언 뒤에서 상대 포탑을 공략하세요':'상대 포탑 파괴! 이제 코어를 공격하세요';
 if(state.winner!==null){$('#result').hidden=false;$('#result-title').textContent=state.winner===me.team?'VICTORY':'DEFEAT';$('#result-copy').textContent=state.winner===me.team?'상대 코어를 파괴했습니다. 멋진 한 판이었어요!':'우리 코어가 파괴되었습니다. 다시 도전해 보세요.';}
}
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(x,y,tx,ty,color,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.lineWidth=1;}
function text(value,x,y,size=12,color='#c1d7e4',weight=500){ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(value,x,y);}
function health(u,width,y){ctx.fillStyle='#07121d';ctx.fillRect(u.x-width/2-2,y-2,width+4,9);ctx.fillStyle='#314552';ctx.fillRect(u.x-width/2,y,width,5);ctx.fillStyle=palette[u.team];ctx.fillRect(u.x-width/2,y,width*Math.max(0,u.hp/u.maxHp),5);}
function diamond(x,y,w,h,fill,stroke){ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w,y);ctx.lineTo(x,y+h);ctx.lineTo(x-w,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.stroke();}
function paintBackground(){
 const gradient=ctx.createLinearGradient(0,0,0,760);gradient.addColorStop(0,'#0b1d2a');gradient.addColorStop(.5,'#1b3542');gradient.addColorStop(1,'#091a29');ctx.fillStyle=gradient;ctx.fillRect(0,0,1600,760);
 // Jagged ice shelves and ravine.
 for(let side=0;side<2;side++)for(let i=0;i<19;i++){const x=i*93;const y=side?655:100;ctx.fillStyle=i%2?'#1b3546':'#203e50';ctx.beginPath();ctx.moveTo(x-60,side?760:0);ctx.lineTo(x+80,side?760:0);ctx.lineTo(x+55,y);ctx.lineTo(x+20,y+(side?-47:47));ctx.lineTo(x-35,y+15);ctx.closePath();ctx.fill();line(x+20,y+(side?-47:47),x+55,y,'#4b758540',2);}
 ctx.fillStyle='#0a1b25';ctx.fillRect(25,204,1550,362);ctx.fillStyle='#304b59';ctx.fillRect(25,201,1550,12);ctx.fillRect(25,548,1550,12);
 const floor=ctx.createLinearGradient(0,215,0,545);floor.addColorStop(0,'#263f4a');floor.addColorStop(.5,'#385561');floor.addColorStop(1,'#263f4a');ctx.fillStyle=floor;ctx.fillRect(30,216,1540,330);
 for(let row=0;row<6;row++)for(let col=0;col<23;col++){const x=col*75+(row%2?35:0),y=218+row*54;ctx.strokeStyle='#718a9220';ctx.strokeRect(x,y,72,51);if((row*7+col)%11===0)line(x+8,y+13,x+28,y+29,'#19354270');}
 for(let i=0;i<15;i++){const x=65+i*105;ctx.fillStyle='#395764';ctx.fillRect(x,190,24,29);ctx.fillRect(x,543,24,29);ctx.fillStyle='#7fabb3';ctx.fillRect(x,189,24,5);ctx.fillRect(x,542,24,5);}
 for(const [x,team]of [[115,0],[1485,1]]){const glow=ctx.createRadialGradient(x,380,10,x,380,160);glow.addColorStop(0,team?'#e67da826':'#69e4eb26');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(x-170,220,340,320);circle(x,380,100,null,team?'#fa91ab33':'#7de2f433');}
 circle(800,380,95,null,'#83b0bc25');diamond(800,380,70,70,'#294853','#688e9b40');diamond(800,380,35,35,'#304f5b','#688e9b40');
 text('F R O S T L I N E',800,131,21,'#789eae50',800);text('BLUE SANCTUARY',140,608,11,'#739dac');text('RED SANCTUARY',1460,608,11,'#a78299');
}
function background(now){
 if(!backgroundLayer){
  backgroundLayer=document.createElement('canvas');backgroundLayer.width=1600;backgroundLayer.height=760;
  const screen=ctx;ctx=backgroundLayer.getContext('2d');paintBackground();ctx=screen;
 }
 ctx.drawImage(backgroundLayer,0,0);
 for(let i=0;i<60;i++){const x=(i*173+now*.013*(i%3+1))%1600,y=(i*97+now*.023)%760;circle(x,y,i%3===0?1.8:1,'#d0f5ff40');}
}
function drawStructure(u,now){
 const color=palette[u.team];if(u.hp<=0){circle(u.x,u.y,35,'#132a34');for(let i=0;i<5;i++)diamond(u.x+Math.sin(i*9)*24,u.y+Math.cos(i*9)*18,9,6,'#3e515b','#576670');return;}
 circle(u.x,u.y+14,42,'#07172370');
 if(u.type==='tower'){
  circle(u.x,u.y,36,'#233c4c','#658391');diamond(u.x,u.y-10,27,43,'#4e6977','#91a9b3');diamond(u.x,u.y-40,19,27,u.team?'#744155':'#326d85',color);
  ctx.save();ctx.shadowColor=color;ctx.shadowBlur=22;circle(u.x,u.y-42,8,color);ctx.restore();
  if(session&&state.players.find(p=>p.id===session.id)?.team!==u.team){ctx.setLineDash([6,10]);circle(u.x,u.y,u.range,null,'#fa91ab16');ctx.setLineDash([]);}
  health(u,75,u.y-83);text('포탑',u.x,u.y+64,11,'#b5cbd8');
 }else{
  circle(u.x,u.y,53,'#1a3444','#56788c');circle(u.x,u.y,43,null,color+'66');ctx.save();ctx.shadowColor=color;ctx.shadowBlur=30;diamond(u.x,u.y-13+Math.sin(now/500)*4,25,49,u.team?'#c26584':'#54abc4',color);ctx.restore();
  const protectedCore=state.structures.some(s=>s.type==='tower'&&s.team===u.team&&s.hp>0);if(protectedCore)circle(u.x,u.y-8,65,null,color+'33');health(u,90,u.y-88);text(protectedCore?'코어 · 보호 중':'코어',u.x,u.y+78,11,'#b5cbd8');
 }
}
function drawUnit(u,now){
 if(u.hp<=0)return;const color=palette[u.team];circle(u.x,u.y+13,u.type==='hero'?22:12,'#05121b65');
 if(u.type==='minion'){circle(u.x,u.y,12,u.team?'#674956':'#3b6676',color);ctx.fillStyle=color;ctx.fillRect(u.x-5,u.y-6,10,7);line(u.x+(u.team?-15:15),u.y-10,u.x+(u.team?-15:15),u.y+13,'#afc2c8',2);health(u,27,u.y-23);return;}
 const mine=u.id===session?.id;
 if(mine){ctx.setLineDash([5,8]);circle(u.x,u.y,u.range,null,'#b8effb16');ctx.setLineDash([]);circle(u.x,u.y,30,null,'#ddfcff');diamond(u.x,u.y-70,5,5,'#efffff','#efffff');}
 circle(u.x,u.y,24,u.kind==='mage'?'#40314f':u.kind==='knight'?'#554332':'#294d5b',color);ctx.save();ctx.shadowColor=color;ctx.shadowBlur=15;text(icons[u.kind],u.x,u.y+10,30,u.kind==='mage'?'#ddc2ff':u.kind==='knight'?'#ffe0ab':'#b6efff');ctx.restore();
 health(u,55,u.y-39);text(mine?'나':u.bot?'연습 봇':'상대 플레이어',u.x,u.y-49,11,mine?'#e7ffff':'#b7cbd8',600);
 if(mine&&u.target){line(u.x,u.y,u.target.x,u.target.y,'#98e9ed20');}
}
function draw(now){
 requestAnimationFrame(draw);if(!session)return;background(now);
 if(!state){text('전장에 연결하는 중…',800,380,24);return;}
 for(const s of state.structures)drawStructure(s,now);
 for(const u of [...state.minions,...state.players].map(u=>motion.entity(u,now)).sort((a,b)=>a.y-b.y))drawUnit(u,now);
 for(const raw of state.projectiles){const p=motion.entity(raw,now);ctx.save();ctx.shadowColor=palette[p.team];ctx.shadowBlur=18;if(p.type==='skill'){circle(p.x,p.y,p.radius,palette[p.team]+'50',palette[p.team]);circle(p.x,p.y,5,'#efffff');}else circle(p.x,p.y,5,palette[p.team]);ctx.restore();}
 for(const e of state.effects){ctx.save();ctx.globalAlpha=Math.min(1,e.life*3);if(e.type==='hit')text(e.text,e.x,e.y-35-(.25-e.life)*80,17,'#ffe6bb',800);if(e.type==='burst'){circle(e.x,e.y,e.radius,'#c3a9ff20',palette[e.team]);circle(e.x,e.y,e.radius*(1-e.life/.7),null,'#dcbdff');}if(e.type==='dash')line(e.x,e.y,e.tx,e.ty,palette[e.team],8);ctx.restore();}
 if(marker&&now-marker.time<700){const t=(now-marker.time)/700;ctx.save();ctx.globalAlpha=1-t;circle(marker.x,Math.max(220,Math.min(540,marker.y)),10+t*18,null,'#b9fff4');ctx.restore();}
 if(now-lastState>4000){connected=false;text('연결이 지연되고 있어요. 잠시 기다려 주세요.',800,680,17,'#ffc89d');}
}
requestAnimationFrame(draw);

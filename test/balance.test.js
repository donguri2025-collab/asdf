import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,command,heroes} from '../game.js';
const setup=()=>{const r=createRoom('balance'),a=addPlayer(r,'lux'),b=addPlayer(r,'garen');a.x=650;b.x=1000;return {r,a,b};};
const cast=(r,p,key,x,y=380)=>command(r,p.id,{type:'skill',key,x,y});
test('Lux E hits inside 105 radius but misses outside; Flash can escape before detonation',()=>{
 for(const [offset,hit]of [[104,true],[106,false]]){const {r,a,b}=setup();b.x=1000+offset;cast(r,a,'e',1000);cast(r,a,'e',1000);assert.equal(b.hp,b.maxHp-(hit?130:0));}
 const {r,a,b}=setup();cast(r,a,'e',1000);cast(r,b,'f',1500);assert.equal(b.x,1240);cast(r,a,'e',1000);assert.equal(b.hp,b.maxHp);
});
test('melee champions have a movement advantage without a blanket damage increase',()=>{
 for(const kind of ['garen','blitzcrank','yone'])for(const ranged of ['ashe','lux','ezreal'])assert.ok(heroes[kind].speed>heroes[ranged].speed);
 assert.equal(heroes.garen.damage,49);assert.equal(heroes.blitzcrank.damage,44);assert.equal(heroes.yone.damage,46);
});

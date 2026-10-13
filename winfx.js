/* winfx.js — (1) активное окно = то, над которым курсор; шорткаты этого окна работают сразу, без клика.
              (2) при Play сцена перерисовывается при смене режима (фон цветной, сетки нет — см. render в index.html).
   Подключается после animfx.js. Цвет фона в Play: window.playBg (по умолчанию #314d79). */
(()=>{
const PANES=[['#dlg','x'],['#hub','x'],['#sped','x'],['#menu','x'],['#wmenu','x'],['#p1','hier'],['#p3','ins'],['#proj','proj'],['#anm','anim'],['#ant','animator'],['#sv','scene']];
const BOX={hier:'#p1',ins:'#p3',proj:'#proj',anim:'#sv',animator:'#sv',scene:'#sv'};
window.hoverWin='scene';window.tlfocus=false;
let cur=null;
function set(w){
  if(w===cur)return;cur=w;window.hoverWin=w;window.tlfocus=(w==='anim');
  document.querySelectorAll('.pn.act').forEach(n=>n.classList.remove('act'));
  const b=w&&BOX[w]&&document.querySelector(BOX[w]);if(b)b.classList.add('act');
}
function onMove(e){
  const t=e.target;if(!t||!t.closest)return;
  for(const[sel,w]of PANES){const el=t.closest(sel);if(el&&getComputedStyle(el).display!=='none'){set(w==='x'?null:w);return}}
  set(null);
}
addEventListener('mouseover',onMove,true);
addEventListener('mousemove',onMove,true);
// Когда окно/диалог закрылось под неподвижным курсором — определить окно заново при первом движении (mousemove выше).

// смена Play/Stop -> сразу перерисовать сцену
let lp=!!window.playing;
setInterval(()=>{const p=!!window.playing;if(p!==lp){lp=p;if(typeof draw=='function')draw()}},100);
})();

/* ---------- подсветка границ объекта под курсором на сцене ----------
   Подсвечивается ровно тот (точный, самый верхний) объект, который выберет клик. Зажат Ctrl — подсвечивается тот, что выберет Ctrl+клик (следующий под выделенным
   в стопке объектов «друг на друге»), рядом имя и номер «2/3». Из меню ПКМ «Под курсором» наведение на пункт подсвечивает объект ярко. */
(()=>{
const cvEl=document.getElementById('cv');if(!cvEl)return;
let hov=null,pre=null,raf=0,last=null,ctrl=false,info=null;
function upd(id,inf){const same=id===hov&&((!inf&&!info)||(inf&&info&&inf.i===info.i&&inf.n===info.n&&inf.name===info.name));if(same)return;hov=id;info=inf||null;if(typeof draw=='function')draw()}
function probe(){raf=0;const e=last;if(!e)return;
  if(window.playing||e.buttons){upd(null);return}
  const w=toW(e),all=hitAll(w),t=window.pickAt?pickAt(w,{ctrlKey:ctrl,metaKey:false,detail:1,clientX:e.clientX,clientY:e.clientY}):(all[0]||null);
  upd(t&&t.id!==sel?t.id:null,ctrl&&t&&all.length>1?{i:all.indexOf(t)+1,n:all.length,name:t.name}:null)}
const queue=()=>{if(!raf)raf=requestAnimationFrame(probe)};
cvEl.addEventListener('mousemove',e=>{last=e;ctrl=e.ctrlKey||e.metaKey;queue()});
cvEl.addEventListener('mouseleave',()=>{last=null;upd(null)});
cvEl.addEventListener('mousedown',()=>upd(null));
const kc=e=>{if(e.key!='Control'&&e.key!='Meta')return;const c=e.type=='keydown';if(c!==ctrl){ctrl=c;if(last)queue()}};
addEventListener('keydown',kc);addEventListener('keyup',kc);addEventListener('blur',()=>{ctrl=false});
window.setHoverObj=id=>{pre=id==null?null:id;hov=pre;info=null;if(typeof draw=='function')draw()};
const _r=window.render;
window.render=function(g,W,H,cam,clean){
  _r.apply(this,arguments);
  if(clean||window.expMode||window.playing||hov==null)return;
  const strong=pre!=null&&hov===pre;if(hov===sel&&!strong)return;
  const L=order().find(x=>x.o.id===hov);if(!L||!L.on)return;
  const o=L.o,M=L.M,[w,h]=size(o,o.img&&window.btnView?btnView(o):null),
    S=(lx,ly)=>{const p=apM(M,lx,ly);return[(p.x-cam.x)*cam.z+W/2,H/2-(p.y-cam.y)*cam.z]};
  const P=[S(-w/2,-h/2),S(w/2,-h/2),S(w/2,h/2),S(-w/2,h/2)];
  g.save();g.beginPath();P.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.lineJoin='round';
  if(strong){g.fillStyle='rgba(120,200,255,.10)';g.fill();g.lineWidth=2;g.strokeStyle='rgba(120,200,255,.95)'}
  else if(info){g.lineWidth=1.5;g.strokeStyle='rgba(140,200,255,.75)'}
  else{g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.28)'}
  g.stroke();
  if(info){const top=P.reduce((a,b)=>b[1]<a[1]?b:a),t=info.name+'  '+info.i+'/'+info.n;
    g.font='11px system-ui,sans-serif';const tw=g.measureText(t).width+12,x=Math.max(4,Math.min(W-tw-4,top[0]-tw/2)),y=Math.max(4,top[1]-24);
    g.fillStyle='rgba(18,26,38,.88)';g.beginPath();if(g.roundRect)g.roundRect(x,y,tw,18,5);else g.rect(x,y,tw,18);g.fill();
    g.fillStyle='#dbeaff';g.textAlign='left';g.textBaseline='middle';g.fillText(t,x+6,y+9.5)}
  g.restore()};
})();

/* ---------- v44: сцена активна → шорткаты сцены (WASD / стрелки / Q E / F / Del / Ctrl+D) работают сразу ----------
   Раньше после правки поля в Inspector / имени клипа / поиска фокус оставался в поле (mousedown на canvas его не снимал),
   и клавиши сцены игнорировались как «ввод в поле». Теперь клик по сцене убирает фокус с поля. */
(()=>{
const FIELD=/^(INPUT|TEXTAREA|SELECT)$/;
addEventListener('mousedown',e=>{
  const t=e.target;if(!t||!t.closest||!t.closest('#scn'))return;
  const a=document.activeElement;if(a&&FIELD.test(a.tagName)&&a!==t)a.blur();
},true);
})();

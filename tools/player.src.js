/* Unity 2D Editor — Web Player. Самостоятельный рантайм для экспортированной игры (без зависимостей).
   Блоки отрисовки текста и градиента подставляются сборщиком (tools/build_player.py) из text.js и gradient.js редактора — вид идентичен. */
(()=>{
'use strict';
const TAU=Math.PI/180,PPU=100;
const rd=v=>Math.round(v*1000)/1000,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const $=s=>document.querySelector(s);

/* ================= данные ================= */
let G=null,objs=[],omap=new Map(),kids=new Map(),roots=[];
const amap=new Map(),CL=new Map(),CT=new Map();
const ast=id=>amap.get(id),get=id=>omap.get(id);
const ppuOf=a=>((a&&a.parent?ast(a.parent):a)||{}).ppu||PPU;

/* ================= подставляемый код редактора ================= */
/*@TEXT*/
/*@GRADIENT*/

/* ================= матрицы (как в редакторе) ================= */
const locM=o=>{const c=Math.cos(o.r*TAU),s=Math.sin(o.r*TAU),rx=(o.rx||0)*TAU,ry=(o.ry||0)*TAU,cx=Math.cos(rx),cy=Math.cos(ry),k=Math.sin(rx)*Math.sin(ry);
  return[c*cy*o.sx-s*k*o.sx,s*cy*o.sx+c*k*o.sx,-s*cx*o.sy,c*cx*o.sy,o.x,o.y]};
const mulM=(P,L)=>[P[0]*L[0]+P[2]*L[1],P[1]*L[0]+P[3]*L[1],P[0]*L[2]+P[2]*L[3],P[1]*L[2]+P[3]*L[3],P[0]*L[4]+P[2]*L[5]+P[4],P[1]*L[4]+P[3]*L[5]+P[5]];
const invM=M=>{const det=M[0]*M[3]-M[1]*M[2];if(Math.abs(det)<1e-12)return null;const a=M[3]/det,b=-M[1]/det,c=-M[2]/det,d=M[0]/det;return[a,b,c,d,-(a*M[4]+c*M[5]),-(b*M[4]+d*M[5])]};
const apM=(M,x,y)=>({x:M[0]*x+M[2]*y+M[4],y:M[1]*x+M[3]*y+M[5]});
function wmat(o,dep){dep=dep||0;const p=o.parent!=null&&dep<64?get(o.parent):null;return p?mulM(wmat(p,dep+1),locM(o)):locM(o)}
const worldPos=o=>{const M=wmat(o);return{x:M[4],y:M[5]}};
function toLocal(o,wx,wy){const p=o.parent!=null?get(o.parent):null;if(!p)return{x:wx,y:wy};const I=invM(wmat(p));return I?apM(I,wx,wy):{x:wx,y:wy}}
function order(){const out=[],seen=new Set();
  const walk=(o,act,PM)=>{if(seen.has(o.id))return;seen.add(o.id);const on=act&&o.active!==false,M=PM?mulM(PM,locM(o)):locM(o);out.push({o,on,M});const k=kids.get(o.id);if(k)for(const c of k)walk(c,on,M)};
  for(const o of roots)walk(o,true,null);return out}
function subtree(id){const r=[],st=[id],seen=new Set();while(st.length){const i=st.pop();if(seen.has(i))continue;seen.add(i);const o=get(i);if(!o)continue;r.push(o);const k=kids.get(i);if(k)for(const c of k)st.push(c.id)}return r}
function size(o,im){im=im||o.img;
  if(!o.img&&!o.text&&o.grad)return[Math.max(.01,o.grad.w),Math.max(.01,o.grad.h)];
  if(!o.img&&o.text)return[Math.max(.01,o.text.w),Math.max(.01,o.text.h)];
  const a=im&&im.sprite&&ast(im.sprite);return a&&a.img?[a.img.width/ppuOf(a),a.img.height/ppuOf(a)]:im?[1,1]:[.3,.3]}

/* ================= свойства (анимация пишет сюда) ================= */
const gim=o=>o.img||o.text||o.grad;
const pget=(o,k)=>k=='sprite'?(o.img?o.img.sprite:undefined):k=='color'||k=='alpha'?(gim(o)?gim(o)[k]:undefined):(k=='rx'||k=='ry')?(o[k]||0):o[k];
const pset=(o,k,v)=>{if(k=='sprite'){if(o.img)o.img.sprite=v}else if(k=='color'||k=='alpha'){if(gim(o))gim(o)[k]=v}else o[k]=v};

/* ================= тонированные спрайты (кэш ограничен) ================= */
const tc=new Map();
function tint(a,col){if(col=='#ffffff')return a.img;const k=a.id+col;let c=tc.get(k);if(c)return c;
  if(tc.size>96)tc.clear();
  c=document.createElement('canvas');c.width=a.img.width;c.height=a.img.height;const x=c.getContext('2d');x.drawImage(a.img,0,0);
  x.globalCompositeOperation='multiply';x.fillStyle=col;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='destination-in';x.drawImage(a.img,0,0);tc.set(k,c);return c}

/* ================= Animator (порт логики редактора) ================= */
const EPS=5e-4;let C=null,RMAP=null;
const base=new Map();
const colHex=h=>/^#[0-9a-f]{6}$/i.test(h||'')?h:'#ffffff';
const rgb=h=>{h=colHex(h);return[1,3,5].map(i=>parseInt(h.substr(i,2),16))};
const lerpCol=(a,b,u)=>{const A=rgb(a),B=rgb(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*u).toString(16).padStart(2,'0')).join('')};
const clipOf=s=>s&&s.clip!=null?CL.get(s.clip):null;
const def=()=>{const t=C.tr.find(t=>t.f=='entry');return t&&t.t};
const nd=id=>C.st.find(n=>n.id==id);
function evalTrack(tr,t){
  const K=tr.keys;if(!K.length)return undefined;
  if(t<=K[0].t)return K[0].v;
  const L=K[K.length-1];if(t>=L.t)return L.v;
  let i=0;while(K[i+1].t<=t)i++;
  const a=K[i],b=K[i+1];
  if(tr.k=='sprite'||a.i=='c')return a.v;
  let u=(t-a.t)/(b.t-a.t);if(a.i=='s')u=u*u*(3-2*u);
  return tr.k=='color'?lerpCol(a.v,b.v,u):a.v+(b.v-a.v)*u}
const splitK=key=>{const i=key.indexOf('.');return{o:get(+key.slice(0,i)),k:key.slice(i+1)}};
function put(o,k,v){const cu=pget(o,k);if(cu===undefined||v===undefined||(typeof v=='number'&&isNaN(v)))return;
  const key=o.id+'.'+k;if(!base.has(key))base.set(key,cu);pset(o,k,k=='alpha'?clamp(v,0,1):v)}
function poseOfClip(c,t){const m=new Map();c.tracks.forEach(tr=>{let oid=tr.o;if(RMAP){const r=RMAP.get(tr.o);if(r!==undefined)oid=r;if(oid<0)return}
  const v=evalTrack(tr,t);if(v!==undefined)m.set(oid+'.'+tr.k,v)});return m}
const clipT=(c,el)=>c.loop?(c.len>0?((el%c.len)+c.len)%c.len:0):clamp(el,0,c.len);
const poseOf=(s,el)=>{const c=clipOf(s);return c?poseOfClip(c,clipT(c,el)):new Map()};
const mix=(k,a,b,w)=>k=='sprite'?(w<.5?a:b):k=='color'?lerpCol(a,b,w):a+(b-a)*w;
function applyPose(A,B,w,own){
  const keys=new Set(A.keys());if(B)B.forEach((_,k)=>keys.add(k));
  keys.forEach(key=>{const{o,k}=splitK(key);if(!o)return;let v=A.get(key);
    if(B){let b=B.get(key);const d=()=>base.has(key)?base.get(key):pget(o,k);
      if(v===undefined)v=d();if(b===undefined)b=d();if(v===undefined||b===undefined)return;v=mix(k,v,b,w)}
    put(o,k,v)});
  own.forEach(key=>{if(keys.has(key))return;own.delete(key);const{o,k}=splitK(key);if(o&&base.has(key))pset(o,k,base.get(key))});
  keys.forEach(key=>own.add(key))}
const chk=c=>{const p=C.pa.find(p=>p.name==c.p);if(!p)return false;if(p.type=='Trigger')return !!p.val;const a=p.type=='Bool'?+!!p.val:+p.val,b=+c.v;return c.op=='>'?a>b:c.op=='<'?a<b:c.op=='=='?a==b:a!=b};
const spd=s=>s.sp==null?1:s.sp;
const stEl=(s,t0,now)=>(now-t0)/1000*spd(s);
const stLen=s=>{const c=clipOf(s);return c?Math.max(c.len,.001):1};
function tickP(p,now){
  let s=nd(p.cur);if(!s)return false;
  if(p.x){const x=p.x,d=nd(x.to);
    if(!d)p.x=null;
    else{const w=x.du>0?(now-x.t0)/1000/x.du:1;
      if(w<1){applyPose(poseOf(s,stEl(s,p.t0,now)),poseOf(d,stEl(d,x.t0,now)),w,p.own);
        const nt=stEl(s,p.t0,now)/stLen(s),c=clipOf(s);p.p=c&&c.loop?((nt%1)+1)%1:clamp(nt,0,1);p.w=w;return true}
      p.cur=x.to;p.t0=x.t0;p.x=null;s=d}}
  p.w=0;
  const el=stEl(s,p.t0,now),nt=el/stLen(s),c=clipOf(s);
  p.p=c&&c.loop?((nt%1)+1)%1:clamp(nt,0,1);
  const ok=t=>{const hasEx=t.hx||!t.cd.length;return(!hasEx||nt>=(t.ex==null?1:t.ex))&&(!t.cd.length||t.cd.every(chk))};
  const t=C.tr.find(t=>t.f!='entry'&&(t.f==p.cur||t.f=='any')&&t.t!=p.cur&&ok(t));
  applyPose(poseOf(s,el),null,0,p.own);
  if(t){t.cd.forEach(c=>{const q=C.pa.find(q=>q.name==c.p);if(q&&q.type=='Trigger')q.val=false});
    const dest=t.t=='exit'?def():t.t;
    if(dest){if(t.du>0)p.x={to:dest,t0:now,du:t.du};else{p.cur=dest;p.t0=now}}}
  return true}
// контроллер может быть вложен под объектом-владельцем: клипы переназначаются на детей владельца по пути в иерархии
const childrenOf=o=>kids.get(o.id)||[];
function rootOf(t,ctlId){for(let o=get(t),g=0;o&&g<64;g++,o=o.parent!=null?get(o.parent):null)if(o.animator&&o.animator.ctl==ctlId)return o;return null}
function pathUnder(root,t){const p=[];let o=get(t),g=0;
  while(o&&o!==root&&g++<64){const par=o.parent!=null?get(o.parent):null;if(!par)return null;p.unshift(childrenOf(par).indexOf(o));o=par}
  return o===root?p:null}
function walkPath(root,p){let o=root;for(const i of p){o=childrenOf(o)[i];if(!o)return null}return o}
function buildRemap(ctl,ownerId){
  const owner=get(ownerId);if(!owner)return null;
  const ids=new Set();ctl.st.forEach(s=>{const c=clipOf(s);if(c)c.tracks.forEach(tr=>{if(get(tr.o))ids.add(tr.o)})});
  if(!ids.size)return null;
  const mine=new Set(subtree(ownerId).map(o=>o.id));
  for(const t of ids)if(mine.has(t))return null;
  const m=new Map();
  ids.forEach(t=>{const r=rootOf(t,ctl.id);if(!r||r===owner)return;
    const path=pathUnder(r,t),x=path&&walkPath(owner,path);m.set(t,x?x.id:-1)});
  return m.size?m:null}
function rtMake(ctl,owner){
  const view={st:ctl.st,tr:ctl.tr,pa:ctl.pa.map(q=>({name:q.name,type:q.type,val:q.type=='Trigger'?false:q.val}))};
  const prev=C;C=view;let d;try{d=def()}finally{C=prev}
  if(!d&&ctl.st.length)d=(ctl.st.find(s=>clipOf(s))||ctl.st[0]).id;
  return{ctl,view,cur:d||null,t0:performance.now(),p:0,x:null,w:0,own:new Set(),map:owner!=null?buildRemap(ctl,owner):null}}
function rtTick(p,now){if(!p.cur)return true;const prev=C,pm=RMAP;C=p.view;RMAP=p.map||null;try{return tickP(p,now)}finally{C=prev;RMAP=pm}}
function rtPlay(p,name){
  const s=p.view.st.find(s=>s.name==name)||p.view.st.find(s=>{const c=clipOf(s);return c&&c.name==name});
  if(!s)return false;p.cur=s.id;p.t0=performance.now();p.x=null;p.w=0;return true}
function rtSet(p,name,val){const q=p.view.pa.find(q=>q.name==name);if(!q)return false;
  q.val=q.type=='Trigger'?true:q.type=='Bool'?!!val:q.type=='Int'?Math.round(+val||0):(+val||0);return true}

/* ================= состояние выполнения ================= */
const run={pl:new Map(),hover:null,down:null};
const ctlOf=t=>t&&t.animator?CT.get(t.animator.ctl):null;
function player(o){
  if(o.active===false||!o.animator)return null;const ctl=ctlOf(o);if(!ctl)return null;
  let p=run.pl.get(o.id);if(!p||p.ctl!==ctl){p=rtMake(ctl,o.id);run.pl.set(o.id,p)}return p}
const setWorld=(o,wx,wy)=>{const L=toLocal(o,wx,wy);o.x=rd(L.x);o.y=rd(L.y)};
const MTH={
 'go.active':(o,a)=>{o.active=!!a[0]},
 'go.toggle':o=>{o.active=o.active===false},
 'tf.setpos':(o,a)=>setWorld(o,+a[0]||0,+a[1]||0),
 'tf.move':(o,a)=>{const w=worldPos(o);setWorld(o,w.x+(+a[0]||0),w.y+(+a[1]||0))},
 'tf.setrot':(o,a)=>{o.r=+a[0]||0},
 'tf.setrot3':(o,a)=>{o.rx=+a[0]||0;o.ry=+a[1]||0;o.r=+a[2]||0},
 'tf.rot3':(o,a)=>{o.rx=rd((o.rx||0)+(+a[0]||0));o.ry=rd((o.ry||0)+(+a[1]||0));o.r=rd(o.r+(+a[2]||0))},
 'tf.rot':(o,a)=>{o.r=rd(o.r+(+a[0]||0))},
 'tf.setscale':(o,a)=>{o.sx=+a[0]||0;o.sy=+a[1]||0},
 'img.color':(o,a)=>{if(o.img)o.img.color=a[0]||'#ffffff'},
 'img.alpha':(o,a)=>{if(o.img)o.img.alpha=Math.max(0,Math.min(1,+a[0]||0))},
 'img.sprite':(o,a)=>{if(o.img)o.img.sprite=a[0]==null?null:a[0]},
 'an.play':(o,a)=>{const p=player(o);if(p&&a[0])rtPlay(p,a[0])},
 'an.trig':(o,a)=>{const p=player(o);if(p&&a[0])rtSet(p,a[0],true)},
 'an.bool':(o,a)=>{const p=player(o);if(p&&a[0])rtSet(p,a[0],!!a[1])},
 'an.float':(o,a)=>{const p=player(o);if(p&&a[0])rtSet(p,a[0],a[1])},
 'an.int':(o,a)=>{const p=player(o);if(p&&a[0])rtSet(p,a[0],a[1])},
 'btn.inter':(o,a)=>{if(o.btn)o.btn.interactable=!!a[0]}};
function exec(E){const t=get(E.t),m=MTH[E.m];if(!t||!m)return;try{m(t,E.a||[])}catch(err){console.warn('OnClick:',err)}}
const fire=o=>{if(!o.btn||o.btn.interactable===false)return;(o.btn.onClick||[]).slice().forEach(exec)};

/* ================= Button: вид и попадание ================= */
const mulCol=(a,b)=>{const p=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16)),A=p(a),B=p(b);return'#'+A.map((v,i)=>Math.round(v*B[i]/255).toString(16).padStart(2,'0')).join('')};
function btnView(o){
  const im=o.img||o.text,b=o.btn;if(!im||!b||b.trans=='none')return im;
  const s=b.interactable===false?'dis':(run.down==o.id&&run.hover==o.id)?'pr':run.hover==o.id?'hi':'nm';
  if(s=='nm')return im;
  if(!o.img)return b.trans=='tint'?Object.assign({},im,{color:mulCol(im.color,b.tint[s]),alpha:s=='dis'?im.alpha*.5:im.alpha}):im;
  if(b.trans=='sprite')return ast(b[s])?Object.assign({},im,{sprite:b[s]}):im;
  return Object.assign({},im,{color:mulCol(im.color,b.tint[s]),alpha:s=='dis'?im.alpha*.5:im.alpha})}
function rayHit(w){const L=order();
  for(let i=L.length-1;i>=0;i--){const{o,on,M}=L[i];if(!on||!(o.img||o.text||o.grad))continue;
    const I=invM(M);if(!I)continue;const p=apM(I,w.x,w.y),[sw,sh]=size(o,o.img?btnView(o):null);
    if(Math.abs(p.x)<=sw/2&&Math.abs(p.y)<=sh/2)return o}
  return null}
const handler=o=>{for(let q=o,n=0;q&&n<64;q=q.parent!=null?get(q.parent):null,n++)if(q.btn)return q;return null};
const live=o=>o&&o.btn&&o.btn.interactable!==false;

/* ================= вид и отрисовка ================= */
const cvs=$('#c'),g=cvs.getContext('2d');
let view={x:0,y:0,w:8,h:4.5,mode:'height',bg:'#222222'},cam={x:0,y:0,z:100},CW=0,CH=0,DPR=1,clipRect=null;
function layoutView(){
  CW=innerWidth;CH=innerHeight;DPR=Math.min(devicePixelRatio||1,2);
  const pw=Math.round(CW*DPR),ph=Math.round(CH*DPR);if(cvs.width!=pw||cvs.height!=ph){cvs.width=pw;cvs.height=ph}
  let z;
  if(view.mode=='fit')z=Math.min(CW/view.w,CH/view.h);else if(view.mode=='width')z=CW/view.w;else z=CH/view.h;
  cam={x:view.x,y:view.y,z};
  clipRect=view.mode=='fit'?{x:CW/2-view.w*z/2,y:CH/2-view.h*z/2,w:view.w*z,h:view.h*z}:null}
const toWorld=e=>{const r=cvs.getBoundingClientRect();return{x:(e.clientX-r.left-CW/2)/cam.z+cam.x,y:-(e.clientY-r.top-CH/2)/cam.z+cam.y}};
function render(){
  g.setTransform(DPR,0,0,DPR,0,0);g.fillStyle=view.bgOuter||'#000';g.fillRect(0,0,CW,CH);
  g.save();if(clipRect){g.beginPath();g.rect(clipRect.x,clipRect.y,clipRect.w,clipRect.h);g.clip()}
  g.fillStyle=view.bg;g.fillRect(0,0,CW,CH);
  const sx=x=>(x-cam.x)*cam.z+CW/2,sy=y=>CH/2-(y-cam.y)*cam.z;
  for(const{o,on,M}of order()){if(!on)continue;
    const im=btnView(o),[w,h]=size(o,o.img?im:null);
    const hw=w/2,hh=h/2,ax=Math.abs(M[0])*hw+Math.abs(M[2])*hh,ay=Math.abs(M[1])*hw+Math.abs(M[3])*hh,px=sx(M[4]),py=sy(M[5]);
    if(px+ax*cam.z<-8||px-ax*cam.z>CW+8||py+ay*cam.z<-8||py-ay*cam.z>CH+8)continue;
    g.save();g.transform(M[0]*cam.z,-M[1]*cam.z,M[2]*cam.z,-M[3]*cam.z,px,py);g.scale(1,-1);
    if(o.img&&im){g.globalAlpha=im.alpha;const a=im.sprite&&ast(im.sprite);if(a&&a.img)g.drawImage(tint(a,im.color),-w/2,-h/2,w,h);else{g.fillStyle=im.color;g.fillRect(-w/2,-h/2,w,h)}g.globalAlpha=1}
    else if(o.text&&im)window.drawText(g,o.text,im);
    else if(o.grad)window.drawGrad(g,o.grad,w,h);
    g.restore()}
  g.restore()}
function frame(){
  const now=performance.now();
  for(const{o,on}of order()){if(!on){run.pl.delete(o.id);continue}if(!o.animator)continue;const p=player(o);if(!p){run.pl.delete(o.id);continue}if(!rtTick(p,now))run.pl.delete(o.id)}
  render();requestAnimationFrame(frame)}

/* ================= ввод (мышь и касания) ================= */
function bindInput(){
  cvs.addEventListener('pointerdown',e=>{if(e.button)return;cvs.setPointerCapture&&cvs.setPointerCapture(e.pointerId);
    const o=handler(rayHit(toWorld(e)));run.hover=o?o.id:null;run.down=live(o)?o.id:null;e.preventDefault()});
  cvs.addEventListener('pointermove',e=>{if(e.pointerType!='mouse'&&run.down==null)return;const o=handler(rayHit(toWorld(e)));run.hover=o?o.id:null;cvs.style.cursor=live(o)?'pointer':''});
  const up=e=>{const id=run.down;run.down=null;
    if(id!=null){const o=handler(rayHit(toWorld(e)));run.hover=o?o.id:null;if(o&&o.id==id)fire(o)}
    if(e.pointerType!='mouse')run.hover=null};
  cvs.addEventListener('pointerup',up);
  cvs.addEventListener('pointercancel',()=>{run.down=null;run.hover=null});
  cvs.addEventListener('pointerleave',e=>{if(e.pointerType=='mouse')run.hover=null});
  cvs.addEventListener('contextmenu',e=>e.preventDefault());
  // вкладка была скрыта — сдвигаем таймеры анимации, чтобы они не «перескакивали»
  let hid=0;document.addEventListener('visibilitychange',()=>{if(document.hidden)hid=performance.now();else if(hid){const d=performance.now()-hid;hid=0;run.pl.forEach(p=>{p.t0+=d;if(p.x)p.x.t0+=d})}});
  addEventListener('resize',layoutView)}

/* ================= загрузка ================= */
const loadImg=url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url});
async function boot(){
  const bar=$('#bar'),msg=$('#msg');
  let r;try{r=await fetch('game.json',{cache:'no-cache'});G=await r.json()}catch(e){msg.textContent='Не удалось загрузить game.json';return}
  document.title=G.title||'Game';view=Object.assign(view,G.view||{});
  document.body.style.background=view.bgOuter||'#000';
  objs=G.objects||[];objs.forEach(o=>omap.set(o.id,o));
  objs.forEach(o=>{if(o.parent!=null&&omap.has(o.parent)){let a=kids.get(o.parent);if(!a)kids.set(o.parent,a=[]);a.push(o)}else roots.push(o)});
  (G.clips||[]).forEach(c=>CL.set(c.id,c));(G.ctls||[]).forEach(k=>CT.set(k.id,k));
  const files=(G.assets||[]).filter(a=>a.file),total=files.length||1;let done=0;const tick=()=>{bar.style.width=Math.round(++done/total*100)+'%'};
  await Promise.all(files.map(async a=>{
    if(a.font){try{const ff=new FontFace('U2DFont'+a.id,'url('+a.file+')');await ff.load();document.fonts.add(ff);amap.set(a.id,{id:a.id,name:a.name,font:true,family:'U2DFont'+a.id})}catch(e){console.warn('font',a.name,e)}}
    else{const img=await loadImg(a.file);if(img)amap.set(a.id,{id:a.id,name:a.name,img,ppu:a.ppu||PPU,mode:a.mode||'single',sprites:a.sprites||[]});else console.warn('image',a.name)}
    tick()}));
  (G.assets||[]).filter(a=>a.parent).forEach(m=>{const p=amap.get(m.parent);if(!p)return;const rc=m.rect,c=document.createElement('canvas');c.width=rc.w;c.height=rc.h;
    c.getContext('2d').drawImage(p.img,rc.x,rc.y,rc.w,rc.h,0,0,rc.w,rc.h);amap.set(m.id,{id:m.id,parent:m.parent,rect:rc,img:c})});
  layoutView();bindInput();$('#load').style.display='none';
  const fs=$('#fs');if(fs&&document.documentElement.requestFullscreen){fs.style.display='block';
    fs.onclick=()=>{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{})}}
  window.__game={objs,run,order,get,fire,rayHit,handler,cam:()=>cam};
  requestAnimationFrame(frame)}
boot();
})();

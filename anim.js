/* Animator (граф состояний + переходы) и Animation (клипы с ключами, dopesheet) */
(()=>{
const $=s=>document.querySelector(s),ac=$('#ac'),g=ac.getContext('2d'),ap=$('#ap'),ins=$('#ins'),box=$('#ant');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),EPS=5e-4;
const CTS=[],CL=[];let ctlId=1,C=null;   // контроллеры (граф состояний); C — редактируемый сейчас
function newCtl(name){const k={id:ctlId++,name:name||('Animator Controller'+(CTS.length?' '+CTS.length:'')),st:[],tr:[],pa:[]};CTS.push(k);return k}
C=newCtl('Animator Controller');
const F=[{id:'entry',name:'Entry',x:40,y:50,c:'#2f8f3f'},{id:'any',name:'Any State',x:40,y:130,c:'#2a8aa0'},{id:'exit',name:'Exit',x:40,y:210,c:'#a03a3a'}];
let nid=1,cid=1,V={x:0,y:0},sl=null,link=null,dg=null,pn=null,pl=null,M={x:0,y:0};
let RMAP=null;   // перепривязка треков клипа к объектам текущего рантайм-плеера (id в клипе -> id реального объекта, -1 = нет такого)
let cur=null,tm=0,rec=false,pv=false,ksel=new Set(),tsel=new Set(),tv={o:-.05,z:200},sy=0,R=[],ed=null,dz=null;
const tcol=new Set();   // id объектов, чьи группы свойств свёрнуты в окне Animation (как стрелки ▸/▾ в Hierarchy)
const W=150,H=34,RUL=28,RH=28,PL=14,MAXT=600;   // PL — левое поле таймлайна (t=0 не прижат к краю); MAXT — предел редактирования, длина клипа считается по последнему ключу
window.amode='scene';window.tlfocus=false;

/* =====================================================================
   МОДЕЛЬ СВОЙСТВ / КЛИПОВ
   клип: {id,name,len,fps,loop,tracks:[{o:idОбъекта,k:свойство,keys:[{t,v,i:'l'|'s'|'c'}]}]}
   ===================================================================== */
const PROPS=[
 {k:'x',g:'Transform',n:'Position X',st:.1},{k:'y',g:'Transform',n:'Position Y',st:.1},
 {k:'rx',g:'Transform',n:'Rotation X',st:1},{k:'ry',g:'Transform',n:'Rotation Y',st:1},{k:'r',g:'Transform',n:'Rotation Z',st:1},{k:'sx',g:'Transform',n:'Scale X',st:.1},{k:'sy',g:'Transform',n:'Scale Y',st:.1},
 {k:'color',g:'Image',n:'Color'},{k:'alpha',g:'Image',n:'Alpha',st:.05,min:0,max:1},{k:'sprite',g:'Image',n:'Sprite'}];
const PD={};PROPS.forEach((p,i)=>{p.i=i;PD[p.k]=p});
const PI={x:'✥',y:'✥',r:'↻',sx:'⤡',sy:'⤡',color:'◐',alpha:'◌',sprite:'▣'};   // значки свойств
// длина клипа = время последнего ключа (минимум — один кадр); считается автоматически
function autoLen(c){let m=0;c.tracks.forEach(t=>t.keys.forEach(k=>{if(k.t>m)m=k.t}));c.len=Math.max(Math.round(m*1e4)/1e4,1/(c.fps||30));return c.len}
const colHex=h=>/^#[0-9a-f]{6}$/i.test(h||'')?h:'#ffffff';
const rgb=h=>{h=colHex(h);return[1,3,5].map(i=>parseInt(h.substr(i,2),16))};
const lerpCol=(a,b,u)=>{const A=rgb(a),B=rgb(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*u).toString(16).padStart(2,'0')).join('')};
const clip=id=>CL.find(c=>c.id==id);
const clipOf=s=>s&&s.clip!=null?clip(s.clip):null;
const keyAt=(tr,t)=>tr.keys.find(k=>Math.abs(k.t-t)<EPS);
const sprLabel=v=>{const a=v!=null&&ast(v);return a?spName(a):'None'};

function evalTrack(tr,t){
  const K=tr.keys;if(!K.length)return undefined;
  if(t<=K[0].t)return K[0].v;
  const L=K[K.length-1];if(t>=L.t)return L.v;
  let i=0;while(K[i+1].t<=t)i++;
  const a=K[i],b=K[i+1];
  if(tr.k=='sprite'||a.i=='c')return a.v;
  let u=(t-a.t)/(b.t-a.t);if(a.i=='s')u=u*u*(3-2*u);
  return tr.k=='color'?lerpCol(a.v,b.v,u):a.v+(b.v-a.v)*u}
function setKey(tr,t,v){
  t=Math.round(t*1e4)/1e4;let k=keyAt(tr,t);
  if(k)k.v=v;
  else{const pr=[...tr.keys].reverse().find(x=>x.t<t);
    k={t,v,i:tr.k=='sprite'?'c':pr?pr.i:'l'};tr.keys.push(k);tr.keys.sort((a,b)=>a.t-b.t)}
  return k}
// имя клипа по умолчанию — ИмяОбъекта+Анимация0, ИмяОбъекта+Анимация1…; без объекта — «New Animation»
const CLIP_WORD='Анимация';
function newClip(base){
  let n,i=0;if(base){n=base+CLIP_WORD+i;while(CL.some(c=>c.name==n))n=base+CLIP_WORD+(++i)}else{n='New Animation';while(CL.some(c=>c.name==n))n='New Animation '+(++i)}
  const c={id:cid++,name:n,len:1,fps:30,loop:true,tracks:[]};CL.push(c);return c}

/* ---- «позы»: значения свойств, которые даёт клип; запись в объекты с запоминанием исходных значений ---- */
const base=new Map(); // 'idОбъекта.свойство' -> исходное значение (до анимации)
const splitK=key=>{const i=key.indexOf('.');return{o:get(+key.slice(0,i)),k:key.slice(i+1)}};
function put(o,k,v){
  const cu=pget(o,k);if(cu===undefined||v===undefined||(typeof v=='number'&&isNaN(v)))return;
  const key=o.id+'.'+k;if(!base.has(key))base.set(key,cu);
  pset(o,k,k=='alpha'?clamp(v,0,1):v)}
function poseOfClip(c,t){const m=new Map();c.tracks.forEach(tr=>{let oid=tr.o;if(RMAP){const r=RMAP.get(tr.o);if(r!==undefined)oid=r;if(oid<0)return}
  const v=evalTrack(tr,t);if(v!==undefined)m.set(oid+'.'+tr.k,v)});return m}
const clipT=(c,el)=>c.loop?(c.len>0?((el%c.len)+c.len)%c.len:0):clamp(el,0,c.len);
const poseOf=(s,el)=>{const c=clipOf(s);return c?poseOfClip(c,clipT(c,el)):new Map()};
const mix=(k,a,b,w)=>k=='sprite'?(w<.5?a:b):k=='color'?lerpCol(a,b,w):a+(b-a)*w;
const editOwn=new Set();   // ключи, которые записал редактор клипа; у рантайм-плееров свой набор (p.own)
function applyPose(A,B,w,own){own=own||editOwn;
  const keys=new Set(A.keys());if(B)B.forEach((_,k)=>keys.add(k));
  keys.forEach(key=>{
    const{o,k}=splitK(key);if(!o)return;let v=A.get(key);
    if(B){let b=B.get(key);const d=()=>base.has(key)?base.get(key):pget(o,k);
      if(v===undefined)v=d();if(b===undefined)b=d();if(v===undefined||b===undefined)return;v=mix(k,v,b,w)}
    put(o,k,v)});
  // свойства, которых нет в текущей позе, возвращаются к исходным значениям (Write Defaults)
  own.forEach(key=>{if(keys.has(key))return;own.delete(key);const{o,k}=splitK(key);if(o&&base.has(key))pset(o,k,base.get(key))});
  keys.forEach(key=>own.add(key))}
function restoreAll(){base.forEach((bv,key)=>{const{o,k}=splitK(key);if(o)pset(o,k,bv)});base.clear();editOwn.clear()}
function maybeRestore(){if(window.amode!='clip'&&!pl&&!pv&&!window.playing){restoreAll();draw();syncIns()}}
// обновление полей Inspector «на месте» (без пересборки) во время проигрывания/скраббинга
function syncIns(){
  if((window.pfocus&&window.amode!='clip')||window.amode=='anim')return;const o=get(sel);if(!o)return;
  ins.querySelectorAll('[data-k]').forEach(i=>{if(document.activeElement!==i)i.value=rd(o[i.dataset.k])});
  const im=o.img||o.text||o.grad;if(im){
    ins.querySelectorAll('[data-ik]').forEach(i=>{if(document.activeElement!==i)i.value=im[i.dataset.ik]});
    const av=ins.querySelector('[data-av]');if(av)av.textContent=rd(im.alpha);
    const sl=ins.querySelector('[data-slot]');if(sl&&o.img){const a=o.img.sprite&&ast(o.img.sprite);sl.textContent=a?spName(a):'None (Sprite)'}}}

/* =====================================================================
   ANIMATOR: граф
   ===================================================================== */
const N=()=>[...F,...C.st],nd=id=>N().find(n=>n.id==id),ct=n=>({x:n.x+W/2,y:n.y+H/2});
const def=()=>{const t=C.tr.find(t=>t.f=='entry');return t&&t.t};
const curT=()=>sl&&sl.k=='t'?C.tr.find(t=>t.id==sl.id):null;
const pos=e=>{const r=ac.getBoundingClientRect();return{x:e.clientX-r.left-V.x,y:e.clientY-r.top-V.y}};
const dist=(p,a,b)=>{const x=b.x-a.x,y=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));return Math.hypot(p.x-a.x-u*x,p.y-a.y-u*y)};
function seg(t){const A=ct(nd(t.f)),B=ct(nd(t.t));let dx=B.x-A.x,dy=B.y-A.y;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const ox=-dy*7,oy=dx*7,k=Math.min(W/2/(Math.abs(dx)||1e-9),H/2/(Math.abs(dy)||1e-9));return{a:{x:A.x+ox+dx*k,y:A.y+oy+dy*k},b:{x:B.x+ox-dx*k,y:B.y+oy-dy*k},dx,dy}}
const hn=p=>[...N()].reverse().find(n=>p.x>=n.x&&p.x<=n.x+W&&p.y>=n.y&&p.y<=n.y+H),ht=p=>C.tr.find(t=>{const s=seg(t);return dist(p,s.a,s.b)<6});
const ins_=()=>inspect();
function dr(){const w=box.clientWidth,h=box.clientHeight,d=devicePixelRatio||1;if(!w)return;if(ac.width!=w*d||ac.height!=h*d){ac.width=w*d;ac.height=h*d}
g.setTransform(d,0,0,d,0,0);g.fillStyle='#3a3a3a';g.fillRect(0,0,w,h);g.strokeStyle='#333';g.lineWidth=1;g.beginPath();for(let x=V.x%25;x<w;x+=25){g.moveTo(x,0);g.lineTo(x,h)}for(let y=V.y%25;y<h;y+=25){g.moveTo(0,y);g.lineTo(w,y)}g.stroke();
g.translate(V.x,V.y);
C.tr.forEach(t=>{const s=seg(t),on=sl&&sl.k=='t'&&sl.id==t.id;g.strokeStyle=g.fillStyle=on?'#5aa0ff':'#ddd';g.lineWidth=on?2.5:1.5;g.beginPath();g.moveTo(s.a.x,s.a.y);g.lineTo(s.b.x,s.b.y);g.stroke();g.beginPath();g.moveTo(s.b.x,s.b.y);g.lineTo(s.b.x-s.dx*11-s.dy*5,s.b.y-s.dy*11+s.dx*5);g.lineTo(s.b.x-s.dx*11+s.dy*5,s.b.y-s.dy*11-s.dx*5);g.fill()});
if(link){const A=ct(nd(link));g.strokeStyle='#fff';g.lineWidth=1.5;g.beginPath();g.moveTo(A.x,A.y);g.lineTo(M.x,M.y);g.stroke()}
N().forEach(n=>{const on=sl&&sl.k=='s'&&sl.id==n.id,cp=clipOf(n);g.fillStyle=n.c||(def()==n.id?'#c0702a':'#5e5e5e');g.fillRect(n.x,n.y,W,H);
if(pl&&pl.cur==n.id){g.fillStyle='#4a90e2';g.fillRect(n.x,n.y+H-5,W*pl.p,5)}
if(pl&&pl.x&&pl.x.to==n.id){g.fillStyle='#e0a030';g.fillRect(n.x,n.y+H-5,W*(pl.w||0),5)}
g.lineWidth=on?2.5:1;g.strokeStyle=on?'#5aa0ff':'#111';g.strokeRect(n.x,n.y,W,H);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
if(cp){g.font='12px Segoe UI,sans-serif';g.fillText(n.name,n.x+W/2,n.y+11);g.fillStyle='#cfd8e3';g.font='10px Segoe UI,sans-serif';g.fillText((cp.loop?'↻ ':'→| ')+cp.name,n.x+W/2,n.y+23)}
else{g.font='12px Segoe UI,sans-serif';g.fillText(n.name,n.x+W/2,n.y+H/2-2)}});
pvDraw()}
// мини-превью сцены в окне Animator
const PV={x:0,y:0,z:50};
function pvDraw(){const cv=$('#apv'),w=cv.clientWidth,h=cv.clientHeight,d=devicePixelRatio||1;if(!w||!h)return;
  if(cv.width!=w*d||cv.height!=h*d){cv.width=w*d;cv.height=h*d}
  const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);render(x,w,h,PV,true)}
$('#apv').addEventListener('wheel',e=>{e.preventDefault();PV.z=clamp(PV.z*(e.deltaY<0?1.15:1/1.15),10,1000);pvDraw()},{passive:false});
$('#apv').addEventListener('mousedown',e=>{if(e.button)return;e.preventDefault();const s={x:e.clientX,y:e.clientY,cx:PV.x,cy:PV.y};
  const mv=ev=>{PV.x=s.cx-(ev.clientX-s.x)/PV.z;PV.y=s.cy+(ev.clientY-s.y)/PV.z;pvDraw()},up=()=>{removeEventListener('mousemove',mv);removeEventListener('mouseup',up)};
  addEventListener('mousemove',mv);addEventListener('mouseup',up)});

// ---- модель графа
function mkT(f,t){if(f=='entry')C.tr=C.tr.filter(x=>x.f!='entry');if(C.tr.some(x=>x.f==f&&x.t==t))return;
  // hx: Has Exit Time, ex: Exit Time (в долях клипа), du: Transition Duration (сек, плавное смешивание)
  const o={id:'t'+nid++,f,t,cd:[],hx:false,ex:1,du:.25};C.tr.push(o);sl={k:'t',id:o.id}}
function mkS(p,cp){const k=C.st.filter(s=>s.name.startsWith('New State')).length,
  s={id:'s'+nid++,name:cp?cp.name:(k?'New State '+k:'New State'),x:p.x-W/2,y:p.y-H/2,sp:1,clip:cp?cp.id:null};
  C.st.push(s);if(!def())mkT('entry',s.id);sl={k:'s',id:s.id};ins_();dr()}
function delS(id){const wasDef=def()==id;C.st=C.st.filter(s=>s.id!=id);C.tr=C.tr.filter(t=>t.f!=id&&t.t!=id);sl=null;
  if(wasDef&&C.st.length){mkT('entry',C.st[0].id);sl=null}}   // удалили стартовое состояние — стартовым становится первое оставшееся
const delT=id=>{C.tr=C.tr.filter(t=>t.id!=id);sl=null};
// при создании клипа автоматически создаётся состояние в Animator
function addClipState(c){const k=C.st.length,prev=sl,
  s={id:'s'+nid++,name:c.name,x:250+(k%3)*180,y:50+Math.floor(k/3)*70,sp:1,clip:c.id};
  C.st.push(s);if(!def())mkT('entry',s.id);sl=prev}

// ---- мышь (граф)
ac.addEventListener('mousedown',e=>{const p=pos(e);if(e.button==1||e.altKey){e.preventDefault();pn={x:e.clientX,y:e.clientY,vx:V.x,vy:V.y};return}if(e.button)return;
const n=hn(p);if(link){if(n&&n.id!=link&&n.id!='entry'&&n.id!='any')mkT(link,n.id);link=null;ins_();dr();return}
if(n){sl={k:'s',id:n.id};dg={n,dx:p.x-n.x,dy:p.y-n.y}}else{const t=ht(p);sl=t?{k:'t',id:t.id}:null}ins_();dr()});
ac.addEventListener('contextmenu',e=>{e.preventDefault();const p=pos(e),n=hn(p),X=e.clientX,Y=e.clientY;
if(!n)return showMenu(X,Y,[['Create State / Empty',()=>mkS(p)],...CL.slice(0,15).map(c=>['Create State / '+c.name,()=>mkS(p,c)])]);
sl={k:'s',id:n.id};ins_();dr();const it=[];
if(n.id!='exit')it.push(['Make Transition',()=>{link=n.id;M=p;dr()}]);
if(!n.c)it.push(['Set as Layer Default State',()=>{mkT('entry',n.id);sl={k:'s',id:n.id};dr()}],['Delete',()=>{delS(n.id);ins_();dr()}]);
if(it.length)showMenu(X,Y,it)});
addEventListener('mousemove',e=>{if(window.amode!='anim')return;const r=ac.getBoundingClientRect();M={x:e.clientX-r.left-V.x,y:e.clientY-r.top-V.y};
if(pn){V.x=pn.vx+e.clientX-pn.x;V.y=pn.vy+e.clientY-pn.y}else if(dg){dg.n.x=M.x-dg.dx;dg.n.y=M.y-dg.dy}else if(!link)return;dr()});
addEventListener('mouseup',()=>{pn=dg=null});
addEventListener('keydown',e=>{if(window.amode!='anim'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.key!='Delete'||!sl)return;
if(sl.k=='t')delT(sl.id);else if(C.st.some(s=>s.id==sl.id))delS(sl.id);else return;ins_();dr()});

// ---- параметры + play
function rp(){ap.innerHTML=`<div class="r"><select id="ctl-sel" class="wide" title="Animator Controller">${CTS.map(k=>`<option value="${k.id}" ${k==C?'selected':''}>${esc(k.name)}</option>`).join('')}<option value="__new">＋ New Controller…</option></select><input type="text" id="ctl-name" value="${esc(C.name)}" style="width:84px;flex:none" ${ctlOwner(C)?'readonly title="Имя берётся из имени объекта"':'title="Имя контроллера"'}></div><div class="r"><b style="flex:1">Parameters</b><button id="pa">+</button><button id="pp">${pl?'■ Stop':'▶ Play'}</button></div>`+(C.pa.map((p,i)=>`<div class="r"><input type="text" data-pn="${i}" value="${esc(p.name)}" style="flex:1"><span>${p.type[0]}</span>${p.type=='Float'||p.type=='Int'?`<input type="number" step="${p.type=='Int'?1:.1}" data-pv="${i}" value="${p.val}" style="width:56px">`:`<input type="checkbox" data-pv="${i}" ${p.val?'checked':''}>`}<button data-px="${i}">✕</button></div>`).join('')||'<div class="e" style="padding:4px">No parameters</div>')}
function useCtl(id){const k=CTS.find(c=>c.id==id);if(!k)return;if(pl)stopPlay();C=k;sl=null;rp();ins_();dr()}
ap.addEventListener('change',e=>{if(e.target.id!='ctl-sel')return;const v=e.target.value;if(v=='__new')useCtl(newCtl().id);else useCtl(+v)});
ap.addEventListener('input',e=>{if(e.target.id!='ctl-name'||ctlOwner(C))return;C.name=e.target.value||'Controller';const o=$('#ctl-sel').selectedOptions[0];if(o)o.textContent=C.name});
ap.addEventListener('click',e=>{const t=e.target,d=t.dataset;
if(t.id=='pa'){const r=t.getBoundingClientRect();showMenu(r.left,r.bottom,['Float','Int','Bool','Trigger'].map(ty=>[ty,()=>{const b='New '+ty,k=C.pa.filter(p=>p.name.startsWith(b)).length;C.pa.push({name:k?b+' '+k:b,type:ty,val:ty=='Float'||ty=='Int'?0:false});rp();ins_()}]))}
if(t.id=='pp')tp();
if(d.px!==undefined){const x=C.pa.splice(+d.px,1)[0];C.tr.forEach(r=>r.cd=r.cd.filter(c=>c.p!=x.name));rp();ins_()}});
ap.addEventListener('input',e=>{const t=e.target,d=t.dataset;
if(d.pn!==undefined){const p=C.pa[+d.pn];C.tr.forEach(r=>r.cd.forEach(c=>{if(c.p==p.name)c.p=t.value}));p.name=t.value}
if(d.pv!==undefined){const p=C.pa[+d.pv];p.val=p.type=='Bool'||p.type=='Trigger'?t.checked:parseFloat(t.value)||0;if(p.type=='Int')p.val=Math.round(p.val)}});
const chk=c=>{const p=C.pa.find(p=>p.name==c.p);if(!p)return false;if(p.type=='Trigger')return !!p.val;const a=p.type=='Bool'?+!!p.val:+p.val,b=+c.v;return c.op=='>'?a>b:c.op=='<'?a<b:c.op=='=='?a==b:a!=b};

// ---- проигрывание контроллера: клипы, Loop, Exit Time, плавные переходы (Duration)
const spd=s=>s.sp==null?1:s.sp;
const stEl=(s,t0,now)=>(now-t0)/1000*spd(s);               // секунды клипа с учётом Speed
const stLen=s=>{const c=clipOf(s);return c?Math.max(c.len,.001):1};
function stopPlay(){pl=null;rp();dr();maybeRestore()}
// один шаг проигрывателя p (редакторного pl или рантайм-плеера кнопок/аниматоров); false — состояние пропало
function tickP(p,now,ed){
  let s=nd(p.cur);if(!s)return false;
  if(p.x){                                                  // идёт смешивание текущего состояния со следующим
    const x=p.x,d=nd(x.to);
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
  applyPose(poseOf(s,el),null,0,p.own);   // 3-й аргумент — вес смешивания, own — набор ЭТОГО плеера (раньше p.own попадал в w, и все аниматоры делили общий editOwn и сбрасывали друг друга)
  if(t){t.cd.forEach(c=>{const q=C.pa.find(q=>q.name==c.p);if(q&&q.type=='Trigger')q.val=false});
    const dest=t.t=='exit'?def():t.t;
    if(dest){if(t.du>0)p.x={to:dest,t0:now,du:t.du};else{p.cur=dest;p.t0=now}}
    if(ed)rp()}
  return true}
function tick(){if(!tickP(pl,performance.now(),true))stopPlay()}

// ---- рантайм: независимые плееры (по одному на объект с компонентом Animator), параметры у каждого свои
/* Привязка клипа к объекту (как в Unity: клип относится к тому объекту, на котором висит Animator).
   Треки хранят id объектов, у которых клип записывали. Если Animator стоит на дубликате/копии и ни один трек
   не попадает в его поддерево — треки переносятся на «такие же» объекты под ним (по пути из индексов детей). */
function rootOf(t,ctlId){for(let o=get(t),g=0;o&&g<64;g++,o=o.parent!=null?get(o.parent):null)if(o.animator&&o.animator.ctl==ctlId)return o;return null}
function pathUnder(root,t){const p=[];let o=get(t),g=0;
  while(o&&o!==root&&g++<64){const par=o.parent!=null?get(o.parent):null;if(!par)return null;p.unshift(objs.filter(c=>c.parent==par.id).indexOf(o));o=par}
  return o===root?p:null}
function walkPath(root,p){let o=root;for(const i of p){o=objs.filter(c=>c.parent==o.id)[i];if(!o)return null}return o}
function buildRemap(ctl,ownerId){
  const owner=get(ownerId);if(!owner)return null;
  const ids=new Set();ctl.st.forEach(s=>{const c=clipOf(s);if(c)c.tracks.forEach(tr=>{if(get(tr.o))ids.add(tr.o)})});
  if(!ids.size)return null;
  const mine=new Set(subtree(ownerId).map(o=>o.id));
  for(const t of ids)if(mine.has(t))return null;      // клип уже анимирует этот объект / его детей — оставляем как есть
  const m=new Map();
  ids.forEach(t=>{const r=rootOf(t,ctl.id);if(!r||r===owner)return;
    const path=pathUnder(r,t),x=path&&walkPath(owner,path);m.set(t,x?x.id:-1)});
  return m.size?m:null}
function rtMake(ctl,owner){
  const view={st:ctl.st,tr:ctl.tr,pa:ctl.pa.map(q=>({name:q.name,type:q.type,val:q.type=='Trigger'?false:q.val}))};
  const prev=C;C=view;let d;try{d=def()}finally{C=prev}
  if(!d&&ctl.st.length)d=(ctl.st.find(s=>clipOf(s))||ctl.st[0]).id;   // нет стартового состояния (Entry) — берём первое с клипом
  return{ctl,view,cur:d||null,t0:performance.now(),p:0,x:null,w:0,own:new Set(),map:owner!=null?buildRemap(ctl,owner):null}}
function rtTick(p,now){if(!p.cur)return true;const prev=C,pm=RMAP;C=p.view;RMAP=p.map||null;try{return tickP(p,now,false)}finally{C=prev;RMAP=pm}}
function rtPlay(p,name){
  const s=p.view.st.find(s=>s.name==name)||p.view.st.find(s=>{const c=clipOf(s);return c&&c.name==name});
  if(!s)return false;p.cur=s.id;p.t0=performance.now();p.x=null;p.w=0;return true}
function rtSet(p,name,val){const q=p.view.pa.find(q=>q.name==name);if(!q)return false;
  q.val=q.type=='Trigger'?true:q.type=='Bool'?!!val:q.type=='Int'?Math.round(+val||0):(+val||0);return true}
function tp(){if(pl){stopPlay();return}const d=def();if(!d){alert('Нет состояния по умолчанию: создайте State (ПКМ по полю)');return}
  C.pa.forEach(p=>{if(p.type=='Trigger')p.val=false});restoreAll();
  pl={cur:d,t0:performance.now(),p:0,x:null,w:0,own:new Set()};rp();
  (function f(){if(!pl)return;tick();if(!pl)return;dr();if(window.amode!='anim'){draw();syncIns()}requestAnimationFrame(f)})()}

// ---- inspector
window.animInspect=()=>{if(window.amode!='anim')return false;
if(!sl){ins.innerHTML='<div class="e">Выберите State или Transition</div>';return true}
if(sl.k=='s'){const n=nd(sl.id);if(!n){ins.innerHTML='';return true}const cp=clipOf(n);
ins.innerHTML=`<div class="sec"><div class="sh">${n.c?'Special state':'State'}</div><div class="r"><span class="l">Name</span><input type="text" data-an="name" value="${esc(n.name)}" ${n.c?'disabled':''}></div>`+(n.c?'':
`<div class="r"><span class="l">Motion</span><select class="wide" data-an="clip"><option value="">None (Motion)</option>${CL.map(c=>`<option value="${c.id}" ${c.id==n.clip?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`+
(cp?`<div class="r"><span class="l">Loop Time</span><input type="checkbox" data-cl="loop" ${cp.loop?'checked':''}><span class="kv" style="margin-left:6px">${rd(cp.len)} с · ${cp.fps} fps</span></div><div class="r"><button data-oc>Открыть в Animation</button></div>`
:`<div class="r"><button data-nc>+ Новая анимация</button></div>`)+
`<div class="r"><span class="l">Speed</span><input type="number" step="0.1" data-an="sp" value="${n.sp}"></div>`)+'</div>';return true}
const t=curT();if(!t){ins.innerHTML='';return true}
const hxEff=t.hx||!t.cd.length;
ins.innerHTML=`<div class="sec"><div class="sh">Transition: ${esc(nd(t.f).name)} → ${esc(nd(t.t).name)}<button data-dt>✕</button></div>`+(t.f=='entry'?'<div class="e" style="padding:4px 0">Переход по умолчанию: Entry → стартовое состояние</div>':
`<div class="r"><span class="l">Has Exit Time</span><input type="checkbox" data-tx="hx" ${hxEff?'checked':''} ${t.cd.length?'':'disabled'}></div>
<div class="r"><span class="l">Exit Time</span><input type="number" step="0.05" min="0" data-tx="ex" value="${t.ex}" ${hxEff?'':'disabled'}></div>
<div class="r"><span class="l">Duration (с)</span><input type="number" step="0.05" min="0" data-tx="du" value="${t.du}"></div>
<div style="color:#888;font-size:11px;padding:2px 0">Exit Time — в долях клипа: 1 = конец, 2 = два цикла лупа. Без условий переход всегда ждёт Exit Time. Duration — плавное смешивание анимаций (0 = мгновенно).</div>
<div class="sh" style="margin-top:10px">Conditions<button data-ac>+</button></div>`+(t.cd.map((c,i)=>{const p=C.pa.find(q=>q.name==c.p),ty=p&&p.type;
return`<div class="r"><select data-cp="${i}">${C.pa.map(q=>`<option ${q.name==c.p?'selected':''}>${esc(q.name)}</option>`).join('')}</select>`+(ty=='Trigger'?'':ty=='Bool'?`<select data-cv="${i}"><option value="1" ${c.v==1?'selected':''}>true</option><option value="0" ${c.v==0?'selected':''}>false</option></select>`:`<select data-co="${i}">${['>','<','==','!='].filter(o=>ty=='Float'?o=='>'||o=='<':1).map(o=>`<option ${o==c.op?'selected':''}>${o}</option>`).join('')}</select><input type="number" step="any" data-cv="${i}" value="${c.v}" style="width:60px">`)+`<button data-cx="${i}">✕</button></div>`}).join('')||'<div class="e" style="padding:4px 0">Нет условий</div>'))+'</div>';return true};
ins.addEventListener('input',e=>{if(window.amode!='anim'||!sl)return;const t=e.target,d=t.dataset;
if(d.an){const n=nd(sl.id);if(!n)return;
  if(d.an=='clip'){n.clip=t.value===''?null:+t.value;ins_();dr();return}
  n[d.an]=d.an=='sp'?(parseFloat(t.value)||0):t.value;dr();return}
if(d.cl){const cp=clipOf(nd(sl.id));if(cp){cp.loop=t.checked;dr()}return}
const r=curT();if(!r)return;
if(d.tx){if(d.tx=='hx'){r.hx=t.checked;ins_()}else{const v=parseFloat(t.value);r[d.tx]=isFinite(v)?Math.max(0,v):0}return}
if(d.cp!==undefined){const c=r.cd[+d.cp],p=C.pa.find(q=>q.name==t.value),ty=p&&p.type;c.p=t.value;c.op=ty=='Float'||ty=='Int'?'>':'==';c.v=ty=='Bool'?1:0;ins_()}
if(d.co!==undefined)r.cd[+d.co].op=t.value;
if(d.cv!==undefined)r.cd[+d.cv].v=parseFloat(t.value)||0});
ins.addEventListener('click',e=>{if(window.amode!='anim')return;const t=e.target,d=t.dataset,r=curT();
if(d.oc!==undefined&&sl&&sl.k=='s'){const cp=clipOf(nd(sl.id));if(cp){cur=cp.id;keepCur=true;setTab('clip')}return}
if(d.nc!==undefined&&sl&&sl.k=='s'){const n=nd(sl.id);if(n){const ow=objs.find(x=>x.animator&&x.animator.ctl==C.id),c=newClip(ow&&ow.name);n.clip=c.id;ins_();dr()}return}
if(d.dt!==undefined&&r){delT(r.id);ins_();dr()}
if(d.ac!==undefined&&r){const p=C.pa[0];if(!p)return;r.cd.push({p:p.name,op:p.type=='Float'||p.type=='Int'?'>':'==',v:p.type=='Bool'?1:0});ins_()}
if(d.cx!==undefined&&r){r.cd.splice(+d.cx,1);ins_()}});

/* =====================================================================
   ANIMATION: таймлайн (dopesheet)
   ===================================================================== */
const cc=()=>cur==null?null:clip(cur);
const snapT=(t,c)=>Math.round(t*c.fps)/c.fps;

function rows(){
  const c=cc();if(!c)return[];
  c.tracks=c.tracks.filter(t=>get(t.o)&&PD[t.k]);
  const out=[],ids=[...new Set(c.tracks.map(t=>t.o))];
  ids.forEach(id=>{const trs=c.tracks.filter(t=>t.o==id).sort((a,b)=>PD[a.k].i-PD[b.k].i),col=tcol.has(id);out.push({g:get(id),trs,col});if(!col)trs.forEach(tr=>out.push({tr}))});
  return out}
const maxSy=()=>Math.max(0,R.length*RH-(($('#tl-cv').clientHeight||0)-RUL));
function listScroll(){$('#tl-list').style.transform=`translateY(${-sy}px)`}
function valHtml(tr,i,v){const p=PD[tr.k];
  if(tr.k=='color')return`<input type="color" data-vi="${i}" value="${colHex(v)}">`;
  if(tr.k=='sprite')return`<div class="slot" data-vs="${i}">${esc(sprLabel(v))}</div>`;
  return`<input type="number" step="${p.st}" ${p.min!=null?`min="${p.min}" max="${p.max}"`:''} data-vi="${i}" value="${rd(v)}">`}
function rowHtml(tr,i){const p=PD[tr.k];
  return`<div class="tp${tsel.has(tr)?' s':''}" data-ri="${i}"><span class="ic">${PI[tr.k]||'•'}</span><span class="tn2" title="${p.n}">${p.n}</span>${valHtml(tr,i,evalTrack(tr,tm))}<button class="kb" data-kb="${i}" title="Поставить / убрать ключ в текущем кадре">◆</button><button data-rm="${i}" title="Удалить свойство">✕</button></div>`}
function buildList(){
  R=rows();const L=$('#tl-list');
  L.innerHTML=R.map((r,i)=>r.g?`<div class="tg${r.g.id==sel||(typeof msel!='undefined'&&msel.has(r.g.id))?' on':''}" data-og="${r.g.id}" title="Выбрать объект"><span class="ic hwt" data-ct="${r.g.id}" title="${r.col?'Развернуть':'Свернуть'} (Alt — все объекты)">${r.col?'▸':'▾'}</span><span class="gn" title="${esc(r.g.name)}">${esc(r.g.name)}</span><canvas class="gth" width="44" height="44" data-gth="${r.g.id}"></canvas><small>${r.trs.length}</small></div>`:rowHtml(r.tr,i)).join('');
  sy=clamp(sy,0,maxSy());listScroll();updVals()}
// миниатюра: спрайт объекта В ТЕКУЩИЙ МОМЕНТ времени (applyPose уже выставил кадр) — меняется вместе с анимацией свойства Sprite
// у объекта с детьми (GameObject-родитель) — миниатюра ВСЕГО объекта: все видимые спрайты потомков в их текущих позах, вписанные в квадрат
function compThumb(cv,o,ord){
  const ids=new Set(subtree(o.id).map(x=>x.id));
  const it=ord.filter(e=>e.on&&ids.has(e.o.id)&&!e.o.screen&&(e.o.img||e.o.text||e.o.grad));
  if(!it.length||(it.length==1&&it[0].o===o))return false;
  const sig='c|'+it.map(e=>e.o.id+':'+e.M.map(v=>Math.round(v*100)).join(',')+(e.o.img?'|'+e.o.img.sprite+'|'+e.o.img.color+'|'+e.o.img.alpha:'')).join(';');
  cv.classList.remove('no');if(cv.dataset.k===sig)return true;cv.dataset.k=sig;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const e of it){const[w,h]=size(e.o);for(const[lx,ly]of[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]){const p=apM(e.M,lx,ly);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)}}
  const g=cv.getContext('2d'),W=cv.width,H=cv.height,cx=(x0+x1)/2,cy=(y0+y1)/2,k=Math.min((W-6)/Math.max(x1-x0,1e-3),(H-6)/Math.max(y1-y0,1e-3));
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);
  for(const e of it){const d=e.o,M=e.M;let im=null;try{im=window.btnView?btnView(d):(d.img||d.text)}catch(_){im=d.img||d.text}
    const[w,h]=size(d,d.img?im:null);
    g.save();g.transform(k*M[0],-k*M[1],k*M[2],-k*M[3],W/2+k*(M[4]-cx),H/2-k*(M[5]-cy));g.scale(1,-1);
    try{
      if(d.img&&im){g.globalAlpha=im.alpha==null?1:im.alpha;const a=im.sprite!=null&&ast(im.sprite);if(a&&a.img)g.drawImage(tint(a,im.color),-w/2,-h/2,w,h);else{g.fillStyle=im.color||'#fff';g.fillRect(-w/2,-h/2,w,h)}g.globalAlpha=1}
      else if(d.text&&window.drawText&&im)drawText(g,d.text,im);
      else if(d.grad&&window.drawGrad)drawGrad(g,d.grad,w,h)}catch(_){}
    g.restore()}
  return true}
function drawThumbs(){
  const ord=order();
  $('#tl-list').querySelectorAll('canvas.gth').forEach(cv=>{
    const o=get(+cv.dataset.gth);if(!o)return;
    if(compThumb(cv,o,ord))return;
    let v=null;try{v=window.btnView?btnView(o):o.img}catch(e){v=o.img}
    const a=o.img&&v&&v.sprite!=null?ast(v.sprite):null,ok=a&&a.img,kind=o.img?'i':o.text?'t':o.grad?'g':o.screen?'s':'n';
    const key=kind+'|'+(o.img&&v?v.sprite+'|'+v.color+'|'+v.alpha+'|'+(ok?a.img.width:0):'');
    if(cv.dataset.k===key)return;cv.dataset.k=key;
    cv.classList.toggle('no',kind=='n');
    const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.clearRect(0,0,W,H);
    if(kind=='i'&&v){g.globalAlpha=v.alpha==null?1:v.alpha;
      if(ok){const im=tint(a,v.color),k=Math.min((W-4)/im.width,(H-4)/im.height);g.drawImage(im,(W-im.width*k)/2,(H-im.height*k)/2,im.width*k,im.height*k)}
      else{g.fillStyle=v.color||'#fff';g.fillRect(6,6,W-12,H-12)}g.globalAlpha=1}
    else{g.fillStyle='#d8d8d8';g.font='bold '+Math.round(H*.6)+'px Segoe UI,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(kind=='t'?'T':kind=='g'?'▤':'▭',W/2,H/2+1)}})}
function updVals(){
  const L=$('#tl-list');drawThumbs();
  R.forEach((r,i)=>{if(!r.tr)return;const row=L.children[i];if(!row)return;
    const v=evalTrack(r.tr,tm),inp=row.querySelector('[data-vi]'),sp=row.querySelector('[data-vs]'),kb=row.querySelector('.kb');
    if(inp&&document.activeElement!==inp)inp.value=r.tr.k=='color'?colHex(v):rd(v);
    if(sp)sp.textContent=sprLabel(v);
    if(kb)kb.classList.toggle('on',!!keyAt(r.tr,tm))})}
function paintRows(){const L=$('#tl-list');R.forEach((r,i)=>{if(r.tr&&L.children[i])L.children[i].classList.toggle('s',tsel.has(r.tr))});tlDraw()}
// клипы контроллера k (в порядке состояний; клип стартового состояния — первым)
function ctlClips(k){
  const e=k.tr.find(t=>t.f=='entry'),d=e&&k.st.find(s=>s.id==e.t),ids=[];
  [d,...k.st].forEach(s=>{if(s&&s.clip!=null&&clip(s.clip)&&!ids.includes(s.clip))ids.push(s.clip)});return ids}
// объект с Animator (сам или ближайший родитель — как в Unity)
const animOf=o=>{for(let a=o,g=0;a&&g<64;g++,a=a.parent!=null?get(a.parent):null)if(a.animator)return a;return null};
let lastAuto,keepCur=false;
// Выбранный объект -> открывается клип, который РЕАЛЬНО его анимирует (дорожки на самом объекте или на его детях).
// Порядок: текущий клип (если подходит) → клипы контроллера объекта → любые клипы. Нет подходящих: у объекта с Animator —
// клип стартового состояния его контроллера, у объекта без анимации — пустое окно (Create New Clip). false — объект не выбран.
function autoCtl(){
  const o=get(sel);if(!o)return false;
  const a=animOf(o),k=a&&CTS.find(c=>c.id==a.animator.ctl),own=k?ctlClips(k).map(clip).filter(Boolean):[];
  const sub=new Set(subtree(o.id).map(x=>x.id)),direct=c=>c.tracks.some(t=>t.o==o.id),inSub=c=>c.tracks.some(t=>sub.has(t.o));
  const pool=[...own,...CL.filter(c=>!own.includes(c))];
  const cc0=clip(cur);
  const subA=a?new Set(subtree(a.id).map(x=>x.id)):null,inA=c=>c.tracks.some(t=>subA.has(t.o));      // клипы, анимирующие объект с Animator (родителя)
  let pick=(cc0&&direct(cc0)&&cc0)||pool.find(direct)||(cc0&&inSub(cc0)&&cc0)||pool.find(inSub)
    ||(a&&((cc0&&inA(cc0)&&cc0)||pool.find(inA)))||null;
  let nk=k;
  if(pick){nk=(k&&ctlClips(k).includes(pick.id))?k:(CTS.find(c=>ctlClips(c).includes(pick.id))||k)}
  else if(k){const d=ctlClips(k)[0];pick=d!=null?clip(d):null}
  if(nk&&nk!==C){if(pl)stopPlay();C=nk;sl=null}
  cur=pick?pick.id:null;
  return true}
function fillSel(){const s=$('#tl-sel'),c=cc();
  const own=ctlClips(C),rest=CL.filter(k=>!own.includes(k.id)),opt=k=>`<option value="${k.id}" ${k.id==cur?'selected':''}>${esc(k.name)}</option>`;
  s.innerHTML=(CL.length?(cur==null?'<option value="" disabled selected>(выберите анимацию)</option>':'')
    +(own.length?`<optgroup label="${esc(C.name)}">`+own.map(id=>opt(clip(id))).join('')+'</optgroup>':'')
    +(rest.length?`<optgroup label="${own.length?'Другие анимации':'Анимации'}">`+rest.map(opt).join('')+'</optgroup>':'')
    :'<option value="" disabled selected>(нет анимаций)</option>')
   +'<option disabled>──────────</option><option value="__new">＋ Create New Clip…</option>'+(c?`<option value="__del">✕ Delete «${esc(c.name)}»…</option>`:'')}
function updHead(){const c=cc(),t=$('#tl-t');if(document.activeElement!==t)t.value=c?rd(tm):'';$('#tl-f').textContent=c?'кадр '+Math.round(tm*c.fps)+' / '+Math.round(c.len*c.fps):''}
function lenLbl(){const c=cc(),e=$('#tl-len');if(e)e.textContent=c?rd(c.len)+' с · '+Math.round(c.len*c.fps)+' кадр.':'—'}
function tbar(){
  const c=cc();
  ['#tl-name','#tl-pl','#tl-rec','#tl-key','#tl-add','#tl-t','#tl-fps','#tl-loop','#tl-first','#tl-pk','#tl-nk','#tl-last','#tl-del'].forEach(id=>$(id).disabled=!c);
  const nm=$('#tl-name');if(document.activeElement!==nm)nm.value=c?c.name:'';
  lenLbl();$('#tl-fps').value=c?c.fps:'';$('#tl-t').step=c?1/c.fps:.01;$('#tl-loop').checked=!!(c&&c.loop);
  $('#tl-pl').textContent=pv?'■':'▶';$('#tl-rec').classList.toggle('on',rec);$('#anm').classList.toggle('rec',rec);
  {const e=$('#tl-empty');e.style.display=c?'none':'flex';const o=get(sel),d=e.firstElementChild;
    if(!c&&d)d.textContent=o?'У «'+o.name+'» нет анимации':'Нет анимаций'}
  updHead()}
function rebuild(){buildList();tbar();tlDraw()}
function sampleClip(){const c=cc();if(c)autoLen(c);applyPose(c?poseOfClip(c,tm):new Map(),null);draw();syncIns()}
function setTime(t,play){const c=cc();if(!c)return;t=clamp(t,0,MAXT);if(!play)t=snapT(t,c);tm=t;sampleClip();updVals();updHead();tlDraw()}
function fitTL(){const c=cc(),w=$('#tl-cv').clientWidth||600;if(!c)return;autoLen(c);tv.z=clamp((w-PL-60)/Math.max(c.len,.5),20,2000);tv.o=0;sy=0}
function selectClip(id,keep){
  cur=id;if(!keep)tm=0;const c=cc();if(c){autoLen(c);tm=clamp(tm,0,MAXT)}
  ksel=new Set();tsel=new Set();ed=null;fillSel();fitTL();rebuild();sampleClip()}
function enterClip(){
  lastAuto=sel;
  if(keepCur||!autoCtl()){if(!cc())cur=CL.length?CL[0].id:null}
  keepCur=false;selectClip(cur,true)}
// смена выбранного объекта в окне Animation: автоматически открывается анимация его контроллера
window.animSel=()=>{if(window.amode!='clip')return;
  if(sel!==lastAuto){lastAuto=sel;const pc=cur,pk=C;
    if(autoCtl()){pvStop();if(cur!==pc)selectClip(cur);else if(C!==pk)fillSel()}}
  buildList();tlDraw()};

// запись: правки в Inspector / на сцене при включённом Rec превращаются в ключи
window.animEdit=(o,k,old,v)=>{
  if(window.amode!='clip'||!rec||pv)return;const c=cc();if(!c||!PD[k])return;
  let tr=c.tracks.find(t=>t.o==o.id&&t.k==k);
  if(!tr){
    if(old===v||(typeof v=='number'&&typeof old=='number'&&Math.abs(v-old)<1e-9))return;
    tr={o:o.id,k,keys:[]};(c.tracks.push(tr),tcol.delete(tr.o));
    const key=o.id+'.'+k;if(!base.has(key)&&old!==undefined)base.set(key,old);editOwn.add(key);
    if(tm>EPS&&old!==undefined)setKey(tr,0,old);
    setKey(tr,tm,v);buildList();tlDraw();return}
  setKey(tr,tm,v);updVals();tlDraw()};

function addProps(o,list){
  const c=cc();if(!c)return;
  list.forEach(k=>{
    if(c.tracks.some(t=>t.o==o.id&&t.k==k))return;
    if(PD[k].g=='Image'&&!o.img&&!(o.text&&k!='sprite')&&!(o.grad&&k=='alpha'))return;
    const v=pget(o,k),tr={o:o.id,k,keys:[]};(c.tracks.push(tr),tcol.delete(tr.o));setKey(tr,0,v);if(tm>EPS)setKey(tr,tm,v)});
  rebuild();sampleClip()}
function delKeys(){
  const c=cc();if(!c||!ksel.size)return;
  c.tracks.forEach(t=>t.keys=t.keys.filter(k=>!ksel.has(k)));
  c.tracks=c.tracks.filter(t=>t.keys.length);ksel=new Set();rebuild();sampleClip()}
function addKeyAt(tr,t){setKey(tr,t,evalTrack(tr,t));rebuild()}
// ключ, упавший на чужой ключ, заменяет его; выделенные ключи, слипшиеся в один кадр (сжатие), сливаются в один
function resolveDrops(trs){
  trs.forEach(tr=>{const sk=tr.keys.filter(k=>ksel.has(k));
    tr.keys=tr.keys.filter(o=>ksel.has(o)?!sk.some(k=>k!==o&&sk.indexOf(k)<sk.indexOf(o)&&Math.abs(k.t-o.t)<EPS):!sk.some(k=>Math.abs(k.t-o.t)<EPS));
    tr.keys.sort((a,b)=>a.t-b.t)});
  const live=new Set();trs.forEach(tr=>tr.keys.forEach(k=>live.add(k)));
  ksel=new Set([...ksel].filter(k=>live.has(k)))}

// ---- буфер ключей: Ctrl+C / Ctrl+X / Ctrl+V и контекстное меню
let KCLIP=null;   // {keys:[{o,k,dt,v,i}]} — dt: смещение от самого раннего скопированного ключа
function copyKeys(){
  const c=cc();if(!c||!ksel.size)return false;const arr=[];let t0=1e9;
  c.tracks.forEach(tr=>tr.keys.forEach(k=>{if(ksel.has(k)){arr.push({o:tr.o,k:tr.k,t:k.t,v:k.v,i:k.i});t0=Math.min(t0,k.t)}}));
  if(!arr.length)return false;arr.forEach(a=>{a.dt=a.t-t0});KCLIP={keys:arr};flash('Скопировано ключей: '+arr.length+' · Ctrl+V — вставить в позицию курсора');return true}
function cutKeys(){if(copyKeys())delKeys()}
// вставка начинается с t0 (по умолчанию — позиция красного курсора); если выделены дорожки того же свойства — ключи идут в них
function pasteKeys(t0){
  const c=cc();if(!c||!KCLIP)return;
  t0=snapT(clamp(t0==null?tm:t0,0,MAXT),c);
  const single=new Set(KCLIP.keys.map(a=>a.o)).size==1,tsl=[...tsel].filter(tr=>c.tracks.includes(tr)),out=[];let skipped=0;
  KCLIP.keys.forEach(a=>{
    let targets=single&&tsl.length?tsl.filter(tr=>tr.k==a.k):[];
    if(!targets.length){const o=get(a.o);if(!o)return;let tr=c.tracks.find(x=>x.o==a.o&&x.k==a.k);
      if(!tr){if(pget(o,a.k)===undefined)return;tr={o:a.o,k:a.k,keys:[]};(c.tracks.push(tr),tcol.delete(tr.o))}targets=[tr]}
    targets.forEach(tr=>{const t=Math.round((t0+a.dt)*1e4)/1e4;if(t>MAXT){skipped++;return}
      const k=setKey(tr,t,a.v);if(tr.k!='sprite')k.i=a.i;out.push(k)})});
  c.tracks=c.tracks.filter(t=>t.keys.length);
  ksel=new Set(out);rebuild();sampleClip();
  flash(out.length?'Вставлено ключей: '+out.length+(skipped?' (дальше '+MAXT+' с: '+skipped+')':''):'Нечего вставлять: объекты для этих ключей не найдены')}

// ---- панель инструментов
const delClip=()=>{const c=cc();if(!c||!confirm(`Удалить анимацию «${c.name}»?`))return;
  CL.splice(CL.indexOf(c),1);C.st.forEach(s=>{if(s.clip==c.id)s.clip=null});pvStop();
  selectClip(CL.length?CL[0].id:null)};
// создание и удаление клипов живут в самом выпадающем списке
$('#tl-sel').onchange=e=>{const v=e.target.value;
  if(v=='__new'){newClipUI();return}
  if(v=='__del'){fillSel();delClip();return}
  if(v!==''){const id=+v;
    if(!ctlClips(C).includes(id)){const k=CTS.find(k=>ctlClips(k).includes(id));if(k){if(pl)stopPlay();C=k;sl=null}}   // клип из другого контроллера — переключаемся на него
    selectClip(id)}};
$('#tl-name').oninput=e=>{const c=cc();if(!c)return;c.name=e.target.value;fillSel()};
// ---- у каждого объекта с Animator СВОЙ контроллер (один на объект), его имя всегда = имя объекта (при совпадении — «Имя 2», «Имя 3»…)
const ctlOwner=k=>!!k&&objs.some(o=>o.animator&&o.animator.ctl==k.id);
// создать контроллер объекта, если его нет (по требованию: при добавлении компонента Animator или первого клипа)
function ensureCtl(o){
  if(!o.animator)o.animator={};
  let k=CTS.find(c=>c.id==o.animator.ctl);
  if(!k){
    k=(C&&!C.st.length&&/^Animator Controller( \d+)?$/.test(C.name)&&!ctlOwner(C))?C:newCtl();   // пустой безымянный контроллер-заготовку переиспользуем
    o.animator.ctl=k.id}
  syncCtl();return CTS.find(c=>c.id==o.animator.ctl)}
// привести контроллеры к имени объектов. Копия объекта (Duplicate / Ctrl+C) ДЕЛИТ контроллер и клипы оригинала — анимации играют и на копии
// (клип перепривязывается к её детям, см. buildRemap). Отдельный независимый контроллер — кнопка «Duplicate as new controller» (dupCtl).
function syncCtl(){
  if(window.playing)return;
  const owners=new Map();let ch=false;
  for(const{o}of order()){if(!o.animator)continue;
    let k=CTS.find(c=>c.id==o.animator.ctl);
    if(!k){k=newCtl();o.animator.ctl=k.id;ch=true}
    if(!owners.has(k.id))owners.set(k.id,[]);owners.get(k.id).push(o)}
  owners.forEach((os,id)=>{const k=CTS.find(c=>c.id==id);
    if(os.length>1&&os.some(o=>k.name==o.name||k.name.startsWith(o.name+' ')))return;   // общий контроллер: имя оставляем, пока оно совпадает с именем одного из владельцев
    const nm=ctlName(os[0].name,k);if(k.name!=nm){k.name=nm;ch=true}});
  if(ch&&window.amode=='anim'){rp();ins_()}}
// «Duplicate as new controller»: у объекта o появляется СВОЙ контроллер — копия прежнего вместе с КОПИЯМИ всех его клипов.
// Треки клонов перепривязываются на «такие же» объекты внутри o (по пути из индексов детей), поэтому правки идут только в этот объект.
function dupCtl(o){
  const src=o&&o.animator&&CTS.find(k=>k.id==o.animator.ctl);if(!src)return null;
  if(pl)stopPlay();pvStop();
  const rm=buildRemap(src,o.id),was=objs.find(x=>x!==o&&x.animator&&x.animator.ctl==src.id),n=newCtl();
  Object.assign(n,jc(src),{id:n.id,name:n.name});
  const cmap=new Map(),uniq=nm=>{let r=nm,i=1;while(CL.some(c=>c.name==r))r=nm+' ('+(i++)+')';return r};
  n.st.forEach(st=>{if(st.clip==null)return;
    if(!cmap.has(st.clip)){
      const c0=clip(st.clip);if(!c0){st.clip=null;return}
      const c=jc(c0);c.id=cid++;
      c.name=uniq(was&&was.name&&c0.name.startsWith(was.name)?o.name+c0.name.slice(was.name.length):c0.name+' (copy)');
      c.tracks.forEach(tr=>{if(rm){const r=rm.get(tr.o);if(r!==undefined)tr.o=r}});
      c.tracks=c.tracks.filter(tr=>tr.o>=0);
      CL.push(c);cmap.set(st.clip,c.id)}
    st.clip=cmap.get(st.clip)});
  o.animator.ctl=n.id;n.name=ctlName(o.name,n);
  C=n;sl=null;
  if(window.amode=='anim'){rp();dr();ins_()}else if(window.amode=='clip'){const f=ctlClips(n)[0];if(f!=null)selectClip(f)}
  return n}
// имя контроллера объекта: имя объекта, при совпадении — «Имя 2», «Имя 3»…
const ctlName=(n,except)=>{const b=n||'Animator Controller';let x=b,i=1;while(CTS.some(c=>c!==except&&c.name==x))x=b+' '+(++i);return x};
// Create New Clip на выбранном объекте: у объекта появляется СВОЙ Animator и ОТДЕЛЬНЫЙ контроллер (даже если Animator есть у родителя).
// Если свой Animator уже есть — клип добавляется состоянием в его контроллер.
const newClipUI=()=>{
  const o=get(sel);let made=false;
  if(o){
    syncCtl();
    let k=o.animator&&CTS.find(c=>c.id==o.animator.ctl);
    if(!k){k=ensureCtl(o);made=true}
    if(k!==C){if(pl)stopPlay();C=k;sl=null}}
  const c=newClip(o&&o.name);addClipState(c);selectClip(c.id);if(made)refresh()};
$('#tl-new').onclick=()=>newClipUI();   // кнопка в пустом окне, когда нет ни одной анимации
$('#tl-pl').onclick=()=>pvToggle();
// переходы: в начало / к предыдущему и следующему ключу / в конец (конец = последний ключ)
const keyTimes=()=>{const c=cc();if(!c)return[];const o=get(sel),trs=tsel.size?[...tsel]:(o&&c.tracks.some(t=>t.o==o.id)?c.tracks.filter(t=>t.o==o.id):c.tracks),s=new Set();trs.forEach(t=>t.keys.forEach(k=>s.add(k.t)));return[...s].sort((a,b)=>a-b)};
$('#tl-first').onclick=()=>{pvStop();setTime(0)};
$('#tl-last').onclick=()=>{const c=cc();if(!c)return;pvStop();setTime(c.len)};
$('#tl-pk').onclick=()=>{const c=cc();if(!c)return;pvStop();const p=keyTimes().filter(t=>t<tm-EPS).pop();setTime(p==null?0:p)};
$('#tl-nk').onclick=()=>{const c=cc();if(!c)return;pvStop();const n=keyTimes().find(t=>t>tm+EPS);setTime(n==null?tm:n)};
$('#tl-del').onclick=()=>delKeys();
$('#tl-rec').onclick=()=>{rec=!rec;tbar()};
$('#tl-t').onchange=e=>setTime(parseFloat(e.target.value)||0);
$('#tl-fps').onchange=e=>{const c=cc();if(!c)return;c.fps=clamp(Math.round(parseFloat(e.target.value))||30,1,240);autoLen(c);rebuild()};
$('#tl-loop').onchange=e=>{const c=cc();if(c)c.loop=e.target.checked};
$('#tl-key').onclick=()=>{
  const c=cc();if(!c)return;let trs;
  if(tsel.size)trs=[...tsel];else{const ids=new Set(selObjs().map(o=>o.id)),mine=c.tracks.filter(t=>ids.has(t.o));trs=mine.length?mine:c.tracks}
  trs.forEach(tr=>{const o=get(tr.o);if(o){const v=pget(o,tr.k);if(v!==undefined)setKey(tr,tm,v)}});rebuild()};
// объекты, которые сейчас анимируем: все выделенные в Hierarchy (Ctrl/Shift+клик, Ctrl+A) или один выбранный
const selObjs=()=>(typeof selIds=='function'?selIds():(sel!=null?[sel]:[])).map(get).filter(Boolean);
$('#tl-add').onclick=e=>{
  const c=cc(),os=selObjs(),r=e.target.getBoundingClientRect();if(!c)return;
  if(!os.length)return showMenu(r.left,r.bottom,[['Выберите объект на сцене или в Hierarchy',()=>{}]]);
  const n=os.length>1?'  (×'+os.length+')':'',all=(list,f)=>{os.forEach(o=>f&&!f(o)?0:addProps(o,list))};
  const has=(o,k)=>c.tracks.some(t=>t.o==o.id&&t.k==k),it=[];
  it.push(['Transform ▸ все свойства'+n,()=>all(PROPS.filter(p=>p.g=='Transform').map(p=>p.k))]);
  if(os.some(o=>o.img))it.push(['Image ▸ Color + Alpha + Sprite'+n,()=>all(['color','alpha','sprite'],o=>o.img)]);
  if(os.some(o=>o.text))it.push(['Text ▸ Color + Alpha'+n,()=>all(['color','alpha'],o=>o.text)]);
  if(os.some(o=>o.grad))it.push(['Gradient ▸ Alpha'+n,()=>all(['alpha'],o=>o.grad)]);
  const ok=(o,p)=>!((p.g=='Image'&&!o.img&&!(o.text&&p.k!='sprite')&&!(o.grad&&p.k=='alpha'))||has(o,p.k));
  PROPS.forEach(p=>{if(!os.some(o=>ok(o,p)))return;it.push([p.g+' ▸ '+p.n+n,()=>os.forEach(o=>{if(ok(o,p))addProps(o,[p.k])})])});
  showMenu(r.left,r.bottom,it)};

// предпросмотр клипа (Loop учитывается: без лупа остановится в конце)
function pvStop(){pv=false;const b=$('#tl-pl');if(b)b.textContent='▶'}
function pvToggle(){
  const c=cc();if(!c)return;if(pv){pvStop();inspect();return}
  autoLen(c);pv=true;$('#tl-pl').textContent='■';if(tm>=c.len-EPS)tm=0;let t0=performance.now()-tm*1000;
  (function f(){if(!pv)return;const c=cc();if(!c){pvStop();return}
    autoLen(c);let t=(performance.now()-t0)/1000;
    if(t>=c.len){if(c.loop){t=t%c.len;t0=performance.now()-t*1000}else{t=c.len;pvStop()}}
    tm=t;sampleClip();updVals();updHead();tlDraw();
    if(pv)requestAnimationFrame(f);else inspect()})()}

// ---- список свойств (слева)
const L_=$('#tl-list');
// кнопки «свернуть / развернуть всё» в шапке списка
{const lh=$('#tl-lh');lh.innerHTML='<span>Свойства</span><span class="lhb"><button data-acp="copy" title="Копировать анимацию выбранного объекта (и его детей) в текущем клипе">⧉</button><button data-acp="paste" title="Вставить скопированную анимацию в выбранный объект (Shift — со сдвигом позиции)">⎘</button><button data-ctall="1" title="Свернуть все объекты">▸▸</button><button data-ctall="0" title="Развернуть все объекты">▾▾</button></span>';
 lh.addEventListener('click',e=>{const a=e.target.closest('[data-acp]');if(a){a.dataset.acp=='copy'?copyAnim(sel):pasteAnim(sel,e.shiftKey);return}
 const b=e.target.closest('[data-ctall]'),c=cc();if(!b||!c)return;
  const ids=[...new Set(c.tracks.map(x=>x.o))];
  if(b.dataset.ctall=='1'){ids.forEach(i=>tcol.add(i));c.tracks.forEach(tr=>{tr.keys.forEach(k=>ksel.delete(k));tsel.delete(tr)})}else tcol.clear();
  rebuild()})}
L_.addEventListener('click',e=>{
  const t=e.target,c=cc();if(!c)return;
  const ct=t.closest('[data-ct]');
  if(ct){const id=+ct.dataset.ct,all=[...new Set(c.tracks.map(x=>x.o))],open=!tcol.has(id);   // open — сейчас развёрнута, значит сворачиваем
    const ch=e.altKey?all:[id];ch.forEach(i=>{if(open)tcol.add(i);else tcol.delete(i)});
    for(const i of ch)for(const tr of c.tracks.filter(x=>x.o==i)){tr.keys.forEach(k=>ksel.delete(k));tsel.delete(tr)}   // скрытые ключи и свойства не остаются выделенными
    rebuild();return}
  const bk=t.closest('[data-kb]'),bx=t.closest('[data-rm]'),sp=t.closest('[data-vs]'),gr=t.closest('[data-og]'),row=t.closest('.tp');
  if(bk){const tr=R[+bk.dataset.kb].tr,k=keyAt(tr,tm);
    if(k){tr.keys.splice(tr.keys.indexOf(k),1);ksel.delete(k);if(!tr.keys.length)c.tracks.splice(c.tracks.indexOf(tr),1)}
    else{const o=get(tr.o),v=o&&pget(o,tr.k);if(v!==undefined)setKey(tr,tm,v)}
    rebuild();sampleClip();return}
  if(bx){const tr=R[+bx.dataset.rm].tr;c.tracks.splice(c.tracks.indexOf(tr),1);tr.keys.forEach(k=>ksel.delete(k));tsel.delete(tr);rebuild();sampleClip();return}
  if(sp){const tr=R[+sp.dataset.vs].tr,r=sp.getBoundingClientRect(),set=v=>{setKey(tr,tm,v);sampleClip();rebuild()};
    showMenu(r.left,r.bottom,[['None',()=>set(null)],...spriteList().map(a=>[spName(a),()=>set(a.id)])]);return}
  if(gr){sel=+gr.dataset.og;refresh();return}
  if(row&&!t.closest('input')){const tr=R[+row.dataset.ri].tr;
    if(e.ctrlKey||e.shiftKey)tsel.has(tr)?tsel.delete(tr):tsel.add(tr);else tsel=new Set([tr]);paintRows()}});
L_.addEventListener('input',e=>{
  const i=e.target.dataset.vi;if(i===undefined||!R[+i])return;const tr=R[+i].tr;
  let v=e.target.type=='color'?e.target.value:parseFloat(e.target.value);
  if(typeof v=='number'&&!isFinite(v))return;if(tr.k=='alpha')v=clamp(v,0,1);
  setKey(tr,tm,v);sampleClip();updVals();tlDraw()});
$('#tl-lc').addEventListener('wheel',e=>{e.preventDefault();sy=clamp(sy+(e.deltaY||0),0,maxSy());listScroll();tlDraw()},{passive:false});


/* ---- Copy / Paste Animation: дорожки объекта (вместе с детьми) → другой объект с такой же структурой ----
   Копируются все дорожки текущего клипа, лежащие на объекте и его потомках; потомки запоминаются ПУТЁМ в иерархии
   (индекс среди детей на каждом уровне), поэтому вставка работает на любую копию с такой же структурой.
   Вставляются только совпадающие каналы: у цели нет такого объекта / свойства (например Sprite без Image) — канал пропускается. */
let ACLIP=null;   // {src,name,clip,items:[{p:[путь],k,keys:[{t,v,i}],rest}]}
const restOf=(o,k)=>{const key=o.id+'.'+k;return base.has(key)?base.get(key):pget(o,k)};   // «покойное» значение (без текущей позы клипа)
function copyAnim(id){
  const c=cc(),root=id!=null?get(id):null;
  if(!c)return flash('Нет открытого клипа');
  if(!root)return flash('Выберите объект, анимацию которого копировать');
  const items=[];
  c.tracks.forEach(tr=>{if(!tr.keys.length)return;const p=pathUnder(root,tr.o),o=get(tr.o);if(!p||!o)return;
    items.push({p,k:tr.k,keys:tr.keys.map(k=>({t:k.t,v:k.v,i:k.i})),rest:tr.k=='x'||tr.k=='y'?restOf(o,tr.k):null})});
  if(!items.length)return flash('У «'+root.name+'» нет дорожек в клипе «'+c.name+'»');
  ACLIP={src:root.id,name:root.name,clip:c.id,items};
  flash('Анимация «'+root.name+'» скопирована: каналов '+items.length+' · выберите другой объект и нажмите ⎘ (Paste)')}
// rel — сдвинуть дорожки Position X/Y на разницу позиций цели и источника (чтобы объект не «телепортировался»)
function pasteAnim(id,rel){
  let c=cc();const root=id!=null?get(id):null;
  if(!ACLIP)return flash('Сначала скопируйте анимацию объекта (⧉ Copy)');
  if(!root)return flash('Выберите объект, в который вставить анимацию');
  if(!c&&id==sel){newClipUI();c=cc()}   // у объекта ещё нет клипа — создаём ему свой Animator + клип (как «Create New Clip»)
  if(!c)return flash('Нет открытого клипа');
  if(root.id==ACLIP.src&&c.id==ACLIP.clip)return flash('Это тот же объект и тот же клип');
  let ok=0;const skip=[];
  ACLIP.items.forEach(it=>{
    const o=walkPath(root,it.p),pn=PD[it.k]?PD[it.k].n:it.k;
    if(!o)return skip.push(pn+' (нет дочернего объекта)');
    if(pget(o,it.k)===undefined)return skip.push(o.name+': '+pn+' (нет такого свойства)');
    const d=rel&&it.rest!=null&&typeof it.rest=='number'?restOf(o,it.k)-it.rest:0;
    let tr=c.tracks.find(x=>x.o==o.id&&x.k==it.k);
    if(!tr){tr={o:o.id,k:it.k,keys:[]};c.tracks.push(tr);tcol.delete(o.id)}
    else if(!base.has(o.id+'.'+it.k)){const old=pget(o,it.k);if(old!==undefined)base.set(o.id+'.'+it.k,old)}
    tr.keys=it.keys.map(k=>({t:k.t,v:typeof k.v=='number'&&d?rd(k.v+d):k.v,i:k.i}));
    ok++});
  if(!ok)return flash('Каналы не совпадают — ничего не вставлено'+(skip.length?': '+skip.slice(0,3).join(', '):''));
  ksel=new Set();tsel=new Set();rebuild();sampleClip();
  flash('Вставлено в «'+root.name+'»: '+ok+' из '+ACLIP.items.length+(skip.length?' · пропущено: '+skip.slice(0,3).join(', ')+(skip.length>3?'…':''):''))}
// ПКМ по объекту в списке свойств
L_.addEventListener('contextmenu',e=>{
  const g=e.target.closest&&e.target.closest('[data-og]');if(!g||!cc())return;e.preventDefault();
  const id=+g.dataset.og,o=get(id);if(!o)return;
  showMenu(e.clientX,e.clientY,[['Copy Animation  «'+o.name+'»',()=>copyAnim(id)],
    ...(ACLIP?[['Paste Animation  ← «'+ACLIP.name+'»',()=>pasteAnim(id,false)],['Paste Animation · со сдвигом позиции',()=>pasteAnim(id,true)]]:[])])});

// ---- холст таймлайна
const tcv=$('#tlc');
const mp=e=>{const r=tcv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
const X=t=>(t-tv.o)*tv.z+PL,T=x=>Math.max(0,(x-PL)/tv.z+tv.o);
const rowAt=y=>{const i=Math.floor((y-RUL+sy)/RH);return i>=0&&i<R.length&&y>=RUL?i:-1};
function keyHit(x,y){
  const i=rowAt(y);if(i<0||!R[i].tr)return null;const tr=R[i].tr;let best=null,bd=7;
  tr.keys.forEach(k=>{const d=Math.abs(X(k.t)-x);if(d<=bd){bd=d;best=k}});
  return best?{tr,k:best,i}:null}
// сводный ромб в строке-группе: все ключи всех дорожек объекта, стоящие в одно время
// иконка свойства на ключе: в строке свойства — по центру ключа; в строке-группе — «таблетка» со значками всех свойств, чьи ключи стоят в это время
function keyGlyph(G,x,y,ch,on){G.fillStyle=on?'#fff':'#141414';G.font='10px "Segoe UI Symbol","Segoe UI",sans-serif';G.textAlign='center';G.textBaseline='middle';G.fillText(ch,x,y+.5)}
function grpTimes(r){const ts=new Map();r.trs.forEach(tr=>tr.keys.forEach(k=>{let e=ts.get(k.t);if(!e)ts.set(k.t,e={on:false,gl:[]});if(ksel.has(k))e.on=true;const g=PI[tr.k]||'•';if(!e.gl.includes(g))e.gl.push(g)}));
  ts.forEach(e=>{if(e.gl.length>4)e.gl=[...e.gl.slice(0,3),'…']});return ts}
const pillW=n=>Math.max(18,n*11+6);
function grpHit(x,y){
  const i=rowAt(y);if(i<0||!R[i].g)return null;let bt=null,bd=1e9;
  grpTimes(R[i]).forEach((e,t)=>{const d=Math.abs(X(t)-x);if(d<=pillW(e.gl.length)/2&&d<bd){bd=d;bt=t}});
  if(bt==null)return null;
  return{keys:R[i].trs.flatMap(tr=>tr.keys.filter(k=>Math.abs(k.t-bt)<1e-6)),i}}
const PAD=9;   // отступ ручек растяжения от крайних ключей
function stBox(){
  if(ksel.size<2)return null;let t0=1e9,t1=-1e9,i0=1e9,i1=-1;
  R.forEach((r,i)=>{const ks=r.tr?r.tr.keys:r.g&&r.col?r.trs.flatMap(t=>t.keys):null;if(!ks)return;ks.forEach(k=>{if(ksel.has(k)){if(k.t<t0)t0=k.t;if(k.t>t1)t1=k.t;if(i<i0)i0=i;if(i>i1)i1=i}})});
  return i1<0||t1-t0<EPS?null:{t0,t1,i0,i1}}
function stHit(m){
  const b=stBox();if(!b)return null;
  const y0=RUL+b.i0*RH-sy,y1=RUL+(b.i1+1)*RH-sy;if(m.y<Math.max(RUL,y0)||m.y>y1)return null;
  const xl=X(b.t0)-PAD,xr=X(b.t1)+PAD;
  if(m.x>=xl-9&&m.x<=xl+2)return{b,side:'l'};
  if(m.x>=xr-2&&m.x<=xr+9)return{b,side:'r'};return null}
// тело рамки (между ручками растяжения): за него выделенные ключи можно перетаскивать по времени
function stBody(m){
  const b=stBox();if(!b)return false;
  const y0=Math.max(RUL,RUL+b.i0*RH-sy),y1=RUL+(b.i1+1)*RH-sy;
  return m.y>=y0&&m.y<=y1&&m.x>=X(b.t0)-PAD&&m.x<=X(b.t1)+PAD}
const TICKS=[[.01,2],[.02,2],[.05,5],[.1,2],[.2,4],[.25,5],[.5,5],[1,5],[2,4],[5,5],[10,5],[30,6],[60,6],[300,5]];
function shape(G,x,y,r,kind){G.beginPath();
  if(kind=='c')G.rect(x-r+1,y-r+1,2*r-2,2*r-2);else if(kind=='s')G.arc(x,y,r,0,7);
  else{G.moveTo(x,y-r-1);G.lineTo(x+r+1,y);G.lineTo(x,y+r+1);G.lineTo(x-r-1,y);G.closePath()}}
function tlDraw(){
  const w=tcv.clientWidth,h=tcv.clientHeight,d=devicePixelRatio||1;if(!w||!h)return;
  if(tcv.width!=w*d||tcv.height!=h*d){tcv.width=w*d;tcv.height=h*d}
  const G=tcv.getContext('2d'),c=cc();G.setTransform(d,0,0,d,0,0);G.fillStyle='#1b1b1b';G.fillRect(0,0,w,h);if(!c)return;autoLen(c);lenLbl();
  R.forEach((r,i)=>{const y=RUL+i*RH-sy;if(y+RH<RUL||y>h)return;
    G.fillStyle=r.g?'#101010':r.tr&&tsel.has(r.tr)?'#2c4a6e':i%2?'#2f2f2f':'#262626';G.fillRect(0,y,w,RH);G.fillStyle=r.g?'#000':'#1a1a1a';G.fillRect(0,y+RH-1,w,1)});
  const xe=X(c.len);if(xe<w){G.fillStyle='rgba(0,0,0,.45)';G.fillRect(Math.max(0,xe),RUL,w,h-RUL)}   // за последним ключом — затемнение
  const[st,sub]=TICKS.find(([s])=>s*tv.z>=70)||[600,6],t0=Math.floor(tv.o/st)*st,t1=tv.o+w/tv.z+st;
  for(let t=t0;t<=t1;t+=st){for(let j=1;j<sub;j++){G.fillStyle='#2b2b2b';G.fillRect(Math.round(X(t+st*j/sub)),RUL,1,h-RUL)}G.fillStyle='#404040';G.fillRect(Math.round(X(t)),RUL,1,h-RUL)}
  if(X(0)>0){G.fillStyle='#0c0c0c';G.fillRect(0,RUL,X(0),h-RUL);G.fillStyle='#555';G.fillRect(Math.round(X(0)),RUL,1,h-RUL)}   // слева от 0 времени нет
  G.fillStyle='#d0402a';G.fillRect(Math.round(xe),RUL,1,h-RUL);
  R.forEach((r,i)=>{const y=RUL+i*RH-sy+RH/2;if(y<RUL-RH/2||y>h+RH/2)return;
    if(r.tr)r.tr.keys.forEach(k=>{const on=ksel.has(k),x=X(k.t);shape(G,x,y,7,k.i);G.fillStyle=on?'#5aa0ff':'#d8d8d8';G.fill();G.lineWidth=1;G.strokeStyle='#000';G.stroke();keyGlyph(G,x,y,PI[r.tr.k]||'•',on)});
    else{grpTimes(r).forEach((e,t)=>{const x=X(t),w=pillW(e.gl.length),h=16,l=x-w/2,tp=y-h/2,rr=6;
      G.beginPath();G.moveTo(l+rr,tp);G.arcTo(l+w,tp,l+w,tp+h,rr);G.arcTo(l+w,tp+h,l,tp+h,rr);G.arcTo(l,tp+h,l,tp,rr);G.arcTo(l,tp,l+w,tp,rr);G.closePath();
      G.fillStyle=e.on?'#5aa0ff':'#9a9a9a';G.fill();G.lineWidth=1;G.strokeStyle='#000';G.stroke();
      e.gl.forEach((ch,j)=>keyGlyph(G,l+w/2+(j-(e.gl.length-1)/2)*11,y,ch,e.on))})}});
  const bx=stBox();
  if(bx){const xl=X(bx.t0)-PAD,xr=X(bx.t1)+PAD,y0=RUL+bx.i0*RH-sy,y1=RUL+(bx.i1+1)*RH-sy,hot=ed&&ed.t=='st';
    G.save();G.beginPath();G.rect(0,RUL,w,h-RUL);G.clip();
    G.fillStyle='rgba(90,160,255,.10)';G.fillRect(xl,y0,xr-xl,y1-y0);
    G.strokeStyle='rgba(90,160,255,.75)';G.lineWidth=1;G.strokeRect(xl+.5,y0+.5,xr-xl,y1-y0-1);
    G.fillStyle=hot?'#9fd0ff':'#5aa0ff';G.fillRect(xl-6,y0,6,y1-y0);G.fillRect(xr,y0,6,y1-y0);
    G.fillStyle='#1d3a5c';[[xl-4,0],[xl-2,0],[xr+2,0],[xr+4,0]].forEach(([gx])=>G.fillRect(gx,(y0+y1)/2-5,1,10));
    G.restore()}
  if(ed&&ed.t=='st'&&ed.moved){const txt='×'+(Math.round(ed.s*100)/100)+(ed.s<0?'  ⟲ реверс':''),tx=clamp(ed.mx+12,4,w-110),ty=clamp(ed.my-22,RUL+2,h-20);
    G.font='11px Segoe UI,sans-serif';G.textBaseline='top';G.textAlign='left';const tw=G.measureText(txt).width+10;
    G.fillStyle='#000c';G.fillRect(tx,ty,tw,17);G.fillStyle=ed.s<0?'#ffb060':'#fff';G.fillText(txt,tx+5,ty+3)}
  if(dz){const x=Math.round(X(dz.t))+.5;G.strokeStyle='#5aa0ff';G.lineWidth=1;G.setLineDash([4,3]);G.beginPath();G.moveTo(x,RUL);G.lineTo(x,h);G.stroke();G.setLineDash([]);
    if(dz.i>=0){const y=RUL+dz.i*RH-sy+RH/2;for(let j=0;j<dz.n;j++){shape(G,X(dz.t+j*dz.dt),y,5,'c');G.fillStyle='rgba(90,160,255,.75)';G.fill()}}}
  if(ed&&ed.t=='mq'){const x=Math.min(ed.x0,ed.x1),y=Math.min(ed.y0,ed.y1),ww=Math.abs(ed.x1-ed.x0),hh=Math.abs(ed.y1-ed.y0);
    G.fillStyle='rgba(90,160,255,.15)';G.fillRect(x,y,ww,hh);G.strokeStyle='#5aa0ff';G.lineWidth=1;G.strokeRect(x+.5,y+.5,ww,hh)}
  G.fillStyle='#191919';G.fillRect(0,0,w,RUL);G.fillStyle='#000';G.fillRect(0,RUL-1,w,1);
  if(X(0)>0){G.fillStyle='#0c0c0c';G.fillRect(0,0,X(0),RUL-1)}
  {const ex=Math.round(xe);if(ex>=0&&ex<w){G.fillStyle='#d0402a';G.fillRect(ex-1,RUL-5,3,4)}}
  G.font='11px Segoe UI,sans-serif';G.textBaseline='top';G.textAlign='left';
  for(let t=t0;t<=t1;t+=st){const x=Math.round(X(t))+.5;G.fillStyle='#888';G.fillRect(x-.5,12,1,RUL-13);G.fillStyle='#c8c8c8';G.fillText(String(Math.round(t*1000)/1000),x+3,4);
    for(let j=1;j<sub;j++){G.fillStyle='#666';G.fillRect(Math.round(X(t+st*j/sub)),RUL-7,1,6)}}
  const px=Math.round(X(tm))+.5;G.strokeStyle='#e44';G.lineWidth=1;G.beginPath();G.moveTo(px,0);G.lineTo(px,h);G.stroke();
  G.fillStyle='#e44';G.beginPath();G.moveTo(px-5,0);G.lineTo(px+6,0);G.lineTo(px+6,8);G.lineTo(px,13);G.lineTo(px-5,8);G.closePath();G.fill()}
const setX=x=>setTime(T(x));
function marq(){
  const x0=Math.min(ed.x0,ed.x1),x1=Math.max(ed.x0,ed.x1),y0=Math.min(ed.y0,ed.y1),y1=Math.max(ed.y0,ed.y1),s=new Set(ed.base);
  R.forEach((r,i)=>{const y=RUL+i*RH-sy;if(y+RH<y0||y>y1)return;const ks=r.tr?r.tr.keys:r.trs?r.trs.flatMap(t=>t.keys):[];ks.forEach(k=>{const x=X(k.t);if(x>=x0&&x<=x1)s.add(k)})});
  ksel=s}
tcv.addEventListener('mousedown',e=>{
  const m=mp(e),c=cc();
  if(e.button==1||(e.button==0&&e.altKey)){e.preventDefault();ed={t:'pan',x:e.clientX,y:e.clientY,o:tv.o,sy};return}
  if(e.button||!c)return;
  if(m.y<RUL){ed={t:'head'};setX(m.x);return}
  const sh=stHit(m);
  if(sh){const b=sh.b,l=sh.side=='l',piv=l?b.t1:b.t0,edge=l?b.t0:b.t1;
    const orig=[...ksel].map(k=>[k,k.t]),trs=c.tracks.filter(t=>t.keys.some(k=>ksel.has(k)));
    const tm_=trs.map(tr=>{const ks=tr.keys.filter(k=>ksel.has(k)).sort((a,b)=>a.t-b.t);return{ks,m:ks.map(k=>k.i)}});
    ed={t:'st',piv,edge,orig,trs,tm:tm_,s:1,moved:false,grab:m.x-X(edge),mx:m.x,my:m.y};
    tcv.style.cursor='ew-resize';tlDraw();return}
  const gh=grpHit(m.x,m.y);
  if(gh){
    const all=gh.keys.every(k=>ksel.has(k));
    if(e.shiftKey||e.ctrlKey){gh.keys.forEach(k=>all?ksel.delete(k):ksel.add(k))}else if(!all)ksel=new Set(gh.keys);
    if(gh.keys.some(k=>ksel.has(k))){const trs=c.tracks.filter(t=>t.keys.some(k=>ksel.has(k)));ed={t:'kd',x0:m.x,orig:[...ksel].map(k=>[k,k.t]),trs,moved:false}}
    tlDraw();return}
  const h=keyHit(m.x,m.y);
  if(h){
    if(e.shiftKey||e.ctrlKey){ksel.has(h.k)?ksel.delete(h.k):ksel.add(h.k)}else if(!ksel.has(h.k))ksel=new Set([h.k]);
    if(ksel.has(h.k)){const trs=c.tracks.filter(t=>t.keys.some(k=>ksel.has(k)));ed={t:'kd',x0:m.x,orig:[...ksel].map(k=>[k,k.t]),trs,moved:false}}
    tlDraw();return}
  if(!e.shiftKey&&!e.ctrlKey&&stBody(m)){          // клик внутри рамки — двигаем все выделенные ключи
    const trs=c.tracks.filter(t=>t.keys.some(k=>ksel.has(k)));
    ed={t:'kd',x0:m.x,orig:[...ksel].map(k=>[k,k.t]),trs,moved:false};tcv.style.cursor='move';tlDraw();return}
  const i=rowAt(m.y),add=e.shiftKey||e.ctrlKey;
  if(!add)ksel=new Set();
  if(i>=0&&R[i].tr){tsel=add?new Set([...tsel,R[i].tr]):new Set([R[i].tr])}else if(!add)tsel=new Set();
  paintRows();ed={t:'mq',x0:m.x,y0:m.y,x1:m.x,y1:m.y,base:new Set(ksel)};tlDraw()});
addEventListener('mousemove',e=>{
  if(!ed)return;const c=cc(),m=mp(e);
  if(ed.t=='pan'){tv.o=Math.max(0,ed.o-(e.clientX-ed.x)/tv.z);sy=clamp(ed.sy-(e.clientY-ed.y),0,maxSy());listScroll()}
  else if(ed.t=='head')setX(m.x);
  else if(ed.t=='kd'&&c){
    let dt=Math.round((m.x-ed.x0)/tv.z*c.fps)/c.fps;
    const mn=Math.min(...ed.orig.map(o=>o[1])),mx=Math.max(...ed.orig.map(o=>o[1]));dt=clamp(dt,-mn,MAXT-mx);
    ed.orig.forEach(([k,t])=>{k.t=Math.round((t+dt)*1e4)/1e4});ed.trs.forEach(t=>t.keys.sort((a,b)=>a.t-b.t));
    if(dt!=0)ed.moved=true;sampleClip();updVals()}
  else if(ed.t=='mq'){ed.x1=m.x;ed.y1=m.y;marq()}
  else if(ed.t=='st'&&c){
    ed.mx=m.x;ed.my=m.y;
    const T1=Math.round(T(m.x-ed.grab)*c.fps)/c.fps,d0=ed.edge-ed.piv;
    let s=(T1-ed.piv)/d0,lo=-1e9,hi=1e9;
    // ни один ключ не должен выйти за [0, MAXT] — ограничиваем масштаб (в обе стороны, вплоть до разворота)
    ed.orig.forEach(([,t])=>{const d=t-ed.piv;if(Math.abs(d)<1e-9)return;const a=(0-ed.piv)/d,b=(MAXT-ed.piv)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b))});
    s=clamp(s,lo,hi);ed.s=s;ed.moved=Math.abs(s-1)>1e-9;
    ed.orig.forEach(([k,t])=>{k.t=ed.moved?clamp(Math.round(Math.round((ed.piv+(t-ed.piv)*s)*c.fps)/c.fps*1e4)/1e4,0,MAXT):t});
    // при развороте порядок ключей меняется на обратный — режимы интерполяции сегментов переезжают вместе с ними
    ed.tm.forEach(({ks,m:md})=>{const n=ks.length;ks.forEach((k,j)=>{k.i=s<0&&n>1?(j==0?md[n-1]:md[j-1]):md[j]})});
    ed.trs.forEach(t=>t.keys.sort((a,b)=>a.t-b.t));sampleClip();updVals()}
  tlDraw()});
tcv.addEventListener('mousemove',e=>{if(ed)return;const c=cc(),m=mp(e);tcv.style.cursor=!c?'':stHit(m)?'ew-resize':(!keyHit(m.x,m.y)&&stBody(m))?'move':''});
addEventListener('mouseup',()=>{
  if(!ed)return;
  if((ed.t=='kd'||ed.t=='st')&&ed.moved){resolveDrops(ed.trs);sampleClip();updVals();rebuild()}
  if(ed.t=='st'||ed.t=='kd')tcv.style.cursor='';
  ed=null;tlDraw()});
tcv.addEventListener('wheel',e=>{
  e.preventDefault();const m=mp(e),dy=e.deltaY||e.deltaX;
  if(e.shiftKey){sy=clamp(sy+dy,0,maxSy());listScroll()}
  else{const t=T(m.x);tv.z=clamp(tv.z*(dy<0?1.2:1/1.2),10,3000);tv.o=Math.max(0,t-(m.x-PL)/tv.z)}
  tlDraw()},{passive:false});
tcv.addEventListener('dblclick',e=>{
  const c=cc();if(!c)return;const m=mp(e),i=rowAt(m.y);
  if(i<0||!R[i].tr||keyHit(m.x,m.y))return;addKeyAt(R[i].tr,snapT(clamp(T(m.x),0,MAXT),c))});
tcv.addEventListener('contextmenu',e=>{
  e.preventDefault();const c=cc();if(!c)return;const m=mp(e),h=keyHit(m.x,m.y);
  if(h){if(!ksel.has(h.k)){ksel=new Set([h.k]);tlDraw()}
    const setI=i=>()=>{ksel.forEach(k=>{k.i=i});tlDraw();sampleClip()};
    showMenu(e.clientX,e.clientY,[['Copy        Ctrl+C',copyKeys],['Cut         Ctrl+X',cutKeys],...(KCLIP?[['Paste       Ctrl+V',()=>pasteKeys()]]:[]),['Delete Key',delKeys],['Interpolation: Linear',setI('l')],['Interpolation: Smooth',setI('s')],['Interpolation: Constant (ступенька)',setI('c')]]);return}
  const i=rowAt(m.y);
  if(i>=0&&R[i].tr)showMenu(e.clientX,e.clientY,[['Add Key',()=>addKeyAt(R[i].tr,snapT(clamp(T(m.x),0,MAXT),c))],
    ...(ksel.size?[['Copy        Ctrl+C',copyKeys]]:[]),...(KCLIP?[['Paste here',()=>pasteKeys(T(m.x))],['Paste at cursor  Ctrl+V',()=>pasteKeys()]]:[])])});
document.addEventListener('mousedown',e=>{window.tlfocus=!!(e.target.closest&&e.target.closest('#anm'))},true);
addEventListener('keydown',e=>{
  if(window.amode!='clip'||!window.tlfocus||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  const c=cc();if(!c)return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&['KeyC','KeyX','KeyV'].includes(e.code)){e.preventDefault();e.code=='KeyC'?copyKeys():e.code=='KeyX'?cutKeys():pasteKeys();return}
  if(e.key=='Delete'||e.key=='Backspace'){e.preventDefault();delKeys()}
  else if(e.key=='ArrowLeft'){e.preventDefault();setTime(tm-1/c.fps)}
  else if(e.key=='ArrowRight'){e.preventDefault();setTime(tm+1/c.fps)}
  else if(e.code=='Space'){e.preventDefault();pvToggle()}});
split('#s5',e=>{const r=$('#sv').getBoundingClientRect();$('#sv').style.setProperty('--ah',clamp(r.bottom-e.clientY,180,r.height-90)+'px')});


/* =====================================================================
   SPRITES: спрайты из Project перетаскиваются прямо на таймлайн (покадрово, шаг — в панели клипа)
   ===================================================================== */
let dragSprites=null,projDrag=false,flashT=0;
const stepF=()=>clamp(Math.round(parseFloat($('#tr-step').value))||1,1,240);
function flash(msg){const h=$('#hint');h.textContent=msg;h.style.color='#e8a050';clearTimeout(flashT);
  flashT=setTimeout(()=>{h.style.color='#999';h.textContent=HINT[window.amode]||''},3500)}
// положить спрайты ключами на дорожку Sprite: по одному на каждые «шаг» кадров, начиная с t0
function putSprites(o,ids,t0){
  const c=cc();
  if(!c)return flash('Сначала создайте анимацию (выпадающий список → Create New Clip)');
  if(!ids||!ids.length)return flash('Нет спрайтов для вставки');
  if(!o)return flash('Выберите объект на сцене или в Hierarchy');
  if(o.grad||o.text)return flash('Спрайты можно вставлять только в объект с Image');
  const made=!o.img;if(made)o.img=newImg();
  let tr=c.tracks.find(t=>t.o==o.id&&t.k=='sprite');
  if(!tr){tr={o:o.id,k:'sprite',keys:[]};(c.tracks.push(tr),tcol.delete(tr.o))}
  const st=stepF(),dt=st/c.fps,ks=[];t0=snapT(clamp(t0,0,MAXT),c);
  ids.forEach((id,i)=>ks.push(setKey(tr,t0+i*dt,id)));
  if(ids.length>1)ks.push(setKey(tr,Math.round((t0+ids.length*dt)*1e4)/1e4,ids[ids.length-1]));   // закрывающий ключ: последний спрайт держится один шаг (длина клипа = последний ключ)
  ksel=new Set(ks);tsel=new Set([tr]);
  if(made)refresh();
  rebuild();setTime(t0);
  flash(`${ids.length} спр. → «${o.name}» с ${rd(t0)} с, шаг ${st} кадр.`)}
// перетаскивание прямо из Project (все выбранные спрайты) тоже принимается таймлайном
document.addEventListener('dragstart',e=>{projDrag=!!(e.target.closest&&e.target.closest('#pgrid .tile:not(.fol)'))},true);
document.addEventListener('dragend',()=>{dragSprites=null;projDrag=false;if(dz){dz=null;tlDraw()}});
const sprPayload=()=>dragSprites||(projDrag&&window.projSprites?projSprites():null);
const sprDrag=()=>window.amode=='clip'&&!!cc()&&!!(dragSprites||projDrag);
const dzSet=v=>{dz=v;tlDraw()};
const tlCv=$('#tl-cv'),tlLc=$('#tl-lc');
tlCv.addEventListener('dragover',e=>{
  if(!sprDrag())return;e.preventDefault();e.dataTransfer.dropEffect='copy';
  const c=cc(),m=mp(e),ids=sprPayload()||[];
  dzSet(ids.length?{t:snapT(clamp(T(m.x),0,MAXT),c),i:rowAt(m.y),n:ids.length,dt:stepF()/c.fps}:null)});
tlCv.addEventListener('dragleave',e=>{if(!tlCv.contains(e.relatedTarget))dzSet(null)});
tlCv.addEventListener('drop',e=>{
  if(!sprDrag())return;e.preventDefault();
  const m=mp(e),ids=sprPayload(),i=rowAt(m.y);dzSet(null);
  if(!ids||!ids.length)return;
  putSprites(i>=0?(R[i].tr?get(R[i].tr.o):R[i].g):get(sel),ids,T(m.x))});
tlLc.addEventListener('dragover',e=>{if(!sprDrag())return;e.preventDefault();e.dataTransfer.dropEffect='copy'});
tlLc.addEventListener('drop',e=>{
  if(!sprDrag())return;e.preventDefault();
  const ids=sprPayload();if(!ids||!ids.length)return;
  const r=e.target.closest&&e.target.closest('[data-ri],[data-og]');let o=get(sel);
  if(r)o=r.dataset.ri!==undefined?get(R[+r.dataset.ri].tr.o):get(+r.dataset.og);
  putSprites(o,ids,tm)});

// ---- вкладки Scene / Animator / Animation
const HINT={scene:'ПКМ — создать · колесо — зум · СКМ/Alt — пан · Shift при масштабе — пропорции',
  anim:'ПКМ — State / Transition · Alt+ЛКМ — пан · Delete — удалить',
  clip:'Колесо — зум · Shift+колесо — прокрутка · Alt/СКМ — пан · 2×клик — ключ · рамка: края — растянуть, тело — переместить · Ctrl+C/X/V — ключи · Del · Space · ←/→'};
function setTab(m){
  const prev=window.amode;if(m==prev)return;
  if(prev=='clip')pvStop();
  window.amode=m;
  document.querySelectorAll('.tb').forEach(x=>x.classList.toggle('on',x.dataset.tab==m));
  const a=m=='anim',k=m=='clip';
  $('#scn').style.display=a?'none':'';box.style.display=a?'':'none';
  $('#anm').style.display=k?'':'none';$('#s5').style.display=k?'':'none';
  $('#hint').textContent=HINT[m];
  if(k&&pl){pl=null;rp()}                       // контроллер и редактор клипа не работают одновременно
  if(a){const so=get(sel),k=so&&so.animator&&CTS.find(c=>c.id==so.animator.ctl);if(k&&k!==C){if(pl)stopPlay();C=k;sl=null}
    PV.x=cam.x;PV.y=cam.y;PV.z=Math.max(10,cam.z*.45);rp();dr();inspect()}
  else refresh();
  if(k)enterClip();
  maybeRestore()}
document.querySelectorAll('.tb').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
new ResizeObserver(dr).observe(box);
new ResizeObserver(()=>{if(window.amode=='clip'){sy=clamp(sy,0,maxSy());listScroll();tlDraw()}}).observe($('#tl-cv'));
function createClip(){const c=newClip();addClipState(c);if(window.amode=='clip')selectClip(c.id);return c}
function openClip(id){if(!clip(id))return;cur=id;const k=CTS.find(k=>ctlClips(k).includes(id));if(k&&k!==C){if(pl)stopPlay();C=k;sl=null}
  if(window.amode=='clip')selectClip(id,true);else{keepCur=true;setTab('clip')}}
const goneC=new Set(),goneK=new Set();   // что пользователь удалил сам (Undo/Redo не должен это воскрешать/сохранять)
function removeClip(id){const c=clip(id);if(!c)return;goneC.add(id);CTS.forEach(k=>k.st.forEach(s=>{if(s.clip==c.id)s.clip=null}));
  CL.splice(CL.indexOf(c),1);if(cur==id){pvStop();cur=CL.length?CL[0].id:null;if(window.amode=='clip')selectClip(cur);else{ksel=new Set();tsel=new Set()}}
  if(window.amode=='anim'){dr();ins_()}}
function removeCtl(id){if(CTS.length<2)return false;const k=CTS.find(c=>c.id==id);if(!k)return false;goneK.add(id);if(pl)stopPlay();
  CTS.splice(CTS.indexOf(k),1);if(C===k){C=CTS[0];sl=null}if(window.amode=='anim'){rp();dr();ins_()}return true}
// сериализация (проект на диске и Undo/Redo)
const jc=o=>JSON.parse(JSON.stringify(o));
function reloadUI(){
  const m=window.amode;
  if(m=='clip'){const c=cc();if(c){autoLen(c);tm=clamp(tm,0,MAXT)}ksel=new Set();tsel=new Set();ed=null;fillSel();rebuild();sampleClip()}
  else if(m=='anim'){rp();dr();ins_()}else rp()}
window.AnimIO={
  dump(){CL.forEach(autoLen);return{clips:CL.map(jc),ctls:CTS.map(k=>{const c=jc(k);c.pa.forEach(p=>{if(p.type=='Trigger')p.val=false});return c}),
    n:{ctlId,cid,nid},cur,curCtl:C?C.id:null}},
  load(d){
    pl=null;pvStop();restoreAll();
    CL.length=0;(d.clips||[]).forEach(c=>{const k=jc(c);autoLen(k);CL.push(k)});
    CTS.length=0;(d.ctls||[]).forEach(k=>CTS.push(jc(k)));
    ctlId=Math.max(ctlId,(d.n&&d.n.ctlId)||1,...CTS.map(k=>k.id+1));cid=Math.max(cid,(d.n&&d.n.cid)||1,...CL.map(c=>c.id+1));nid=Math.max(nid,(d.n&&d.n.nid)||1);
    if(!CTS.length)newCtl('Animator Controller');
    C=CTS.find(k=>k.id==d.curCtl)||CTS[0];
    sl=null;link=null;dg=null;ksel=new Set();tsel=new Set();ed=null;dz=null;
    cur=CL.some(c=>c.id==d.cur)?d.cur:(CL.length?CL[0].id:null);reloadUI()},
  reset(){this.load({clips:[],ctls:[],n:{},cur:null,curCtl:null})},
  // Undo/Redo: клипы и контроллеры (файлы анимаций) не пропадают от Ctrl+Z — те, что есть сейчас, но отсутствуют в снимке, дописываются в него
  // (кроме удалённых пользователем намеренно). Ключи внутри клипов откатываются как обычно. Возвращает число сохранённых.
  keep(a){if(!a)return 0;a.clips=a.clips||[];a.ctls=a.ctls||[];let n=0;
    CL.forEach(c=>{if(!goneC.has(c.id)&&!a.clips.some(x=>x.id==c.id)){a.clips.push(jc(c));n++}});
    CTS.forEach(k=>{if(!goneK.has(k.id)&&!a.ctls.some(x=>x.id==k.id)){const q=jc(k);q.pa.forEach(p=>{if(p.type=='Trigger')p.val=false});a.ctls.push(q);n++}});
    return n},
  stop(){if(pl)stopPlay();pvStop()}};
window.animData={get C(){return C},CTS,CL};   // доступ к данным аниматора (контроллеры + клипы)
window.setTab=setTab;window.animSync=syncIns;
window.AnimRT={ensureCtl,syncCtl,dupCtl,ctlOwner,ctls:CTS,clips:CL,base,newCtl,ctlOf:id=>CTS.find(k=>k.id==id),openCtl:useCtl,mk:rtMake,tick:rtTick,play:rtPlay,set:rtSet,restore:restoreAll,createClip,openClip,removeClip,removeCtl};
rp();tbar();
})();

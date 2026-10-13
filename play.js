/* Компоненты Button (Transition + On Click) и Animator (Controller) + режим Play */
(()=>{
const $=s=>document.querySelector(s),ins=$('#ins'),scn=$('#scn'),RT=()=>window.AnimRT;
let run=null;window.playing=false;
const mkBtn=()=>({interactable:true,trans:'sprite',hi:null,pr:null,dis:null,tint:{hi:'#f5f5f5',pr:'#c8c8c8',dis:'#c8c8c8'},onClick:[]});
window.mkBtn=mkBtn;
const spLabel=v=>{const a=v!=null&&ast(v);return a?esc(spName(a)):'None (Sprite)'};

/* ---------- методы, которые можно повесить на событие ---------- */
const NUM=(l,d,st)=>({t:'num',l,d:d||0,st:st||.1});
// позиция в МИРОВЫХ координатах: переводим в локальные относительно родителя (как transform.position в Unity)
const setWorld=(o,wx,wy)=>{const L=toLocal(o,wx,wy);o.x=rd(L.x);o.y=rd(L.y)};
const ctlOf=t=>t&&t.animator?RT().ctlOf(t.animator.ctl):null;
const stateNames=t=>{const c=ctlOf(t);return c?c.st.map(s=>s.name):[]};
const paramNames=(t,ty)=>{const c=ctlOf(t);return c?c.pa.filter(q=>q.type==ty).map(q=>q.name):[]};
function player(o){
  if(!run||o.active===false||!o.animator)return null;const ctl=ctlOf(o);if(!ctl)return null;
  let p=run.pl.get(o.id);if(!p||p.ctl!==ctl){p=RT().mk(ctl,o.id);run.pl.set(o.id,p)}return p}
const MTH=[
 {k:'go.active',g:'GameObject',n:'SetActive(bool)',a:[{t:'bool',l:'Active',d:true}],run:(o,a)=>{o.active=!!a[0]}},
 {k:'go.toggle',g:'GameObject',n:'Toggle Active()',a:[],run:o=>{o.active=o.active===false}},
 {k:'tf.setpos',g:'Transform',n:'Set Position(x, y) · World',a:[NUM('X'),NUM('Y')],run:(o,a)=>setWorld(o,+a[0]||0,+a[1]||0)},
 {k:'tf.move',g:'Transform',n:'Translate(dx, dy) · World',a:[NUM('dX'),NUM('dY')],run:(o,a)=>{const w=worldPos(o);setWorld(o,w.x+(+a[0]||0),w.y+(+a[1]||0))}},
 {k:'tf.setrot',g:'Transform',n:'Set Rotation(z)',a:[NUM('Z',0,1)],run:(o,a)=>{o.r=+a[0]||0}},
 {k:'tf.setrot3',g:'Transform',n:'Set Rotation(x, y, z)',a:[NUM('X',0,1),NUM('Y',0,1),NUM('Z',0,1)],run:(o,a)=>{o.rx=+a[0]||0;o.ry=+a[1]||0;o.r=+a[2]||0}},
 {k:'tf.rot3',g:'Transform',n:'Rotate(dx, dy, dz)',a:[NUM('dX',0,1),NUM('dY',0,1),NUM('dZ',0,1)],run:(o,a)=>{o.rx=rd((o.rx||0)+(+a[0]||0));o.ry=rd((o.ry||0)+(+a[1]||0));o.r=rd(o.r+(+a[2]||0))}},
 {k:'tf.rot',g:'Transform',n:'Rotate(dz)',a:[NUM('dZ',0,1)],run:(o,a)=>{o.r=rd(o.r+(+a[0]||0))}},
 {k:'tf.setscale',g:'Transform',n:'Set Scale(x, y)',a:[NUM('X',1),NUM('Y',1)],run:(o,a)=>{o.sx=+a[0]||0;o.sy=+a[1]||0}},
 {k:'img.color',g:'Image',n:'Set Color(color)',if:o=>!!o.img,a:[{t:'color',l:'Color',d:'#ffffff'}],run:(o,a)=>{o.img.color=a[0]||'#ffffff'}},
 {k:'img.alpha',g:'Image',n:'Set Alpha(a)',if:o=>!!o.img,a:[NUM('Alpha',1,.05)],run:(o,a)=>{o.img.alpha=Math.max(0,Math.min(1,+a[0]||0))}},
 {k:'img.sprite',g:'Image',n:'Set Sprite(sprite)',if:o=>!!o.img,a:[{t:'sprite',l:'Sprite',d:null}],run:(o,a)=>{o.img.sprite=a[0]==null?null:a[0]}},
 {k:'an.play',g:'Animator',n:'Play(state)',if:o=>!!o.animator,a:[{t:'state',l:'State'}],run:(o,a)=>{const p=player(o);if(p&&a[0])RT().play(p,a[0])}},
 {k:'an.trig',g:'Animator',n:'SetTrigger(name)',if:o=>!!o.animator,a:[{t:'param',pt:'Trigger',l:'Trigger'}],run:(o,a)=>{const p=player(o);if(p&&a[0])RT().set(p,a[0],true)}},
 {k:'an.bool',g:'Animator',n:'SetBool(name, value)',if:o=>!!o.animator,a:[{t:'param',pt:'Bool',l:'Bool'},{t:'bool',l:'Value',d:true}],run:(o,a)=>{const p=player(o);if(p&&a[0])RT().set(p,a[0],!!a[1])}},
 {k:'an.float',g:'Animator',n:'SetFloat(name, value)',if:o=>!!o.animator,a:[{t:'param',pt:'Float',l:'Float'},NUM('Value')],run:(o,a)=>{const p=player(o);if(p&&a[0])RT().set(p,a[0],a[1])}},
 {k:'an.int',g:'Animator',n:'SetInteger(name, value)',if:o=>!!o.animator,a:[{t:'param',pt:'Int',l:'Int'},NUM('Value',0,1)],run:(o,a)=>{const p=player(o);if(p&&a[0])RT().set(p,a[0],a[1])}},
 {k:'mc.open',g:'MenuController',n:'Open(index)',if:o=>!!o.menu,a:[NUM('Index',0,1)],run:(o,a)=>window.MenuCtl&&MenuCtl.open(o,+a[0]||0)},
 {k:'mc.close',g:'MenuController',n:'Close All()',if:o=>!!o.menu,a:[],run:o=>window.MenuCtl&&MenuCtl.close(o)},
 {k:'btn.inter',g:'Button',n:'Set Interactable(bool)',if:o=>!!o.btn,a:[{t:'bool',l:'Interactable',d:true}],run:(o,a)=>{o.btn.interactable=!!a[0]}}
];
const MD={};MTH.forEach(m=>MD[m.k]=m);
const defArgs=(m,t)=>m?m.a.map(s=>s.t=='state'?(stateNames(t)[0]||''):s.t=='param'?(paramNames(t,s.pt)[0]||''):s.d!==undefined?s.d:0):[];

/* ---------- Inspector ---------- */
const optsMethods=(E,t)=>{
  const av=t?MTH.filter(m=>!m.if||m.if(t)):[];let h='<option value="">No Function</option>';
  if(E.m&&!av.some(m=>m.k==E.m))h+=`<option value="${E.m}" selected>⚠ ${esc(MD[E.m]?MD[E.m].g+'.'+MD[E.m].n:E.m)} (недоступно)</option>`;
  [...new Set(av.map(m=>m.g))].forEach(g=>{h+=`<optgroup label="${g}">`+av.filter(m=>m.g==g).map(m=>`<option value="${m.k}" ${m.k==E.m?'selected':''}>${esc(m.n)}</option>`).join('')+'</optgroup>'});
  return h};
function argsHtml(E,i,t){
  const m=MD[E.m];if(!m||!t)return'';
  return m.a.map((s,j)=>{const v=E.a[j],id=i+'.'+j;let c;
    if(s.t=='bool')c=`<input type="checkbox" data-ar="${id}" ${v?'checked':''}>`;
    else if(s.t=='num')c=`<input type="number" step="${s.st}" data-ar="${id}" value="${v==null?0:v}">`;
    else if(s.t=='color')c=`<input type="color" data-ar="${id}" value="${v||'#ffffff'}">`;
    else if(s.t=='sprite')c=`<div class="slot" data-as="${id}">${spLabel(v)}</div>`;
    else{const L=s.t=='state'?stateNames(t):paramNames(t,s.pt);
      c=`<select class="wide" data-ar="${id}">${L.map(n=>`<option ${n==v?'selected':''}>${esc(n)}</option>`).join('')||'<option value="">(нет)</option>'}</select>`}
    return`<div class="r"><span class="l">${s.l||''}</span>${c}</div>`}).join('')}
function evHtml(E,i){
  const t=get(E.t);
  return`<div class="ev"><div class="r"><div class="slot" data-ot="${i}" title="Перетащите объект из Hierarchy, Shift+перетаскивание со сцены, ⌖ — выбрать кликом, клик — список">${t?esc(t.name):(E.t?'⚠ Missing':'None (Object)')}</div><button data-opick="${i}" title="Выбрать объект кликом по сцене или Hierarchy">⌖</button><button data-edel="${i}" title="Remove">✕</button></div>
<div class="r"><select class="wide" data-em="${i}">${optsMethods(E,t)}</select></div>${argsHtml(E,i,t)}</div>`}
function btnHtml(o){
  const b=o.btn,sl=(k,l)=>`<div class="r"><span class="l">${l}</span><div class="slot" data-bs="${k}">${spLabel(b[k])}</div></div>`,
    tc=(k,l)=>`<div class="r"><span class="l">${l}</span><input type="color" data-bt="${k}" value="${b.tint[k]}"></div>`;
  return`<div class="sec"><div class="sh">Button<button data-crm="btn" title="Remove Component">✕</button></div>
<div class="r"><span class="l">Interactable</span><input type="checkbox" data-bk="interactable" ${b.interactable===false?'':'checked'}></div>
<div class="r"><span class="l">Transition</span><select class="wide" data-bk="trans">${[['none','None'],['tint','Color Tint'],['sprite','Sprite Swap']].map(([v,n])=>`<option value="${v}" ${b.trans==v?'selected':''}>${n}</option>`).join('')}</select></div>
${b.trans=='sprite'?sl('hi','Highlighted')+sl('pr','Pressed')+sl('dis','Disabled'):b.trans=='tint'?tc('hi','Highlighted')+tc('pr','Pressed')+tc('dis','Disabled'):''}
<div class="sh" style="margin-top:8px">On Click ()<button data-eadd title="Add event">＋</button></div>
<div style="color:#888;font-size:11px;line-height:1.4;margin:-2px 0 4px">Объект: перетащите из Hierarchy, <b>Shift+перетаскивание</b> со сцены или ⌖ → клик по объекту</div>
${b.onClick.map(evHtml).join('')||'<div class="e" style="padding:2px 0">List is Empty</div>'}</div>`}
function animHtml(o){
  const A=o.animator;
  return`<div class="sec"><div class="sh">Animator<button data-crm="animator" title="Remove Component">✕</button></div>
<div class="r"><span class="l">Controller</span><span class="wide" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Контроллер объекта: имя берётся из имени объекта. Если у копии объекта он общий — правки анимаций видны всем, кто им пользуется">${esc((RT().ctlOf(A.ctl)||{name:o.name}).name)}${objs.filter(x=>x.animator&&x.animator.ctl==A.ctl).length>1?` <span style=\"color:#e0b040\">· shared ×${objs.filter(x=>x.animator&&x.animator.ctl==A.ctl).length}</span>`:''}</span></div>
<div class="r"><button data-aopen>Open in Animator</button><button data-adup title="Сделать для этого объекта свой контроллер: копия контроллера и всех его анимаций, правки пойдут только сюда">Duplicate as new controller</button></div></div>`}
window.compHtml=o=>(o.btn?btnHtml(o):'')+(o.animator?animHtml(o):'');
window.compMenu=o=>{const it=[];
  if(!o.btn)it.push(['UI / Button',()=>{if(!o.img&&!o.text&&!o.grad)o.img=newImg();o.btn=mkBtn();refresh()}]);
  if(!o.animator)it.push(['Animator',()=>{RT().ensureCtl(o);refresh()}]);
  return it};

/* ---------- события Inspector ---------- */
const sprMenu=(x,y,set)=>showMenu(x,y,[['None',()=>set(null)],...spriteList().map(a=>[spName(a),()=>set(a.id)])]);
ins.addEventListener('input',e=>{
  const t=e.target,d=t.dataset,o=get(sel);if(!o||!o.btn||t.tagName=='SELECT')return;
  if(d.bk=='interactable')o.btn.interactable=t.checked;
  else if(d.bt!==undefined)o.btn.tint[d.bt]=t.value;
  else if(d.ar!==undefined){const[i,j]=d.ar.split('.').map(Number),E=o.btn.onClick[i],s=E&&MD[E.m]&&MD[E.m].a[j];if(!s)return;
    E.a[j]=s.t=='bool'?t.checked:s.t=='num'?(parseFloat(t.value)||0):t.value}});
ins.addEventListener('change',e=>{
  const t=e.target,d=t.dataset,o=get(sel);if(!o)return;
  if(d.ctl!==undefined&&o.animator){if(t.value=='__new')o.animator.ctl=RT().newCtl().id;else o.animator.ctl=+t.value;inspect();return}
  if(!o.btn)return;
  if(d.bk=='trans'){o.btn.trans=t.value;inspect();return}
  if(d.et!==undefined){const E=o.btn.onClick[+d.et];E.t=t.value===''?null:+t.value;
    const m=MD[E.m],tg=get(E.t);if(!m||!tg||(m.if&&!m.if(tg)))E.m='';E.a=defArgs(MD[E.m],tg);inspect();return}
  if(d.em!==undefined){const E=o.btn.onClick[+d.em];E.m=t.value;E.a=defArgs(MD[E.m],get(E.t));inspect();return}
  if(d.ar!==undefined&&t.tagName=='SELECT'){const[i,j]=d.ar.split('.').map(Number);o.btn.onClick[i].a[j]=t.value}});
ins.addEventListener('click',e=>{
  const t=e.target,d=t.dataset,o=get(sel);if(!o)return;
  if(d.crm){delete o[d.crm];refresh();return}
  if(d.aopen!==undefined&&o.animator){RT().openCtl(o.animator.ctl);window.setTab('anim');return}
  if(d.adup!==undefined&&o.animator){RT().dupCtl(o);refresh();return}
  if(!o.btn)return;
  if(d.eadd!==undefined){o.btn.onClick.push({t:null,m:'',a:[]});inspect();return}
  if(d.edel!==undefined){o.btn.onClick.splice(+d.edel,1);inspect();return}
  const r=t.getBoundingClientRect();
  if(d.bs){sprMenu(r.left,r.bottom,v=>{o.btn[d.bs]=v;inspect()});return}
  if(d.as){const[i,j]=d.as.split('.').map(Number);sprMenu(r.left,r.bottom,v=>{o.btn.onClick[i].a[j]=v;inspect()})}});
// перетаскивание спрайта из Project прямо в слоты (как в Unity)
const isSlot=el=>el&&el.dataset&&(el.dataset.bs!==undefined||el.dataset.as!==undefined);
ins.addEventListener('dragover',e=>{if(isSlot(e.target)){e.preventDefault();e.target.classList.add('o')}});
ins.addEventListener('dragleave',e=>{if(isSlot(e.target))e.target.classList.remove('o')});
ins.addEventListener('drop',e=>{
  const t=e.target,o=get(sel);if(!isSlot(t)||!o||!o.btn)return;
  const id=e.dataTransfer.getData('text/plain');if(!id.startsWith('asset:'))return;
  e.preventDefault();t.classList.remove('o');const v=spr(+id.slice(6));
  if(t.dataset.bs)o.btn[t.dataset.bs]=v;else{const[i,j]=t.dataset.as.split('.').map(Number);o.btn.onClick[i].a[j]=v}
  inspect()});

/* ---------- выбор объекта-цели события: перетаскиванием / ⌖ / списком ---------- */
function setTarget(o,i,id){const E=o&&o.btn&&o.btn.onClick[i];if(!E)return;
  E.t=id==null?null:+id;const m=MD[E.m],tg=get(E.t);if(!m||!tg||(m.if&&!m.if(tg)))E.m='';E.a=defArgs(MD[E.m],tg);inspect()}
const isOt=el=>el&&el.dataset&&el.dataset.ot!==undefined;
ins.addEventListener('dragover',e=>{if(isOt(e.target)){e.preventDefault();e.target.classList.add('o')}});
ins.addEventListener('dragleave',e=>{if(isOt(e.target))e.target.classList.remove('o')});
ins.addEventListener('drop',e=>{const t=e.target,o=get(sel);if(!isOt(t)||!o||!o.btn)return;
  const id=e.dataTransfer.getData('text/plain');if(!id.startsWith('obj:'))return;
  e.preventDefault();setTarget(o,+t.dataset.ot,+id.slice(4))});
ins.addEventListener('click',e=>{const t=e.target,d=t.dataset,o=get(sel);if(!o||!o.btn)return;
  if(d.ot!==undefined){const r=t.getBoundingClientRect(),i=+d.ot;
    showMenu(r.left,r.bottom,[['None (Object)',()=>setTarget(o,i,null)],...objs.map(x=>[x.name,()=>setTarget(o,i,x.id)])])}
  else if(d.opick!==undefined){pickObj={oid:o.id,i:+d.opick};window.dragMark&&dragMark('obj');document.body.style.cursor='crosshair';
    $('#hint').textContent='Кликните по объекту на сцене или в Hierarchy · Esc — отмена'}});
let pickObj=null,refDrag=null,hintOld='';
const endPick=()=>{if(pickObj){pickObj=null;window.dragMark&&dragMark(null);document.body.style.cursor='';if(window.amode&&HINTS())$('#hint').textContent=HINTS()}};
window.pickRef=cb=>{pickObj={cb};window.dragMark&&dragMark('obj');document.body.style.cursor='crosshair';$('#hint').textContent='Кликните по объекту на сцене или в Hierarchy · Esc — отмена'};
const HINTS=()=>({scene:'ПКМ — создать · колесо — зум · СКМ/Alt — пан · Shift при масштабе — пропорции'})[window.amode||'scene']||'';
document.addEventListener('mousedown',e=>{
  if(window.playing||e.button)return;const cvEl=$('#cv');
  if(pickObj){                                     // режим ⌖: клик по сцене или Hierarchy
    let id=null;if(e.target===cvEl){const h=hit(toW(e));id=h?h.id:null}
    else{const it=e.target.closest&&e.target.closest('#hier .it');if(it)id=+it.dataset.id}
    const pk=pickObj;endPick();
    if(id!=null){e.stopPropagation();e.preventDefault();pk.cb?pk.cb(id):setTarget(get(pk.oid),pk.i,id)}return}
  // Shift+перетаскивание объекта со сцены в поле Inspector (объект не двигается и выделение не меняется)
  const s=get(sel);if(e.target!==cvEl||!e.shiftKey||e.altKey||!s||!(s.btn||s.menu))return;
  if(window.gizOver&&gizOver(e)>=0)return;
  const h=hit(toW(e));if(!h)return;e.stopPropagation();e.preventDefault();
  const chip=document.createElement('div');chip.textContent='⇢ '+h.name;
  chip.style.cssText='position:fixed;z-index:50;pointer-events:none;background:#2c5d87;color:#fff;padding:2px 8px;border-radius:3px;border:1px solid #111;box-shadow:0 2px 8px #000a';
  document.body.append(chip);refDrag={id:h.id,chip};window.dragMark&&dragMark('obj');document.body.style.cursor='copy';mvRef(e)},true);
function mvRef(e){if(!refDrag)return;refDrag.chip.style.left=e.clientX+12+'px';refDrag.chip.style.top=e.clientY+10+'px';
  ins.querySelectorAll('[data-ot].o,[data-mo].o').forEach(x=>x.classList.remove('o'));
  const el=document.elementFromPoint(e.clientX,e.clientY),sl=el&&el.closest&&el.closest('[data-ot],[data-mo]');if(sl)sl.classList.add('o')}
addEventListener('mousemove',mvRef);
addEventListener('mouseup',e=>{if(!refDrag)return;const r=refDrag;refDrag=null;window.dragMark&&dragMark(null);r.chip.remove();document.body.style.cursor='';
  ins.querySelectorAll('[data-ot].o,[data-mo].o').forEach(x=>x.classList.remove('o'));
  const el=document.elementFromPoint(e.clientX,e.clientY),sl=el&&el.closest&&el.closest('[data-ot],[data-mo]'),o=get(sel);
  if(!sl||!o)return;
  if(sl.dataset.mo!==undefined){if(o.menu&&window.menuSet)menuSet(o,sl.dataset.mo,r.id)}
  else if(o.btn)setTarget(o,+sl.dataset.ot,r.id)},true);
addEventListener('keydown',e=>{if(e.key=='Escape'&&pickObj){e.preventDefault();endPick()}});

/* ---------- Play ---------- */
const mulCol=(a,b)=>{const p=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16)),A=p(a),B=p(b);return'#'+A.map((v,i)=>Math.round(v*B[i]/255).toString(16).padStart(2,'0')).join('')};
window.btnView=o=>{
  const im=o.img||o.text,b=o.btn;if(!im||!b||!window.playing||!run||b.trans=='none')return im;
  const s=b.interactable===false?'dis':(run.down==o.id&&run.hover==o.id)?'pr':run.hover==o.id?'hi':'nm';
  if(s=='nm')return im;
  if(!o.img)return b.trans=='tint'?Object.assign({},im,{color:mulCol(im.color,b.tint[s]),alpha:s=='dis'?im.alpha*.5:im.alpha}):im;   // у Text — только Color Tint
  if(b.trans=='sprite')return ast(b[s])?Object.assign({},im,{sprite:b[s]}):im;
  return Object.assign({},im,{color:mulCol(im.color,b.tint[s]),alpha:s=='dis'?im.alpha*.5:im.alpha})};
function exec(E){
  const t=get(E.t),m=MD[E.m];if(!t||!m||(m.if&&!m.if(t)))return;
  try{m.run(t,E.a||[])}catch(err){console.warn('OnClick:',err)}}
const fire=o=>{if(run&&run.paused)return;if(!o.btn||o.btn.interactable===false)return;(o.btn.onClick||[]).slice().forEach(exec);window.MenuCtl&&MenuCtl.click(o)};
function rayHit(w){
  const L=order();
  for(let i=L.length-1;i>=0;i--){const{o,on,M}=L[i];if(!on||!(o.img||o.text||o.grad))continue;
    const I=invM(M);if(!I)continue;const p=apM(I,w.x,w.y),[sw,sh]=size(o,o.img?btnView(o):null);
    if(Math.abs(p.x)<=sw/2&&Math.abs(p.y)<=sh/2)return o}
  return null}
const handler=o=>{for(let q=o,n=0;q&&n<64;q=q.parent!=null?get(q.parent):null,n++)if(q.btn)return q;return null};   // кнопка = объект под курсором или ближайший родитель с Button
const live=o=>o&&o.btn&&o.btn.interactable!==false;
scn.addEventListener('mousedown',e=>{
  if(!window.playing||e.button==1||e.altKey)return;e.stopPropagation();if(e.button)return;
  const o=handler(rayHit(toW(e)));run.hover=o?o.id:null;run.down=live(o)?o.id:null},true);
scn.addEventListener('contextmenu',e=>{if(window.playing){e.stopPropagation();e.preventDefault()}},true);
scn.addEventListener('dragover',e=>{if(window.playing)e.stopPropagation()},true);
scn.addEventListener('drop',e=>{if(window.playing){e.stopPropagation();e.preventDefault()}},true);
scn.addEventListener('mousemove',e=>{
  if(!window.playing)return;const o=handler(rayHit(toW(e)));run.hover=o?o.id:null;$('#cv').style.cursor=live(o)?'pointer':''});
scn.addEventListener('mouseleave',()=>{if(window.playing)run.hover=null});
addEventListener('mouseup',()=>{
  if(!window.playing||!run||run.down==null)return;const id=run.down,o=get(id);run.down=null;
  if(o&&run.hover==id)fire(o)});
function frame(){
  if(!run)return;const now=performance.now();
  if(!run.paused){for(const{o,on}of order()){if(!on){run.pl.delete(o.id);continue}if(!o.animator)continue;const p=player(o);if(!p){run.pl.delete(o.id);continue}if(!RT().tick(p,now))run.pl.delete(o.id)}}
  drawNow();if(window.animSync)animSync();run.raf=requestAnimationFrame(frame)}
const pb=$('#play-btn'),pa=$('#pause-btn');
function start(){
  if(window.playing)return;
  if(window.amode!='scene')window.setTab('scene');
  RT().restore();
  run={snap:{objs:JSON.parse(JSON.stringify(objs)),sel},pl:new Map(),hover:null,down:null,raf:0,paused:false,hint:$('#hint').textContent};
  window.playing=true;pb.textContent='■ Stop';pb.classList.add('on');scn.classList.add('playing');pa.disabled=false;pa.classList.remove('on');
  $('#hint').textContent='PLAY — клики по кнопкам работают · Esc / Ctrl+P — стоп · изменения сбросятся после Stop';
  frame()}
function stop(){
  if(!window.playing||!run)return;cancelAnimationFrame(run.raf);RT().restore();
  objs=run.snap.objs;sel=run.snap.sel;$('#hint').textContent=run.hint;
  run=null;window.playing=false;pb.textContent='▶ Play';pb.classList.remove('on');scn.classList.remove('playing');pa.disabled=true;pa.classList.remove('on');pa.textContent='⏸';$('#cv').style.cursor='';
  refresh()}
pb.onclick=()=>window.playing?stop():start();
// пауза: время анимаций замирает и после продолжения идёт с того же места
function pause(){
  if(!run)return;
  if(run.paused){const d=performance.now()-run.pausedAt;run.pl.forEach(p=>{p.t0+=d;if(p.x)p.x.t0+=d});run.paused=false}
  else{run.paused=true;run.pausedAt=performance.now();run.down=null}
  pa.classList.toggle('on',run.paused);pa.textContent=run.paused?'▶▏':'⏸'}
pa.onclick=pause;
addEventListener('keydown',e=>{
  const sp=document.getElementById('sped'),hub=document.getElementById('hub');
  if(hub&&hub.style.display!='none')return;
  if(e.ctrlKey&&e.code=='KeyP'){e.preventDefault();window.playing?stop():start()}
  else if(e.key=='Escape'&&window.playing&&!(sp&&sp.style.display!='none')){e.preventDefault();stop()}});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.tb');if(window.playing&&b&&b.dataset.tab!='scene')stop()},true);
window.playMode={start,stop,pause,fire,exec,pl:()=>run?run.pl:null,editObjs:()=>run?run.snap.objs:null,isPaused:()=>!!(run&&run.paused)};
})();

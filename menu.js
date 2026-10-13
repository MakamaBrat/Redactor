/* MenuController — массив окон + массив кнопок.
   o.menu = {wins:[id|null,…], btns:[id|null,…]}  (btns всегда той же длины, что и wins)
   Open(i): все окна деактивируются, активируется wins[i]. Анимации окон (Animator у самого окна и у любых вложенных объектов)
   каждый раз стартуют заново: позы сбрасываются к исходным и плееры пересоздаются.
   Кнопка btns[i] по клику сама вызывает Open(i) (в Play и в экспортированной игре).
   Метод Open(index) / Close All() доступен и в On Click любой Button (группа MenuController). */
(()=>{
const $=s=>document.querySelector(s),ins=$('#ins'),RT=()=>window.AnimRT;
window.mkMenu=()=>({wins:[],btns:[]});

const norm=M=>{if(!Array.isArray(M.wins))M.wins=[];if(!Array.isArray(M.btns))M.btns=[];
  while(M.btns.length<M.wins.length)M.btns.push(null);M.btns.length=M.wins.length;return M};
const win=(M,i)=>{const id=M.wins[i];return id!=null?get(id):null};

/* ---------- Runtime ---------- */
// все объекты окон + их дети
function idsOf(M){const s=new Set();M.wins.forEach(id=>{if(get(id))subtree(id).forEach(x=>s.add(x.id))});return s}
// «как в первый раз»: исходные значения анимированных свойств + остановка Animator'ов
function reset(ids){
  const base=RT().base,pl=window.playMode&&playMode.pl&&playMode.pl();
  base.forEach((bv,key)=>{const i=key.indexOf('.'),oid=+key.slice(0,i);
    if(!ids.has(oid))return;const x=get(oid);if(x)pset(x,key.slice(i+1),bv);base.delete(key)});
  if(pl)ids.forEach(id=>pl.delete(id))}
function open(o,idx){
  const M=o&&o.menu;if(!M)return;norm(M);idx=Math.round(+idx);
  const t=win(M,idx);if(!t){console.warn('MenuController: нет окна с индексом',idx);return}
  reset(idsOf(M));
  M.wins.forEach(id=>{const w=get(id);if(w)w.active=false});
  t.active=true}
function close(o){
  const M=o&&o.menu;if(!M)return;norm(M);reset(idsOf(M));
  M.wins.forEach(id=>{const w=get(id);if(w)w.active=false})}
// клик по Button: если он в массиве кнопок какого-то MenuController — открыть соответствующее окно
function click(b){objs.forEach(m=>{const M=m.menu;if(!M)return;norm(M);M.btns.forEach((id,i)=>{if(id===b.id)open(m,i)})})}
window.MenuCtl={open,close,click};

/* ---------- Inspector ---------- */
const nm=id=>{const t=id!=null?get(id):null;return t?esc(t.name):(id!=null?'⚠ Missing':'None (Object)')};
const slot=(k,i,id)=>`<div class="slot" data-mo="${k}.${i}" title="Перетащите объект из Hierarchy, Shift+перетаскивание со сцены, ⌖ — выбрать кликом, клик — список">${nm(id)}</div><button data-mpick="${k}.${i}" title="Выбрать объект кликом по сцене или Hierarchy">⌖</button>`;
function menuHtml(o){
  const M=norm(o.menu),n=M.wins.length;
  return`<div class="sec"><div class="sh">MenuController<button data-crm="menu" title="Remove Component">✕</button></div>
<div class="r"><span class="l">Windows</span><input type="number" min="0" max="64" step="1" data-msize value="${n}" style="width:60px;flex:none"><button data-madd title="Add element">＋</button></div>
${M.wins.map((id,i)=>`<div class="r"><span class="l">Window ${i}</span>${slot('w',i,id)}<button data-mdel="${i}" title="Remove element (окно и его кнопка)">✕</button></div>`).join('')||'<div class="e" style="padding:2px 0">List is Empty</div>'}
${n?`<div class="sh" style="margin-top:8px">Buttons</div>
<div style="color:#888;font-size:11px;line-height:1.4;margin:-2px 0 4px">Кнопка №i открывает окно №i. Button-компонент добавится объекту автоматически.</div>
${M.btns.map((id,i)=>`<div class="r"><span class="l" title="Открывает: ${win(M,i)?esc(win(M,i).name):'—'}">Button ${i}</span>${slot('b',i,id)}</div>`).join('')}`:''}
<div class="e" style="padding:2px 0;color:#888">Open(i): все окна выключаются, включается окно i; анимации окна играются заново. Метод также есть в On Click любой кнопки: MenuController ▸ Open(index).</div></div>`}
const _ch=window.compHtml,_cm=window.compMenu;
window.compHtml=o=>(o.menu?menuHtml(o):'')+(_ch?_ch(o):'');
window.compMenu=o=>{const it=_cm?_cm(o):[];if(!o.menu)it.push(['MenuController',()=>{o.menu=mkMenu();refresh()}]);return it};

/* ---------- запись объекта в слот ---------- */
window.menuSet=(o,spec,id)=>{
  const M=o&&o.menu;if(!M)return;norm(M);const[k,s]=String(spec).split('.'),i=+s,arr=k=='w'?M.wins:M.btns;
  if(!(i>=0&&i<arr.length))return;id=id==null?null:+id;arr[i]=id;
  const t=id!=null?get(id):null;
  if(k=='b'&&t&&!t.btn&&window.mkBtn)t.btn=mkBtn();           // кнопке нужен Button, иначе клик не ловится
  refresh()};

/* ---------- события Inspector ---------- */
ins.addEventListener('change',e=>{const t=e.target,o=get(sel);if(!o||!o.menu||t.dataset.msize===undefined)return;
  const M=norm(o.menu),n=Math.max(0,Math.min(64,Math.round(+t.value)||0));
  while(M.wins.length<n)M.wins.push(null);M.wins.length=n;norm(M);inspect()});
ins.addEventListener('click',e=>{const t=e.target,d=t.dataset,o=get(sel);if(!o||!o.menu||!d)return;const M=norm(o.menu);
  if(d.madd!==undefined){if(M.wins.length<64){M.wins.push(null);norm(M)}inspect();return}
  if(d.mdel!==undefined){const i=+d.mdel;M.wins.splice(i,1);M.btns.splice(i,1);inspect();return}
  if(d.mo!==undefined){const r=t.getBoundingClientRect(),spec=d.mo;
    showMenu(r.left,r.bottom,[['None (Object)',()=>menuSet(o,spec,null)],...objs.map(x=>[x.name,()=>menuSet(o,spec,x.id)])]);return}
  if(d.mpick!==undefined&&window.pickRef){const spec=d.mpick,oid=o.id;pickRef(id=>menuSet(get(oid),spec,id))}});
const isMo=el=>el&&el.dataset&&el.dataset.mo!==undefined;
ins.addEventListener('dragover',e=>{if(isMo(e.target)){e.preventDefault();e.target.classList.add('o')}});
ins.addEventListener('dragleave',e=>{if(isMo(e.target))e.target.classList.remove('o')});
ins.addEventListener('drop',e=>{const t=e.target,o=get(sel);if(!isMo(t)||!o||!o.menu)return;
  const id=e.dataTransfer.getData('text/plain');if(!id.startsWith('obj:'))return;
  e.preventDefault();t.classList.remove('o');menuSet(o,t.dataset.mo,+id.slice(4))});
})();

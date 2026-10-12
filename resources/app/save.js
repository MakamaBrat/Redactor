/* Проект на диске, Undo/Redo, стартовый экран (Hub), меню File/Edit, горячие клавиши */
(()=>{
const $=s=>document.querySelector(s),N=()=>window.native;
const FORMAT='unity2d-project',VER=1,PROJ='project.u2d.json';
const urlById=new Map();                     // id ассета -> dataURL (картинки неизменны, поэтому снимки Undo хранят только метаданные)
let P=null;                                  // открытый проект: {dir,name}
let stack=[],idx=-1,savedSig=null,restoring=false,down=false,lastInput=0,busy=false;
let dirty=false,loading=false;

/* ============================ утилиты ============================ */
const jc=o=>JSON.parse(JSON.stringify(o));
const safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'_').replace(/[. ]+$/,'')||'_';
const extOf=url=>{const m=/^data:image\/([a-z0-9+.-]+)/i.exec(url||'');const t=m?m[1].toLowerCase():'png';return t=='jpeg'?'jpg':t=='svg+xml'?'svg':t};
const mimeOf=ext=>({otf:'font/otf',ttf:'font/ttf',woff:'font/woff',woff2:'font/woff2',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',bmp:'image/bmp'})[ext]||'image/png';
const b64of=url=>url.slice(url.indexOf(',')+1);
const loadImg=url=>new Promise(r=>{if(imgCache.has(url))return r(imgCache.get(url));const i=new Image();i.onload=()=>{imgCache.set(url,i);r(i)};i.onerror=()=>r(null);i.src=url});
let toastT=0;
function toast(msg,err){const t=$('#toast');t.textContent=msg;t.className=err?'err show':'show';clearTimeout(toastT);toastT=setTimeout(()=>{t.className=err?'err':''},err?5000:1800)}

/* ============================ состояние ============================ */
// Единое описание проекта; одно и то же идёт и в историю, и на диск.
// Во время скраббинга/записи анимации объекты временно «позированы» — в состояние берутся исходные значения (base).
function editObjs(){const p=window.playMode&&playMode.editObjs();return p||objs}
function collect(){
  const base=AnimRT.base,src=editObjs(),inPlay=src!==objs;
  const list=src.map(o=>{const c=JSON.parse(JSON.stringify(o));
    if(!inPlay)base.forEach((v,key)=>{const i=key.indexOf('.');if(+key.slice(0,i)!=o.id)return;const k=key.slice(i+1);
      if(k=='sprite'){if(c.img)c.img.sprite=v}else if(k=='color'||k=='alpha'){const im=c.img||c.text||c.grad;if(im)im[k]=v}else c[k]=v});
    return c});
  assets.forEach(a=>urlById.set(a.id,a.url));
  return{objs:list,proj:ProjIO.dump(),anim:AnimIO.dump(),cam:{x:cam.x,y:cam.y,z:cam.z},n:{nid,aid}}}
const sigOf=S=>{const c={objs:S.objs,proj:S.proj,anim:S.anim};return JSON.stringify(c)};

/* ============================ Undo / Redo ============================ */
function setDirty(v){
  if(v===dirty)return;dirty=v;paintTitle();if(N())N().setDirty(v)}
function paintTitle(){
  const nm=P?P.name:'';document.title=(P?nm+(dirty?' *':'')+' — ':'')+'Unity 2D Editor';
  $('#pname').textContent=P?nm+(dirty?' ●':''):'';$('#pname').title=P?P.dir||'':'';
  $('#msave').classList.toggle('dirty',dirty)}
function initHistory(){
  const S=collect(),sg=sigOf(S);stack=[sg];idx=0;savedSig=sg;dirty=false;paintTitle();if(N())N().setDirty(false)}
function check(force){
  if(!P||loading||restoring||window.playing||(down&&!force))return;
  if(!force&&Date.now()-lastInput<450)return;           // пока человек печатает — ждём паузы
  if($('#sped')&&$('#sped').style.display!='none')return;   // Sprite Editor работает со своей копией
  const sg=sigOf(collect());
  if(sg!==stack[idx]){stack.length=idx+1;stack.push(sg);let sz=0;for(const q of stack)sz+=q.length;while(stack.length>20&&(stack.length>200||sz>60e6)){sz-=stack.shift().length}idx=stack.length-1}
  setDirty(sg!==savedSig)}
function apply(sg){
  const d=JSON.parse(sg);restoring=true;
  try{
    AnimIO.stop();AnimRT.restore();
    const old=sel;
    objs=d.objs;
    ProjIO.load(d.proj,id=>urlById.get(id));
    AnimIO.load(d.anim);
    nid=Math.max(nid,...objs.map(o=>o.id+1),1);
    sel=objs.some(o=>o.id==old)?old:null;
    refresh();ProjIO.rerender();
  }finally{restoring=false}
  setDirty(sg!==savedSig)}
function undo(){
  if(!P||window.playing)return;check(true);
  if(idx>0){idx--;apply(stack[idx]);toast('Undo')}else toast('Нечего отменять')}
function redo(){
  if(!P||window.playing)return;check(true);
  if(idx<stack.length-1){idx++;apply(stack[idx]);toast('Redo')}else toast('Нечего возвращать')}

/* ----- когда проверять изменения ----- */
addEventListener('mousedown',()=>{check(true);down=true},true);   // новый жест начинается с фиксации предыдущего изменения
addEventListener('blur',()=>{down=false});
addEventListener('mouseup',()=>{down=false;setTimeout(()=>check(),0)},true);
addEventListener('dragend',()=>{down=false;setTimeout(()=>check(),30)},true);
['change','click','drop','contextmenu'].forEach(ev=>addEventListener(ev,()=>setTimeout(()=>check(),0)));
addEventListener('keyup',()=>setTimeout(()=>check(),0),true);
addEventListener('input',()=>{lastInput=Date.now()},true);
let lastAct=Date.now();['mousedown','keydown','input','change','drop','wheel'].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now()},true));
setInterval(()=>{if(document.hidden||Date.now()-lastAct>8000)return;check()},500);   // не гоняем сериализацию сцены в простое                          // асинхронные операции (импорт, нарезка и т.п.)

/* ============================ сохранение ============================ */
// файловая раскладка:
//   project.u2d.json          — метаданные проекта (папки, ассеты, счётчики, камера)
//   Scenes/Main.scene.json    — объекты сцены
//   Animations/*.anim.json    — клипы;  Animations/*.controller.json — Animator Controller'ы
//   Assets/<папки>/*.png      — текстуры (структура папок как в Project)
function toFiles(S){
  const files=[],used=new Set();
  const uniqRel=(rel)=>{let r=rel,i=1;const m=/^(.*?)(\.[^.\/]+(?:\.json)?)$/.exec(rel);
    while(used.has(r.toLowerCase())){r=m?m[1]+'_'+(++i)+m[2]:rel+'_'+(++i)}used.add(r.toLowerCase());return r};
  const fol=id=>S.proj.folders.find(f=>f.id==id);
  const pathOf=id=>{const p=[];for(let x=id,g=0;x!=null&&g<64;g++){const f=fol(x);if(!f)break;if(f.parent!=null)p.unshift(safe(f.name));x=f.parent}return p.join('/')};
  const assetsMeta=S.proj.assets.map(a=>{
    if(a.parent)return a;
    const url=urlById.get(a.id);if(!url)return a;
    const ext=a.font?(a.ext||'otf'):extOf(url),dir=pathOf(a.folder),rel=uniqRel('Assets/'+(dir?dir+'/':'')+safe(a.name)+'.'+ext);
    files.push({rel,b64:b64of(url)});return{...a,file:rel}});
  const scene=uniqRel('Scenes/Main.scene.json');
  files.push({rel:scene,text:JSON.stringify({objects:S.objs},null,1)});
  const clips=S.anim.clips.map(c=>{const rel=uniqRel('Animations/'+safe(c.name)+'.anim.json');files.push({rel,text:JSON.stringify(c,null,1)});return rel});
  const ctls=S.anim.ctls.map(k=>{const rel=uniqRel('Animations/'+safe(k.name)+'.controller.json');files.push({rel,text:JSON.stringify(k,null,1)});return rel});
  const meta={format:FORMAT,version:VER,name:P.name,saved:new Date().toISOString(),
    counters:S.n,proj:{fid:S.proj.fid,folders:S.proj.folders,assets:assetsMeta},
    scene,anim:{n:S.anim.n,cur:S.anim.cur,curCtl:S.anim.curCtl,clips,ctls},
    view:{cam:S.cam,sel:sel,folder:ProjIO.cur?ProjIO.cur():0}};
  files.push({rel:PROJ,text:JSON.stringify(meta,null,1)});
  return files}
async function saveAll(){
  if(!P)return false;
  if(!N()){toast('Сохранение на диск работает только в приложении (Electron)',true);return false}
  if(busy)return false;busy=true;
  try{
    check(true);
    const S=collect(),files=toFiles(S),r=await N().saveProject({dir:P.dir,files});
    if(r&&r.error){toast('Не удалось сохранить: '+r.error,true);return false}
    savedSig=sigOf(S);if(stack[idx]!==savedSig){/* состояние изменилось во время записи */}
    setDirty(sigOf(collect())!==savedSig);
    await N().recent.add(P.dir,P.name);
    toast('Проект сохранён: '+P.name);return true
  }catch(e){toast('Ошибка сохранения: '+(e.message||e),true);return false}
  finally{busy=false}}
async function saveAs(){
  if(!P||!N())return;
  const parent=await N().pickDir({title:'Сохранить копию проекта в папку…'});if(!parent)return;
  const name=await ask('Save Project As','Имя нового проекта',P.name+' Copy');if(!name)return;
  const r=await N().createProject({parent,name});if(r.error){toast(r.error,true);return}
  const old=P;P={dir:r.dir,name:r.name};
  if(!await saveAll()){P=old;paintTitle();return}
  paintTitle()}

/* ============================ загрузка ============================ */
function resetWorld(){
  if(window.playing)playMode.stop();
  if(window.amode!='scene')window.setTab('scene');
  urlById.clear();
  AnimIO.stop();AnimRT.restore();
  objs=[];sel=null;nid=1;aid=1;
  for(const k in tc)delete tc[k];
  ProjIO.reset();AnimIO.reset();
  cam.x=0;cam.y=0;cam.z=100}
async function newProject(dir,name){
  loading=true;
  try{
    resetWorld();P={dir,name};
    await ProjIO.seed();
    refresh();ProjIO.rerender();
    initHistory();hideHub()
  }finally{loading=false}
  if(dir&&N())await saveAll()}
async function openProject(dir){
  if(!N())return;
  const r=await N().readProject(dir);
  if(r.error){toast('Не удалось открыть: '+r.error,true);return false}
  let m;try{m=typeof r.meta=='string'?JSON.parse(r.meta):r.meta}catch(e){toast('Повреждён '+PROJ,true);return false}
  if(m.format!=FORMAT){toast('Это не проект Unity 2D Editor',true);return false}
  const F=r.files||{},J=rel=>{try{return F[rel]&&F[rel].text?JSON.parse(F[rel].text):null}catch(e){return null}};
  // картинки
  const urls=new Map(),warns=[];
  for(const a of m.proj.assets){
    if(a.parent||!a.file)continue;const f=F[a.file];
    if(!f||!f.b64){warns.push(a.name);continue}
    const url='data:'+mimeOf(a.file.split('.').pop().toLowerCase())+';base64,'+f.b64;
    if(a.font){if(!await loadFont(url)){warns.push(a.name);continue}}
    else if(!await loadImg(url)){warns.push(a.name);continue}
    urls.set(a.id,url);urlById.set(a.id,url)}
  m.proj.assets=m.proj.assets.filter(a=>a.parent||urls.has(a.id));
  const scene=J(m.scene)||{objects:[]};
  const clips=m.anim.clips.map(J).filter(Boolean),ctls=m.anim.ctls.map(J).filter(Boolean);
  loading=true;
  try{
  resetWorld();P={dir,name:m.name||dir.split(/[\\/]/).pop()};
  urls.forEach((u,id)=>urlById.set(id,u));
  ProjIO.load(m.proj,id=>urls.get(id));
  AnimIO.load({clips,ctls,n:m.anim.n,cur:m.anim.cur,curCtl:m.anim.curCtl});
  objs=scene.objects||[];
  nid=Math.max((m.counters&&m.counters.nid)||1,...objs.map(o=>o.id+1),1);
  aid=Math.max(aid,(m.counters&&m.counters.aid)||1);
  if(m.view){if(m.view.cam)Object.assign(cam,m.view.cam);sel=objs.some(o=>o.id==m.view.sel)?m.view.sel:null}
  if(window.amode!='scene')setTab('scene');
  refresh();ProjIO.rerender();
  initHistory();hideHub();
  }finally{loading=false}
  await N().recent.add(dir,P.name);
  toast(warns.length?'Проект открыт, но не найдены текстуры: '+warns.join(', '):'Проект открыт: '+P.name,!!warns.length);
  return true}

/* ============================ окна ============================ */
// простой модальный ввод текста
function ask(title,label,def){
  return new Promise(res=>{
    const d=$('#dlg');d.innerHTML=`<div class="dbox"><div class="dh">${esc(title)}</div><div class="db"><label>${esc(label)}</label><input type="text" id="dlg-in" value="${esc(def||'')}"></div><div class="df"><button id="dlg-ok">OK</button><button id="dlg-no">Отмена</button></div></div>`;
    d.style.display='flex';const i=$('#dlg-in');i.focus();i.select();
    const fin=v=>{d.style.display='none';d.innerHTML='';res(v)};
    $('#dlg-ok').onclick=()=>fin(i.value.trim());$('#dlg-no').onclick=()=>fin(null);
    i.onkeydown=e=>{e.stopPropagation();if(e.key=='Enter')fin(i.value.trim());if(e.key=='Escape')fin(null)}})}
// Сохранить / Не сохранять / Отмена
function confirmSave(msg){
  return new Promise(res=>{
    const d=$('#dlg');d.innerHTML=`<div class="dbox"><div class="dh">Несохранённые изменения</div><div class="db">${esc(msg)}</div><div class="df"><button id="cs-y" class="pri">Сохранить</button><button id="cs-n">Не сохранять</button><button id="cs-c">Отмена</button></div></div>`;
    d.style.display='flex';$('#cs-y').focus();
    const fin=v=>{d.style.display='none';d.innerHTML='';res(v)};
    $('#cs-y').onclick=()=>fin('save');$('#cs-n').onclick=()=>fin('no');$('#cs-c').onclick=()=>fin(null)})}
// можно ли покинуть текущий проект
async function leave(){
  check(true);
  if(!P||!dirty)return true;
  const r=await confirmSave(`В проекте «${P.name}» есть несохранённые изменения. Сохранить?`);
  if(r===null)return false;
  if(r=='save')return await saveAll();
  return true}

/* ----- стартовый экран ----- */
const fmtDate=t=>{const d=new Date(t),p=n=>String(n).padStart(2,'0');return`${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`};
async function showHub(){
  const hub=$('#hub');hub.style.display='flex';
  let recent=[];try{if(N())recent=await N().recent.get()}catch(e){}
  hub.innerHTML=`<div class="hw"><div class="hl"><div class="logo">Unity <b>2D</b> Editor</div>
<div class="hbtn-col"><button class="hbtn pri" id="h-new">＋ New Project</button><button class="hbtn" id="h-open">📂 Open Project…</button>${P?'<button class="hbtn" id="h-back">↩ Назад в «'+esc(P.name)+'»</button>':''}</div>
${N()?'':'<div class="hwarn">Запущено без Electron: проекты нельзя сохранять на диск.<br><button id="h-try">Продолжить без диска (песочница)</button></div>'}</div>
<div class="hr"><div class="hh">Recent projects</div><div id="h-list">${recent.length?recent.map((r,i)=>`<div class="hrec" data-i="${i}"><div class="hn">${esc(r.name)}</div><div class="hp">${esc(r.dir)}</div><div class="hd">${fmtDate(r.time)}</div><button class="hx" data-x="${i}" title="Убрать из списка">✕</button></div>`).join(''):'<div class="e">Пока нет недавних проектов. Создайте новый или откройте существующий.</div>'}</div></div></div>`;
  hub._recent=recent;
  const nb=$('#h-new'),ob=$('#h-open');
  nb.onclick=newDialog;
  ob.onclick=async()=>{if(!N())return;const d=await N().pickDir({title:'Выберите папку проекта (где лежит '+PROJ+')'});if(d&&await leave())await openProject(d)};
  const bk=$('#h-back');if(bk)bk.onclick=hideHub;
  const tr=$('#h-try');if(tr)tr.onclick=async()=>{if(!await leave())return;await newProject(null,'Sandbox')};
  $('#h-list').onclick=async e=>{
    const x=e.target.closest('[data-x]');
    if(x){e.stopPropagation();await N().recent.remove(recent[+x.dataset.x].dir);showHub();return}
    const it=e.target.closest('.hrec');if(!it)return;
    const r=recent[+it.dataset.i];if(P&&P.dir===r.dir){hideHub();return}
    if(await leave())await openProject(r.dir)}}
function hideHub(){const h=$('#hub');h.style.display='none';h.innerHTML=''}
async function newDialog(){
  if(!N())return;
  const def=(await N().defaults()).projects;
  const d=$('#dlg');
  d.innerHTML=`<div class="dbox wide"><div class="dh">New Project</div><div class="db">
<div class="r"><span class="l">Project name</span><input type="text" id="np-name" value="My 2D Project"></div>
<div class="r"><span class="l">Location</span><input type="text" id="np-dir" value="${esc(def)}"><button id="np-br">Browse…</button></div>
<div class="hint" id="np-path"></div><div class="np-err" id="np-err"></div></div>
<div class="df"><button id="np-ok" class="pri">Create project</button><button id="np-no">Отмена</button></div></div>`;
  d.style.display='flex';const nm=$('#np-name'),di=$('#np-dir');nm.focus();nm.select();
  const upd=()=>{$('#np-path').textContent='Будет создана папка: '+di.value.replace(/[\\/]+$/,'')+'\\'+nm.value.trim()};
  nm.oninput=di.oninput=upd;upd();
  const close=()=>{d.style.display='none';d.innerHTML=''};
  $('#np-br').onclick=async()=>{const p=await N().pickDir({title:'Папка для нового проекта',defaultPath:di.value});if(p){di.value=p;upd()}};
  $('#np-no').onclick=close;
  const go=async()=>{
    $('#np-err').textContent='';
    const parent=di.value.trim(),name=nm.value.trim();
    if(!await leave())return;
    const r=await N().createProject({parent,name});
    if(r.error){$('#np-err').textContent=r.error;return}
    close();await newProject(r.dir,r.name)};
  $('#np-ok').onclick=go;
  d.onkeydown=e=>{if(e.key=='Enter'&&e.target.tagName=='INPUT')go();if(e.key=='Escape')close()}}

/* ============================ меню File / Edit ============================ */
function menuAt(btn,items){const r=btn.getBoundingClientRect();showMenu(r.left,r.bottom,items)}
async function recentMenu(btn){
  let rec=[];try{if(N())rec=await N().recent.get()}catch(e){}
  const its=rec.filter(r=>!P||r.dir!==P.dir).slice(0,10).map(r=>[r.name+'   —   '+r.dir,async()=>{if(await leave())await openProject(r.dir)}]);
  menuAt(btn,its.length?its:[['(список пуст)',()=>{}]])}
document.querySelectorAll('#mbar .mb').forEach(b=>b.onclick=()=>{
  const m=b.dataset.m;
  if(m=='file')menuAt(b,[
    ['New Project…',async()=>{showHub();setTimeout(newDialog,0)}],
    ['Open Project…',async()=>{if(!N())return;const d=await N().pickDir({title:'Выберите папку проекта'});if(d&&await leave())await openProject(d)}],
    ['Open Recent ▸',()=>setTimeout(()=>recentMenu(b),0)],
    ['Save All            Ctrl+S',saveAll],
    ['Save Project As…',saveAs],
    ['Export  Web (Vercel)...',()=>window.Exporter&&Exporter.open()],
    ['Show in Explorer',()=>{if(P&&P.dir&&N())N().reveal(P.dir)}],
    ['Start Screen / Recent Projects…',showHub]]);
  else menuAt(b,[['Undo            Ctrl+Z',undo],['Redo            Ctrl+Y',redo]])});
$('#msave').onclick=saveAll;

/* ============================ горячие клавиши ============================ */
// в поле ввода с несохранённым вводом Ctrl+Z работает как обычная отмена текста
const inField=el=>el&&/^(INPUT|TEXTAREA)$/.test(el.tagName)&&!/^(checkbox|radio|range|color|button)$/.test(el.type||'');
let focusVal=null;
addEventListener('focusin',e=>{if(inField(e.target))focusVal=e.target.value},true);
addEventListener('change',e=>{if(inField(e.target))focusVal=e.target.value},true);
addEventListener('keydown',e=>{
  if($('#hub').style.display!='none'||$('#dlg').style.display!='none')return;
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
  const k=e.code;
  if(k=='KeyS'){e.preventDefault();e.stopPropagation();e.shiftKey?saveAs():saveAll();return}
  if(k!='KeyZ'&&k!='KeyY')return;
  const sp=$('#sped');if(sp&&sp.style.display!='none')return;                 // в Sprite Editor — свои правила
  const el=document.activeElement;
  if(inField(el)&&el.value!==focusVal)return;                                   // правится текст — не мешаем
  e.preventDefault();e.stopPropagation();
  if(inField(el)&&el.type!='text')el.blur();
  if(k=='KeyY'||(k=='KeyZ'&&e.shiftKey))redo();else undo()},true);

/* ============================ закрытие окна ============================ */
if(N())N().onAskClose(async()=>{if(await leave())N().closeNow()});
addEventListener('beforeunload',e=>{if(dirty&&!N()){e.preventDefault();e.returnValue=''}});

/* ============================ старт ============================ */
window.Project={save:saveAll,undo,redo,check:()=>check(true),get dirty(){return dirty},get info(){return P},
  _open:openProject,_new:newProject,_hub:showHub,_collect:collect,_stack:()=>({n:stack.length,i:idx})};
paintTitle();showHub();
})();

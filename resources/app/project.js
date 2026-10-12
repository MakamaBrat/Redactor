/* Project browser (папки, перетаскивание, поиск) + Sprite Editor (нарезка атласов) */
(()=>{
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let folders=[{id:0,name:'Assets',parent:null}],fid=1,cur=0,psel=new Set(),anchor=null,
    tOpen=new Set([0]),subOpen=new Set(),zoom=64,query='',dragKeys=null,E=null;
window.pfocus=false;
const kind=k=>k[0];   // f — папка, a — ассет/спрайт, c — анимация (клип), k — Animator Controller
const animFolder=()=>folders.find(f=>f.sys=='anim');
const fontsFolder=()=>folders.find(f=>f.sys=='fonts');   // системная папка Fonts: сюда по умолчанию попадают все импортируемые шрифты
const inFonts=id=>{const F=fontsFolder();for(let x=id,g=0;F&&x!=null&&g<64;g++){if(x==F.id)return true;const f=folders.find(y=>y.id==x);x=f?f.parent:null}return false};
const safeFolder=id=>{const f=folders.find(x=>x.id==id);return f&&f.sys=='anim'?(f.parent==null?0:f.parent):id};
window.curFolder=()=>safeFolder(cur);
window.animFolder=animFolder;

// ---------- модель ----------
const fol=id=>folders.find(f=>f.id==id);
const kf=id=>'f'+id,ka=id=>'a'+id,isF=k=>k[0]=='f',idOf=k=>+k.slice(1);
const byName=(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
const subF=p=>folders.filter(f=>f.parent===p).sort(byName);
const texIn=p=>assets.filter(a=>!a.parent&&a.folder===p).sort(byName);
const isUnder=(f,anc)=>{for(let x=f;x!=null;x=fol(x)&&fol(x).parent)if(x==anc)return true;return false};
const pathStr=id=>{const p=[];for(let x=id;x!=null;x=fol(x).parent)p.unshift(fol(x).name);return p.join('/')};
const allUnder=id=>{const r=[id];subF(id).forEach(c=>r.push(...allUnder(c.id)));return r};
function uniq(name,parent,skipKey){
  const taken=new Set([...folders.filter(f=>f.parent===parent&&kf(f.id)!=skipKey).map(f=>f.name),
    ...assets.filter(a=>!a.parent&&a.folder===parent&&ka(a.id)!=skipKey).map(a=>a.name)]);
  if(!taken.has(name))return name;let i=1;while(taken.has(name+' '+i))i++;return name+' '+i}
window.uniqAsset=(n,f)=>uniq(n,f);
function mkFolder(name,parent){const f={id:fid++,name:uniq(name,parent),parent};folders.push(f);tOpen.add(parent);return f}
window.ppuOf=a=>((a&&a.parent?ast(a.parent):a)||{}).ppu||PPU;
window.spName=a=>a.parent?ast(a.parent).name+' / '+a.name:a.name;
window.spriteList=()=>assets.filter(a=>!a.font&&(a.parent||!(a.sprites&&a.sprites.length))).sort((x,y)=>spName(x).localeCompare(spName(y),undefined,{numeric:true}));
// ---------- шрифты (.otf/.ttf/.woff/.woff2) ----------
const FONT_RE=/\.(otf|ttf|woff2?)$/i,fontFam=new Map();let fcnt=0;
window.isFontFile=n=>FONT_RE.test(n||'');
window.fontFamOf=url=>fontFam.get(url);
window.loadFont=async url=>{      // dataURL -> имя семейства, зарегистрированного в document.fonts (null при ошибке)
  if(fontFam.has(url))return fontFam.get(url);
  try{const bin=atob(url.slice(url.indexOf(',')+1)),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    const fam='U2DFont'+(++fcnt),ff=new FontFace(fam,buf.buffer);await ff.load();document.fonts.add(ff);fontFam.set(url,fam);return fam}
  catch(e){console.warn('Шрифт не загружен:',e);return null}};
window.mkFont=async(name,url,folder,ext)=>{const fam=await loadFont(url);if(!fam)return null;
  const a={id:aid++,name:uniqAsset(name,folder),url,font:true,family:fam,ext:(ext||'otf').toLowerCase(),folder};assets.push(a);return a};
window.spr=id=>{const a=ast(id);return a&&a.sprites&&a.sprites.length?a.sprites[0]:id};

// ---------- отрисовка ----------
const FSVG='<svg class="fsv" viewBox="0 0 48 40"><path d="M2 7a3 3 0 0 1 3-3h12l5 5h21a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#a98a3e"/><path d="M2 15a3 3 0 0 1 3-3h38a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#d6b45e"/></svg>';
function items(){
  const q=query.trim().toLowerCase(),out=[];
  if(q){
    folders.filter(f=>f.id&&f.name.toLowerCase().includes(q)).sort(byName).forEach(f=>out.push({k:kf(f.id),f}));
    assets.filter(a=>a.name.toLowerCase().includes(q)).sort(byName).forEach(a=>out.push({k:ka(a.id),a}));
    AnimRT.clips.filter(c=>c.name.toLowerCase().includes(q)).sort(byName).forEach(c=>out.push({k:'c'+c.id,c}));
    AnimRT.ctls.filter(c=>c.name.toLowerCase().includes(q)).sort(byName).forEach(t=>out.push({k:'k'+t.id,t}));
  }else{
    subF(cur).forEach(f=>out.push({k:kf(f.id),f}));
    texIn(cur).forEach(a=>{out.push({k:ka(a.id),a});if(subOpen.has(a.id))a.sprites.forEach(s=>out.push({k:ka(s),a:ast(s)}))});
    if(fol(cur)&&fol(cur).sys=='anim'){
      AnimRT.clips.slice().sort(byName).forEach(c=>out.push({k:'c'+c.id,c}));
      AnimRT.ctls.slice().sort(byName).forEach(t=>out.push({k:'k'+t.id,t}))}
  }
  return out}
const CLIPSVG='<svg class="fsv" viewBox="0 0 48 40"><rect x="3" y="4" width="42" height="32" rx="4" fill="#2d6fa8"/><rect x="3" y="4" width="42" height="7" fill="#3c8ccc"/><path d="M19 15l14 7-14 7z" fill="#fff"/></svg>';
const CTLSVG='<svg class="fsv" viewBox="0 0 48 40"><path d="M14 12h20M14 28h20M10 14v12M38 14v12" stroke="#bbb" stroke-width="2" fill="none"/><rect x="4" y="6" width="14" height="10" rx="2" fill="#c0702a"/><rect x="30" y="6" width="14" height="10" rx="2" fill="#5e8f5e"/><rect x="4" y="24" width="14" height="10" rx="2" fill="#5e5e5e"/><rect x="30" y="24" width="14" height="10" rx="2" fill="#2a8aa0"/></svg>';
function tile(it){
  const s=psel.has(it.k)?' s':'';
  if(it.c)return`<div class="tile ani${s}" data-k="${it.k}" title="${esc(it.c.name)}.anim — ${rd(it.c.len)} с, ${it.c.fps} fps"><div class="th">${CLIPSVG}</div><span>${esc(it.c.name)}</span></div>`;
  if(it.t)return`<div class="tile ani${s}" data-k="${it.k}" title="${esc(it.t.name)}.controller"><div class="th">${CTLSVG}</div><span>${esc(it.t.name)}</span></div>`;
  if(it.f)return`<div class="tile fol${s}" draggable="true" data-k="${it.k}" title="${esc(pathStr(it.f.id))}"><div class="th">${FSVG}</div><span>${esc(it.f.name)}</span></div>`;
  const a=it.a,has=a.sprites&&a.sprites.length;
  if(a.font)return`<div class="tile${s}" draggable="true" data-k="${it.k}" title="${esc(a.name)}.${a.ext}"><div class="th"><div class="fa" style="font-family:'${a.family}',sans-serif">Aa</div></div><span>${esc(a.name)}</span></div>`;
  return`<div class="tile${s}${a.parent?' sub':''}" draggable="true" data-k="${it.k}" title="${esc(spName(a))} (${a.img.width}×${a.img.height})"><div class="th"><img src="${a.url}" draggable="false"></div><span>${esc(a.name)}</span>${has?`<b class="ex" data-ex="${a.id}">${subOpen.has(a.id)?'◂':'▸'}</b>`:''}</div>`}
function treeNode(id,d){
  const f=fol(id),ch=subF(id),op=tOpen.has(id);
  return`<div class="tn${id==cur&&!query.trim()?' s':''}" data-f="${id}" style="padding-left:${4+d*14}px"><b class="tw" data-tw="${id}">${ch.length?(op?'▾':'▸'):''}</b>${FSVG}<span>${esc(f.name)}</span></div>`+(op?ch.map(c=>treeNode(c.id,d+1)).join(''):'')}
function crumbs(){
  if(query.trim())return`<span>Поиск: «${esc(query)}»</span>`;
  const p=[];for(let x=cur;x!=null;x=fol(x).parent)p.unshift(x);
  return p.map(id=>`<span class="cr" data-f="${id}">${esc(fol(id).name)}</span>`).join('<i>›</i>')}
function projRender(){
  if(!fol(cur))cur=0;
  $('#proj').style.setProperty('--ts',zoom+'px');
  $('#ptree').innerHTML=treeNode(0,0);
  $('#pcrumb').innerHTML=crumbs();
  const its=items();
  $('#pgrid').innerHTML=its.map(tile).join('')||'<div class="e">Пусто. ПКМ — создать папку; перетащите сюда картинки или папки с компьютера.</div>';
  window.projSelChanged&&projSelChanged();
}
// выбранные спрайты в порядке показа в Project (атлас с нарезкой раскрывается во все свои спрайты) — для окна Sprites в Animation
window.projSprites=()=>{const out=[],seen=new Set(),add=id=>{if(!seen.has(id)){seen.add(id);out.push(id)}};
  items().forEach(it=>{if(!it.a||it.a.font||!psel.has(it.k))return;const a=it.a;if(a.sprites&&a.sprites.length)a.sprites.forEach(add);else add(a.id)});
  return out};
window.projRender=projRender;
const paintSel=()=>{document.querySelectorAll('#pgrid .tile').forEach(t=>t.classList.toggle('s',psel.has(t.dataset.k)));window.projSelChanged&&projSelChanged()};
const touch=()=>{window.pfocus=true;inspect()};

function openFolder(id){
  for(let x=fol(id).parent;x!=null;x=fol(x).parent)tOpen.add(x);
  cur=id;query='';$('#psearch').value='';psel=new Set();anchor=null;projRender();touch()}

// ---------- выбор ----------
function pick(k,e){
  const vis=items().map(i=>i.k);
  if(e.shiftKey&&anchor&&vis.includes(anchor)&&vis.includes(k)){
    const a=vis.indexOf(anchor),b=vis.indexOf(k);psel=new Set(vis.slice(Math.min(a,b),Math.max(a,b)+1))}
  else if(e.ctrlKey||e.metaKey){psel.has(k)?psel.delete(k):psel.add(k);anchor=k}
  else{psel=new Set([k]);anchor=k}
  paintSel();touch()}

const grid=$('#pgrid');
grid.addEventListener('click',e=>{
  const ex=e.target.closest('.ex');
  if(ex){const id=+ex.dataset.ex;subOpen.has(id)?subOpen.delete(id):subOpen.add(id);projRender();return}
  const t=e.target.closest('.tile');
  if(t)pick(t.dataset.k,e);else{psel=new Set();paintSel();touch()}});
grid.addEventListener('dblclick',e=>{
  const t=e.target.closest('.tile');if(!t||e.target.closest('input'))return;
  openKey(t.dataset.k)});
function openKey(k){const id=idOf(k);
  if(isF(k))openFolder(id);
  else if(k[0]=='c')AnimRT.openClip(id);
  else if(k[0]=='k'){AnimRT.openCtl(id);window.setTab('anim')}
  else if(!(ast(id)&&ast(id).font))openSprite(id)}
$('#ptree').addEventListener('click',e=>{
  const tw=e.target.closest('.tw'),n=e.target.closest('.tn');if(!n)return;const id=+n.dataset.f;
  if(tw){if(subF(id).length){tOpen.has(id)?tOpen.delete(id):tOpen.add(id);projRender()}return}
  openFolder(id)});
$('#pcrumb').addEventListener('click',e=>{const c=e.target.closest('.cr');if(c)openFolder(+c.dataset.f)});

// ---------- создание / переименование / удаление ----------
function newFolder(parent){
  parent=safeFolder(parent==null?cur:parent);
  if(parent!=cur||query.trim()){cur=parent;query='';$('#psearch').value=''}
  const f=mkFolder('New Folder',parent);psel=new Set([kf(f.id)]);anchor=kf(f.id);projRender();touch();
  const el=$(`#pgrid [data-k="${kf(f.id)}"]`);if(el){el.scrollIntoView({block:'nearest'});rename(kf(f.id))}}
function rename(k){
  if(k[0]!='f'&&k[0]!='a')return;
  const id=idOf(k),isf=isF(k),obj=isf?fol(id):ast(id);
  if(!obj||(!isf&&obj.parent)||(isf&&(!id||obj.sys)))return;
  const tl=$(`#pgrid [data-k="${k}"]`);if(!tl)return;const el=tl.querySelector('span');
  const inp=document.createElement('input');inp.type='text';inp.value=obj.name;inp.className='rn';
  tl.draggable=false;el.replaceWith(inp);inp.focus();inp.select();
  let done=0;
  const fin=ok=>{if(done)return;done=1;
    if(ok){const v=inp.value.trim().replace(/[\\/:*?"<>|]/g,'');if(v&&v!=obj.name)obj.name=uniq(v,isf?obj.parent:obj.folder,k)}
    projRender();inspect();draw()};
  inp.onkeydown=e=>{e.stopPropagation();if(e.key=='Enter')fin(1);if(e.key=='Escape')fin(0)};
  inp.onblur=()=>fin(1);inp.onmousedown=inp.onclick=inp.ondblclick=e=>e.stopPropagation()}
function delKeys(keys){
  const cks=keys.filter(k=>k[0]=='c').map(idOf);let tks=keys.filter(k=>k[0]=='k').map(idOf);
  keys=keys.filter(k=>k[0]=='f'||k[0]=='a');
  const fids=new Set(),aids=new Set();
  keys.forEach(k=>{const id=idOf(k);if(isF(k)){if(id&&!fol(id).sys)allUnder(id).forEach(x=>fids.add(x))}else{const a=ast(id);if(a&&!a.parent)aids.add(id)}});
  assets.forEach(a=>{if(!a.parent&&fids.has(a.folder))aids.add(a.id)});
  if(tks.length&&AnimRT.ctls.length-tks.length<1){alert('Нельзя удалить единственный Animator Controller');tks=[]}
  if(!fids.size&&!aids.size&&!cks.length&&!tks.length)return;
  const gone=new Set();aids.forEach(id=>{gone.add(id);(ast(id).sprites||[]).forEach(s=>gone.add(s))});
  const used=objs.filter(o=>o.img&&gone.has(o.img.sprite)).length;
  const parts=[];if(fids.size)parts.push('папок — '+fids.size);if(aids.size)parts.push('ассетов — '+aids.size);if(cks.length)parts.push('анимаций — '+cks.length);if(tks.length)parts.push('контроллеров — '+tks.length);
  const msg='Удалить: '+parts.join(', ')+'?'+(used?`\nИспользуются на сцене (${used} об.) — ссылки будут сброшены.`:'')+'\nОтменить можно через Ctrl+Z.';
  if(!confirm(msg))return;
  cks.forEach(id=>AnimRT.removeClip(id));
  tks.forEach(id=>{if(AnimRT.removeCtl(id))objs.forEach(o=>{if(o.animator&&o.animator.ctl==id)o.animator.ctl=AnimRT.ctls[0].id})});
  objs.forEach(o=>{if(o.img&&gone.has(o.img.sprite))o.img.sprite=null;if(o.text&&gone.has(o.text.font))o.text.font=null});
  for(let i=assets.length;i--;)if(gone.has(assets[i].id))assets.splice(i,1);
  folders=folders.filter(f=>!fids.has(f.id));
  psel=new Set();anchor=null;clearTint();projRender();inspect();draw()}
const clearTint=()=>{for(const k in tc)delete tc[k]};

// ---------- меню ----------
function newAnim(t){
  const x=t=='clip'?AnimRT.createClip():AnimRT.newCtl(),af=animFolder();
  if(af)openFolder(af.id);
  psel=new Set([(t=='clip'?'c':'k')+x.id]);anchor=[...psel][0];projRender();touch()}
const createItems=()=>[['Create Folder',()=>newFolder()],['Animation Clip',()=>newAnim('clip')],['Animator Controller',()=>newAnim('ctl')],['Import New Asset…',()=>$('#file').click()]];
$('#pnew').onclick=e=>{const r=e.target.getBoundingClientRect();showMenu(r.left,r.bottom,createItems())};
grid.addEventListener('contextmenu',e=>{
  e.preventDefault();window.pfocus=true;
  const t=e.target.closest('.tile');
  if(!t){psel=new Set();paintSel();inspect();showMenu(e.clientX,e.clientY,createItems());return}
  const k=t.dataset.k;if(!psel.has(k)){psel=new Set([k]);anchor=k;paintSel();inspect()}
  const ks=[...psel],one=ks.length==1,it=[],renamable=x=>x[0]=='f'?(idOf(x)&&!fol(idOf(x)).sys):x[0]=='a'&&!ast(idOf(x)).parent;
  const deletable=x=>x[0]=='f'?(idOf(x)&&!fol(idOf(x)).sys):x[0]=='a'?!ast(idOf(x)).parent:true;
  if(one&&k[0]!='a')it.push(['Open',()=>openKey(k)]);
  if(one&&k[0]=='a'&&!ast(idOf(k)).font)it.push(['Sprite Editor…',()=>openSprite(idOf(k))]);
  if(one&&renamable(k))it.push(['Rename   (F2)',()=>rename(k)]);
  if(ks.some(deletable))it.push(['Delete',()=>delKeys(ks)]);
  it.push(...createItems().slice(0,3));
  showMenu(e.clientX,e.clientY,it)});
$('#ptree').addEventListener('contextmenu',e=>{
  e.preventDefault();const n=e.target.closest('.tn');
  if(!n)return showMenu(e.clientX,e.clientY,[['Create Folder',()=>newFolder(0)]]);
  const id=+n.dataset.f,it=[['Create Folder',()=>newFolder(id)]];
  if(id&&!fol(id).sys)it.push(['Rename',()=>{const p=fol(id).parent;cur=p;query='';$('#psearch').value='';projRender();rename(kf(id))}],['Delete',()=>delKeys([kf(id)])]);
  showMenu(e.clientX,e.clientY,it)});

// ---------- клавиатура ----------
addEventListener('keydown',e=>{
  if(!window.pfocus||E||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  const ks=[...psel];
  if(e.key=='F2'&&ks.length==1){e.preventDefault();rename(ks[0])}
  else if(e.key=='Delete'&&ks.length){e.preventDefault();delKeys(ks)}
  else if(e.key=='Enter'&&ks.length==1){openKey(ks[0])}
  else if(e.key=='Backspace'&&!query.trim()){const f=fol(cur);if(f&&f.parent!=null){e.preventDefault();openFolder(f.parent)}}
  else if((e.ctrlKey||e.metaKey)&&e.key=='a'){e.preventDefault();psel=new Set(items().map(i=>i.k));paintSel();inspect()}});
// фокус: клики вне панели Project/инспектора возвращают инспектор к объектам сцены
document.addEventListener('mousedown',e=>{
  const t=e.target;
  if(t.closest('#proj')||t.closest('#sped')){window.pfocus=true;return}
  if(t.closest('#ins')||t.closest('#menu'))return;
  if(window.pfocus){window.pfocus=false;setTimeout(inspect,0)}},true);

// ---------- перетаскивание ----------
const movable=k=>k[0]=='f'?(idOf(k)!=0&&!fol(idOf(k)).sys):k[0]=='a'&&!ast(idOf(k)).parent;
grid.addEventListener('dragstart',e=>{
  const t=e.target.closest('.tile');if(!t)return;const k=t.dataset.k;
  if(!psel.has(k)){psel=new Set([k]);anchor=k;paintSel();touch()}
  dragKeys=[...psel];
  e.dataTransfer.setData('text/plain',(isF(k)?'folder:':'asset:')+idOf(k));
  e.dataTransfer.effectAllowed='copyMove'});
addEventListener('dragend',()=>{dragKeys=null;clearDT()});
const clearDT=()=>document.querySelectorAll('.dt').forEach(x=>x.classList.remove('dt'));
const hasFiles=e=>[...(e.dataTransfer.types||[])].includes('Files');
function dropTarget(e){
  const el=e.target.closest&&e.target.closest('.tile.fol,.tn,.cr');
  if(el)return{id:el.dataset.f!=null?+el.dataset.f:idOf(el.dataset.k),el};
  return{id:cur,el:grid}}
function canDrop(id){
  if(!dragKeys||(fol(id)&&fol(id).sys=='anim'))return false;
  const mv=dragKeys.filter(movable);if(!mv.length)return false;
  return !mv.some(k=>isF(k)&&isUnder(id,idOf(k)))}
const body=$('#pbody');
body.addEventListener('dragover',e=>{
  if(e.target.closest('#sped'))return;
  const {id,el}=dropTarget(e),ok=hasFiles(e)||canDrop(id);
  clearDT();if(!ok)return;e.preventDefault();e.dataTransfer.dropEffect=hasFiles(e)?'copy':'move';el.classList.add('dt')});
body.addEventListener('dragleave',e=>{if(!body.contains(e.relatedTarget))clearDT()});
body.addEventListener('drop',e=>{
  e.preventDefault();clearDT();const {id}=dropTarget(e);
  if(hasFiles(e))importDrop(e.dataTransfer,id);
  else if(canDrop(id))moveKeys(dragKeys.filter(movable),id);
  dragKeys=null});
function moveKeys(keys,T){
  let n=0;
  keys.forEach(k=>{const id=idOf(k);
    if(isF(k)){const f=fol(id);if(!f||isUnder(T,id)||f.parent===T)return;f.parent=T;f.name=uniq(f.name,T,k);n++}
    else{const a=ast(id);if(!a||a.parent||a.folder===T)return;a.folder=T;a.name=uniq(a.name,T,k);n++}});
  if(n){tOpen.add(T);projRender()}}

// ---------- импорт ----------
const readFile=f=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r(null);fr.readAsDataURL(f)});
async function importOne(f,folder,route){
  if(isFontFile(f.name)){const F=fontsFolder();if(route&&F&&!inFonts(folder))folder=F.id;const url=await readFile(f);return url?mkFont(f.name.replace(/\.\w+$/,''),url,folder,f.name.split('.').pop()):null}
  if(!f.type.startsWith('image/'))return null;
  const url=await readFile(f);return url?mkAsset(f.name.replace(/\.\w+$/,''),url,folder):null}
window.importFiles=async(fs,folder)=>{
  folder=safeFolder(folder==null?cur:folder);const out=[];
  for(const f of fs){const a=await importOne(f,folder,true);if(a)out.push(a)}
  if(out.length){psel=new Set(out.map(a=>ka(a.id)));projRender()}return out};
async function walk(en,parent,top){
  if(en.isFile){const f=await new Promise(r=>en.file(r,()=>r(null)));if(f)await importOne(f,parent,top)}
  else if(en.isDirectory){
    const nf=mkFolder(en.name,parent),rd=en.createReader(),all=[];
    for(;;){const b=await new Promise(r=>rd.readEntries(r,()=>r([])));if(!b.length)break;all.push(...b)}
    for(const c of all)await walk(c,nf.id)}}
async function importDrop(dt,target){
  target=safeFolder(target);
  const ents=[...(dt.items||[])].map(i=>i.webkitGetAsEntry&&i.webkitGetAsEntry()).filter(Boolean);
  if(!ents.length)await importFiles(dt.files,target);
  else for(const en of ents)await walk(en,target,true);
  projRender()}
$('#imp').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{await importFiles(e.target.files);e.target.value='';touch()};
$('#psearch').oninput=e=>{query=e.target.value;psel=new Set();projRender()};
$('#pzoom').oninput=e=>{zoom=+e.target.value;$('#proj').style.setProperty('--ts',zoom+'px')};
split('#s4',e=>{const r=body.getBoundingClientRect();body.style.setProperty('--tw',clamp(e.clientX-r.left,100,r.width-200)+'px')});

// ---------- инспектор ассетов ----------
window.assetInspect=()=>{
  if(!window.pfocus||!psel.size)return false;
  if(window.amode=='clip'&&[...psel].some(k=>!isF(k)))return false; // в редакторе анимации спрайты не переключают Inspector (см. окно Sprites)
  const box=$('#ins'),ks=[...psel];
  if(ks.length>1){box.innerHTML=`<div class="sec"><b>${ks.length} items selected</b></div>`;return true}
  const k=ks[0],id=idOf(k);
  if(k[0]=='c'){const c=AnimRT.clips.find(x=>x.id==id);if(!c)return false;
    box.innerHTML=`<div class="sec"><div class="sh">Animation Clip</div>
<div class="r"><span class="l">Name</span><span class="kv">${esc(c.name)}</span></div>
<div class="r"><span class="l">Length</span><span class="kv">${rd(c.len)} с</span></div>
<div class="r"><span class="l">Frame Rate</span><span class="kv">${c.fps} fps</span></div>
<div class="r"><span class="l">Loop Time</span><span class="kv">${c.loop?'да':'нет'}</span></div>
<div class="r"><span class="l">Properties</span><span class="kv">${c.tracks.length}</span></div>
<div class="r"><span class="l">File</span><span class="kv">Animations/${esc(c.name)}.anim.json</span></div></div>
<div class="sec" style="text-align:center"><button data-pa="open">Open in Animation</button></div>`;return true}
  if(k[0]=='k'){const c=AnimRT.ctls.find(x=>x.id==id);if(!c)return false;
    box.innerHTML=`<div class="sec"><div class="sh">Animator Controller</div>
<div class="r"><span class="l">Name</span><span class="kv">${esc(c.name)}</span></div>
<div class="r"><span class="l">States</span><span class="kv">${c.st.length}</span></div>
<div class="r"><span class="l">Parameters</span><span class="kv">${c.pa.length}</span></div>
<div class="r"><span class="l">File</span><span class="kv">Animations/${esc(c.name)}.controller.json</span></div></div>
<div class="sec" style="text-align:center"><button data-pa="open">Open in Animator</button></div>`;return true}
  if(isF(k)){
    const f=fol(id);if(!f)return false;
    const fs=allUnder(id),na=assets.filter(a=>!a.parent&&fs.includes(a.folder)).length;
    box.innerHTML=`<div class="sec"><div class="sh">Folder</div>
<div class="r"><span class="l">Name</span><input type="text" data-pa="name" value="${esc(f.name)}" ${id&&!f.sys?'':'disabled'}></div>
<div class="r"><span class="l">Path</span><span class="kv">${esc(pathStr(id))}</span></div>
<div class="r"><span class="l">Contents</span><span class="kv">папок: ${fs.length-1}, ассетов: ${na}</span></div></div>`;return true}
  const a=ast(id);if(!a)return false;
  if(a.font){const kb=Math.max(1,Math.round((a.url.length-a.url.indexOf(',')-1)*3/4096)),ty={otf:'OpenType (.otf)',ttf:'TrueType (.ttf)',woff:'WOFF (.woff)',woff2:'WOFF2 (.woff2)'}[a.ext]||a.ext;
    const ff=`font-family:'${a.family}',sans-serif`;
    box.innerHTML=`<div class="sec"><input type="text" data-pa="name" value="${esc(a.name)}"></div>
<div class="sec"><div class="sh">Font Import Settings</div>
<div class="r"><span class="l">Font Type</span><span class="kv">${ty}</span></div>
<div class="r"><span class="l">File Size</span><span class="kv">${kb} KB</span></div>
<div class="r"><span class="l">Used By</span><span class="kv">${objs.filter(o=>o.text&&o.text.font==a.id).length} Text</span></div></div>
<div class="fprev" style="${ff}"><div style="font-size:34px">Aa Bb Cc</div><div style="font-size:18px;margin-top:6px">The quick brown fox jumps over the lazy dog</div><div style="font-size:18px;margin-top:6px">Съешь ещё этих мягких булок 0123456789</div></div>`;return true}
  const prev=`<div class="prev"><img src="${a.url}"></div>`;
  if(a.parent){
    const p=ast(a.parent),r=a.rect;
    box.innerHTML=`<div class="sec"><div class="sh">Sprite</div>
<div class="r"><span class="l">Name</span><span>${esc(a.name)}</span></div>
<div class="r"><span class="l">Texture</span><span class="kv">${esc(p.name)}</span></div>
<div class="r"><span class="l">Rect</span><span class="kv">x ${r.x}  y ${r.y}  w ${r.w}  h ${r.h}</span></div></div>${prev}
<div class="sec" style="text-align:center"><button data-pa="edit">Sprite Editor</button></div>`;return true}
  box.innerHTML=`<div class="sec"><input type="text" data-pa="name" value="${esc(a.name)}"></div>
<div class="sec"><div class="sh">Texture Import Settings</div>
<div class="r"><span class="l">Texture Type</span><span class="kv">Sprite (2D and UI)</span></div>
<div class="r"><span class="l">Sprite Mode</span><select class="wide" data-pa="mode"><option value="single" ${a.sprites.length?'':'selected'}>Single</option><option value="multiple" ${a.sprites.length?'selected':''}>Multiple</option></select></div>
<div class="r"><span class="l">Pixels Per Unit</span><input type="number" min="1" step="1" data-pa="ppu" value="${a.ppu}"></div>
<div class="r"><span class="l">Size</span><span class="kv">${a.img.width} × ${a.img.height}</span></div>
<div class="r"><span class="l">Sprites</span><span class="kv">${a.sprites.length}</span></div>
<div style="text-align:center;margin-top:8px"><button data-pa="edit">Sprite Editor</button></div></div>${prev}`;
  return true};
const insEl=$('#ins');
insEl.addEventListener('change',e=>{
  const t=e.target,act=t.dataset.pa;if(!act||!window.pfocus||psel.size!=1)return;
  const k=[...psel][0],id=idOf(k);if(k[0]!='f'&&k[0]!='a')return;
  if(act=='name'){const isf=isF(k),o=isf?fol(id):ast(id),v=t.value.trim().replace(/[\\/:*?"<>|]/g,'');
    if(o&&v&&(!isf||id)){o.name=uniq(v,isf?o.parent:o.folder,k)}projRender();inspect();return}
  const a=ast(id);if(!a||a.parent)return;
  if(act=='ppu'){a.ppu=Math.max(.01,parseFloat(t.value)||100);inspect();draw()}
  if(act=='mode'){
    if(t.value=='single'&&a.sprites.length){
      if(!confirm(`Режим Single удалит все спрайты (${a.sprites.length}) этой текстуры. Продолжить?`)){inspect();return}
      setSprites(a,[]);projRender();draw()}
    inspect()}});
insEl.addEventListener('click',e=>{
  if(!window.pfocus||psel.size!=1)return;const k=[...psel][0];
  if(e.target.dataset.pa=='edit'&&k[0]=='a')openSprite(idOf(k));
  else if(e.target.dataset.pa=='open')openKey(k)});

// ---------- общие операции со спрайтами ----------
function setSprites(tex,rects){
  const keep=new Set(rects.map(r=>r.id).filter(Boolean)),gone=new Set(tex.sprites.filter(s=>!keep.has(s)));
  for(let i=assets.length;i--;)if(gone.has(assets[i].id))assets.splice(i,1);
  const ids=[];
  rects.forEach(r=>{
    let s=r.id&&ast(r.id);
    const c=document.createElement('canvas');c.width=r.w;c.height=r.h;
    c.getContext('2d').drawImage(tex.img,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
    if(!s){s={id:aid++,parent:tex.id,folder:tex.folder};assets.push(s);r.id=s.id}
    s.name=r.name;s.rect={x:r.x,y:r.y,w:r.w,h:r.h};s.img=c;s.url=c.toDataURL();imgCache.set(s.url,c);ids.push(s.id)});
  tex.sprites=ids;tex.mode=ids.length?'multiple':'single';
  objs.forEach(o=>{const im=o.img;if(!im)return;
    if(gone.has(im.sprite))im.sprite=ids.length?null:tex.id;
    else if(im.sprite==tex.id&&ids.length)im.sprite=ids[0]});
  clearTint()}

// =====================================================================
//                           SPRITE EDITOR
// =====================================================================
let ed=null,spaceDown=false,chk=null;
const num=(id,v)=>`<input type="number" id="${id}" value="${v}" min="0">`;
const row=(l,a,b)=>`<div class="r"><span class="l">${l}</span>${a}${b||''}</div>`;
function ensureDom(){
  if($('#sped'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="sped" style="display:none"><div class="spw">
<div class="sph"><b>Sprite Editor</b><span id="sp-title"></span><span class="grow"></span>
<button id="sp-sl">Slice ▾</button><button id="sp-trim" title="Обрезать рамки по непрозрачным пикселям (выбранную или все)">Trim</button><button id="sp-rev">Revert</button><button id="sp-app">Apply</button><button id="sp-x">✕</button></div>
<div class="spb"><div class="spc" id="spc"><canvas id="spcv"></canvas>
<div id="spsl" style="display:none">
${row('Type','<select id="sp-type"><option value="auto">Automatic</option><option value="size">Grid By Cell Size</option><option value="count">Grid By Cell Count</option></select>')}
<div class="spg" data-for="auto">${row('Minimum Size',num('a-min',4))}${row('Merge Gap (px)',num('a-gap',0))}${row('Alpha Threshold',num('a-thr',1))}</div>
<div class="spg" data-for="size">${row('Pixel Size',num('g-w',32),num('g-h',32))}</div>
<div class="spg" data-for="count">${row('Column & Row',num('g-c',4),num('g-r',4))}</div>
<div class="spg" data-for="size count">${row('Offset',num('g-ox',0),num('g-oy',0))}${row('Padding',num('g-px',0),num('g-py',0))}
<div class="r"><span class="l"></span><label><input type="checkbox" id="g-keep"> Keep Empty Rects</label></div></div>
<div class="r"><span class="l"></span><label><input type="checkbox" id="sp-rep" checked> Replace existing</label></div>
<div class="r"><button id="sp-do">Slice</button><span id="sp-msg"></span></div></div>
<div id="sp-st"></div></div>
<div class="sps"><div class="sec"><div class="sh">Sprite</div><div id="sp-props"></div></div>
<div class="sec sl"><div class="sh">Sprites <span id="sp-cnt"></span></div><div id="sp-list"></div></div></div></div></div></div>`);

  $('#sp-x').onclick=closeEd;
  $('#sp-app').onclick=applyEd;
  $('#sp-rev').onclick=()=>{if(!E.dirty||confirm('Отменить все неприменённые изменения?')){loadRects();E.dirty=false;E.si=-1;side();spDraw()}};
  $('#sp-trim').onclick=trimSel;
  $('#sp-sl').onclick=()=>{const p=$('#spsl');p.style.display=p.style.display=='none'?'':'none';groups();preview()};
  $('#sp-type').onchange=()=>{groups();preview()};
  $('#spsl').addEventListener('input',preview);
  $('#sp-do').onclick=doSlice;
  $('#sp-props').addEventListener('change',e=>{
    const t=e.target,k=t.dataset.sp;if(!k||E.si<0)return;const r=E.rects[E.si];
    if(k=='name'){const v=t.value.trim();if(v)r.name=rectName(v,E.si)}
    else{const v=Math.round(+t.value)||0;
      if(k=='x')r.x=clamp(v,0,E.W-r.w);if(k=='y')r.y=clamp(v,0,E.H-r.h);
      if(k=='w')r.w=clamp(v,1,E.W-r.x);if(k=='h')r.h=clamp(v,1,E.H-r.y)}
    E.dirty=true;side();spDraw()});
  $('#sp-props').addEventListener('click',e=>{if(e.target.id=='sp-del')delRect()});
  $('#sp-list').addEventListener('click',e=>{const it=e.target.closest('.it');if(it){E.si=+it.dataset.i;side();spDraw()}});

  const cv=$('#spcv');
  const mp=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  cv.addEventListener('mousedown',e=>{
    if(!E)return;const m=mp(e),p=ip(m);
    if(e.button==1||(e.button==0&&(e.altKey||spaceDown))){e.preventDefault();ed={t:'pan',cx:e.clientX,cy:e.clientY,vx:E.v.x,vy:E.v.y};return}
    if(e.button!=0)return;
    if(E.si>=0){const h=handleAt(E.rects[E.si],m);if(h){ed={t:'size',h,r0:{...E.rects[E.si]}};return}}
    const i=hitRect(p);
    if(i>=0){E.si=i;ed={t:'move',r0:{...E.rects[i]},p0:p};side();spDraw();return}
    E.si=-1;ed={t:'new',p0:{x:clamp(p.x,0,E.W),y:clamp(p.y,0,E.H)},i:null};side();spDraw()});
  cv.addEventListener('wheel',e=>{
    if(!E)return;e.preventDefault();const m=mp(e),v=E.v,nz=clamp(v.z*(e.deltaY<0?1.2:1/1.2),.05,64);
    v.x=m.x-(m.x-v.x)*nz/v.z;v.y=m.y-(m.y-v.y)*nz/v.z;v.z=nz;spDraw()},{passive:false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('mousemove',e=>{
    if(!E)return;const m=mp(e),p=ip(m);
    if(!ed){
      const sr=E.si>=0&&E.rects[E.si],h=sr&&handleAt(sr,m);
      cv.style.cursor=h?CUR[h]:hitRect(p)>=0?'move':'crosshair';
      status(p);return}
    if(ed.t=='pan'){E.v.x=ed.vx+e.clientX-ed.cx;E.v.y=ed.vy+e.clientY-ed.cy}
    else if(ed.t=='move'){const r=E.rects[E.si],dx=Math.round(p.x-ed.p0.x),dy=Math.round(p.y-ed.p0.y);
      const nx=clamp(ed.r0.x+dx,0,E.W-r.w),ny=clamp(ed.r0.y+dy,0,E.H-r.h);
      if(nx!=r.x||ny!=r.y){r.x=nx;r.y=ny;E.dirty=true;side()}}
    else if(ed.t=='size'){const r=E.rects[E.si],o=ed.r0;let x0=o.x,x1=o.x+o.w,y0=o.y,y1=o.y+o.h;
      const px=clamp(Math.round(p.x),0,E.W),py=clamp(Math.round(p.y),0,E.H);
      if(ed.h.includes('w'))x0=Math.min(px,x1-1);if(ed.h.includes('e'))x1=Math.max(px,x0+1);
      if(ed.h.includes('n'))y0=Math.min(py,y1-1);if(ed.h.includes('s'))y1=Math.max(py,y0+1);
      r.x=x0;r.y=y0;r.w=x1-x0;r.h=y1-y0;E.dirty=true;side()}
    else if(ed.t=='new'){
      const q={x:clamp(p.x,0,E.W),y:clamp(p.y,0,E.H)};
      if(ed.i==null){if(Math.hypot((q.x-ed.p0.x)*E.v.z,(q.y-ed.p0.y)*E.v.z)<3)return;
        E.rects.push({id:null,name:rectName(E.tex.name+'_'+E.rects.length),x:0,y:0,w:1,h:1});ed.i=E.rects.length-1;E.si=ed.i;E.dirty=true}
      const r=E.rects[ed.i],x0=Math.floor(Math.min(ed.p0.x,q.x)),y0=Math.floor(Math.min(ed.p0.y,q.y));
      r.x=x0;r.y=y0;r.w=Math.max(1,Math.min(E.W,Math.ceil(Math.max(ed.p0.x,q.x)))-x0);r.h=Math.max(1,Math.min(E.H,Math.ceil(Math.max(ed.p0.y,q.y)))-y0);side()}
    spDraw();status(p)});
  addEventListener('mouseup',()=>{if(ed&&E){ed=null;side();spDraw()}});
  addEventListener('keydown',e=>{
    if(!E)return;
    if(e.code=='Space'&&!/INPUT|SELECT/.test(e.target.tagName)){spaceDown=true;e.preventDefault();return}
    if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if(e.key=='Escape'){if($('#spsl').style.display!='none'){$('#spsl').style.display='none';preview()}else closeEd();return}
    if((e.key=='Delete'||e.key=='Backspace')&&E.si>=0){e.preventDefault();delRect();return}
    if(e.key.startsWith('Arrow')&&E.si>=0){e.preventDefault();const r=E.rects[E.si],s=e.shiftKey?10:1;
      if(e.key=='ArrowLeft')r.x=clamp(r.x-s,0,E.W-r.w);if(e.key=='ArrowRight')r.x=clamp(r.x+s,0,E.W-r.w);
      if(e.key=='ArrowUp')r.y=clamp(r.y-s,0,E.H-r.h);if(e.key=='ArrowDown')r.y=clamp(r.y+s,0,E.H-r.h);
      E.dirty=true;side();spDraw()}},true);
  addEventListener('keyup',e=>{if(e.code=='Space')spaceDown=false});
  new ResizeObserver(()=>{if(E)spDraw()}).observe($('#spc'));
}
const CUR={n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',ne:'nesw-resize',sw:'nesw-resize',nw:'nwse-resize',se:'nwse-resize'};
const ip=m=>({x:(m.x-E.v.x)/E.v.z,y:(m.y-E.v.y)/E.v.z});
const alphaAt=(x,y)=>E.px[(y*E.W+x)*4+3];
function loadRects(){E.rects=E.tex.sprites.map(s=>{const sp=ast(s);return{id:s,name:sp.name,...sp.rect}})}
function rectName(name,except){
  const used=new Set(E.rects.filter((_,i)=>i!==except).map(r=>r.name));
  if(!used.has(name))return name;
  const m=name.match(/^(.*?)(\d+)$/),base=m?m[1]:name+'_';let i=m?+m[2]+1:1;
  while(used.has(base+i))i++;return base+i}
function openSprite(id){
  let a=ast(id);if(!a||E)return;let pre=null;
  if(a.parent){pre=a.id;a=ast(a.parent)}
  ensureDom();
  const c=document.createElement('canvas');c.width=a.img.width;c.height=a.img.height;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(a.img,0,0);
  E={tex:a,W:c.width,H:c.height,px:x.getImageData(0,0,c.width,c.height).data,rects:[],si:-1,dirty:false,v:{x:0,y:0,z:1},prev:[]};
  loadRects();if(pre)E.si=E.rects.findIndex(r=>r.id==pre);
  window.pfocus=true;
  $('#sp-title').textContent='— '+a.name;
  $('#spsl').style.display='none';$('#sp-msg').textContent='';
  $('#sped').style.display='flex';
  groups();fit();side();spDraw()}
window.openSprite=openSprite;
function closeEd(){
  if(!E)return;
  if(E.dirty&&!confirm('Есть неприменённые изменения. Закрыть без сохранения?'))return;
  E=null;ed=null;$('#sped').style.display='none';projRender();inspect()}
function fit(){
  const cv=$('#spcv'),w=cv.clientWidth,h=cv.clientHeight,z=clamp(Math.min((w-60)/E.W,(h-60)/E.H),.05,16);
  E.v={z,x:(w-E.W*z)/2,y:(h-E.H*z)/2}}
function applyEd(){
  if(!E)return;
  setSprites(E.tex,E.rects);E.dirty=false;
  if(E.si>=E.rects.length)E.si=-1;
  projRender();inspect();draw();side();spDraw();
  const m=$('#sp-msg');$('#spsl').style.display=='none'||(m.textContent='Применено')}
function delRect(){if(E.si<0)return;E.rects.splice(E.si,1);E.si=-1;E.dirty=true;side();spDraw()}

// --- hit-test / handles ---
function hitRect(p){
  const inn=r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
  if(E.si>=0&&inn(E.rects[E.si]))return E.si;
  let best=-1,ba=1e18;E.rects.forEach((r,i)=>{if(inn(r)&&r.w*r.h<=ba){best=i;ba=r.w*r.h}});return best}
function handlePts(r){
  const v=E.v,x=v.x+r.x*v.z,y=v.y+r.y*v.z,w=r.w*v.z,h=r.h*v.z;
  return{nw:[x,y],ne:[x+w,y],se:[x+w,y+h],sw:[x,y+h],n:[x+w/2,y],s:[x+w/2,y+h],e:[x+w,y+h/2],w:[x,y+h/2]}}
function handleAt(r,m){
  const pts=handlePts(r);
  for(const k of ['nw','ne','se','sw','n','s','e','w'])if(Math.abs(pts[k][0]-m.x)<=6&&Math.abs(pts[k][1]-m.y)<=6)return k;
  return null}

// --- рисование ---
function spDraw(){
  if(!E)return;
  const cv=$('#spcv'),w=cv.clientWidth,h=cv.clientHeight,d=devicePixelRatio||1;
  if(cv.width!=w*d||cv.height!=h*d){cv.width=w*d;cv.height=h*d}
  const g=cv.getContext('2d'),{x,y,z}=E.v;
  g.setTransform(d,0,0,d,0,0);g.fillStyle='#303030';g.fillRect(0,0,w,h);
  const sw=E.W*z,sh=E.H*z;
  if(!chk){chk=document.createElement('canvas');chk.width=chk.height=16;const c=chk.getContext('2d');c.fillStyle='#2b2b2b';c.fillRect(0,0,16,16);c.fillStyle='#3d3d3d';c.fillRect(0,0,8,8);c.fillRect(8,8,8,8)}
  g.fillStyle=g.createPattern(chk,'repeat');g.fillRect(x,y,sw,sh);
  g.imageSmoothingEnabled=z<1;g.drawImage(E.tex.img,x,y,sw,sh);
  g.lineWidth=1;g.strokeStyle='#000';g.strokeRect(x-.5,y-.5,sw+1,sh+1);
  // превью сетки
  g.setLineDash([4,3]);g.strokeStyle='#ffd24a';
  E.prev.forEach(r=>g.strokeRect(Math.round(x+r.x*z)+.5,Math.round(y+r.y*z)+.5,Math.max(1,r.w*z-1),Math.max(1,r.h*z-1)));
  g.setLineDash([]);
  E.rects.forEach((r,i)=>{
    const rx=Math.round(x+r.x*z)+.5,ry=Math.round(y+r.y*z)+.5,rw=Math.max(1,r.w*z-1),rh=Math.max(1,r.h*z-1);
    if(i==E.si){g.fillStyle='rgba(90,160,255,.18)';g.fillRect(rx,ry,rw,rh)}
    g.strokeStyle=i==E.si?'#5aa0ff':'#58e058';g.lineWidth=i==E.si?2:1;g.strokeRect(rx,ry,rw,rh);
    if(rw>46&&(i==E.si||z>=1)){g.font='11px Segoe UI,sans-serif';g.textBaseline='top';g.textAlign='left';
      const t=r.name,tw=Math.min(rw-2,g.measureText(t).width+6);g.fillStyle='#000a';g.fillRect(rx+1,ry+1,tw,14);
      g.fillStyle='#fff';g.save();g.beginPath();g.rect(rx+1,ry+1,tw,14);g.clip();g.fillText(t,rx+4,ry+2);g.restore()}});
  if(E.si>=0){const pts=handlePts(E.rects[E.si]);g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=1;
    for(const k in pts){g.fillRect(pts[k][0]-3,pts[k][1]-3,6,6);g.strokeRect(pts[k][0]-3.5,pts[k][1]-3.5,7,7)}}
}
function status(p){
  const px=p&&p.x>=0&&p.y>=0&&p.x<E.W&&p.y<E.H?`  ·  x ${Math.floor(p.x)}  y ${Math.floor(p.y)}`:'';
  $('#sp-st').textContent=`${E.W}×${E.H}  ·  масштаб ${Math.round(E.v.z*100)}%${px}  ·  ЛКМ: рамка / выбор · колесо: зум · СКМ / Alt / Пробел: пан · Del: удалить · стрелки: сдвиг${E.dirty?'  ·  ● есть неприменённые изменения':''}`}
function side(){
  if(!E)return;
  const r=E.rects[E.si],f=(k,v)=>`<input type="number" data-sp="${k}" value="${v}" step="1" style="width:100%">`;
  $('#sp-props').innerHTML=r?`<div class="r"><span class="l" style="width:60px">Name</span><input type="text" data-sp="name" value="${esc(r.name)}"></div>
<div class="r"><span class="l" style="width:60px">X / Y</span>${f('x',r.x)}${f('y',r.y)}</div>
<div class="r"><span class="l" style="width:60px">W / H</span>${f('w',r.w)}${f('h',r.h)}</div>
<div class="r"><button id="sp-del">Delete</button></div>`:'<div class="e" style="padding:4px 0">Выберите рамку или нарисуйте новую мышью на изображении</div>';
  $('#sp-cnt').textContent=`(${E.rects.length})`;
  $('#sp-list').innerHTML=E.rects.map((q,i)=>`<div class="it ${i==E.si?'s':''}" data-i="${i}"><span>${esc(q.name)}</span><small>${q.w}×${q.h}</small></div>`).join('')||'<div class="e">Нет спрайтов. Откройте Slice ▾ или нарисуйте рамку.</div>';
  status()}

// --- нарезка ---
const n=id=>Math.max(0,parseInt($('#'+id).value)||0);
function groups(){const t=$('#sp-type').value;document.querySelectorAll('#spsl .spg').forEach(g=>g.style.display=g.dataset.for.split(' ').includes(t)?'':'none')}
const msg=t=>{$('#sp-msg').textContent=t};
function emptyCell(x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(alphaAt(i,j)>0)return false;return true}
function gridRects(){
  const t=$('#sp-type').value,W=E.W,H=E.H,ox=n('g-ox'),oy=n('g-oy'),px=n('g-px'),py=n('g-py'),keep=$('#g-keep').checked;
  let cw,ch,cols,rows;
  if(t=='size'){cw=Math.max(1,n('g-w'));ch=Math.max(1,n('g-h'));cols=Math.floor((W-ox+px)/(cw+px));rows=Math.floor((H-oy+py)/(ch+py))}
  else{cols=Math.max(1,n('g-c'));rows=Math.max(1,n('g-r'));cw=Math.floor((W-ox-px*(cols-1))/cols);ch=Math.floor((H-oy-py*(rows-1))/rows)}
  if(cw<1||ch<1||cols<1||rows<1)return{rects:[],err:'Ячейки не помещаются в текстуру'};
  if(cols*rows>20000)return{rects:[],err:'Слишком много ячеек (>20000)'};
  const out=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=ox+c*(cw+px),y=oy+r*(ch+py);
    if(x+cw>W||y+ch>H)continue;
    if(!keep&&emptyCell(x,y,cw,ch))continue;
    out.push({x,y,w:cw,h:ch})}
  return{rects:out}}
function mergeRects(r,g){
  r=r.map(q=>({...q}));let ch=true;
  while(ch){ch=false;
    for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){
      const a=r[i],b=r[j];
      if(a.x-g<=b.x+b.w&&b.x-g<=a.x+a.w&&a.y-g<=b.y+b.h&&b.y-g<=a.y+a.h){
        const x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),x1=Math.max(a.x+a.w,b.x+b.w),y1=Math.max(a.y+a.h,b.y+b.h);
        r[i]={x:x0,y:y0,w:x1-x0,h:y1-y0};r.splice(j,1);j--;ch=true}}}
  return r}
function readingOrder(r){
  r.sort((a,b)=>a.y-b.y||a.x-b.x);
  const out=[];let rw=[],ry=0,rh=0;
  r.forEach(q=>{if(rw.length&&q.y>ry+rh*.5){out.push(...rw.sort((a,b)=>a.x-b.x));rw=[]}
    if(!rw.length){ry=q.y;rh=q.h}rw.push(q)});
  out.push(...rw.sort((a,b)=>a.x-b.x));return out}
function autoRects(){
  const {W,H,px}=E,thr=Math.max(1,n('a-thr')),min=n('a-min'),gap=n('a-gap'),N=W*H;
  const mask=new Uint8Array(N);let cnt=0;
  for(let i=0,j=3;i<N;i++,j+=4)if(px[j]>=thr){mask[i]=1;cnt++}
  const stack=new Int32Array(cnt||1),out=[];
  for(let s=0;s<N;s++){
    if(mask[s]!==1)continue;
    let sp=0,x0=W,y0=H,x1=-1,y1=-1;stack[sp++]=s;mask[s]=2;
    while(sp){
      const p=stack[--sp],x=p%W,y=(p-x)/W;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;
        for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx;if(mask[q]===1){mask[q]=2;stack[sp++]=q}}}}
    out.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1})}
  let r=gap>0?mergeRects(out,gap):out;
  r=r.filter(q=>q.w>=min&&q.h>=min);
  return{rects:readingOrder(r)}}
function preview(){
  if(!E)return;
  const t=$('#sp-type').value,open=$('#spsl').style.display!='none';
  E.prev=[];
  if(open&&t!='auto'){const r=gridRects();E.prev=r.rects;msg(r.err||`ячеек: ${r.rects.length}`)}else msg('');
  spDraw()}
function doSlice(){
  const t=$('#sp-type').value,res=t=='auto'?autoRects():gridRects();
  if(res.err){msg(res.err);return}
  if(!res.rects.length){msg('Ничего не найдено');return}
  const rep=$('#sp-rep').checked,old=E.rects,base=E.tex.name;
  const out=rep?[]:old.slice();
  res.rects.forEach((q,i)=>out.push({...q,name:null,id:rep&&old[i]?old[i].id:null}));
  E.rects=out;
  let k=0;const used=new Set(out.filter(r=>r.name).map(r=>r.name));
  out.forEach(r=>{if(r.name)return;while(used.has(base+'_'+k))k++;r.name=base+'_'+k;used.add(r.name)});
  E.si=-1;E.dirty=true;E.prev=[];side();spDraw();msg(`Создано спрайтов: ${res.rects.length}. Нажмите Apply`)}
function trimSel(){
  const idx=E.si>=0?[E.si]:E.rects.map((_,i)=>i);let ch=0;
  idx.forEach(i=>{const r=E.rects[i];let x0=r.x+r.w,y0=r.y+r.h,x1=r.x-1,y1=r.y-1;
    for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(alphaAt(x,y)>0){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    if(x1<x0)return;const nr={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
    if(nr.x!=r.x||nr.y!=r.y||nr.w!=r.w||nr.h!=r.h){Object.assign(r,nr);ch++}});
  if(ch){E.dirty=true;side();spDraw()}msg(ch?`Обрезано: ${ch}`:'Нечего обрезать')}

// ---------- сохранение / загрузка / новый проект ----------
function ensureSys(){if(!folders.some(f=>f.sys=='anim'))folders.push({id:fid++,name:uniq('Animations',0),parent:0,sys:'anim'});
  if(!folders.some(f=>f.sys=='fonts'))folders.push({id:fid++,name:uniq('Fonts',0),parent:0,sys:'fonts'})}
const clearAllTint=()=>{for(const k in tc)delete tc[k]};
window.ProjIO={
  dump(){return{fid,folders:folders.map(f=>({...f})),
    assets:assets.map(a=>a.font?{id:a.id,name:a.name,folder:a.folder,font:1,ext:a.ext}:a.parent?{id:a.id,name:a.name,parent:a.parent,folder:a.folder,rect:{...a.rect}}
      :{id:a.id,name:a.name,folder:a.folder,ppu:a.ppu,mode:a.mode,sprites:(a.sprites||[]).slice()})}},
  // urlOf(id) -> dataURL; все картинки уже должны лежать в imgCache
  load(d,urlOf){
    folders=d.folders.map(f=>({...f}));
    if(!folders.some(f=>f.id==0))folders.unshift({id:0,name:'Assets',parent:null});
    fid=Math.max(fid,d.fid||1,...folders.map(f=>f.id+1));
    assets.length=0;const byId=new Map();
    d.assets.filter(m=>!m.parent).forEach(m=>{
      if(m.font){const u=urlOf(m.id),fam=u&&fontFamOf(u);if(fam)assets.push({id:m.id,name:m.name,url:u,font:true,family:fam,ext:m.ext||'otf',folder:m.folder});return}
      const url=urlOf(m.id),img=url&&imgCache.get(url);if(!img)return;
      const a={id:m.id,name:m.name,url,img,folder:m.folder,ppu:m.ppu||PPU,mode:m.mode||'single',sprites:(m.sprites||[]).slice()};
      assets.push(a);byId.set(a.id,a)});
    d.assets.filter(m=>m.parent).forEach(m=>{
      const p=byId.get(m.parent);if(!p)return;const r=m.rect;
      let url=urlOf(m.id),img=url&&imgCache.get(url);
      if(!img){const c=document.createElement('canvas');c.width=r.w;c.height=r.h;c.getContext('2d').drawImage(p.img,r.x,r.y,r.w,r.h,0,0,r.w,r.h);img=c;url=c.toDataURL();imgCache.set(url,c)}
      assets.push({id:m.id,parent:m.parent,folder:m.folder,name:m.name,rect:{...r},img,url})});
    byId.forEach(a=>{a.sprites=a.sprites.filter(id=>assets.some(x=>x.id==id))});
    folders.forEach(f=>{if(f.id!=0&&!fol(f.parent))f.parent=0});
    ensureSys();
    aid=Math.max(aid,...assets.map(a=>a.id+1),1);
    if(!fol(cur))cur=0;psel=new Set();anchor=null;subOpen=new Set([...subOpen].filter(id=>ast(id)));
    clearAllTint();projRender()},
  reset(){
    folders=[{id:0,name:'Assets',parent:null}];fid=1;assets.length=0;ensureSys();
    cur=0;psel=new Set();anchor=null;tOpen=new Set([0]);subOpen=new Set();query='';$('#psearch').value='';
    clearAllTint();projRender()},
  // стартовый набор: фигуры + демо-атлас 4×2 для нарезки
  async seed(){
    const sf=mkFolder('Sprites',0);
    await gen('Square',x=>x.rect(8,8,112,112),sf.id);
    await gen('Circle',x=>x.arc(64,64,56,0,7),sf.id);
    await gen('Triangle',x=>{x.moveTo(64,8);x.lineTo(120,116);x.lineTo(8,116);x.closePath()},sf.id);
    await gen('Star',x=>{for(let i=0;i<10;i++){const r=i%2?24:58,a=i*Math.PI/5-Math.PI/2;x[i?'lineTo':'moveTo'](64+r*Math.cos(a),68+r*Math.sin(a))}x.closePath()},sf.id);
    const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
    const cols=['#e55','#e95','#ed5','#7d5','#5dc','#5ae','#85e','#e5b'];
    cols.forEach((col,i)=>{const cx=(i%4)*64+32,cy=Math.floor(i/4)*64+32;x.fillStyle=col;x.beginPath();
      if(i%3==0)x.rect(cx-20,cy-20,40,40);else if(i%3==1)x.arc(cx,cy,22,0,7);else{x.moveTo(cx,cy-24);x.lineTo(cx+24,cy+20);x.lineTo(cx-24,cy+20);x.closePath()}x.fill()});
    await mkAsset('SampleAtlas',c.toDataURL(),sf.id);
    tOpen.add(0);projRender()},
  rerender:()=>projRender(),
  showAnimations(){const f=animFolder();if(f)openFolder(f.id)}};
ProjIO.reset();
})();

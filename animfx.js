/* animfx.js — окно Animation: плашка «что редактируем» + призраки ключей на сцене.
   Подключается после project.js. Данные клипа читаются адаптером readKeys() (см. комментарий там). */
(()=>{
const anm=document.getElementById('anm'),bar=document.getElementById('tl-bar'),selClip=document.getElementById('tl-sel');
if(!anm||!bar)return;
const depthOf=o=>{let d=0;for(let p=o;p&&p.parent!=null&&d<64;){const q=get(p.parent);if(!q)break;p=q;d++}return d};
const hue=o=>hHue(depthOf(o));

/* ---------- плашка: КТО и В КАКОМ КЛИПЕ редактируется ---------- */
const who=document.createElement('div');who.id='tl-who';bar.prepend(who);
let last='';
function updWho(){
  const o=get(sel),clip=selClip&&selClip.selectedOptions[0]?selClip.selectedOptions[0].textContent:'',rec=document.getElementById('tl-rec')?.classList.contains('on');
  const h=o?hue(o):210;anm.style.setProperty('--oh',h);if(o&&window.lvlApply)lvlApply(anm,depthOf(o),o);anm.classList.toggle('has',!!o);anm.classList.toggle('rec',!!rec);
  const html=o?`<i class="wd"></i><span class="wl">Вы анимируете</span><b class="wn">${esc(o.name)}</b><span class="ws">·</span><span class="wl">анимация</span><b class="wc">${clip?esc(clip):'—'}</b>${rec?'<em class="wr">● Запись идёт — изменения сами станут ключами</em>':''}`
              :'<span class="wl">Выберите объект на сцене или в Hierarchy — его ключи появятся здесь, а на сцене — призраками</span>';
  if(html!==last){last=html;who.innerHTML=html}
}
['click','change','input'].forEach(ev=>bar.addEventListener(ev,()=>setTimeout(updWho,0)));
const wrap=n=>{const f=window[n];if(typeof f=='function')window[n]=function(){const r=f.apply(this,arguments);updWho();return r}};
wrap('animSel');wrap('animSync');setInterval(updWho,400);updWho();

/* ---------- кнопка Ghosts ---------- */
const ghostsOn=false;   // кнопка «Призраки» убрана: призраки ключей на сцене отключены

/* ---------- меню Window: галочки = какие окна открыты; у каждого включённого окна своя вкладка в шапке сцены ----------
   При запуске: Animation включено (вкладка есть, окно открыто), Animator выключен. */
const OPEN_AT_START=true;               // false — вкладка Animation есть, но окно открывается кликом по ней
const en={clip:true,anim:false};        // галочки
const tabBtn=m=>document.querySelector(`.tb[data-tab="${m}"]`);
function syncTabs(){const c=window.amode;if(c&&c!='scene'&&c in en)en[c]=true;   // окно открыто любым способом -> у него есть галочка
  for(const m in en){const bt=tabBtn(m);if(bt)bt.classList.toggle('en',!!en[m])}}
function setMode(m){if(typeof window.setTab=='function')window.setTab(m)}
function toggleWin(m){
  if(en[m]){en[m]=false;if(window.amode==m)setMode('scene')}
  else{en[m]=true;syncTabs();setMode(m)}
  syncTabs();setTimeout(syncTabs,0);
}
{const st=window.setTab;if(typeof st=='function')window.setTab=function(){const r=st.apply(this,arguments);syncTabs();return r}}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.tb'))setTimeout(syncTabs,0)},true);
setInterval(syncTabs,250);
syncTabs();
setTimeout(()=>{if(OPEN_AT_START&&en.clip&&window.amode!='clip')setMode('clip');syncTabs()},0);

const W=document.createElement('div');W.id='wmenu';document.body.appendChild(W);
const wbtn=document.getElementById('mwin');
const ITEMS=[['clip','Animation','Ctrl+Shift+A'],['anim','Animator','']];
function wDraw(){W.innerHTML=ITEMS.map(([m,n,k])=>`<div class="wi" data-m="${m}"><b class="wk">${en[m]?'✔':''}</b><span class="wn2">${n}</span><i>${k}</i></div>`).join('')}
function wClose(){W.style.display='none';wbtn&&wbtn.classList.remove('on')}
function wOpen(){wDraw();const r=wbtn.getBoundingClientRect();W.style.left=r.left+'px';W.style.top=r.bottom+'px';W.style.display='block';wbtn.classList.add('on')}
if(wbtn){
  wbtn.addEventListener('click',e=>{e.stopPropagation();W.style.display=='block'?wClose():wOpen()});
  W.addEventListener('click',e=>{const it=e.target.closest('.wi');if(!it)return;toggleWin(it.dataset.m);wDraw();setTimeout(wClose,120)});
  document.addEventListener('mousedown',e=>{if(W.style.display=='block'&&!W.contains(e.target)&&e.target!==wbtn)wClose()},true);
  addEventListener('keydown',e=>{if(e.key=='Escape')wClose()});
  addEventListener('blur',wClose);
}
addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&(e.key=='A'||e.key=='a')){e.preventDefault();toggleWin('clip')}});
// дополнительные настройки (длина, FPS, повтор) спрятаны за ⚙
const setb=document.getElementById('tl-setb');
if(setb)setb.onclick=()=>{anm.classList.toggle('set');setb.classList.toggle('on',anm.classList.contains('set'))};

/* ---------- адаптер: ключи выбранного объекта в текущем клипе ----------
   Ожидаемая форма (подстроено под имена из project.js/index.html; если anim.js хранит иначе — правится только эта функция):
   clip.tracks[] = {obj|oid|target, prop|k|p, keys:[{t|time|f, v|value}]}.  Время в любых единицах — нужен лишь порядок. */
function readKeys(o){
  try{
    const R=window.AnimRT;if(!R||!R.clips)return null;
    const id=selClip&&selClip.value,clip=R.clips.find(c=>String(c.id)===String(id))||R.clips[0];if(!clip)return null;
    const tr=(clip.tracks||clip.curves||clip.props||[]).filter(t=>String(t.obj??t.oid??t.target??t.id)===String(o.id));
    const tracks=tr.map(t=>({p:t.prop??t.k??t.p,ks:(t.keys??t.kf??t.frames??[]).map(k=>({t:+(k.t??k.time??k.f),v:k.v??k.value})).filter(k=>isFinite(k.t)).sort((a,b)=>a.t-b.t)})).filter(t=>t.p&&t.ks.length);
    if(!tracks.length)return null;
    const times=[...new Set(tracks.flatMap(t=>t.ks.map(k=>k.t)))].sort((a,b)=>a-b);
    const at=(t,tk)=>{const ks=tk.ks;if(t<=ks[0].t)return ks[0].v;for(let i=1;i<ks.length;i++){if(t<=ks[i].t){const a=ks[i-1],b=ks[i];return typeof a.v=='number'&&typeof b.v=='number'?a.v+(b.v-a.v)*((t-a.t)/(b.t-a.t||1)):a.v}}return ks[ks.length-1].v};
    return times.map(t=>{const s={t};for(const tk of tracks)s[tk.p]=at(t,tk);return s});
  }catch(e){return null}
}

/* ---------- призраки ---------- */
function drawGhosts(g,W,H,cam){
  if(!ghostsOn||window.playing||window.amode!='clip')return;
  const o=get(sel);if(!o||o.screen)return;const S=readKeys(o);if(!S||S.length<1)return;
  const P=o.parent!=null&&get(o.parent)?wmat(get(o.parent)):null,sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>H/2-(y-cam.y)*cam.z;
  const n=S.length,col=i=>`hsl(${Math.round(190+(n>1?i/(n-1):0)*150)},95%,68%)`;
  const pose=S.map(s=>{const L={...o};for(const k of['x','y','r','sx','sy','rx','ry'])if(s[k]!=null)L[k]=s[k];const M=P?mulM(P,locM(L)):locM(L);return{M,s}});
  g.save();g.lineJoin=g.lineCap='round';
  // световая дорожка движения
  if(n>1){for(let pass=0;pass<2;pass++){g.beginPath();pose.forEach((p,i)=>{const x=sx(p.M[4]),y=sy(p.M[5]);i?g.lineTo(x,y):g.moveTo(x,y)});
    g.strokeStyle=pass?'#ffffffcc':col(Math.floor(n/2));g.globalAlpha=pass?.7:.35;g.lineWidth=pass?1.2:5;g.shadowColor=col(Math.floor(n/2));g.shadowBlur=pass?0:14;if(pass)g.setLineDash([6,5]);g.stroke();g.setLineDash([])}}
  g.shadowBlur=0;
  pose.forEach((p,i)=>{const{M,s}=p,c=col(i),im=o.img,sp=s.sprite!==undefined?s.sprite:im&&im.sprite,a=sp&&ast(sp),[w,h]=size(o,im&&{...im,sprite:sp});
    g.save();g.transform(M[0]*cam.z,-M[1]*cam.z,M[2]*cam.z,-M[3]*cam.z,sx(M[4]),sy(M[5]));g.scale(1,-1);
    // тело призрака: полупрозрачный спрайт/плашка + мягкое свечение цветом ключа
    g.globalAlpha=.30*(s.alpha!=null?+s.alpha:im?im.alpha:1);
    if(a&&a.img)g.drawImage(a.img,-w/2,-h/2,w,h);else{g.fillStyle=c;g.fillRect(-w/2,-h/2,w,h)}
    g.globalAlpha=.9;g.shadowColor=c;g.shadowBlur=12;g.strokeStyle=c;g.lineWidth=1.6/cam.z/Math.max(Math.abs(M[0])+Math.abs(M[1]),1e-6)*Math.max(Math.hypot(M[0],M[1]),1e-6);
    g.setLineDash([5/cam.z,4/cam.z]);g.strokeRect(-w/2,-h/2,w,h);g.restore();
    // бейдж с номером ключа
    const x=sx(M[4]),y=sy(M[5]);g.setLineDash([]);g.shadowColor=c;g.shadowBlur=8;g.globalAlpha=1;g.fillStyle=c;g.beginPath();g.arc(x,y,9,0,7);g.fill();
    g.shadowBlur=0;g.fillStyle='#10131a';g.font='bold 11px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(i+1,x,y+.5)});
  g.restore();
}
const _render=window.render;
window.render=function(g,W,H,cam,clean){_render.apply(this,arguments);if(!clean)drawGhosts(g,W,H,cam)};
})();

/* ---------- v40: имя клипа показывается один раз (select); ✎ временно заменяет его полем ввода для переименования ---------- */
(()=>{
const g=document.querySelector('#tl-bar .g-clip'),sel=document.getElementById('tl-sel'),nm=document.getElementById('tl-name');
if(g&&sel&&nm){
  const b=document.createElement('button');b.id='tl-ren';b.className='ib';b.textContent='✎';b.title='Переименовать анимацию';g.appendChild(b);
  const end=()=>g.classList.remove('ed');
  b.onclick=()=>{if(g.classList.contains('ed')){end();return}g.classList.add('ed');nm.focus();nm.select()};
  nm.addEventListener('blur',end);
  nm.addEventListener('keydown',e=>{if(e.key=='Enter'||e.key=='Escape'){e.preventDefault();end()}});
  b.addEventListener('mousedown',e=>{if(g.classList.contains('ed'))e.preventDefault()});
}
/* ручка: тянуть правый край списка свойств */
const lw=document.getElementById('tl-lw');
if(lw){
  const h=document.createElement('div');h.id='tl-rs';h.title='Потяните, чтобы изменить ширину списка';lw.appendChild(h);
  h.addEventListener('mousedown',e=>{e.preventDefault();const x0=e.clientX,w0=lw.getBoundingClientRect().width;h.classList.add('on');
    const mv=ev=>{lw.style.width=Math.max(220,w0+ev.clientX-x0)+'px'};
    const up=()=>{h.classList.remove('on');removeEventListener('mousemove',mv);removeEventListener('mouseup',up)};
    addEventListener('mousemove',mv);addEventListener('mouseup',up)});
}
})();

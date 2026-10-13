/* levelfx.js — у КАЖДОГО объекта свой случайный символ-узор, чтобы отличать объекты одного уровня (одного цвета):
   среди объектов одной глубины символы не повторяются (пока хватает символов). Символ запоминается за объектом (по id, в рамках проекта).
   Показывается: плитка + «печать» на фоне строки в Hierarchy, фон Inspector и списка свойств в Animation.
   Кнопка 🎲 в шапке Hierarchy — перебросить все символы заново. */
(()=>{
if(typeof hHue!='function'||typeof order!='function')return;
const SYMS=[...'☠☮☯♠Ω♤♣♧♥♡♦♢♔♕♚♛⚜★☆✮✯☄☾☽☼☀☁☂☃☻☺'];
let key=null,map={};
const storeKey=()=>'lvlObjSyms:'+((window.Project&&Project.info&&(Project.info.dir||Project.info.name))||'default');
function load(){const k=storeKey();if(k===key)return;key=k;map={};try{map=JSON.parse(localStorage.getItem(k)||'{}')||{}}catch(e){map={}}}
const save=()=>{try{localStorage.setItem(key,JSON.stringify(map))}catch(e){}};
// раздать символы: объекты одной глубины получают разные
function ensure(){load();let ch=false;const used={},ids=new Set(),L=order();
  for(const{o,d}of L){ids.add(o.id);const u=used[d]||(used[d]=new Set());let s=map[o.id];
    if(!s||u.has(s)||!SYMS.includes(s)){const free=SYMS.filter(x=>!u.has(x)),pool=free.length?free:SYMS;s=pool[Math.floor(Math.random()*pool.length)];map[o.id]=s;ch=true}
    u.add(s)}
  for(const id in map)if(!ids.has(+id)){delete map[id];ch=true}
  if(ch)save()}
const symFor=o=>{if(!o)return null;if(!map[o.id]||key!==storeKey())ensure();return map[o.id]||null};
const FF="Segoe UI Symbol,Noto Sans Symbols,Noto Sans Symbols 2,Arial Unicode MS,DejaVu Sans,sans-serif";
const url=svg=>'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
const cache={};
function art(h,sym){const k=h+'|'+sym;if(cache[k])return cache[k];
  const s=sym+'&#xFE0E;',fill=`hsl(${h},95%,88%)`;
  return cache[k]={sym,
   tile:url(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><g font-family="${FF}" font-size="15" text-anchor="middle" dominant-baseline="central" fill="${fill}" fill-opacity=".13"><text x="11" y="11" transform="rotate(-14 11 11)">${s}</text><text x="33" y="33" transform="rotate(12 33 33)">${s}</text></g></svg>`),
   stamp:url(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><text x="30" y="31" font-family="${FF}" font-size="42" text-anchor="middle" dominant-baseline="central" fill="${fill}" fill-opacity=".55">${s}</text></svg>`)}}
// Inspector / Animation: переменные --opat, --ostamp, --osym для выбранного объекта o на глубине d
window.lvlApply=(el,d,o)=>{if(!el||!o)return;const s=symFor(o);if(!s)return;const a=art(hHue(d),s);
  el.style.setProperty('--opat',a.tile);el.style.setProperty('--ostamp',a.stamp);el.style.setProperty('--osym','"'+s+'\uFE0E"')};
// Hierarchy: после каждой перерисовки раздаём строкам их узор
function paintRows(){ensure();const h=document.getElementById('hier');if(!h)return;
  h.querySelectorAll('.it').forEach(r=>{const o=get(+r.dataset.id),s=o&&map[o.id];if(!s)return;const a=art(hHue(+r.dataset.d||0),s);
    r.style.setProperty('--opat',a.tile);r.style.setProperty('--ostamp',a.stamp);r.title=r.title||''})}
const _hier=window.hier;
if(typeof _hier=='function')window.hier=function(){const r=_hier.apply(this,arguments);try{paintRows()}catch(e){}return r};
window.lvlReroll=()=>{load();map={};save();try{window.hier&&hier();window.inspect&&inspect()}catch(e){}};
// узор показываем только у объектов ТЕКУЩЕГО уровня: уровень выбранного в Hierarchy (или заданный ползунком уровней)
{const st=document.createElement('style');st.id='lvl-cur';let css='';
 for(let d=0;d<=40;d++)css+=`#hier[data-cur="${d}"] .it[data-d="${d}"]::after{background-image:var(--ostamp),var(--opat)}`;
 st.textContent=css;document.head.appendChild(st);
 const h=document.getElementById('hier');let raf=0;
 function cur(){raf=0;let d=null;
  if(typeof hlvl!='undefined'&&hlvl>0)d=hlvl-1;
  else if(typeof sel!='undefined'&&sel!=null){const r=h.querySelector('.it[data-id="'+sel+'"]');if(r)d=+r.dataset.d}
  if(d==null)h.removeAttribute('data-cur');else if(h.getAttribute('data-cur')!=String(d))h.setAttribute('data-cur',d)}
 const q=()=>{if(!raf)raf=requestAnimationFrame(cur)};
 if(h){new MutationObserver(q).observe(h,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});cur()}}
try{window.hier&&hier()}catch(e){}
})();

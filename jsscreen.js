/* JS Screen — объект-«экран игры»: задаёт область, которую увидит игрок в экспортированной веб-версии (Export ▸ Web).
   Основан на Screen (рамка, gizmo, Scale = Size работают так же), но вместо записи GIF/MP4 хранит настройки плеера:
   размер/пресет устройства, режим масштабирования, цвета, лимит зума, сглаживание, ориентацию и т.д.
   Данные лежат в o.screen с kind:'js' → формат файла проекта прежний. */
(()=>{
const $=s=>document.querySelector(s),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),ins=$('#ins');

/* ---------- данные ---------- */
const MODES=[
 ['fit','Fit — вся область видна, поля по краям'],
 ['pixel','Pixel Perfect — целочисленный зум, поля по краям'],
 ['height','Match Height — на широком экране видно больше по ширине'],
 ['width','Match Width — на высоком экране видно больше по высоте'],
 ['expand','Expand — без полей, область всегда целиком видна'],
 ['cover','Cover — без полей, края области обрезаются']];
const ORIENT=[['any','Любая'],['landscape','Только горизонтальная'],['portrait','Только вертикальная']];
const MAXK=[[0,'Без лимита'],[1,'1× (не больше 100%)'],[2,'2×'],[3,'3×'],[4,'4×']];
const DPRS=[[0,'Auto (до 2×)'],[1,'не выше 1× (быстро)'],[1.5,'не выше 1.5×'],[2,'не выше 2×'],[3,'не выше 3× (чётко, тяжело)']];
const GUIDE=[[4/3,'4:3'],[16/9,'16:9'],[21/9,'21:9'],[9/16,'9:16'],[9/19.5,'9:19.5']];
/* [значение, подпись] — группы пресетов устройств (размеры в CSS-пикселях) */
const PRE=[
 ['Десктоп',[['1920x1080','Full HD 1920 × 1080 (16:9)'],['1600x900','1600 × 900 (16:9)'],['1366x768','Ноутбук 1366 × 768'],['1280x720','HD 1280 × 720 (16:9)'],['1024x768','1024 × 768 (4:3)'],['800x600','800 × 600 (4:3)']]],
 ['Телефон — горизонтально',[['844x390','iPhone 14 · 844 × 390'],['932x430','iPhone 14 Pro Max · 932 × 430'],['915x412','Android · 915 × 412'],['800x360','Android compact · 800 × 360']]],
 ['Телефон — вертикально',[['390x844','iPhone 14 · 390 × 844'],['430x932','iPhone 14 Pro Max · 430 × 932'],['412x915','Android · 412 × 915'],['360x800','Android compact · 360 × 800']]],
 ['Планшет',[['1180x820','iPad Air · 1180 × 820'],['820x1180','iPad Air · 820 × 1180'],['1024x768','iPad · 1024 × 768'],['768x1024','iPad · 768 × 1024']]],
 ['Квадрат / Пиксель-арт',[['512x512','512 × 512'],['256x256','256 × 256'],['640x360','640 × 360 (16:9)'],['320x180','320 × 180 (16:9)'],['480x270','480 × 270 (16:9)']]]];

window.mkJsScreen=()=>({kind:'js',w:1280,h:720,bg:'#202020',bgo:'#000000',transp:false,k:1,
  mode:'height',maxk:0,dpr:0,smooth:true,orient:'any',fs:true,guides:true});
const isJs=o=>!!(o&&o.screen&&o.screen.kind=='js');
window.isJsScreen=isJs;
const jsList=()=>objs.filter(o=>isJs(o));
window.jsScreens=jsList;

/* настройки, которые попадают в game.json → view */
window.jsScreenView=o=>{const S=o.screen,Mx=window.order?order().find(e=>e.o.id==o.id):null;
  const x=Mx?Mx.M[4]:o.x||0,y=Mx?Mx.M[5]:o.y||0;
  return{x:rd(x),y:rd(y),w:Math.max(.5,S.w/PPU),h:Math.max(.5,S.h/PPU),mode:S.mode||'height',bg:S.bg||'#202020',bgOuter:S.bgo||'#000000',
    maxScale:+S.maxk||0,dpr:+S.dpr||0,smooth:S.smooth!==false,orient:S.orient||'any',fs:S.fs!==false}};

/* какая область мира видна на экране с пропорциями r = ширина/высота (в единицах сцены) */
function visible(S,r){const vw=S.w/PPU,vh=S.h/PPU,ar=vw/vh,m=S.mode||'height';
  if(m=='width')return[vw,vw/r];
  if(m=='expand')return r>=ar?[vh*r,vh]:[vw,vw/r];
  if(m=='cover')return r>=ar?[vw,vw/r]:[vh*r,vh];
  if(m=='fit'||m=='pixel')return null;
  return[vh*r,vh]}

/* ---------- Inspector ---------- */
const row=(l,c,tip)=>`<div class="r"><span class="l" ${tip?`title="${esc(tip)}"`:''}>${l}</span>${c}</div>`;
const selHtml=(key,list,cur)=>`<select data-js="${key}" style="flex:1;max-width:none">${list.map(([v,t])=>`<option value="${v}" ${v==cur?'selected':''}>${t}</option>`).join('')}</select>`;
const gcd=(a,b)=>b?gcd(b,a%b):a;
function ratioTxt(S){const g=gcd(S.w,S.h),a=S.w/g,b=S.h/g;return a<=40&&b<=40?`${a}:${b}`:(S.w/S.h).toFixed(2)+':1'}

window.jsScrHtml=function(o){const S=o.screen,cur=S.w+'x'+S.h,mode=S.mode||'height',vis=visible(S,16/9);
  const note={fit:'Область всегда видна целиком. Если пропорции экрана другие — по краям цвет Letterbox.',
   pixel:'Как Fit, но зум только целый (1×, 2×, 3×…) — картинка без размытия. Для пиксель-арта.',
   height:'Высота области всегда видна целиком; на широком экране игрок увидит больше по бокам (см. Aspect guides).',
   width:'Ширина области всегда видна целиком; на высоком экране игрок увидит больше сверху/снизу.',
   expand:'Область видна целиком, а свободное место заполняется сценой (без полей).',
   cover:'Экран заполняется полностью, лишнее по краям области обрезается.'}[mode];
  return`<div class="sec"><div class="sh">JS Screen<button data-crm="screen" title="Remove Component">✕</button></div>
${row('Device',`<select data-js="pre" style="flex:1;max-width:none"><option value="">Custom · ${S.w} × ${S.h}</option>${PRE.map(([g,l])=>`<optgroup label="${g}">${l.map(([v,t])=>`<option value="${v}" ${v==cur?'selected':''}>${t}</option>`).join('')}</optgroup>`).join('')}</select>`,'Размер области = экран выбранного устройства')}
${row('Width',`<input type="number" min="16" max="4096" step="1" data-js="w" value="${S.w}">`)}
${row('Height',`<input type="number" min="16" max="4096" step="1" data-js="h" value="${S.h}">`)}
<div class="r"><button data-js-act="swap" style="flex:1" title="Поменять ширину и высоту местами">⟲ Rotate (${S.w}↔${S.h})</button><button data-js-act="focus" style="flex:1" title="Показать область в Scene на весь экран">🎯 Focus in Scene</button></div>
<div class="e" style="padding:2px 0;color:#888">${S.w} × ${S.h} px · ${ratioTxt(S)} · ${(S.w/PPU).toFixed(2)} × ${(S.h/PPU).toFixed(2)} юнитов</div>
${row('Scale mode',selHtml('mode',MODES,mode))}
<div class="e" style="padding:0 0 4px;color:#888">${note}</div>
${row('Background',`<input type="color" data-js="bg" value="${S.bg}">`,'Цвет сцены внутри области')}
${row('Letterbox',`<input type="color" data-js="bgo" value="${S.bgo||'#000000'}">`,'Цвет полей вокруг области и фон страницы')}
${row('Max scale',selHtml('maxk',MAXK,+S.maxk||0),'Ограничить увеличение (на 4K-мониторе игра не раздувается)')}
${row('Pixel ratio',selHtml('dpr',DPRS,+S.dpr||0),'Максимальная плотность пикселей канваса: выше — чётче, но тяжелее')}
${row('Orientation',selHtml('orient',ORIENT,S.orient||'any'),'Если телефон повёрнут не так — игрок увидит подсказку «Поверните устройство»')}
${row('Options',`<label><input type="checkbox" data-js="smooth" ${S.smooth!==false?'checked':''}> Smoothing</label><label style="margin-left:8px"><input type="checkbox" data-js="fs" ${S.fs!==false?'checked':''}> Fullscreen ⛶</label>`,'Smoothing выключен = «пиксельное» масштабирование спрайтов')}
${row('Guides',`<label><input type="checkbox" data-js="guides" ${S.guides!==false?'checked':''}> Aspect guides${vis?'':' (нет для этого режима)'}</label>`,'Показывать в Scene, что увидят игроки на экранах 4:3, 16:9, 21:9 и 9:19.5')}
<div class="r"><button data-js-act="export" style="flex:1;background:#2c5d87">🌐 Export Web…</button></div>
<div class="e" style="padding:2px 0;color:#888">Эта область станет видимой частью игры при Export ▸ Web. Позиция — из Transform; Scale и Size — одно и то же (1 юнит = 100 px).</div></div>`};

ins.addEventListener('input',e=>{const t=e.target,k=t.dataset.js,o=get(sel);if(k===undefined||!isJs(o))return;const S=o.screen;
  if(k=='w'||k=='h'){const v=parseFloat(t.value);if(isNaN(v))return;S[k]=cl(Math.round(v),16,4096);draw();return}
  if(k=='pre'){if(!t.value)return;[S.w,S.h]=t.value.split('x').map(Number);inspect();draw();return}
  if(k=='bg'||k=='bgo'){S[k]=t.value;draw();return}
  if(k=='smooth'||k=='fs'||k=='guides'){S[k]=t.checked;draw();return}
  if(k=='mode'||k=='orient'){S[k]=t.value;inspect();draw();return}
  if(k=='maxk'||k=='dpr'){S[k]=+t.value;return}});
ins.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.js;if(k=='w'||k=='h')inspect()});
ins.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-js-act]'),o=get(sel);if(!b||!isJs(o))return;const S=o.screen,a=b.dataset.jsAct;
  if(a=='swap'){[S.w,S.h]=[S.h,S.w];inspect();draw()}
  else if(a=='focus')focus(o);
  else if(a=='export')window.Exporter&&Exporter.open(o.id)});

function focus(o){const S=o.screen,en=order().find(x=>x.o.id==o.id),cv=$('#cv');if(!en||!cv)return;
  const w=S.w/PPU,h=S.h/PPU;cam.x=en.M[4];cam.y=en.M[5];cam.z=cl(Math.min(cv.clientWidth/w,cv.clientHeight/h)*.9,5,2000);draw()}

/* ---------- отрисовка в редакторе: рамка JS Screen + aspect guides ---------- */
window.jsScrDraw=(g,o,X,Y,w,h,cam_)=>{const S=o.screen,z=cam_.z;
  if(S.guides===false)return;
  const cx=X+w/2,cy=Y+h/2;g.save();g.font='10px Segoe UI,sans-serif';g.textAlign='left';g.textBaseline='top';g.setLineDash([3,4]);g.lineWidth=1;
  GUIDE.forEach(([r,name],i)=>{const v=visible(S,r);if(!v)return;const gw=v[0]*z,gh=v[1]*z;
    if(Math.abs(gw-w)<1.5&&Math.abs(gh-h)<1.5)return;           // совпадает с рамкой
    g.strokeStyle=['#ff9f43','#2ed573','#ff6b81','#a29bfe','#1dd1a1'][i];g.fillStyle=g.strokeStyle;
    g.strokeRect(cx-gw/2,cy-gh/2,gw,gh);g.fillText(name,cx-gw/2+4,cy-gh/2+3)});
  g.restore()};

/* ---------- меню ---------- */
const _cm=window.compMenu;
window.compMenu=o=>{const it=_cm?_cm(o):[];if(o.screen)return it;if(!o.img&&!o.text&&!o.grad)it.unshift(['JS Screen',()=>{o.screen=mkJsScreen();refresh()}]);return it};
})();

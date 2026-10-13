/* Компонент Gradient (UI / Gradient): настраиваемый полупрозрачный градиент с узорами. Работает как Image: размер, цвет/прозрачность, анимация Alpha */
(()=>{
const $=s=>document.querySelector(s),ins=$('#ins');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hex=h=>{h=/^#[0-9a-f]{6}$/i.test(h||'')?h:'#ffffff';return[1,3,5].map(i=>parseInt(h.substr(i,2),16))};
const rgba=(c,a)=>{const[r,g,b]=hex(c);return`rgba(${r},${g},${b},${rd(clamp(a==null?1:a,0,1))})`};

window.mkGrad=()=>({type:'linear',angle:90,w:2,h:2,alpha:1,
  stops:[{p:0,c:'#ff4081',a:.85},{p:1,c:'#3d5afe',a:.25}],
  pattern:'none',pmode:'cut',pscale:.25,pangle:0,pthick:.5,pstr:1,pcol:'#ffffff',pinv:false});

const PATTERNS=[['none','None'],['stripes','Stripes (полосы)'],['dots','Dots (точки)'],['checker','Checker (шахматка)'],['grid','Grid (сетка)'],
  ['waves','Waves (волны)'],['diamonds','Diamonds (ромбы)'],['triangles','Triangles (треугольники)'],['plus','Plus (кресты)']];

/* ---------- узоры: Path2D из НЕперекрывающихся фигур (чтобы работали Invert и even-odd) ---------- */
const pcache=new Map();
function buildPath(kind,w,h,s,ang,th){
  const R=Math.hypot(w,h)/2+s,P=new Path2D(),n=Math.ceil(R/s)+1,t=clamp(th,.05,.95);
  const rect=(x,y,a,b)=>P.rect(x,y,a,b);
  const poly=pts=>{P.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)P.lineTo(pts[i][0],pts[i][1]);P.closePath()};
  if(kind=='stripes'){for(let i=-n;i<=n;i++)rect(-R,i*s,2*R,s*t)}
  else if(kind=='dots'){const r=s*t/2;for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++){const x=i*s+s/2,y=j*s+s/2;P.moveTo(x+r,y);P.arc(x,y,r,0,Math.PI*2)}}
  else if(kind=='checker'){for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)if(((i+j)&1)==0)rect(i*s,j*s,s,s)}
  else if(kind=='grid'){const lw=Math.max(s*t*.5,s*.02),gap=s-lw;                     // горизонтали на всю ширину, вертикали — только между ними (без наложения)
    for(let j=-n;j<=n;j++){rect(-R,j*s,2*R,lw);for(let i=-n;i<=n;i++)rect(i*s,j*s+lw,lw,gap)}}
  else if(kind=='waves'){const amp=s*.25,step=Math.max(s/8,.004),len=Math.ceil(2*R/step);
    for(let j=-n;j<=n;j++){const y0=j*s,f=x=>y0+Math.sin(x/s*Math.PI*2)*amp,top=[],bot=[];
      for(let k=0;k<=len;k++){const x=-R+k*step;top.push([x,f(x)]);bot.push([x,f(x)+s*t])}
      poly(top.concat(bot.reverse()))}}
  else if(kind=='diamonds'){const r=s*t/2;for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++){const x=i*s+s/2,y=j*s+s/2;poly([[x,y-r],[x+r,y],[x,y+r],[x-r,y]])}}
  else if(kind=='triangles'){const b=s*t;for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++){const x=i*s+s/2,y=j*s+s/2;poly([[x,y-b/2],[x+b/2,y+b/2],[x-b/2,y+b/2]])}}
  else if(kind=='plus'){const a=s*t/2,c=a/3;for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++){const x=i*s+s/2,y=j*s+s/2;
    poly([[x-c,y-a],[x+c,y-a],[x+c,y-c],[x+a,y-c],[x+a,y+c],[x+c,y+c],[x+c,y+a],[x-c,y+a],[x-c,y+c],[x-a,y+c],[x-a,y-c],[x-c,y-c]])}}
  const out=new Path2D();out.addPath(P,new DOMMatrix().rotate(ang));return out}
function patPath(G,w,h){
  // не даём создать слишком много фигур
  const R=Math.hypot(w,h)/2,s=Math.max(+G.pscale||.25,R/45),key=[G.pattern,rd(w),rd(h),rd(s),rd(+G.pangle||0),rd(G.pthick)].join('|');
  let p=pcache.get(key);
  if(!p){if(pcache.size>40)pcache.clear();p=buildPath(G.pattern,w,h,s,+G.pangle||0,G.pthick==null?.5:G.pthick);pcache.set(key,p)}
  return p}

/* ---------- заливка ---------- */
function paint(g,G,w,h){
  const st=(G.stops&&G.stops.length?G.stops.slice():[{p:0,c:'#ffffff',a:1},{p:1,c:'#ffffff',a:0}]).sort((a,b)=>a.p-b.p);
  const a=(+G.angle||0)*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);let gr;
  if(G.type=='radial')gr=g.createRadialGradient(0,0,0,0,0,Math.max(Math.hypot(w,h)/2,1e-6));
  else if(G.type=='conic'&&g.createConicGradient)gr=g.createConicGradient(a,0,0);
  else{const L=(Math.abs(w*dx)+Math.abs(h*dy))/2;gr=g.createLinearGradient(-dx*L,-dy*L,dx*L,dy*L)}
  st.forEach(s=>gr.addColorStop(clamp(s.p,0,1),rgba(s.c,s.a)));return gr}

// вызывается из render() в локальных осях объекта (y вниз, единицы сцены)
window.drawGrad=(g,G,w,h)=>{
  const A=clamp(G.alpha==null?1:G.alpha,0,1);if(A<=0)return;
  const x=-w/2,y=-h/2,fill=paint(g,G,w,h),pat=G.pattern&&G.pattern!='none'?patPath(G,w,h):null,str=clamp(G.pstr==null?1:G.pstr,0,1);
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.fillStyle=fill;
  if(!pat){g.globalAlpha=A;g.fillRect(x,y,w,h)}
  else{
    const inv=new Path2D();inv.rect(x-1e3,y-1e3,w+2e3,h+2e3);inv.addPath(pat);        // «всё, кроме узора» (even-odd)
    const inside=G.pinv?inv:pat,outside=G.pinv?pat:inv;
    if(G.pmode=='over'){                                                                // узор поверх градиента
      g.globalAlpha=A;g.fillRect(x,y,w,h);
      g.globalAlpha=A*str;g.fillStyle=G.pcol||'#ffffff';g.fill(inside,G.pinv?'evenodd':'nonzero')}
    else{                                                                               // градиент проступает сквозь узор
      g.save();g.clip(inside,G.pinv?'evenodd':'nonzero');g.globalAlpha=A;g.fillRect(x,y,w,h);g.restore();
      if(str<1){g.save();g.clip(outside,G.pinv?'nonzero':'evenodd');g.globalAlpha=A*(1-str);g.fillRect(x,y,w,h);g.restore()}}}
  g.restore();g.globalAlpha=1};

/* ---------- Inspector ---------- */
const sel_=(k,v,opts)=>`<select class="wide" data-gx="${k}">${opts.map(([a,n])=>`<option value="${a}" ${a==v?'selected':''}>${n}</option>`).join('')}</select>`;
const num=(k,v,st,mn,mx)=>`<input type="number" data-gx="${k}" step="${st}" ${mn!=null?`min="${mn}"`:''} ${mx!=null?`max="${mx}"`:''} value="${rd(v)}">`;
const rng=(k,v)=>`<input type="range" min="0" max="1" step="0.01" data-gx="${k}" value="${v}"><span data-gv="${k}" style="width:30px">${rd(v)}</span>`;
const row=(l,c,tip)=>`<div class="r"><span class="l" ${tip?`title="${tip}"`:''}>${l}</span>${c}</div>`;
const sh=t=>`<div class="sh" style="margin:8px 0 4px;color:#aaa">${t}</div>`;
const CHK='conic-gradient(#2a2a2a 25%,#3a3a3a 0 50%,#2a2a2a 0 75%,#3a3a3a 0) 0 0/10px 10px';
function barCss(G){
  const st=(G.stops||[]).slice().sort((a,b)=>a.p-b.p);if(!st.length)return'none';
  return`linear-gradient(90deg,${st.map(s=>`${rgba(s.c,s.a)} ${Math.round(clamp(s.p,0,1)*100)}%`).join(',')})`}
function gradHtml(o){
  const G=o.grad,lin=G.type=='linear'||G.type=='conic',pt=G.pattern&&G.pattern!='none';
  return`<div class="sec"><div class="sh">Gradient<button data-crm="grad" title="Remove Component">✕</button></div>
${row('Type',sel_('type',G.type,[['linear','Linear'],['radial','Radial'],['conic','Conic (угловой)']]))}
${lin?row('Angle',num('angle',G.angle,1),'Угол: 0° — слева направо, 90° — сверху вниз'):''}
${row('Width',num('w',G.w,.1,.01),'Rect (units)')}${row('Height',num('h',G.h,.1,.01),'Rect (units)')}
<div class="r"><span class="l">Alpha</span><input type="range" min="0" max="1" step="0.01" data-ik="alpha" value="${G.alpha}"><span data-av style="width:30px">${rd(G.alpha)}</span></div>
${sh('Colors (стопы)')}
<div data-gbar style="height:18px;border:1px solid #111;border-radius:2px;margin:2px 0 6px;background:${barCss(G)},${CHK}"></div>
${G.stops.map((s,i)=>`<div class="r"><input type="number" data-gs="${i}.p" step="0.05" min="0" max="1" value="${rd(s.p)}" style="width:50px;flex:none" title="Позиция 0…1"><input type="color" data-gs="${i}.c" value="${s.c}"><input type="range" min="0" max="1" step="0.01" data-gs="${i}.a" value="${s.a}" title="Прозрачность стопа"><span data-gsv="${i}" style="width:28px">${rd(s.a)}</span><button data-gdel="${i}" title="Удалить стоп" ${G.stops.length<=2?'disabled':''}>✕</button></div>`).join('')}
<div class="r"><button data-gadd>＋ Stop</button><button data-grev title="Поменять цвета местами">⇄ Reverse</button></div>
${sh('Pattern (узор)')}
${row('Pattern',sel_('pattern',G.pattern||'none',PATTERNS))}
${pt?row('Mode',sel_('pmode',G.pmode||'cut',[['cut','Cut-out (градиент сквозь узор)'],['over','Overlay (узор поверх)']]))
 +row('Scale',num('pscale',G.pscale,.05,.01),'Размер ячейки (units)')
 +row('Angle',num('pangle',G.pangle,5))
 +row('Thickness',rng('pthick',G.pthick),'Толщина фигур в ячейке')
 +row('Strength',rng('pstr',G.pstr==null?1:G.pstr),G.pmode=='over'?'Прозрачность узора':'Насколько скрыт градиент вне узора')
 +(G.pmode=='over'?row('Color',`<input type="color" data-gx="pcol" value="${G.pcol||'#ffffff'}">`):'')
 +row('Invert',`<input type="checkbox" data-gx="pinv" ${G.pinv?'checked':''}>`,'Поменять местами узор и фон'):''}</div>`}

const _ch=window.compHtml,_cm=window.compMenu;
window.compHtml=o=>(o.grad?gradHtml(o):'')+(_ch?_ch(o):'');
window.compMenu=o=>{const it=_cm?_cm(o):[];if(!o.grad&&!o.img&&!o.text)it.unshift(['UI / Gradient',()=>{o.grad=mkGrad();refresh()}]);return it};

const REDRAW=new Set(['type','pattern','pmode']),NUM={w:.01,h:.01,pscale:.01};
ins.addEventListener('input',e=>{
  const t=e.target,o=get(sel);if(!o||!o.grad)return;const G=o.grad;
  if(t.dataset.gx!==undefined){const k=t.dataset.gx;
    if(t.type=='checkbox')G[k]=t.checked;
    else if(t.type=='number'){let v=parseFloat(t.value);if(isNaN(v))return;if(NUM[k]!==undefined)v=Math.max(NUM[k],v);G[k]=v}
    else if(t.type=='range'){G[k]=parseFloat(t.value);const sp=ins.querySelector(`[data-gv="${k}"]`);if(sp)sp.textContent=rd(G[k])}
    else G[k]=t.value;
    if(REDRAW.has(k)&&t.tagName=='SELECT')inspect();
    draw()}
  else if(t.dataset.gs!==undefined){const[i,f]=t.dataset.gs.split('.'),s=G.stops[+i];if(!s)return;
    if(f=='c')s.c=t.value;else{const v=parseFloat(t.value);if(isNaN(v))return;s[f]=clamp(v,0,1);if(f=='a'){const sp=ins.querySelector(`[data-gsv="${i}"]`);if(sp)sp.textContent=rd(s.a)}}
    const b=ins.querySelector('[data-gbar]');if(b)b.style.background=barCss(G)+','+CHK;
    draw()}});
ins.addEventListener('click',e=>{
  const t=e.target,d=t.dataset,o=get(sel);if(!o||!o.grad)return;const G=o.grad;
  if(d.gadd!==undefined){                                   // новый стоп — посередине самого широкого промежутка
    const st=G.stops.slice().sort((a,b)=>a.p-b.p);let bi=0,bg=-1;
    for(let i=0;i<st.length-1;i++){const gp=st[i+1].p-st[i].p;if(gp>bg){bg=gp;bi=i}}
    const A=st[bi],B=st[bi+1]||A;G.stops.push({p:rd((A.p+B.p)/2),c:A.c,a:A.a});inspect();draw();return}
  if(d.gdel!==undefined&&G.stops.length>2){G.stops.splice(+d.gdel,1);inspect();draw();return}
  if(d.grev!==undefined){G.stops.forEach(s=>s.p=rd(1-s.p));inspect();draw()}});
})();

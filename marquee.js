/* marquee.js — рамочное выделение в окне Scene + общая рамка группы.
   • ЛКМ по пустому месту и тянем — «резиновая» рамка; все объекты, которых она касается, выделяются (Screen — только если рамка накрыла его целиком).
   • Shift+рамка — добавить к текущему выделению; Shift+клик по объекту — добавить/убрать его из выделения.
   • Когда выделено 2+ объекта, одиночные маркеры масштаба скрыты, вокруг группы рисуется рамка: тянешь за неё (границу или пустое место внутри) — двигается вся группа
     (с Rec ключи пишутся у всех сразу — используется тот же drag, что и при перетаскивании за объект).
   • Esc во время рамки — отмена. */
(()=>{
const scn=document.getElementById('scn');if(!scn)return;
const BORDER=7,MOVE=4;                                   // зона захвата границы группы, px; порог «это уже drag, а не клик», px
let mq=null,hoverFrame=false;

const ids=()=>selIds();                                  // из index.html: выделенные id (или [sel])
const multi=()=>ids().length>1;
const hasRect=o=>!!(o.img||o.text||o.grad||o.screen);
const cvPos=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
const dims=()=>({W:cv.clientWidth,H:cv.clientHeight});
const s2w=(px,py)=>{const{W,H}=dims();return{x:(px-W/2)/cam.z+cam.x,y:-(py-H/2)/cam.z+cam.y}};
const w2s=(x,y)=>{const{W,H}=dims();return[(x-cam.x)*cam.z+W/2,H/2-(y-cam.y)*cam.z]};

// углы объекта в мире (локальный прямоугольник через мировую матрицу)
function quadOf(o){const M=wmat(o),[w,h]=size(o);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>{const p=apM(M,x,y);return[p.x,p.y]})}
// пересечение выпуклого четырёхугольника и осевого прямоугольника (SAT)
function quadHitsRect(q,x0,y0,x1,y1){
  let a0=1e18,a1=-1e18,b0=1e18,b1=-1e18;for(const[x,y]of q){if(x<a0)a0=x;if(x>a1)a1=x;if(y<b0)b0=y;if(y>b1)b1=y}
  if(a1<x0||a0>x1||b1<y0||b0>y1)return false;
  for(let i=0;i<2;i++){const ex=q[i+1][0]-q[i][0],ey=q[i+1][1]-q[i][1],nx=-ey,ny=ex;
    let p0=1e18,p1=-1e18;for(const[x,y]of q){const d=x*nx+y*ny;if(d<p0)p0=d;if(d>p1)p1=d}
    let r0=1e18,r1=-1e18;for(const[x,y]of[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]){const d=x*nx+y*ny;if(d<r0)r0=d;if(d>r1)r1=d}
    if(p1<r0||p0>r1)return false}
  return true}
const quadInsideRect=(q,x0,y0,x1,y1)=>q.every(([x,y])=>x>=x0&&x<=x1&&y>=y0&&y<=y1);

function collect(x0,y0,x1,y1){
  const out=[];
  for(const{o,on}of order()){if(!on||!hasRect(o))continue;
    const q=quadOf(o);if(o.screen?quadInsideRect(q,x0,y0,x1,y1):quadHitsRect(q,x0,y0,x1,y1))out.push(o.id)}
  return out}

// охват группы в мире: все собственные прямоугольники выделенных и их потомков
function groupBox(){
  let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;const quads=[];
  for(const id of ids())for(const d of subtree(id)){if(!hasRect(d))continue;const q=quadOf(d);
    quads.push(q);for(const[x,y]of q){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  return x0<=x1?{x0,y0,x1,y1,quads}:null}

// вне пределов экрана → в экранные px, с минимальной толщиной, чтобы рамку можно было схватить
function frameScr(){const b=groupBox();if(!b)return null;
  const[a0,b0]=w2s(b.x0,b.y1),[a1,b1]=w2s(b.x1,b.y0);
  return{b,l:a0-4,t:b0-4,r:a1+4,btm:b1+4}}

function inFrame(F,p){return p.x>=F.l-BORDER&&p.x<=F.r+BORDER&&p.y>=F.t-BORDER&&p.y<=F.btm+BORDER}

function commit(list){
  const uniq=[...new Set(list)];msel.clear();
  if(!uniq.length)sel=null;
  else{sel=uniq[uniq.length-1];if(uniq.length>1)uniq.forEach(i=>msel.add(i));if(typeof hanc!='undefined')hanc=sel}
  refresh()}

function startGroupDrag(w){
  drag={gx:w.x,gy:w.y,items:selTop(ids()).map(get).filter(Boolean).map(o=>{const p=worldPos(o);return{o,x:p.x,y:p.y}})}}

/* ---------- mousedown (capture на #scn — после gizmo.js, поэтому его маркеры в приоритете) ---------- */
scn.addEventListener('mousedown',e=>{
  if(e.target!==cv||e.button||e.altKey||window.playing)return;
  const p=cvPos(e),w=s2w(p.x,p.y),hits=hitAll(w),solid=hits.filter(o=>!o.screen);

  // 1) клик по рамке группы (граница или пустое место внутри; по чужому объекту внутри рамки — обычный выбор)
  if(multi()&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
    const F=frameScr();
    if(F&&inFrame(F,p)){
      const onBorder=p.x<F.l+BORDER||p.x>F.r-BORDER||p.y<F.t+BORDER||p.y>F.btm-BORDER,sset=new Set(ids());
      if(onBorder||!solid.length||solid.some(o=>sset.has(o.id))){e.stopImmediatePropagation();e.preventDefault();startGroupDrag(w);return}}}

  // 2) Shift+клик по объекту — добавить/убрать из выделения
  if(e.shiftKey&&solid.length){
    e.stopImmediatePropagation();e.preventDefault();
    const t=solid[0],cur=ids().filter(i=>get(i)),k=cur.indexOf(t.id);
    if(k>=0)cur.splice(k,1);else cur.push(t.id);
    commit(cur);return}

  // 3) пустое место (или внутри не выбранного Screen) — начинаем рамку
  const s=get(sel),screenSelHit=!!s&&s.screen&&hits.includes(s);
  if(solid.length||screenSelHit&&!e.shiftKey)return;     // обычная логика index.html: выбор / перетаскивание
  e.stopImmediatePropagation();e.preventDefault();
  mq={sx:p.x,sy:p.y,cx:p.x,cy:p.y,add:e.shiftKey,base:e.shiftKey?ids().slice():[],moved:false,pre:[],e0:e};
  draw()},true);

addEventListener('mousemove',e=>{
  if(mq){
    const p=cvPos(e);mq.cx=p.x;mq.cy=p.y;
    if(!mq.moved&&Math.hypot(mq.cx-mq.sx,mq.cy-mq.sy)>=MOVE)mq.moved=true;
    if(mq.moved){const a=s2w(Math.min(mq.sx,mq.cx),Math.min(mq.sy,mq.cy)),b=s2w(Math.max(mq.sx,mq.cx),Math.max(mq.sy,mq.cy));
      mq.pre=collect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x,b.x),Math.max(a.y,b.y))}
    draw();return}
  // курсор «move» над рамкой группы
  if(window.playing||drag||pan||e.target!==cv){if(hoverFrame){hoverFrame=false;if(cv.style.cursor=='move')cv.style.cursor=''}return}
  let on=false;
  if(multi()&&!e.ctrlKey&&!e.shiftKey){const F=frameScr(),p=cvPos(e);if(F&&inFrame(F,p)){
    const onB=p.x<F.l+BORDER||p.x>F.r-BORDER||p.y<F.t+BORDER||p.y>F.btm-BORDER,sset=new Set(ids()),solid=hitAll(s2w(p.x,p.y)).filter(o=>!o.screen);
    on=onB||!solid.length||solid.some(o=>sset.has(o.id))}}
  if(on){cv.style.cursor='move'}else if(hoverFrame&&cv.style.cursor=='move')cv.style.cursor='';
  hoverFrame=on});

addEventListener('mouseup',e=>{
  if(!mq||e.button)return;const m=mq;mq=null;
  if(m.moved){
    const list=m.add?[...m.base,...m.pre.filter(i=>!m.base.includes(i))]:m.pre;
    commit(list)}
  else if(!m.add){                                        // обычный клик без движения — как раньше: выбрать объект под курсором / снять выделение
    const w=s2w(m.sx,m.sy),h=pickAt(w,m.e0,true);msel.clear();sel=h?h.id:null;
    if(h)for(let q=h;q&&q.parent!=null;q=get(q.parent))hcol.delete(q.parent);
    refresh()}
  draw()},true);
addEventListener('keydown',e=>{if(mq&&e.key=='Escape'){mq=null;draw()}},true);
addEventListener('blur',()=>{if(mq){mq=null;draw()}});

/* ---------- отрисовка ---------- */
const _dg=window.drawGizmo;
window.drawGizmo=(g,W,H,c)=>{
  const grp=multi()&&!window.playing;
  if(grp){
    const F=frameScr();
    if(F){
      g.save();
      // контуры отдельных объектов
      g.lineWidth=1.5;g.strokeStyle='#ffd24a';
      for(const id of ids())for(const d of subtree(id)){if(!hasRect(d)||d.screen)continue;
        g.beginPath();quadOf(d).forEach(([x,y],i)=>{const[sx,sy]=w2s(x,y);g[i?'lineTo':'moveTo'](sx,sy)});g.closePath();g.stroke()}
      // общая рамка
      const w=F.r-F.l,h=F.btm-F.t;
      g.fillStyle='rgba(90,160,255,.07)';g.fillRect(F.l,F.t,w,h);
      g.lineWidth=2;g.strokeStyle='#5aa0ff';g.setLineDash([]);g.strokeRect(F.l,F.t,w,h);
      // «ручки» движения на серединах сторон и крест в центре
      g.fillStyle='#5aa0ff';
      for(const[x,y]of[[F.l+w/2,F.t],[F.l+w/2,F.btm],[F.l,F.t+h/2],[F.r,F.t+h/2]])g.fillRect(x-10,y-2.5,20,5),g.fillRect(x-2.5,y-10,5,20);
      const cx=F.l+w/2,cy=F.t+h/2;g.strokeStyle='#5aa0ff';g.lineWidth=2;g.beginPath();g.moveTo(cx-9,cy);g.lineTo(cx+9,cy);g.moveTo(cx,cy-9);g.lineTo(cx,cy+9);g.stroke();
      g.fillStyle='#5aa0ff';g.font='11px Segoe UI,sans-serif';g.textBaseline='bottom';g.textAlign='left';g.fillText(`${ids().length} objects — тяните за рамку`,F.l,F.t-5);
      g.restore()}}
  else if(_dg)_dg(g,W,H,c);
  // рамка выделения + предпросмотр
  if(mq&&mq.moved){
    g.save();
    g.lineWidth=1.5;g.strokeStyle='#ffd24a';
    for(const id of[...mq.base,...mq.pre]){const d=get(id);if(!d||d.screen&&!mq.pre.includes(id))continue;
      g.beginPath();quadOf(d).forEach(([x,y],i)=>{const[sx,sy]=w2s(x,y);g[i?'lineTo':'moveTo'](sx,sy)});g.closePath();g.stroke()}
    const x=Math.min(mq.sx,mq.cx),y=Math.min(mq.sy,mq.cy),w=Math.abs(mq.cx-mq.sx),h=Math.abs(mq.cy-mq.sy);
    g.fillStyle='rgba(90,160,255,.15)';g.fillRect(x,y,w,h);g.strokeStyle='#5aa0ff';g.lineWidth=1;g.setLineDash([5,3]);g.strokeRect(x+.5,y+.5,w,h);g.setLineDash([]);
    g.restore()}};
})();

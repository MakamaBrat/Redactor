/* Рамка выделения с маркерами масштаба (как Rect Tool в Unity): тянем за угол/сторону — меняется Scale, Shift — сохраняет пропорции */
(()=>{
const DIRS=[[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[1,0],[0,1],[-1,0]];   // сначала углы (приоритет при попадании), затем стороны
const HS=4,HIT=8;                                                       // половина размера маркера / радиус попадания, px
let giz=null,hover=-1;

// локальный прямоугольник объекта: свой размер (Image/Text/Gradient) или охват всех детей (пустой родитель)
const ownRect=o=>{if(o.img||o.text||o.grad||o.screen){const[w,h]=size(o);return[-w/2,-h/2,w/2,h/2]}return null};
function boxOf(o){
  let r=ownRect(o);
  if(!r){
    const I=invM(wmat(o));let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    if(I)for(const d of subtree(o.id)){if(d===o)continue;const q=ownRect(d);if(!q)continue;const M=wmat(d);
      for(const[cx,cy]of[[q[0],q[1]],[q[2],q[1]],[q[2],q[3]],[q[0],q[3]]]){const p=apM(M,cx,cy),l=apM(I,p.x,p.y);
        x0=Math.min(x0,l.x);y0=Math.min(y0,l.y);x1=Math.max(x1,l.x);y1=Math.max(y1,l.y)}}
    r=x0<=x1?[x0,y0,x1,y1]:[-.15,-.15,.15,.15]}
  if(r[2]-r[0]<.02){const c=(r[0]+r[2])/2;r=[c-.01,r[1],c+.01,r[3]]}
  if(r[3]-r[1]<.02){const c=(r[1]+r[3])/2;r=[r[0],c-.01,r[2],c+.01]}
  return{r,own:!!ownRect(o)}}

function calc(o,W,H,cam){
  const{r,own}=boxOf(o),M=wmat(o),sx=x=>(x-cam.x)*cam.z+W/2,sy=y=>H/2-(y-cam.y)*cam.z;
  const S=(lx,ly)=>{const p=apM(M,lx,ly);return[sx(p.x),sy(p.y)]};
  const[x0,y0,x1,y1]=r,xm=(x0+x1)/2,ym=(y0+y1)/2,at=d=>S(d[0]<0?x0:d[0]>0?x1:xm,d[1]<0?y0:d[1]>0?y1:ym);
  const quad=[S(x0,y0),S(x1,y0),S(x1,y1),S(x0,y1)],c=S(xm,ym);
  const wpx=Math.hypot(quad[1][0]-quad[0][0],quad[1][1]-quad[0][1]),hpx=Math.hypot(quad[3][0]-quad[0][0],quad[3][1]-quad[0][1]);
  const ok=Math.abs(M[0]*M[3]-M[1]*M[2])>1e-9&&Math.min(wpx,hpx)>=18;   // слишком мелко/вырожденно (Rotation 90°) — маркеров нет
  return{r,own,M,quad,c,ok,pts:DIRS.map(d=>{const p=at(d);return{hx:d[0],hy:d[1],x:p[0],y:p[1]}}),pv:S(0,0),sx,sy}}

const CUR=['ew-resize','nwse-resize','ns-resize','nesw-resize'];
function curOf(G,p){const a=((Math.atan2(p.y-G.c[1],p.x-G.c[0])*180/Math.PI)%180+180)%180;return CUR[Math.round(a/45)%4]}

window.drawGizmo=(g,W,H,cam)=>{
  const o=get(sel);if(!o)return;const G=calc(o,W,H,cam);
  g.save();g.lineWidth=2;g.strokeStyle='#5aa0ff';g.setLineDash(G.own?[]:[6,4]);
  g.beginPath();G.quad.forEach((p,i)=>g[i?'lineTo':'moveTo'](p[0],p[1]));g.closePath();g.stroke();g.setLineDash([]);
  const px=G.pv[0],py=G.pv[1];g.strokeStyle='#e44';g.beginPath();g.moveTo(px,py);g.lineTo(px+50,py);g.stroke();
  g.strokeStyle='#4e4';g.beginPath();g.moveTo(px,py);g.lineTo(px,py-50);g.stroke();
  if(G.ok)G.pts.forEach((p,i)=>{const on=giz?(giz.hx==p.hx&&giz.hy==p.hy):i==hover;
    g.fillStyle=on?'#5aa0ff':'#fff';g.strokeStyle='#1d3f5e';g.lineWidth=1.5;g.beginPath();g.rect(p.x-HS,p.y-HS,HS*2,HS*2);g.fill();g.stroke()});
  g.restore()};

const dims=()=>({W:cv.clientWidth,H:cv.clientHeight});
function handleAt(e){
  if(window.playing||sel==null)return-1;const o=get(sel);if(!o)return-1;
  const{W,H}=dims(),G=calc(o,W,H,cam);if(!G.ok)return-1;
  const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  for(let i=0;i<G.pts.length;i++)if(Math.abs(G.pts[i].x-mx)<=HIT&&Math.abs(G.pts[i].y-my)<=HIT)return i;
  return-1}

window.gizOver=handleAt;
// начало перетаскивания маркера: запоминаем якорь (противоположный угол/сторона), он остаётся на месте
document.getElementById('scn').addEventListener('mousedown',e=>{
  if(e.target!==cv||e.button||e.altKey||window.playing)return;
  const i=handleAt(e);if(i<0)return;
  e.stopImmediatePropagation();e.preventDefault();
  const o=get(sel),{W,H}=dims(),G=calc(o,W,H,cam),d=DIRS[i],[x0,y0,x1,y1]=G.r,xm=(x0+x1)/2,ym=(y0+y1)/2;
  const lx=d[0]<0?x0:d[0]>0?x1:xm,ly=d[1]<0?y0:d[1]>0?y1:ym,ax=d[0]<0?x1:d[0]>0?x0:xm,ay=d[1]<0?y1:d[1]>0?y0:ym;
  const sx0=Math.abs(o.sx)<1e-3?1e-3:o.sx,sy0=Math.abs(o.sy)<1e-3?1e-3:o.sy;
  const B=locM({x:0,y:0,r:o.r,rx:o.rx,ry:o.ry,sx:1,sy:1}),Bi=invM(B);if(!Bi)return;
  giz={id:o.id,hx:d[0],hy:d[1],lx,ly,ax,ay,sx0,sy0,B,Bi,Ap:{x:o.x+B[0]*sx0*ax+B[2]*sy0*ay,y:o.y+B[1]*sx0*ax+B[3]*sy0*ay}};
  document.body.style.cursor=curOf(G,G.pts[i]);draw()},true);

const MIN=.01,sg=v=>v<0?-1:1;
addEventListener('mousemove',e=>{
  if(giz){
    const o=get(giz.id);if(!o){giz=null;return}
    const w=toW(e),pm=toLocal(o,w.x,w.y),d=apM(giz.Bi,pm.x-giz.Ap.x,pm.y-giz.Ap.y);
    let nx=giz.hx?d.x/(giz.lx-giz.ax):giz.sx0,ny=giz.hy?d.y/(giz.ly-giz.ay):giz.sy0;
    if(e.shiftKey){                                        // Shift — одинаковое изменение по обеим осям (пропорции сохраняются)
      let k=giz.hx&&giz.hy?(nx/giz.sx0+ny/giz.sy0)/2:giz.hx?nx/giz.sx0:ny/giz.sy0;
      const kmin=Math.max(MIN/Math.abs(giz.sx0),MIN/Math.abs(giz.sy0));if(Math.abs(k)<kmin)k=sg(k)*kmin;
      nx=giz.sx0*k;ny=giz.sy0*k}
    else{if(Math.abs(nx)<MIN)nx=sg(nx)*MIN;if(Math.abs(ny)<MIN)ny=sg(ny)*MIN}
    const B=giz.B,px=giz.Ap.x-(B[0]*nx*giz.ax+B[2]*ny*giz.ay),py=giz.Ap.y-(B[1]*nx*giz.ax+B[3]*ny*giz.ay);
    chg(o,'sx',rd(nx));chg(o,'sy',rd(ny));chg(o,'x',rd(px));chg(o,'y',rd(py));
    window.animSync?animSync():inspect();draw();return}
  // наведение: подсветка маркера и курсор-стрелка
  if(window.playing||e.target!==cv){if(hover!=-1){hover=-1;draw()}return}
  const i=handleAt(e);
  if(i!=hover){hover=i;draw()}
  if(i>=0){const{W,H}=dims(),G=calc(get(sel),W,H,cam);cv.style.cursor=curOf(G,G.pts[i])}
  else if(cv.style.cursor.endsWith('-resize'))cv.style.cursor=''});
const stop=()=>{if(giz){giz=null;document.body.style.cursor='';draw()}};
addEventListener('mouseup',stop);addEventListener('blur',stop);
})();

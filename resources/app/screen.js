/* Screen — объект-«камера записи»: только размер (позиция берётся из Transform), фон (цвет / прозрачный) и Export GIF.
   Экспорт: подтверждение → Play всей сцены → запись области Screen → GIF (свой LZW-кодировщик, без зависимостей). */
(()=>{
const $=s=>document.querySelector(s),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),ins=$('#ins');
window.mkScreen=()=>({w:480,h:270,bg:'#202020',transp:false,k:1});
const outSize=S=>[Math.round(S.w*(S.k||1)),Math.round(S.h*(S.k||1))];

/* ---------- Inspector ---------- */
const PRE=[['480x270','480 × 270 (16:9)'],['640x360','640 × 360 (16:9)'],['1280x720','1280 × 720 (HD)'],['512x512','512 × 512'],['256x256','256 × 256'],['128x128','128 × 128']];
const row=(l,c)=>`<div class="r"><span class="l">${l}</span>${c}</div>`;
function scrHtml(o){const S=o.screen,[ow,oh]=outSize(S);
  return`<div class="sec"><div class="sh">Screen<button data-crm="screen" title="Remove Component">✕</button></div>
${row('Preset',`<select data-scr="pre" style="flex:1;max-width:none"><option value="">Custom</option>${PRE.map(([v,t])=>`<option value="${v}" ${v==S.w+'x'+S.h?'selected':''}>${t}</option>`).join('')}</select>`)}
${row('Width',`<input type="number" min="16" max="2000" step="1" data-scr="w" value="${S.w}">`)}
${row('Height',`<input type="number" min="16" max="2000" step="1" data-scr="h" value="${S.h}">`)}
${row('Background',`<input type="color" data-scr="bg" value="${S.bg}" ${S.transp?'disabled':''}><label style="margin-left:8px"><input type="checkbox" data-scr="transp" ${S.transp?'checked':''}> Transparent</label>`)}
${row('GIF scale',`<select data-scr="k" style="flex:1;max-width:none">${[.25,.5,1,2].map(v=>`<option value="${v}" ${v==(S.k||1)?'selected':''}>${v*100}% → ${Math.round(S.w*v)}×${Math.round(S.h*v)} px</option>`).join('')}</select>`)}
<div class="r"><button data-scr-exp="gif" style="flex:1;background:#2c5d87">⏺ Export GIF…</button><button data-scr-exp="mp4" style="flex:1;background:#2c5d87">⏺ Export MP4…</button></div>
<div class="e" style="padding:2px 0;color:#888">Размер области в пикселях (1 юнит = 100 px). Позиция — из Transform; Scale и Rotation на область не влияют. GIF умеет прозрачность, MP4 — нет (фон = Background).</div></div>`}
const _ch=window.compHtml,_cm=window.compMenu;
window.compHtml=o=>(o.screen?scrHtml(o):'')+(_ch?_ch(o):'');
window.compMenu=o=>{if(o.screen)return[];const it=_cm?_cm(o):[];if(!o.img&&!o.text&&!o.grad)it.unshift(['Screen',()=>{o.screen=mkScreen();refresh()}]);return it};
ins.addEventListener('input',e=>{const t=e.target,k=t.dataset.scr,o=get(sel);if(k===undefined||!o||!o.screen)return;const S=o.screen;
  if(k=='pre'){if(!t.value)return;[S.w,S.h]=t.value.split('x').map(Number);inspect()}
  else if(k=='transp'){S.transp=t.checked;inspect()}
  else if(k=='bg')S.bg=t.value;
  else if(k=='k'){S.k=+t.value}
  else{const v=parseFloat(t.value);if(isNaN(v))return;S[k]=cl(Math.round(v),16,2000)}
  draw()});
ins.addEventListener('change',e=>{const k=e.target.dataset.scr;if(k=='w'||k=='h'||k=='k')inspect()});
ins.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-scr-exp]'),o=get(sel);if(b&&o&&o.screen)openExport(o,b.dataset.scrExp)});

/* ---------- отрисовка рамки Screen в редакторе (под объектами) ---------- */
window.drawScreens=(g,W,H,cam,clean)=>{if(window.expMode||clean)return;
  for(const{o,on,M}of order()){if(!on||!o.screen)continue;
    const S=o.screen,hw=S.w/PPU/2,hh=S.h/PPU/2,X=(M[4]-hw-cam.x)*cam.z+W/2,Y=H/2-(M[5]+hh-cam.y)*cam.z,w=hw*2*cam.z,h=hh*2*cam.z;
    if(X>W||Y>H||X+w<0||Y+h<0)continue;
    g.save();g.beginPath();g.rect(X,Y,w,h);g.clip();
    if(S.transp){const c=12,xa=Math.max(0,X),xb=Math.min(W,X+w),ya=Math.max(0,Y),yb=Math.min(H,Y+h);
      for(let yy=Math.floor((ya-Y)/c);Y+yy*c<yb;yy++)for(let xx=Math.floor((xa-X)/c);X+xx*c<xb;xx++){g.fillStyle=(xx+yy)&1?'#6a6a6a':'#8a8a8a';g.fillRect(X+xx*c,Y+yy*c,c,c)}}
    else{g.fillStyle=S.bg;g.fillRect(X,Y,w,h)}
    g.restore();
    g.strokeStyle=o.id==sel?'#ffd24a':'#4fb3ff';g.lineWidth=2;g.setLineDash([8,5]);g.strokeRect(X,Y,w,h);g.setLineDash([]);
    g.fillStyle=g.strokeStyle;g.font='11px Segoe UI,sans-serif';g.textBaseline='bottom';g.textAlign='left';g.fillText(`${o.name}  ${S.w}×${S.h}${S.transp?' · transparent':''}`,X,Y-4)}};

/* ---------- GIF: квантование (median cut, 15 бит) ---------- */
function quant(d,n,tr){
  const h=new Uint32Array(32768),mx=tr?255:256;
  for(let i=0,p=0;i<n;i++,p+=4){if(tr&&d[p+3]<128)continue;h[(d[p]>>3)<<10|(d[p+1]>>3)<<5|(d[p+2]>>3)]++}
  const ks=[];for(let k=0;k<32768;k++)if(h[k])ks.push(k);
  const bx=[ks];
  while(bx.length<mx){
    let bi=-1,bs=1;for(let i=0;i<bx.length;i++)if(bx[i].length>bs){bs=bx[i].length;bi=i}
    if(bi<0)break;const b=bx[bi];
    let r0=31,r1=0,g0=31,g1=0,b0=31,b1=0;
    for(const k of b){const r=k>>10,g=(k>>5)&31,bl=k&31;if(r<r0)r0=r;if(r>r1)r1=r;if(g<g0)g0=g;if(g>g1)g1=g;if(bl<b0)b0=bl;if(bl>b1)b1=bl}
    const dr=r1-r0,dg=g1-g0,db=b1-b0,sh=dr>=dg&&dr>=db?10:dg>=db?5:0;
    b.sort((a,c)=>((a>>sh)&31)-((c>>sh)&31));
    let tot=0;for(const k of b)tot+=h[k];let acc=0,s=0;
    for(;s<b.length-1;s++){acc+=h[b[s]];if(acc>=tot/2)break}
    s=Math.min(s,b.length-2);bx.splice(bi,1,b.slice(0,s+1),b.slice(s+1))}
  const pal=new Uint8Array(768);
  bx.forEach((b,i)=>{let r=0,g=0,bl=0,t=0;for(const k of b){const w=h[k];r+=(k>>10)*w;g+=((k>>5)&31)*w;bl+=(k&31)*w;t+=w}t=t||1;
    pal[i*3]=Math.min(255,r/t*8+4);pal[i*3+1]=Math.min(255,g/t*8+4);pal[i*3+2]=Math.min(255,bl/t*8+4)});
  const np=bx.length,lut=new Int16Array(32768).fill(-1),idx=new Uint8Array(n);
  for(let i=0,p=0;i<n;i++,p+=4){
    if(tr&&d[p+3]<128){idx[i]=255;continue}
    const key=(d[p]>>3)<<10|(d[p+1]>>3)<<5|(d[p+2]>>3);let v=lut[key];
    if(v<0){let best=1e9;v=0;for(let j=0;j<np;j++){const a=d[p]-pal[j*3],b=d[p+1]-pal[j*3+1],c=d[p+2]-pal[j*3+2],e=a*a+b*b+c*c;if(e<best){best=e;v=j}}lut[key]=v}
    idx[i]=v}
  return{pal,idx}}

/* ---------- GIF: LZW ---------- */
function lzw(px){
  const CLR=256,EOI=257;let size=9,nxt=258,map=new Map(),out=[],cur=0,sh=0;
  const put=c=>{cur|=c<<sh;sh+=size;while(sh>=8){out.push(cur&255);cur>>>=8;sh-=8}};
  put(CLR);let pre=px[0];
  for(let i=1;i<px.length;i++){const k=px[i],key=pre<<8|k,v=map.get(key);
    if(v!==undefined){pre=v;continue}
    put(pre);
    if(nxt==4096){put(CLR);map.clear();nxt=258;size=9}
    else{if(nxt>=(1<<size))size++;map.set(key,nxt++)}
    pre=k}
  put(pre);if(nxt>=(1<<size)&&size<12)size++;put(EOI);if(sh>0)out.push(cur&255);
  const res=[8];for(let i=0;i<out.length;i+=255){const n=Math.min(255,out.length-i);res.push(n);for(let j=0;j<n;j++)res.push(out[i+j])}
  res.push(0);return Uint8Array.from(res)}

async function encodeGif(frames,ts,W,H,fps,loop,tr,prog){
  const parts=[Uint8Array.from([71,73,70,56,57,97,W&255,W>>8,H&255,H>>8,0,0,0,...(loop?[33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]:[])])];
  for(let i=0;i<frames.length;i++){
    const q=quant(frames[i],W*H,tr),dl=Math.max(2,Math.round((i+1<frames.length?ts[i+1]-ts[i]:1000/fps)/10));
    parts.push(Uint8Array.from([33,249,4,(tr?2:1)<<2|(tr?1:0),dl&255,dl>>8,tr?255:0,0,44,0,0,0,0,W&255,W>>8,H&255,H>>8,0x87]),q.pal,lzw(q.idx));
    frames[i]=null;prog(i+1,frames.length);await new Promise(r=>setTimeout(r,0))}
  parts.push(Uint8Array.from([59]));return new Blob(parts,{type:'image/gif'})}
window.U2DGif={quant,lzw,encodeGif};

/* ---------- диалог экспорта (GIF / MP4) ---------- */
const st=document.createElement('style');
st.textContent='#gifov{position:fixed;inset:0;background:#000b;z-index:60;display:flex;align-items:center;justify-content:center}#gifm{background:#2d2d2d;border:1px solid #111;padding:14px 16px;width:420px;max-width:92vw;box-shadow:0 8px 30px #000a;user-select:none}#gifm h3{margin:0 0 8px;font-size:14px}#gifm .bar{height:10px;background:#1a1a1a;border-radius:5px;overflow:hidden;margin:10px 0}#gifm .bar i{display:block;height:100%;width:0;background:#4a90e2}#gifm .btns{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}#gifm img,#gifm video{max-width:100%;max-height:260px;display:block;margin:8px auto}#gifm img{background:repeating-conic-gradient(#555 0 25%,#777 0 50%) 0 0/16px 16px}#gifm video{background:#000}#gifm button:disabled{opacity:.45;cursor:default}';
document.head.append(st);
function modal(){let ov=$('#gifov');if(!ov){ov=document.createElement('div');ov.id='gifov';ov.innerHTML='<div id="gifm"></div>';document.body.append(ov)}return{ov,m:ov.firstChild,close:()=>ov.remove()}}
function autoDur(){let m=0;try{const A=window.AnimRT,cls=Array.isArray(A.clips)?A.clips:[...A.clips.values()];
  objs.forEach(o=>{if(!o.animator||o.active===false)return;const c=A.ctlOf(o.animator.ctl);if(!c)return;
    c.st.forEach(s=>{const k=s.clip!=null&&cls.find(x=>x.id==s.clip);if(k&&k.len>m)m=k.len})})}catch(e){}
  return m>0?Math.min(60,Math.ceil(m*2)/2):3}
let busy=false;
const FPS={gif:[10,15,20,25,30],mp4:[15,24,30,60]},FD={gif:15,mp4:30};
async function openExport(o,fmt0){
  if(busy)return;const S=o.screen,{m,close}=modal(),[ow,oh]=outSize(S),Q=s=>m.querySelector(s);
  const nat=window.native&&native.mp4,ffok=nat?!!(await native.mp4.probe().catch(()=>null)||{}).ok:false;
  const L='<span class="l" style="width:120px">';
  m.innerHTML=`<h3>Export — подтверждение</h3>
<div style="line-height:1.5">Сцена будет <b>проиграна (Play)</b> и записана по области <b>${esc(o.name)}</b>: ${S.w}×${S.h} px → ${ow}×${oh} px. После записи сцена вернётся в исходное состояние.</div>
<div class="r" style="margin-top:10px">${L}Формат</span><select id="gfmt" style="flex:1;max-width:none"><option value="gif">GIF</option><option value="mp4">MP4 (H.264)</option></select></div>
<div class="r">${L}Длительность, с</span><input id="gdur" type="number" min="0.5" max="60" step="0.5" value="${autoDur()}"></div>
<div class="r">${L}FPS</span><select id="gfps" style="flex:1;max-width:none"></select></div>
<div class="r" id="gr-loop">${L}Повтор</span><label><input type="checkbox" id="gloop" checked> бесконечный цикл</label></div>
<div class="r" id="gr-q">${L}Качество</span><select id="gq" style="flex:1;max-width:none"><option value="18">Высокое</option><option value="23" selected>Среднее</option><option value="28">Низкое (меньше размер)</option></select></div>
<div id="gnote" style="color:#c9a227;line-height:1.4;margin-top:4px"></div>
<div id="gest" style="color:#999;min-height:16px"></div>
<div class="btns"><button id="gno">Отмена</button><button id="gok" style="background:#2c5d87">⏺ Записать</button></div>`;
  let cur=null;
  const sync=()=>{const fmt=Q('#gfmt').value,mp=fmt=='mp4';
    if(cur!==fmt){Q('#gfps').innerHTML=FPS[fmt].map(v=>`<option ${v==FD[fmt]?'selected':''}>${v}</option>`).join('');cur=fmt}
    Q('#gr-loop').style.display=mp?'none':'';Q('#gr-q').style.display=mp?'':'none';
    const d=+Q('#gdur').value||0,f=+Q('#gfps').value,n=Math.ceil(d*f),mb=n*ow*oh*4/1e6,bad=mb>700||d<=0;
    let note='';
    if(mp){if(!nat)note='MP4 доступен только в десктопной версии (Electron).';else if(!ffok)note='Не найден ffmpeg: положите ffmpeg.exe в папку resources/ffmpeg рядом с программой.';
      else if(S.transp)note='MP4 не поддерживает прозрачность: фон будет залит цветом Background ('+S.bg+').'}
    Q('#gnote').textContent=note;
    Q('#gest').textContent=`${n} кадров, ≈${Math.round(mb)} МБ в памяти`+(bad&&d>0?' — слишком много, уменьшите размер/длительность':'');
    Q('#gok').disabled=bad||(mp&&!(nat&&ffok))};
  Q('#gfmt').value=fmt0=='mp4'?'mp4':'gif';
  m.addEventListener('input',sync);sync();
  Q('#gno').onclick=close;
  Q('#gok').onclick=()=>record(o,{fmt:Q('#gfmt').value,dur:+Q('#gdur').value,fps:+Q('#gfps').value,loop:Q('#gloop').checked,crf:+Q('#gq').value},m,close)}

async function encodeMp4(frames,ts,W,H,fps,crf,prog){
  const N=frames.length,step=1000/fps,r=await native.mp4.start({w:W,h:H,fps,crf});if(r.error)throw new Error(r.error);
  try{
    for(let i=0;i<N;i++){                       // постоянный fps: кадр повторяется столько раз, сколько он «длился» в реальном времени
      const k=Math.round((ts[i]-ts[0])/step),nx=i+1<N?Math.round((ts[i+1]-ts[0])/step):k+1,rep=Math.max(1,nx-k),f=frames[i];
      const e=await native.mp4.frame({id:r.id,buf:new Uint8Array(f.buffer,f.byteOffset,f.byteLength),rep});if(e&&e.error)throw new Error(e.error);
      frames[i]=null;prog(i+1,N)}
    const f=await native.mp4.end({id:r.id});if(f.error)throw new Error(f.error);
    return{id:r.id,size:f.size}
  }catch(e){native.mp4.discard({id:r.id});throw e}}

async function record(o,opt,m,close){
  const{fmt,dur,fps,loop,crf}=opt,mp=fmt=='mp4';
  busy=true;const S=o.screen,[W,H]=outSize(S),tr=!mp&&!!S.transp,bg=S.bg,id=o.id,base=(o.name||'Screen').replace(/[\\/:*?"<>|]/g,'');
  const c=document.createElement('canvas');c.width=W;c.height=H;const gc=c.getContext('2d',{willReadFrequently:true});
  const N=Math.max(1,Math.round(dur*fps)),step=1000/fps,frames=[],ts=[];let cancel=false,t0=null;
  m.innerHTML=`<h3>Запись…</h3><div id="gst">Кадр 0 / ${N}</div><div class="bar"><i id="gbar"></i></div><div class="btns"><button id="gstop">Отмена</button></div>`;
  m.querySelector('#gstop').onclick=()=>{cancel=true};
  const started=!window.playing;if(started)playMode.start();
  const done=ok=>{if(started&&window.playing)playMode.stop();
    if(!ok){busy=false;close();return}
    (mp?finishMp4:finishGif)()};
  const tick=()=>{
    if(cancel||!window.playing){frames.length=0;return done(false)}
    const now=performance.now();if(t0==null)t0=now;
    if(now-t0>=frames.length*step-1){
      const e=order().find(x=>x.o.id==id);
      if(e){window.expMode={bg:tr?null:bg};gc.setTransform(1,0,0,1,0,0);gc.clearRect(0,0,W,H);
        try{render(gc,W,H,{x:e.M[4],y:e.M[5],z:W/(S.w/PPU)},true)}finally{window.expMode=null}
        frames.push(gc.getImageData(0,0,W,H).data);ts.push(now);
        m.querySelector('#gst').textContent=`Кадр ${frames.length} / ${N}`;m.querySelector('#gbar').style.width=frames.length/N*100+'%'}
      else{frames.length=0;return done(false)}   // Screen удалили во время записи
      if(frames.length>=N)return done(true)}
    requestAnimationFrame(tick)};
  const prog=(i,n)=>{const s=m.querySelector('#gst'),b=m.querySelector('#gbar');if(s)s.textContent=`Кадр ${i} / ${n}`;if(b)b.style.width=i/n*100+'%'};
  const fail=err=>{m.innerHTML=`<h3>Ошибка</h3><div style="line-height:1.5">${esc(String(err&&err.message||err))}</div><div class="btns"><button id="gx">Закрыть</button></div>`;m.querySelector('#gx').onclick=close;busy=false};
  const finishGif=async()=>{
    m.innerHTML=`<h3>Кодирование GIF…</h3><div id="gst">Кадр 0 / ${frames.length}</div><div class="bar"><i id="gbar"></i></div>`;
    try{const blob=await encodeGif(frames,ts,W,H,fps,loop,tr,prog),url=URL.createObjectURL(blob);
      m.innerHTML=`<h3>Готово</h3><img src="${url}"><div style="text-align:center;color:#999">${W}×${H} px · ${(blob.size/1024).toFixed(0)} КБ · ${ts.length} кадров</div><div class="btns"><button id="gx">Закрыть</button><button id="gsv" style="background:#2c5d87">💾 Сохранить как…</button></div>`;
      m.querySelector('#gx').onclick=()=>{close();setTimeout(()=>URL.revokeObjectURL(url),1e4)};
      m.querySelector('#gsv').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=base+'.gif';document.body.append(a);a.click();a.remove()};
      busy=false}
    catch(err){fail(err)}};
  const finishMp4=async()=>{
    m.innerHTML=`<h3>Кодирование MP4 (H.264)…</h3><div id="gst">Кадр 0 / ${frames.length}</div><div class="bar"><i id="gbar"></i></div>`;
    let r=null;
    try{r=await encodeMp4(frames,ts,W,H,fps,crf,prog);
      const buf=await native.mp4.read({id:r.id}),url=URL.createObjectURL(new Blob([buf],{type:'video/mp4'}));
      m.innerHTML=`<h3>Готово</h3><video src="${url}" autoplay loop muted controls></video><div style="text-align:center;color:#999">${W&~1}×${H&~1} px · ${fps} fps · ${(r.size/1024).toFixed(0)} КБ · ${(ts.length/fps).toFixed(1)} с</div><div id="gsp" style="text-align:center;color:#8c8;min-height:16px;margin-top:4px"></div><div class="btns"><button id="gx">Закрыть</button><button id="gsv" style="background:#2c5d87">💾 Сохранить как…</button></div>`;
      const id2=r.id;
      m.querySelector('#gx').onclick=()=>{close();native.mp4.discard({id:id2});URL.revokeObjectURL(url)};
      m.querySelector('#gsv').onclick=async()=>{const s=await native.mp4.save({id:id2,name:base+'.mp4'}),sp=m.querySelector('#gsp');
        if(s.path){sp.textContent='Сохранено: '+s.path+' ';const b=document.createElement('button');b.textContent='Показать в папке';b.onclick=()=>native.mp4.reveal(s.path);sp.append(b)}
        else if(s.error){sp.style.color='#e66';sp.textContent='Ошибка: '+s.error}};
      busy=false}
    catch(err){fail(err)}};
  requestAnimationFrame(tick)}
})();

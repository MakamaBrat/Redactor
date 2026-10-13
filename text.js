/* Компонент Text: шрифты .otf/.ttf/.woff из Project, основные настройки текста (как в Unity UI Text) */
(()=>{
const $=s=>document.querySelector(s),ins=$('#ins');
const DEF='"Segoe UI",Arial,sans-serif',PX=PPU;       // 1 юнит сцены = PPU пикселей текста
const mc=document.createElement('canvas').getContext('2d');

window.mkText=()=>({str:'New Text',font:null,size:32,style:'normal',lsp:1,ls:0,ha:'center',va:'middle',
  rich:true,wrap:true,trunc:true,fit:false,min:10,max:40,color:'#ffffff',alpha:1,ol:false,olc:'#000000',olw:2,w:3,h:1});

const famOf=t=>{const a=t.font!=null&&ast(t.font);return a&&a.font?`"${a.family}",${DEF}`:DEF};
const fontStr=(t,sz,b,i)=>`${i||/italic/.test(t.style)?'italic ':''}${b||/bold/.test(t.style)?'bold ':''}${sz}px ${famOf(t)}`;
const setLS=(c,t)=>{try{c.letterSpacing=(+t.ls||0)+'px'}catch(e){}};

/* ---------- Rich Text: <b> <i> <color=#rrggbb[aa] | red> <size=40 | 150%> (как в Unity) ---------- */
const NAMED={aqua:'#00ffff',black:'#000000',blue:'#0000ff',brown:'#a52a2a',cyan:'#00ffff',darkblue:'#0000a0',fuchsia:'#ff00ff',green:'#008000',grey:'#808080',gray:'#808080',
  lightblue:'#add8e6',lime:'#00ff00',magenta:'#ff00ff',maroon:'#800000',navy:'#000080',olive:'#808000',orange:'#ffa500',purple:'#800080',red:'#ff0000',silver:'#c0c0c0',teal:'#008080',white:'#ffffff',yellow:'#ffff00'};
function parseCol(v){
  v=String(v||'').trim().replace(/^["']|["']$/g,'').toLowerCase();
  if(NAMED[v])return NAMED[v];
  const m=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);if(!m)return null;
  let h=m[1];if(h.length<=4)h=h.replace(/./g,c=>c+c);
  if(h.length==6)return'#'+h;
  return`rgba(${parseInt(h.substr(0,2),16)},${parseInt(h.substr(2,2),16)},${parseInt(h.substr(4,2),16)},${Math.round(parseInt(h.substr(6,2),16)/255*1000)/1000})`}
// строка -> [{s,st}], st = {b,i,sz,szp,col}; неизвестные/незакрытые теги остаются обычным текстом
function parseRich(src,rich){
  src=String(src==null?'':src);const base={b:false,i:false,sz:null,szp:null,col:null};
  if(!rich)return[{s:src,st:base}];
  const out=[],stack=[],re=/<(\/?)(b|i|color|size)(?:=([^<>]*))?>/iy;let cur=base,i=0,buf='';
  const flush=()=>{if(buf){out.push({s:buf,st:cur});buf=''}};
  const open=(tag,patch,len)=>{flush();stack.push({tag,prev:cur});cur={...cur,...patch};i+=len};
  while(i<src.length){
    if(src[i]=='<'){re.lastIndex=i;const m=re.exec(src);
      if(m){const tag=m[2].toLowerCase(),val=m[3],len=m[0].length;
        if(m[1]){if(val===undefined){const k=stack.map(x=>x.tag).lastIndexOf(tag);if(k>=0){flush();cur=stack[k].prev;stack.length=k;i+=len;continue}}}
        else if(tag=='b'||tag=='i'){if(val===undefined){open(tag,{[tag]:true},len);continue}}
        else if(tag=='color'){const c=val!==undefined&&parseCol(val);if(c){open(tag,{col:c},len);continue}}
        else if(val!==undefined){const n=parseFloat(val);if(n>0&&/^\s*[\d.]+\s*%?\s*$/.test(val)){open(tag,/%/.test(val)?{szp:n,sz:null}:{sz:n,szp:null},len);continue}}}}
    buf+=src[i++]}
  flush();return out}

/* ---------- раскладка (по сегментам с разным стилем) ---------- */
const LC=new WeakMap();
function layout(t){
  const key=[t.str,t.rich,t.wrap,t.fit,t.min,t.max,t.size,t.style,t.lsp,t.ls,t.w,t.h,famOf(t)].join('\u0001'),c=LC.get(t);if(c&&c.key===key)return c.r;
  const r=layout_(t);LC.set(t,{key,r});return r}
function layout_(t){
  const W=Math.max(1,t.w*PX),H=Math.max(1,t.h*PX),ls=t.lsp==null?1:+t.lsp,bs=Math.max(1,+t.size||1),runs=parseRich(t.str,t.rich!==false);
  const run=sz=>{
    const wrap=t.wrap||t.fit,k=t.fit?sz/bs:1,                       // при Best Fit размеры из <size=N> масштабируются вместе со шрифтом
      szOf=st=>st.szp!=null?sz*st.szp/100:st.sz!=null?Math.max(1,st.sz*k):sz,cache=new Map();
    const mw=(s,st)=>{const f=fontStr(t,szOf(st),st.b,st.i),key=f+'\u0001'+s;let w=cache.get(key);
      if(w===undefined){mc.font=f;setLS(mc,t);w=mc.measureText(s).width;cache.set(key,w)}return w};
    // слова (могут состоять из нескольких сегментов: Hel<b>lo</b>), пробелы и переводы строк
    const items=[];let word=null;const pushWord=()=>{if(word){items.push(word);word=null}};
    for(const r of runs){let seg='';
      const fs=()=>{if(seg){(word||(word={t:'w',segs:[]})).segs.push({s:seg,st:r.st});seg=''}};
      for(const ch of r.s){if(ch=='\r')continue;
        if(ch=='\n'){fs();pushWord();items.push({t:'nl'})}
        else if(ch==' '){fs();pushWord();items.push({t:'sp',st:r.st})}
        else seg+=ch}
      fs()}
    pushWord();
    const lines=[];let line={segs:[],w:0,wr:false};
    const add=(s,st,w)=>{const l=line.segs[line.segs.length-1];if(l&&l.st===st){l.s+=s;l.w+=w}else line.segs.push({s,st,w});line.w+=w};
    const trim=()=>{let l;while((l=line.segs[line.segs.length-1])&&!l.s.trim())line.segs.pop();if(l)l.s=l.s.replace(/ +$/,'');line.w=line.segs.reduce((a,x)=>a+mw(x.s,x.st),0)};
    const end=wr=>{trim();lines.push(line);line={segs:[],w:0,wr:!!wr}};
    for(const it of items){
      if(it.t=='nl'){end();continue}
      if(it.t=='sp'){if(!(line.wr&&!line.segs.length))add(' ',it.st,mw(' ',it.st));continue}
      const ww=it.segs.reduce((a,x)=>a+mw(x.s,x.st),0);
      if(!wrap||line.w+ww<=W+1e-6){it.segs.forEach(x=>add(x.s,x.st,mw(x.s,x.st)));continue}
      trim();if(line.segs.length)end(true);
      if(ww<=W){it.segs.forEach(x=>add(x.s,x.st,mw(x.s,x.st)));continue}
      for(const x of it.segs)for(const ch of x.s){const cw=mw(ch,x.st);if(line.segs.length&&line.w+cw>W)end(true);add(ch,x.st,cw)}}   // слишком длинное слово — по символам
    end();
    let total=0;
    lines.forEach(l=>{l.w=0;l.sz=sz;let mx=0;
      l.segs.forEach(q=>{q.w=mw(q.s,q.st);l.w+=q.w;mx=Math.max(mx,szOf(q.st))});
      if(mx)l.sz=mx;l.lh=l.sz*1.2*ls;total+=l.lh});
    return{size:sz,L:lines,total,szOf}};
  if(!t.fit)return run(bs);
  let a=Math.max(1,Math.floor(Math.min(t.min,t.max))),b=Math.max(a,Math.floor(Math.max(t.min,t.max))),best=a;
  while(a<=b){const m=(a+b)>>1,q=run(m);if(q.total<=H){best=m;a=m+1}else b=m-1}
  return run(best)}

/* ---------- рисование (вызывается из render() в локальных осях объекта, y вниз, единицы сцены) ---------- */
window.drawText=(g,t,v)=>{
  g.scale(1/PX,1/PX);                                // дальше — пиксели текста
  const W=t.w*PX,H=t.h*PX,r=layout(t);let L=r.L;
  if(!t.fit&&t.trunc){let acc=0,n=0;for(const l of L){if(acc+l.lh>H+1e-3*l.lh)break;acc+=l.lh;n++}L=L.slice(0,n)}
  if(!L.length)return;
  const block=L.reduce((a,l)=>a+l.lh,0),top=t.va=='top'?-H/2:t.va=='bottom'?H/2-block:-block/2;
  g.textAlign='left';g.textBaseline='middle';g.lineJoin='round';
  const alpha=v.alpha==null?1:v.alpha,out=t.ol&&t.olw>0;let y=top;
  for(const l of L){
    const baseY=y+l.lh/2+.35*l.sz;                   // общая базовая линия: куски разного размера выравниваются по ней
    let x=t.ha=='left'?-W/2:t.ha=='right'?W/2-l.w:-l.w/2;
    for(const q of l.segs){
      const sz=r.szOf(q.st),yy=baseY-.35*sz;
      g.font=fontStr(t,sz,q.st.b,q.st.i);setLS(g,t);g.globalAlpha=alpha;
      if(out){g.strokeStyle=t.olc;g.lineWidth=t.olw*2;g.strokeText(q.s,x,yy)}
      g.fillStyle=q.st.col||v.color||'#fff';g.fillText(q.s,x,yy);x+=q.w}
    y+=l.lh}
  g.globalAlpha=1};

/* ---------- Inspector ---------- */
const sel_=(k,v,opts)=>`<select class="wide" data-tx="${k}">${opts.map(([a,n])=>`<option value="${a}" ${a==v?'selected':''}>${n}</option>`).join('')}</select>`;
const num=(k,v,st,mn)=>`<input type="number" data-tx="${k}" step="${st}" min="${mn}" value="${rd(v)}">`;
const chk=(k,v)=>`<input type="checkbox" data-tx="${k}" ${v?'checked':''}>`;
const row=(l,c,tip)=>`<div class="r"><span class="l" ${tip?`title="${tip}"`:''}>${l}</span>${c}</div>`;
function textHtml(o){
  const t=o.text,fa=t.font!=null&&ast(t.font),fname=fa&&fa.font?esc(fa.name):(t.font!=null?'⚠ Missing':'Default (Segoe UI)');
  return`<div class="sec"><div class="sh">Text<button data-crm="text" title="Remove Component">✕</button></div>
<div class="r"><textarea data-tx="str" rows="3" placeholder="Текст…">${esc(t.str||'')}</textarea></div>
${t.rich!==false?'<div style="color:#888;font-size:11px;line-height:1.4;margin:-2px 0 4px">Rich Text: &lt;b&gt; &lt;i&gt; &lt;color=#ff0000&gt; / &lt;color=red&gt; &lt;size=48&gt; — закрывать &lt;/b&gt; &lt;/i&gt; &lt;/color&gt; &lt;/size&gt;</div>':''}
<div class="sh" style="margin:8px 0 4px;color:#aaa">Character</div>
${row('Font',`<div class="slot" data-fs title="Перетащите .otf/.ttf из Project или кликните для выбора">${fname}</div>`)}
${row('Font Style',sel_('style',t.style,[['normal','Normal'],['bold','Bold'],['italic','Italic'],['bolditalic','Bold And Italic']]))}
${row('Font Size',num('size',t.size,1,1))}
${row('Line Spacing',num('lsp',t.lsp,.1,0))}
${row('Letter Sp.',num('ls',t.ls,.5,-50),'Letter Spacing (px)')}
${row('Rich Text',chk('rich',t.rich!==false),'Теги в тексте: <b> <i> <color> <size>')}
<div class="sh" style="margin:8px 0 4px;color:#aaa">Paragraph</div>
${row('Alignment',sel_('ha',t.ha,[['left','Left'],['center','Center'],['right','Right']])+sel_('va',t.va,[['top','Top'],['middle','Middle'],['bottom','Bottom']]))}
${row('H Overflow',sel_('wrap',t.wrap?'1':'',[['1','Wrap'],['','Overflow']]),'Horizontal Overflow')}
${row('V Overflow',sel_('trunc',t.trunc?'1':'',[['1','Truncate'],['','Overflow']]),'Vertical Overflow')}
${row('Best Fit',chk('fit',t.fit))}
${t.fit?row('Min Size',num('min',t.min,1,1))+row('Max Size',num('max',t.max,1,1)):''}
<div class="sh" style="margin:8px 0 4px;color:#aaa">Appearance</div>
<div class="r"><span class="l">Color</span><input type="color" data-ik="color" value="${t.color}"></div>
<div class="r"><span class="l">Alpha</span><input type="range" min="0" max="1" step="0.01" data-ik="alpha" value="${t.alpha}"><span data-av style="width:30px">${rd(t.alpha)}</span></div>
${row('Outline',chk('ol',t.ol))}
${t.ol?row('Out. Color',`<input type="color" data-tx="olc" value="${t.olc}">`)+row('Out. Size',num('olw',t.olw,.5,0),'Outline Size (px)'):''}
<div class="sh" style="margin:8px 0 4px;color:#aaa">Rect (units)</div>
${row('Width',num('w',t.w,.1,.01))}
${row('Height',num('h',t.h,.1,.01))}</div>`}

const _ch=window.compHtml,_cm=window.compMenu;
window.compHtml=o=>(o.text?textHtml(o):'')+(_ch?_ch(o):'');
window.compMenu=o=>{const it=_cm?_cm(o):[];if(!o.text&&!o.img&&!o.grad)it.unshift(['UI / Text',()=>{o.text=mkText();refresh()}]);return it};

const MINV={size:1,min:1,max:1,w:.01,h:.01,lsp:0,olw:0,ls:-50};
ins.addEventListener('input',e=>{
  const t=e.target,k=t.dataset.tx;if(k===undefined)return;const o=get(sel);if(!o||!o.text)return;const x=o.text;
  if(t.type=='checkbox')x[k]=t.checked;
  else if(t.type=='number'){let v=parseFloat(t.value);if(isNaN(v))return;if(MINV[k]!==undefined)v=Math.max(MINV[k],v);x[k]=v}
  else if(k=='wrap'||k=='trunc')x[k]=t.value==='1';
  else x[k]=t.value;
  if(k=='fit'||k=='ol'||k=='rich')inspect();
  draw()});
const fonts=()=>assets.filter(a=>a.font).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
ins.addEventListener('click',e=>{
  const t=e.target;if(t.dataset.fs===undefined)return;const o=get(sel);if(!o||!o.text)return;const r=t.getBoundingClientRect();
  const set=id=>{o.text.font=id;refresh()},F=fonts();
  showMenu(r.left,r.bottom,[['None (Default)',()=>set(null)],...(F.length?F.map(a=>[a.name,()=>set(a.id)]):[['(нет шрифтов — перетащите .ttf/.otf в папку Fonts в Project)',()=>{}]])])});
ins.addEventListener('dragover',e=>{if(e.target.dataset&&e.target.dataset.fs!==undefined){e.preventDefault();e.target.classList.add('o')}});
ins.addEventListener('dragleave',e=>{if(e.target.dataset&&e.target.dataset.fs!==undefined)e.target.classList.remove('o')});
ins.addEventListener('drop',e=>{
  const t=e.target,o=get(sel);if(!t.dataset||t.dataset.fs===undefined||!o||!o.text)return;
  const id=e.dataTransfer.getData('text/plain');if(!id.startsWith('asset:')||!isFont(+id.slice(6)))return;
  e.preventDefault();o.text.font=+id.slice(6);refresh()});
})();

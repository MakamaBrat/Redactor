/* File ▸ Export ▸ Web (Vercel): собирает статический сайт с игрой (index.html + player.js + game.json + assets/) и vercel.json */
(()=>{
const $=s=>document.querySelector(s),N=()=>window.native;
const enc=new TextEncoder();
const safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'_').replace(/[. ]+$/,'')||'game';
const slug=s=>safe(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'game';
const extOf=url=>{const m=/^data:image\/([a-z0-9+.-]+)/i.exec(url||'');const t=m?m[1].toLowerCase():'png';return t=='jpeg'?'jpg':t=='svg+xml'?'svg':t};
const b64of=url=>url.slice(url.indexOf(',')+1);
const hash=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};   // FNV-1a — имя файла зависит от содержимого (безопасный вечный кэш)
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';

/* ---------- минимальный ZIP (без сжатия) ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
const bytesOf=f=>{if(f.text!=null)return enc.encode(f.text);const bin=atob(f.b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
function makeZip(files,root){
  const parts=[],cen=[];let off=0;const d=new Date(),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate(),tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);
  for(const f of files){
    const name=enc.encode((root?root+'/':'')+f.rel),data=bytesOf(f),crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,tm,true);lh.setUint16(12,dt,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
    parts.push(lh.buffer,name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,tm,true);ch.setUint16(14,dt,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,name.length,true);ch.setUint32(42,off,true);
    cen.push(ch.buffer,name);off+=30+name.length+data.length}
  let cs=0;cen.forEach(x=>cs+=x.byteLength||x.length);
  const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
  return new Blob([...parts,...cen,end.buffer],{type:'application/zip'})}

/* ---------- шаблоны страницы ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pageHtml=(title,bg)=>`<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="${bg}"><title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8E%AE%3C/text%3E%3C/svg%3E">
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${bg};overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#c{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
#load{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:${bg};color:#ddd;font:15px system-ui,sans-serif}
#track{width:min(260px,60vw);height:6px;border-radius:3px;background:#ffffff22;overflow:hidden}#bar{height:100%;width:0;background:#5aa0ff;transition:width .15s}
#fs{display:none;position:fixed;right:10px;bottom:10px;width:38px;height:38px;border:0;border-radius:8px;background:#0006;color:#fff;font-size:20px;line-height:38px;cursor:pointer;opacity:.55}#fs:hover{opacity:1}
</style></head><body>
<canvas id="c"></canvas>
<div id="load"><div id="msg">${esc(title)}</div><div id="track"><div id="bar"></div></div></div>
<button id="fs" title="Fullscreen" aria-label="Fullscreen">⛶</button>
<script src="player.js"></script>
</body></html>
`;
const vercelJson=()=>JSON.stringify({
  $schema:'https://openapi.vercel.sh/vercel.json',cleanUrls:true,
  headers:[
    {source:'/assets/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},
    {source:'/(game\\.json|player\\.js|index\\.html)',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},
    {source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'}]}]},null,2)+'\n';
const readme=(title)=>`# ${title}

Статический веб-билд, собранный в Unity 2D Editor (File ▸ Export ▸ Web).
Сборка не требуется — на Vercel это обычный статический сайт.

## Деплой на Vercel

**Через CLI** (в этой папке):

    npx vercel --prod

На вопросы отвечайте Enter: Framework Preset — "Other", Build Command — пусто, Output Directory — "." (текущая папка).

**Через сайт:** vercel.com ▸ Add New ▸ Project ▸ загрузите эту папку (или залейте её в GitHub-репозиторий и импортируйте его).

## Локальная проверка

    npx serve .

(открывать index.html двойным кликом нельзя — браузеры блокируют загрузку game.json по file://)

## Что внутри

- \`index.html\`, \`player.js\` — страница и рантайм игры
- \`game.json\` — сцена, анимации, Animator-контроллеры
- \`assets/\` — спрайты и шрифты (имена содержат хэш, кэшируются навсегда)
- \`vercel.json\` — кэш-заголовки
`;

/* ---------- сборка ---------- */
function build(o){
  const S=Project._collect(),files=[];
  const meta=S.proj.assets.map(a=>{
    if(a.parent)return{id:a.id,parent:a.parent,rect:a.rect};
    const src=assets.find(x=>x.id==a.id);if(!src||!src.url)return null;
    const font=!!a.font,ext=font?(a.ext||'otf'):extOf(src.url),b64=b64of(src.url),file='assets/'+a.id+'-'+hash(b64)+'.'+ext;
    files.push({rel:file,b64});
    return font?{id:a.id,name:a.name,font:1,file}:{id:a.id,name:a.name,file,ppu:a.ppu,mode:a.mode,sprites:a.sprites}}).filter(Boolean);
  const game={format:'unity2d-web',version:1,title:o.title,
    view:{x:o.x,y:o.y,w:o.w,h:o.h,mode:o.mode,bg:o.bg,bgOuter:o.bgOuter},
    objects:S.objs,assets:meta,clips:S.anim.clips,ctls:S.anim.ctls};
  const out=[
    {rel:'index.html',text:pageHtml(o.title,o.bgOuter)},
    {rel:'player.js',text:window.PLAYER_SRC},
    {rel:'game.json',text:JSON.stringify(game)},
    {rel:'vercel.json',text:vercelJson()},
    {rel:'README.md',text:readme(o.title)},
    ...files];
  const bytes=out.reduce((s,f)=>s+(f.text!=null?f.text.length:Math.floor(f.b64.length*3/4)),0);
  return{files:out,bytes}}

/* ---------- диалог ---------- */
const row=(l,c,tip)=>`<div class="r"><span class="l" ${tip?`title="${esc(tip)}"`:''}>${l}</span>${c}</div>`;
const inp=(id,v,ex='')=>`<input type="number" id="ex-${id}" value="${v}" step="0.5" ${ex}>`;
function open(){
  if(window.playing)playMode.stop();
  const info=Project.info||{name:'Game'},cv_=$('#cv'),z=cam.z||100;
  const vw=Math.round(cv_.clientWidth/z*10)/10,vh=Math.round(cv_.clientHeight/z*10)/10;
  const sep=info.dir&&info.dir.includes('\\')?'\\':'/',dir0=info.dir?info.dir.replace(/[\\/]+$/,'')+sep+'Build'+sep+'Web':'';
  const d=$('#dlg');
  d.innerHTML=`<div class="dbox wide"><div class="dh">Export ▸ Web (Vercel)</div><div class="db">
${row('Title',`<input type="text" id="ex-title" value="${esc(info.name)}">`)}
${row('Camera X / Y',`${inp('x',rd(cam.x),'style="width:50%"')}${inp('y',rd(cam.y),'style="width:50%"')}`,'Центр кадра в игре (по умолчанию — текущий вид Scene)')}
${row('View W / H',`${inp('w',vw,'min="0.5" style="width:50%"')}${inp('h',vh,'min="0.5" style="width:50%"')}`,'Размер видимой области в единицах сцены')}
${row('Scale mode',`<select id="ex-mode" class="wide"><option value="fit">Fit — вся область видна, поля по краям</option><option value="height" selected>Match Height — на широком экране видно больше по ширине</option><option value="width">Match Width — по ширине экрана</option></select>`)}
${row('Background',`<input type="color" id="ex-bg" value="#2b2b2b">`,'Цвет сцены')}
${row('Letterbox',`<input type="color" id="ex-bgo" value="#000000">`,'Цвет полей (режим Fit) и страницы')}
${N()&&info.dir?row('Folder',`<input type="text" id="ex-dir" value="${esc(dir0)}"><button id="ex-br">Browse</button>`):''}
<div class="hint" id="ex-info" style="margin-top:8px"></div><div class="np-err" id="ex-err"></div></div>
<div class="df">${N()&&info.dir?'<button id="ex-go" class="pri">Export to folder</button>':''}<button id="ex-zip" ${N()&&info.dir?'':'class="pri"'}>Download .zip</button><button id="ex-no">Close</button></div></div>`;
  d.style.display='flex';
  const $$=id=>$('#ex-'+id),val=id=>parseFloat($$(id).value),close=()=>{d.style.display='none';d.innerHTML=''};
  const opts=()=>({title:$$('title').value.trim()||info.name,x:val('x')||0,y:val('y')||0,w:Math.max(.5,val('w')||vw),h:Math.max(.5,val('h')||vh),mode:$$('mode').value,bg:$$('bg').value,bgOuter:$$('bgo').value});
  const err=m=>{$$('err').textContent=m||''};
  try{const r=build(opts());$$('info').textContent=`Файлов: ${r.files.length} · размер: ${fmtSize(r.bytes)}`}catch(e){err('Ошибка сборки: '+e.message)}
  $$('no').onclick=close;
  $$('zip').onclick=()=>{try{const o=opts(),r=build(o),nm=slug(o.title);
    const url=URL.createObjectURL(makeZip(r.files,nm)),a=document.createElement('a');a.href=url;a.download=nm+'-web.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    $$('info').textContent=`✔ ${nm}-web.zip — ${fmtSize(r.bytes)}. Распакуйте и задеплойте папку на Vercel (см. README.md внутри).`}catch(e){err('Ошибка: '+e.message)}};
  const go=$$('go');if(go){
    $$('br').onclick=async()=>{const p=await N().pickDir({title:'Папка для веб-билда',defaultPath:$$('dir').value});if(p)$$('dir').value=p};
    go.onclick=async()=>{err('');const dir=$$('dir').value.trim();if(!dir){err('Укажите папку');return}
      try{const r=build(opts());go.disabled=true;
        const res=await N().writeBuild({dir,files:r.files});go.disabled=false;
        if(res&&res.error){err(res.error);return}
        $$('info').innerHTML=`✔ Готово: ${esc(dir)} (${r.files.length} файлов, ${fmtSize(r.bytes)}). Деплой: <code>npx vercel --prod</code> в этой папке. <button id="ex-rev">Open folder</button>`;
        $$('rev').onclick=()=>N().reveal(dir)}catch(e){go.disabled=false;err('Ошибка: '+e.message)}}}
  d.onkeydown=e=>{if(e.key=='Escape')close()}}
window.Exporter={open,build,makeZip};
})();

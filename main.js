const {app,BrowserWindow,Menu,ipcMain,dialog,shell}=require('electron');
const fs=require('fs'),path=require('path');
const PROJ='project.u2d.json',MANAGED=['Assets','Animations','Scenes'];
const RF=()=>path.join(app.getPath('userData'),'recent-projects.json');
let win=null,dirty=false,force=false;

const readJSON=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return d}};
const isProj=d=>{try{return fs.existsSync(path.join(d,PROJ))}catch(e){return false}};
// путь внутри папки проекта (защита от выхода за пределы)
const inside=(dir,rel)=>{const root=path.resolve(dir),p=path.resolve(root,rel);
  if(p!==root&&!p.startsWith(root+path.sep))throw new Error('Недопустимый путь: '+rel);return p};
const cleanName=s=>String(s||'').trim().replace(/[\\/:*?"<>|]/g,'').replace(/[. ]+$/,'');

/* ---------- экспорт веб-билда: записывает готовые файлы в выбранную папку (ничего не удаляя) ---------- */
ipcMain.handle('build:write',(_,{dir,files})=>{
  try{
    if(!dir)return{error:'Не указана папка'};
    files.forEach(f=>{const p=inside(dir,f.rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,f.b64!=null?Buffer.from(f.b64,'base64'):f.text)});
    return{ok:true,count:files.length}
  }catch(e){return{error:String(e.message||e)}}});

/* ---------- недавние проекты ---------- */
const recentList=()=>readJSON(RF(),[]).filter(r=>r&&r.dir&&isProj(r.dir)).sort((a,b)=>b.time-a.time);
const saveRecent=l=>{try{fs.mkdirSync(path.dirname(RF()),{recursive:true});fs.writeFileSync(RF(),JSON.stringify(l.slice(0,20)))}catch(e){}};
ipcMain.handle('recent:get',()=>recentList());
ipcMain.handle('recent:add',(_,{dir,name})=>{const l=recentList().filter(r=>path.resolve(r.dir)!==path.resolve(dir));l.unshift({dir,name,time:Date.now()});saveRecent(l)});
ipcMain.handle('recent:remove',(_,dir)=>{saveRecent(recentList().filter(r=>path.resolve(r.dir)!==path.resolve(dir)))});

/* ---------- диалоги / папки ---------- */
ipcMain.handle('app:defaults',()=>({projects:path.join(app.getPath('documents'),'Unity2D Projects')}));
ipcMain.handle('dlg:dir',async(_,o)=>{
  const r=await dialog.showOpenDialog(win,{title:(o&&o.title)||'Выберите папку',defaultPath:o&&o.defaultPath,properties:['openDirectory','createDirectory']});
  return r.canceled||!r.filePaths.length?null:r.filePaths[0]});
ipcMain.handle('proj:reveal',(_,dir)=>shell.openPath(dir));

/* ---------- проект на диске ---------- */
ipcMain.handle('proj:create',(_,{parent,name})=>{
  try{
    name=cleanName(name);if(!name)return{error:'Введите имя проекта'};
    if(!parent)return{error:'Выберите папку для проекта'};
    const dir=path.join(parent,name);
    if(fs.existsSync(dir)&&fs.readdirSync(dir).length)return{error:'Папка «'+dir+'» уже существует и не пуста'};
    MANAGED.forEach(d=>fs.mkdirSync(path.join(dir,d),{recursive:true}));
    return{dir,name}
  }catch(e){return{error:String(e.message||e)}}});

ipcMain.handle('proj:read',(_,dir)=>{
  try{
    const mp=path.join(dir,PROJ);if(!fs.existsSync(mp))return{error:'В папке нет файла '+PROJ};
    const meta=fs.readFileSync(mp,'utf8'),m=JSON.parse(meta),files={};
    const want=[m.scene,...((m.anim&&m.anim.clips)||[]),...((m.anim&&m.anim.ctls)||[]),...(((m.proj&&m.proj.assets)||[]).map(a=>a.file))].filter(Boolean);
    want.forEach(rel=>{
      try{const p=inside(dir,rel),isJson=/\.json$/i.test(rel);
        files[rel]=isJson?{text:fs.readFileSync(p,'utf8')}:{b64:fs.readFileSync(p).toString('base64')}}
      catch(e){files[rel]=null}});
    return{meta,files}
  }catch(e){return{error:String(e.message||e)}}});

// удаляем из служебных папок только то, что редактор сам создаёт и что больше не нужно
const OWN={Assets:/\.(png|jpe?g|gif|webp|svg|bmp|otf|ttf|woff2?)$/i,Animations:/\.(anim|controller)\.json$/i,Scenes:/\.scene\.json$/i};
function sweep(dir,sub,keep){
  const walk=d=>{let any=false;
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      const p=path.join(d,e.name);
      if(e.isDirectory()){if(!walk(p)){try{fs.rmdirSync(p)}catch(_){any=true}}else any=true}
      else{const rel=path.relative(dir,p).split(path.sep).join('/');
        if(OWN[sub].test(e.name)&&!keep.has(rel))try{fs.unlinkSync(p)}catch(_){any=true}else any=true}}
    return any};
  const root=path.join(dir,sub);if(fs.existsSync(root))walk(root)}
ipcMain.handle('proj:save',(_,{dir,files})=>{
  try{
    const keep=new Set(),meta=files.find(f=>f.rel==PROJ);
    files.forEach(f=>{if(f.rel==PROJ)return;
      const p=inside(dir,f.rel);fs.mkdirSync(path.dirname(p),{recursive:true});
      fs.writeFileSync(p,f.b64!=null?Buffer.from(f.b64,'base64'):f.text);keep.add(f.rel)});
    MANAGED.forEach(s=>{fs.mkdirSync(path.join(dir,s),{recursive:true});sweep(dir,s,keep)});
    const mp=path.join(dir,PROJ),tmp=mp+'.tmp';fs.writeFileSync(tmp,meta.text);fs.renameSync(tmp,mp);   // метафайл — последним и атомарно
    return{ok:true}
  }catch(e){return{error:String(e.message||e)}}});

/* ---------- окно ---------- */
ipcMain.on('win:dirty',(_,v)=>{dirty=!!v});
ipcMain.on('win:close',()=>{force=true;if(win)win.close()});
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  win=new BrowserWindow({width:1400,height:850,backgroundColor:'#383838',title:'Unity 2D Editor',
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.maximize();win.loadFile('index.html');
  win.on('close',e=>{if(force||!dirty)return;e.preventDefault();win.webContents.send('ask-close')});
  win.on('closed',()=>{win=null})});
app.on('window-all-closed',()=>app.quit());

/* ---------- MP4 (H.264) через ffmpeg: кадры RGBA из редактора -> stdin ffmpeg -> временный .mp4 ---------- */
const {spawn}=require('child_process'),os=require('os');
const mp4s=new Map();let mpId=1;
const ffPath=()=>{const exe=process.platform=='win32'?'ffmpeg.exe':'ffmpeg',c=[process.env.U2D_FFMPEG,path.join(process.resourcesPath||'','ffmpeg',exe),path.join(__dirname,'..','ffmpeg',exe),path.join(__dirname,'ffmpeg',exe)].filter(Boolean);
  return c.find(p=>{try{return fs.statSync(p).isFile()}catch(e){return false}})||null};
ipcMain.handle('mp4:probe',()=>({ok:!!ffPath()}));
ipcMain.handle('mp4:start',(_,{w,h,fps,crf})=>{
  const ff=ffPath();if(!ff)return{error:'ffmpeg не найден: положите ffmpeg.exe в папку resources/ffmpeg рядом с программой'};
  try{
    const id=mpId++,out=path.join(os.tmpdir(),`u2d_${process.pid}_${id}.mp4`);
    const p=spawn(ff,['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',`${w}x${h}`,'-framerate',String(fps),'-i','-',
      '-vf','crop=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','medium','-crf',String(crf),'-pix_fmt','yuv420p','-movflags','+faststart','-r',String(fps),out],
      {windowsHide:true,stdio:['pipe','ignore','pipe']});
    const e={p,out,err:'',closed:null};
    p.stderr.on('data',d=>{e.err=(e.err+d).slice(-800)});p.stdin.on('error',()=>{});
    e.done=new Promise(r=>{p.on('close',c=>{e.closed=c;r(c)});p.on('error',er=>{e.err+=String(er);e.closed=-1;r(-1)})});
    mp4s.set(id,e);return{id}
  }catch(er){return{error:String(er.message||er)}}});
ipcMain.handle('mp4:frame',async(_,{id,buf,rep})=>{
  const e=mp4s.get(id);if(!e||e.closed!==null)return{error:'ffmpeg завершился: '+(e?e.err:'нет сессии')};
  try{const b=Buffer.from(buf.buffer,buf.byteOffset,buf.byteLength);
    for(let i=0;i<rep;i++){if(!e.p.stdin.write(b))await new Promise(r=>{e.p.stdin.once('drain',r);e.p.once('close',r)})}
    return{ok:true}}catch(er){return{error:String(er.message||er)}}});
ipcMain.handle('mp4:end',async(_,{id})=>{
  const e=mp4s.get(id);if(!e)return{error:'нет сессии'};
  try{e.p.stdin.end()}catch(_){}const c=await e.done;
  if(c!==0)return{error:'ffmpeg (код '+c+'): '+e.err};
  try{return{ok:true,size:fs.statSync(e.out).size}}catch(er){return{error:String(er.message||er)}}});
ipcMain.handle('mp4:read',(_,{id})=>{const e=mp4s.get(id);return e?fs.readFileSync(e.out):null});
ipcMain.handle('mp4:save',async(_,{id,name})=>{
  const e=mp4s.get(id);if(!e)return{error:'файл не найден'};
  const r=await dialog.showSaveDialog(win,{title:'Сохранить MP4',defaultPath:name,filters:[{name:'MP4 video',extensions:['mp4']}]});
  if(r.canceled||!r.filePath)return{canceled:true};
  try{fs.copyFileSync(e.out,r.filePath);return{path:r.filePath}}catch(er){return{error:String(er.message||er)}}});
ipcMain.handle('mp4:reveal',(_,p)=>{shell.showItemInFolder(p)});
const mpDrop=id=>{const e=mp4s.get(id);if(!e)return;try{e.p.kill()}catch(_){}try{fs.unlinkSync(e.out)}catch(_){}mp4s.delete(id)};
ipcMain.handle('mp4:discard',(_,{id})=>{mpDrop(id)});
app.on('will-quit',()=>[...mp4s.keys()].forEach(mpDrop));

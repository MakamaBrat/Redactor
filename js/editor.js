// mygame editor — standalone: no game code, no bundled assets. Opens a project folder (File System Access API,
// <input webkitdirectory> fallback), reads maps/sprites from it and lets you edit scenes and project files by hand.
const $ = id => document.getElementById(id);
const FS = { base: '', files: new Map(), root: null, name: '' };
const SKIP = new Set(['node_modules', '.git', 'dist', '.vercel']);
const S = { map: null, tag: '', maps: [], objs: [], sel: null, cam: { x: 0, y: 0 }, zoom: 2, ptab: 'proj', sprIds: [], tab: 'Meta', cwd: '', open: new Set([0]), n: 0, D: new Map(), loop: false };
let meta = null, defaultMeta = null;
const P = rel => FS.base + rel;
const toast = (m, bad) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; t.style.color = bad ? '#f99' : '#ddd'; clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = 'none'), 3500); };
const showErr = m => { const e = $('err'); e.style.display = 'block'; e.textContent = m + '\n\n(клик, чтобы закрыть)'; e.onclick = () => (e.style.display = 'none'); };

// ---------- virtual file system over the picked folder ----------
async function walk(dir, pre) { for await (const [n, h] of dir.entries()) { if (SKIP.has(n)) continue; if (h.kind === 'directory') await walk(h, pre + n + '/'); else FS.files.set(pre + n, { h }); } }
async function getFile(p) { const e = FS.files.get(p); if (!e) throw new Error('нет файла: ' + p); return e.h ? e.h.getFile() : e.f; }
const readText = async p => (await getFile(p)).text();
const urls = new Map();
async function urlOf(p) { if (!urls.has(p)) urls.set(p, URL.createObjectURL(await getFile(p))); return urls.get(p); }
const loadImg = async p => { try { const u = await urlOf(p); return await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = u; }); } catch (e) { return null; } };
async function writeFile(path, text) {
  if (FS.root) {
    const parts = path.split('/'); let d = FS.root;
    for (const s of parts.slice(0, -1)) d = await d.getDirectoryHandle(s, { create: true });
    const fh = await d.getFileHandle(parts.at(-1), { create: true }), w = await fh.createWritable(); await w.write(text); await w.close();
    FS.files.set(path, { h: fh }); S.D = buildDirs(); renderTree(); renderGrid(); return 'сохранено: ' + path;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text])); a.download = path.split('/').at(-1); a.click(); return 'скачано (в этом браузере нельзя писать в папку): ' + a.download;
}
function buildDirs() {
  const D = new Map([['', { d: new Set(), f: [] }]]);
  for (const k of FS.files.keys()) { const ps = k.split('/'); let cur = ''; for (let i = 0; i < ps.length - 1; i++) { const nx = cur + ps[i] + '/'; if (!D.has(nx)) D.set(nx, { d: new Set(), f: [] }); D.get(cur).d.add(nx); cur = nx; } D.get(cur).f.push(k); }
  return D;
}

// ---------- engine pieces (own copies, so the editor needs no game files) ----------
const TICK = 50, sprCache = {}, pending = {}, infoCache = {}; // infoCache: one sprite.json object per sprite, shared by all palettes
async function loadSprite(id, pal = 0) {
  const k = id + '#' + pal; if (sprCache[k]) return sprCache[k];
  const base = P(meta.paths.sprites + '/' + id), dir = pal ? 'frames_pal' + pal : 'frames';
  const info = (infoCache[id] ||= JSON.parse(await readText(base + '/sprite.json')));
  const frames = await Promise.all(info.frames.map(f => loadImg(base + '/' + dir + '/f' + String(f.i).padStart(3, '0') + '.png')));
  return (sprCache[k] = { id, info, frames });
}
function getSpr(id, pal) { const k = id + '#' + pal; if (sprCache[k]) return sprCache[k]; if (!pending[k]) pending[k] = loadSprite(id, pal).catch(() => (sprCache[k] = { bad: 1 })); return null; }
function animAt(spr, a, t) { const seq = spr.info.animations[a]; if (!seq || !seq.length) return null; const total = seq.reduce((s, e) => s + Math.max(1, e.time), 0) * TICK; let u = t % total; for (const e of seq) { const d = Math.max(1, e.time) * TICK; if (u < d) return e; u -= d; } return seq.at(-1); }
function drawFrame(g, spr, f, x, y, flip = 0) { const im = spr.frames[f], m = spr.info.frames[f]; if (!im || !m) return; g.save(); g.translate(x, y); g.scale(flip & 1 ? -1 : 1, flip & 2 ? -1 : 1); g.drawImage(im, m.ox, m.oy); g.restore(); }
function tileLookup(d) { return (px, py) => { const T = d.tileSize, tx = Math.floor(px / T), ty = Math.floor(py / T), bw = d.tilesPerBlockW, bh = d.tilesPerBlockH; if (tx < 0 || ty < 0 || tx >= d.blocksW * bw || ty >= d.blocksH * bh) return { collision: 2 }; const b = d.blockMap[Math.floor(tx / bw) + Math.floor(ty / bh) * d.blocksW] & 0x1f, t = d.tileIndex[b][(tx % bw) + (ty % bh) * bw]; return { block: b, tile: t, collision: d.collision[t] ?? 0 }; }; }
async function loadMap(tag) { const base = P(meta.paths.maps + '/' + tag), data = JSON.parse(await readText(base + '.json')), image = await loadImg(base + '_full.png'); if (!image) throw new Error('нет картинки карты ' + tag + '_full.png'); return { tag, data, image, w: image.width, h: image.height, tileAt: tileLookup(data) }; }

// ---------- open project ----------
async function pickProject() {
  try {
    if (window.showDirectoryPicker) { const root = await showDirectoryPicker({ mode: 'readwrite' }); FS.root = root; FS.name = root.name; FS.files = new Map(); await walk(root, ''); await afterOpen(); }
    else $('dirin').click();
  } catch (e) { if (e.name !== 'AbortError') showErr('Не удалось открыть папку: ' + e.message); }
}
$('dirin').onchange = async e => { FS.root = null; FS.files = new Map(); FS.name = e.target.files[0]?.webkitRelativePath.split('/')[0] || ''; for (const f of e.target.files) { const p = f.webkitRelativePath.split('/').slice(1).join('/'); if (!p.split('/').some(s => SKIP.has(s))) FS.files.set(p, { f }); } await afterOpen(); e.target.value = ''; };
function detectBase() { for (const k of FS.files.keys()) { const i = k.indexOf(meta.paths.maps + '/'); if (i >= 0 && k.endsWith('.json')) { FS.base = k.slice(0, i); return true; } } FS.base = ''; return false; }
async function afterOpen() {
  for (const o of [sprCache, pending, infoCache]) for (const k in o) delete o[k];
  urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); meta = defaultMeta;
  if (!detectBase()) return showErr('В выбранной папке не найден ' + meta.paths.maps + '/*.json.\nВыберите папку проекта (ту, где лежит assets/).');
  if (FS.files.has(P('editor.meta.json'))) { try { meta = JSON.parse(await readText(P('editor.meta.json'))); toast('Метафайл взят из проекта'); } catch (e) { toast('editor.meta.json в проекте битый — использую встроенный', true); } }
  S.D = buildDirs(); S.cwd = FS.base; S.open = new Set(['', FS.base]); S.tab = 'Files';
  const md = P(meta.paths.maps + '/'); S.maps = [...FS.files.keys()].filter(k => k.startsWith(md) && k.endsWith('.json') && !k.slice(md.length).includes('/')).map(k => k.slice(md.length, -5)).filter(t => FS.files.has(md + t + '_full.png'));
  if (!S.maps.length) return showErr('Карты не найдены: нужны пары <tag>.json + <tag>_full.png в ' + md);
  $('pname').textContent = FS.name + (FS.base ? ' / ' + FS.base : '') + (FS.root ? '' : ' (только чтение)');
  const sd = P(meta.paths.sprites + '/'); S.sprIds = [...new Set([...FS.files.keys()].filter(k => k.startsWith(sd) && k.endsWith('/sprite.json')).map(k => k.slice(sd.length).split('/')[0]))].sort(); A.id = ''; fillSprSelect();
  $('start').style.display = 'none';
  try { await setMap(S.maps[0], false); } catch (e) { return showErr('Не удалось загрузить карту: ' + e.message); }
  renderAll(); if (!S.loop) { S.loop = true; frame(); }
}

// ---------- scene ----------
const prefab = o => meta.prefabs.find(p => p.name === o.prefab) || meta.prefabs.find(p => p.spr === o.spr && p.kind === o.kind);
function add(p, x, y) { const o = { id: ++S.n, name: p.name + ' (' + S.n + ')', kind: p.kind, prefab: p.name, spr: p.spr, pal: p.pal, anim: p.anim, flip: 0, x: Math.round(x), y: Math.round(y) }; getSpr(o.spr, o.pal); S.objs.push(o); select(o); return o; }
function select(o) { S.sel = o; renderHier(); renderInsp(); }
async function setMap(tag, keep = true) {
  S.map = await loadMap(tag); S.tag = tag; if (!keep) S.objs = [];
  if (!keep) {
    const cx = S.map.w / 2, cy = S.map.h / 2; let hx = cx, hy = cy;
    search: for (let r = 0; r < 800; r += 24) for (let a = 0; a < 6.28; a += .4) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (S.map.tileAt(x, y).collision === 0) { hx = x; hy = y; break search; } }
    const by = k => meta.prefabs.find(p => p.kind === k);
    for (const [k, dx, dy] of [['player', 0, 0], ['car', 60, 0], ['ped', -40, 30], ['cop', 0, -50]]) if (by(k)) add(by(k), hx + dx, hy + dy);
    select(S.objs[0] || null); S.cam = { x: hx - cv.width / 2 / S.zoom, y: hy - cv.height / 2 / S.zoom };
  }
  if (S.tab === 'Maps') renderGrid(); renderHier();
}
async function loadScene(path) {
  try { const d = JSON.parse(await readText(path)); if (d.map !== S.tag) await setMap(d.map, true); S.objs = d.objects || []; S.n = Math.max(0, ...S.objs.map(o => o.id || 0)); S.objs.forEach(o => getSpr(o.spr, o.pal)); select(null); toast('Сцена загружена: ' + path); } catch (e) { toast('Не удалось загрузить сцену: ' + e.message, true); }
}

// ---------- panels ----------
function renderAll() { renderHier(); renderInsp(); renderTree(); renderGrid(); }
function renderHier() {
  const h = $('hl'); h.innerHTML = '<div class="root">▾ ' + (S.tag || '—') + ' (Scene)</div>';
  for (const o of S.objs) {
    const d = document.createElement('div'); d.className = 'row' + (o === S.sel ? ' sel' : ''); d.style.paddingLeft = '22px';
    d.innerHTML = '<i>' + (prefab(o)?.icon || '▫') + '</i>' + o.name + '<span class="k">' + o.kind + '</span>';
    d.onclick = () => select(o); d.ondblclick = () => { S.cam = { x: o.x - cv.width / 2 / S.zoom, y: o.y - cv.height / 2 / S.zoom }; };
    h.appendChild(d);
  }
}
function renderInsp() {
  const o = S.sel, b = $('il'); if (!o) { b.innerHTML = '<div class="empty">Ничего не выбрано</div>'; return; }
  const L = { x: 'Position X', y: 'Position Y', anim: 'Animation', pal: 'Palette', flip: 'Flip (0-3)' };
  b.innerHTML = '<div class="root">' + o.kind + ' · ' + o.spr + '</div><div class="f"><label>Name</label><input type="text" data-p="name" value="' + o.name.replace(/"/g, '&quot;') + '"></div>' +
    Object.keys(L).map(k => '<div class="f"><label>' + L[k] + '</label><input type="number" data-p="' + k + '" value="' + o[k] + '"></div>').join('') +
    '<div class="f"><label></label><button id="del">Удалить (Del)</button></div><div class="f"><label></label><button id="oan">Открыть в аниматоре</button></div><div class="note">' + (prefab(o)?.doc || '') + '</div>';
  b.querySelectorAll('input').forEach(i => i.oninput = () => { o[i.dataset.p] = i.type === 'number' ? +i.value || 0 : i.value; if (i.dataset.p === 'pal') getSpr(o.spr, o.pal); if (i.dataset.p === 'name') renderHier(); });
  $('del').onclick = del; $('oan').onclick = () => openAnimator(o.spr, o.pal, o.anim);
}
function del() { if (!S.sel) return; S.objs = S.objs.filter(o => o !== S.sel); select(null); }
const base = p => p.replace(/\/$/, '').split('/').at(-1);
function renderTree() {
  const t = $('tree'); t.innerHTML = '';
  const row = (txt, pad, on, sel) => { const d = document.createElement('div'); d.className = 'row' + (sel ? ' sel' : ''); d.style.paddingLeft = pad + 'px'; d.textContent = txt; d.onclick = on; t.appendChild(d); };
  const dirs = (dir, depth) => { const e = S.D.get(dir); if (!e) return; for (const d of [...e.d].sort()) { const kids = S.D.get(d).d.size, open = S.open.has(d); row((kids ? (open ? '▾ ' : '▸ ') : '   ') + '📁 ' + base(d), 8 + depth * 12, () => { S.tab = 'Files'; S.cwd = d; kids && (open ? S.open.delete(d) : S.open.add(d)); renderTree(); renderGrid(); }, S.tab === 'Files' && S.cwd === d); if (open) dirs(d, depth + 1); } };
  if (FS.files.size) { row('▾ 📁 ' + (FS.name || 'Project'), 4, () => { S.tab = 'Files'; S.cwd = FS.base; renderTree(); renderGrid(); }, S.tab === 'Files' && S.cwd === FS.base); dirs(FS.base, 1); }
  row('🧩 Prefabs', 8, () => { S.tab = 'Prefabs'; renderTree(); renderGrid(); }, S.tab === 'Prefabs');
  row('🗺 Maps', 8, () => { S.tab = 'Maps'; renderTree(); renderGrid(); }, S.tab === 'Maps');
  row('📘 Meta', 8, () => { S.tab = 'Meta'; renderTree(); renderGrid(); }, S.tab === 'Meta');
}
const ICON = { json: '🧾', js: '📜', md: '📝', txt: '📝', html: '🌐', css: '🎨', java: '☕', py: '🐍', png: '🖼', wav: '🔊', mid: '🎵', bin: '📦', zip: '🗜' };
const TEXT = new Set(['json', 'js', 'md', 'txt', 'html', 'css', 'java', 'py', 'cjs', 'mjs', 'bat', 'gitignore']);
function renderGrid() {
  const g = $('grid'); g.innerHTML = '';
  if (S.tab === 'Meta') return renderMeta(g);
  if (S.tab === 'Maps') { for (const t of S.maps) { const d = document.createElement('div'); d.className = 'it map'; d.style.background = t === S.tag ? 'var(--hi)' : ''; d.innerHTML = '<canvas width="76" height="50"></canvas><span>' + t + '</span>'; d.onclick = () => setMap(t, true).then(renderGrid).catch(e => toast(e.message, true)); loadImg(P(meta.paths.maps + '/' + t + '_preview.png')).then(im => im && d.firstChild.getContext('2d').drawImage(im, 0, 0, 76, 50)); g.appendChild(d); } return; }
  if (S.tab === 'Prefabs') {
    for (const p of meta.prefabs) {
      const d = document.createElement('div'); d.className = 'it'; d.draggable = true; d.title = p.doc; d.innerHTML = '<canvas width="64" height="64"></canvas><span>' + p.name + '</span>';
      d.ondragstart = e => e.dataTransfer.setData('text/plain', meta.prefabs.indexOf(p)); d.ondblclick = () => add(p, S.cam.x + cv.width / 2 / S.zoom, S.cam.y + cv.height / 2 / S.zoom); g.appendChild(d);
      loadSprite(p.spr, p.pal).then(() => { const o = { ...p, x: 0, y: 0, flip: 0 }, r = frameOf(o); if (!r) return; const t = document.createElement('canvas'); t.width = t.height = 128; const tc = t.getContext('2d'); tc.translate(64, 64); drawObj(tc, o); const b = bbox(o), k = Math.min(1, 56 / Math.max(b.x1 - b.x0, b.y1 - b.y0)), c = d.firstChild.getContext('2d'); c.imageSmoothingEnabled = false; c.save(); c.translate(32, 32); c.scale(k, k); c.drawImage(t, -64, -64); c.restore(); }).catch(() => {});
    }
    return;
  }
  const e = S.D.get(S.cwd); if (!e) { g.innerHTML = '<div class="empty">Папка пуста</div>'; return; }
  const items = [...[...e.d].sort().map(d => ({ dir: d })), ...e.f.sort().map(f => ({ f }))];
  for (const it of items.slice(0, 600)) {
    const d = document.createElement('div'); d.className = 'it'; const name = base(it.dir || it.f), ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    d.title = it.dir || it.f; d.innerHTML = '<div class="ic">' + (it.dir ? '📁' : ICON[ext] || '📄') + '</div><span>' + name + '</span>';
    d.ondblclick = () => it.dir ? (S.cwd = it.dir, S.open.add(it.dir), renderTree(), renderGrid()) : openFile(it.f); g.appendChild(d);
  }
  if (items.length > 600) g.insertAdjacentHTML('beforeend', '<div class="empty">… показаны первые 600 из ' + items.length + '</div>');
  if (!items.length) g.innerHTML = '<div class="empty">Папка пуста</div>';
}
function renderMeta(g) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  g.innerHTML = '<div class="docs"><p>' + esc(meta.about) + '</p>' + '<button id="svmeta" style="margin:8px 0">Сохранить метафайл в проект (editor.meta.json)</button>' +
    '<h5>Коды коллизии (collision)</h5>' + Object.entries(meta.collision).map(([k, v]) => '<div class="leg"><b style="background:' + (v.color || 'transparent') + '"></b>' + k + ' — <span>' + esc(v.name) + ': ' + esc(v.doc) + '</span></div>').join('') +
    meta.docs.map(d => '<h5>' + esc(d.title) + '</h5><p>' + esc(d.text) + '</p>').join('') + '</div>';
  $('svmeta').onclick = async () => { if (!FS.files.size) return toast('Сначала откройте проект', true); try { toast(await writeFile(P('editor.meta.json'), JSON.stringify(meta, null, 2))); } catch (e) { toast(e.message, true); } };
}
// ---------- file editor ----------
async function openFile(path) {
  const name = base(path), ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (name.endsWith('.scene.json')) return loadScene(path);
  const ed = $('ed'); ed.style.display = 'flex';
  const head = (extra = '') => '<div class="eb"><b>' + path + '</b>' + extra + '<button id="edx">Закрыть</button></div>';
  if (ext === 'png') { ed.innerHTML = head() + '<div class="im"><img id="edi"></div>'; $('edi').src = await urlOf(path); }
  else if (TEXT.has(ext) || (await getFile(path)).size < 200000 && ext !== 'bin' && ext !== 'wav' && ext !== 'mid') {
    const txt = await readText(path); ed.innerHTML = head('<button id="eds">💾 Сохранить</button>') + '<textarea id="edt" spellcheck="false"></textarea>'; const ta = $('edt'); ta.value = txt;
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('eds').click(); } };
    $('eds').onclick = async () => { try { if (ext === 'json') JSON.parse(ta.value); toast(await writeFile(path, ta.value)); } catch (e) { toast('Не сохранено: ' + e.message, true); } };
  } else { ed.innerHTML = head() + '<div class="empty">Бинарный файл (' + ext + '), правка вручную недоступна.</div>'; }
  $('edx').onclick = () => (ed.style.display = 'none');
}

// ---------- scene view ----------
const cv = $('cv'), ctx = cv.getContext('2d');
const frameOf = o => { const s = getSpr(o.spr, o.pal); if (!s || s.bad) return null; const e = animAt(s, o.anim, $('anm').checked ? performance.now() : 0); return e ? { s, e } : null; };
const fidx = e => e.frame ?? e.f ?? e.i;
function bbox(o) {
  const mk = (x, y) => ({ x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 }), r = frameOf(o); if (!r) return mk(o.x, o.y);
  const f = fidx(r.e), m = r.s.info.frames[f], im = r.s.frames[f]; if (!m || !im) return mk(o.x, o.y);
  const dx = r.e.dx || 0, dy = r.e.dy || 0, fl = o.flip ^ (r.e.flip || 0), w = im.width, h = im.height;
  const x0 = fl & 1 ? o.x - dx - m.ox - w : o.x + dx + m.ox, y0 = fl & 2 ? o.y - dy - m.oy - h : o.y + dy + m.oy; return { x0, y0, x1: x0 + w, y1: y0 + h };
}
function drawObj(g, o) { const r = frameOf(o); if (!r) { g.fillStyle = '#f0f'; g.fillRect(o.x - 6, o.y - 6, 12, 12); return; } drawFrame(g, r.s, fidx(r.e), o.x + (r.e.dx || 0), o.y + (r.e.dy || 0), (o.flip ^ (r.e.flip || 0)) & 3); }
const world = (px, py) => ({ x: S.cam.x + px / S.zoom, y: S.cam.y + py / S.zoom });
function frame() {
  requestAnimationFrame(frame); const r = cv.parentElement.getBoundingClientRect(); if (cv.width !== (r.width | 0) || cv.height !== (r.height | 0)) { cv.width = r.width | 0; cv.height = r.height | 0; }
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#111'; ctx.fillRect(0, 0, cv.width, cv.height); if (!S.map) return;
  ctx.save(); ctx.scale(S.zoom, S.zoom); ctx.translate(-S.cam.x, -S.cam.y); ctx.drawImage(S.map.image, 0, 0);
  if ($('col').checked) { const T = S.map.data.tileSize, x0 = Math.max(0, Math.floor(S.cam.x / T)), y0 = Math.max(0, Math.floor(S.cam.y / T)), x1 = Math.ceil((S.cam.x + cv.width / S.zoom) / T), y1 = Math.ceil((S.cam.y + cv.height / S.zoom) / T); for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) { const c = meta.collision[S.map.tileAt(tx * T + 1, ty * T + 1).collision]?.color; if (c) { ctx.fillStyle = c; ctx.fillRect(tx * T, ty * T, T, T); } } }
  for (const o of [...S.objs].sort((a, b) => a.y - b.y)) drawObj(ctx, o);
  const o = S.sel; if (o) { const b = bbox(o); ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 1 / S.zoom; ctx.strokeRect(b.x0 - .5, b.y0 - .5, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); ctx.strokeStyle = '#f33'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + 14, o.y); ctx.stroke(); ctx.strokeStyle = '#3f3'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y - 14); ctx.stroke(); }
  ctx.restore(); $('zl').textContent = Math.round(S.zoom * 100) + '%';
}
let drag = null;
const pick = w => [...S.objs].sort((a, b) => b.y - a.y).find(o => { const b = bbox(o); return w.x >= b.x0 && w.x <= b.x1 && w.y >= b.y0 && w.y <= b.y1; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const w = world(e.offsetX, e.offsetY); if (e.button === 1 || e.button === 2 || e.altKey) { drag = { pan: 1, sx: e.clientX, sy: e.clientY, cx: S.cam.x, cy: S.cam.y }; return; } const o = pick(w); select(o || null); if (o) drag = { o, dx: o.x - w.x, dy: o.y - w.y }; });
cv.addEventListener('pointermove', e => {
  const w = world(e.offsetX, e.offsetY); if (S.map) { const c = S.map.tileAt(w.x, w.y).collision; $('hud').textContent = 'x ' + (w.x | 0) + '  y ' + (w.y | 0) + '  коллизия ' + c + ' (' + (meta.collision[c]?.name || '?') + ')'; }
  if (!drag) return; if (drag.pan) { S.cam.x = drag.cx - (e.clientX - drag.sx) / S.zoom; S.cam.y = drag.cy - (e.clientY - drag.sy) / S.zoom; } else { drag.o.x = Math.round(w.x + drag.dx); drag.o.y = Math.round(w.y + drag.dy); renderInsp(); }
});
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); const w = world(e.offsetX, e.offsetY); S.zoom = Math.max(.25, Math.min(8, S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); S.cam.x = w.x - e.offsetX / S.zoom; S.cam.y = w.y - e.offsetY / S.zoom; }, { passive: false });
cv.addEventListener('dragover', e => e.preventDefault());
cv.addEventListener('drop', e => { e.preventDefault(); const p = meta.prefabs[+e.dataTransfer.getData('text/plain')]; if (p) { const w = world(e.offsetX, e.offsetY); add(p, w.x, w.y); } });
addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || !S.map) return;
  if (S.ptab === 'anim' && A.focus) return animKey(e);
  if (e.key === 'Delete' || e.key === 'Backspace') del();
  if ((e.ctrlKey || e.metaKey) && e.key === 'd' && S.sel) { e.preventDefault(); const s = S.sel, o = add(prefab(s) || s, s.x + 12, s.y + 12); Object.assign(o, { anim: s.anim, pal: s.pal, flip: s.flip, name: s.name.replace(/ \(\d+\)$/, '') + ' (' + o.id + ')' }); renderHier(); renderInsp(); }
  if (S.sel && e.key.startsWith('Arrow')) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; S.sel.x += e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0; S.sel.y += e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0; renderInsp(); }
});
$('openp').onclick = $('openp2').onclick = pickProject;
$('save').onclick = async () => { if (!S.map) return toast('Сначала откройте проект', true); try { toast(await writeFile(P(meta.paths.scenes + '/' + S.tag + '.scene.json'), JSON.stringify({ map: S.tag, objects: S.objs }, null, 1))); } catch (e) { toast('Не сохранено: ' + e.message, true); } };


// ---------- animator: keyframe editor for sprite.json animations (entry = {frame, time, dx, dy, flip}; time in 50 ms ticks) ----------
const A = { id: '', pal: 0, idx: 0, sel: 0, spr: null, playing: false, t: 0, dirty: false, undo: [], focus: false, K: 6, cur: -1, pk: [] };
const clip = () => A.spr?.info.animations[A.idx];
const dur = e => Math.max(1, e.time) * TICK;
const total = () => (clip() || []).reduce((s, e) => s + dur(e), 0);
const keyStart = i => (clip() || []).slice(0, i).reduce((s, e) => s + dur(e), 0);
function keyAt(t) { const c = clip() || []; let a = 0; for (let i = 0; i < c.length; i++) { if (t < a + dur(c[i])) return i; a += dur(c[i]); } return Math.max(0, c.length - 1); }
const layout = () => { let x = 0; return (clip() || []).map(e => { const w = Math.max(34, e.time * A.K), r = { x, w }; x += w; return r; }); };
function timeToX(t) { const c = clip() || [], L = layout(); let a = 0; for (let i = 0; i < c.length; i++) { const d = dur(c[i]); if (t < a + d || i === c.length - 1) return L[i].x + Math.min(1, (t - a) / d) * L[i].w; a += d; } return 0; }
function xToTime(x) { const c = clip() || [], L = layout(); let a = 0; for (let i = 0; i < c.length; i++) { const d = dur(c[i]); if (x < L[i].x + L[i].w || i === c.length - 1) return a + Math.max(0, Math.min(1, (x - L[i].x) / L[i].w)) * d; a += d; } return 0; }
function thumb(c, spr, f) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); const im = spr.frames[f], m = spr.info.frames[f]; if (!im || !m) return; const k = Math.min(1, (c.width - 2) / Math.max(im.width, im.height)); g.imageSmoothingEnabled = false; g.drawImage(im, (c.width - im.width * k) / 2, (c.height - im.height * k) / 2, im.width * k, im.height * k); }
function fillSprSelect() { $('asp').innerHTML = S.sprIds.map(i => '<option>' + i + '</option>').join(''); }
function setPTab(t) { S.ptab = t; $('pbody').style.display = t === 'proj' ? 'flex' : 'none'; $('anim').style.display = t === 'anim' ? 'flex' : 'none'; document.querySelectorAll('#ptabs .tb').forEach(b => b.classList.toggle('on', b.dataset.p === t)); if (t === 'anim' && !A.id && S.sprIds.length) openAnimator(S.sprIds[0], 0, 0); }
async function openAnimator(id, pal = 0, idx = 0) {
  if (!FS.files.size) return toast('Сначала откройте проект', true);
  setPTab('anim');
  try { A.spr = await loadSprite(id, pal | 0); } catch (e) { return toast('Не удалось загрузить спрайт ' + id + ': ' + e.message, true); }
  Object.assign(A, { id, pal: pal | 0, idx: Math.max(0, Math.min(idx | 0, A.spr.info.animations.length - 1)), sel: 0, t: 0, playing: false, undo: [], dirty: false });
  $('asp').value = id; $('apal').innerHTML = Array.from({ length: Math.max(1, (A.spr.info.palettes?.length) || 1) }, (_, i) => '<option value="' + i + '">палитра ' + i + '</option>').join(''); $('apal').value = A.pal;
  $('aplay').textContent = '▶'; $('adirty').textContent = '';
  buildPicker(); renderTL(); renderKey();
}
function buildPicker() {
  const p = $('apick'); p.innerHTML = ''; A.pk = [];
  A.spr.frames.forEach((im, f) => { const c = document.createElement('canvas'); c.width = c.height = 36; c.title = 'frame ' + f; thumb(c, A.spr, f); c.onclick = () => { const e = (clip() || [])[A.sel]; if (!e) return; snap(); e.frame = f; touch(); }; p.appendChild(c); A.pk.push(c); });
}
function snap() { A.undo.push({ idx: A.idx, j: JSON.stringify(clip()) }); if (A.undo.length > 80) A.undo.shift(); }
function touch() { A.dirty = true; $('adirty').textContent = '● не сохранено'; renderTL(); renderKey(); }
function undo() { const u = A.undo.pop(); if (!u) return toast('Нечего отменять'); A.idx = u.idx; A.spr.info.animations[A.idx] = JSON.parse(u.j); A.sel = Math.min(A.sel, Math.max(0, clip().length - 1)); touch(); }
function renderTL() {
  const c = clip() || [], L = layout(), W = L.length ? L.at(-1).x + L.at(-1).w + 60 : 200;
  $('acnt').textContent = 'из ' + A.spr.info.animations.length + ' · ' + c.length + ' ключей · ' + (total() / 1000).toFixed(2) + ' с'; $('aidx').value = A.idx;
  for (let r = 0; r < 4; r++) { const l = $('lr' + r); l.innerHTML = ''; l.style.width = W + 'px'; }
  let tick = 0;
  c.forEach((e, i) => {
    const { x, w } = L[i], sel = i === A.sel ? ' sel' : '';
    const t = document.createElement('div'); t.className = 'tk'; t.style.left = x + 'px'; t.textContent = tick * TICK + ' мс'; $('lr0').appendChild(t); tick += Math.max(1, e.time);
    const b = document.createElement('div'); b.className = 'kb' + sel; b.style.left = x + 1 + 'px'; b.style.width = w - 2 + 'px'; b.dataset.i = i;
    const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 32; thumb(cv2, A.spr, e.frame); b.appendChild(cv2);
    const sm = document.createElement('small'); sm.innerHTML = '#' + e.frame + '<br>' + e.time + ' т'; b.appendChild(sm);
    const rz = document.createElement('div'); rz.className = 'rz'; rz.title = 'Тяни — длительность'; b.appendChild(rz);
    b.onpointerdown = ev => { if (ev.target === rz) return resizeStart(ev, i); A.sel = i; A.playing = false; $('aplay').textContent = '▶'; A.t = keyStart(i); renderTL(); renderKey(); };
    $('lr1').appendChild(b);
    const dm = document.createElement('div'); dm.className = 'dm' + sel + (e.dx || e.dy ? '' : ' off'); dm.style.left = x + 1 + 'px'; dm.style.maxWidth = w - 2 + 'px'; dm.textContent = '◆ ' + (e.dx || 0) + ',' + (e.dy || 0); dm.onpointerdown = () => b.onpointerdown({ target: null }); $('lr2').appendChild(dm);
    const fl = document.createElement('div'); fl.className = 'dm' + sel + (e.flip ? '' : ' off'); fl.style.left = x + 1 + 'px'; fl.style.maxWidth = w - 2 + 'px'; fl.textContent = '◆ ' + (e.flip || 0); fl.onpointerdown = () => b.onpointerdown({ target: null }); $('lr3').appendChild(fl);
  });
  if (!c.length) $('lr1').innerHTML = '<div class="empty">Пустой клип — нажмите «+ Key»</div>';
  $('tin').style.width = W + 64 + 'px'; A.cur = -1; updatePlay();
}
function resizeStart(ev, i) {
  ev.preventDefault(); const e = clip()[i]; snap(); const x0 = ev.clientX, t0 = e.time; A.sel = i;
  const mv = m => { e.time = Math.max(1, Math.round(t0 + (m.clientX - x0) / A.K)); A.dirty = true; $('adirty').textContent = '● не сохранено'; renderTL(); renderKey(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function renderKey() {
  const e = (clip() || [])[A.sel]; const ids = ['akf', 'akt', 'akx', 'aky', 'akfl'], ks = ['frame', 'time', 'dx', 'dy', 'flip'];
  ids.forEach((id, n) => { const el = $(id); el.disabled = !e; if (e && document.activeElement !== el) el.value = e[ks[n]] ?? 0; });
  A.pk.forEach((c, f) => c.classList.toggle('on', !!e && e.frame === f));
}
function updatePlay() {
  if (!A.spr) return; const i = keyAt(A.t);
  $('ph').style.left = 64 + timeToX(A.t) + 'px';
  if (i !== A.cur) { A.cur = i; document.querySelectorAll('#lr1 .kb').forEach(b => b.classList.toggle('cur', +b.dataset.i === i)); if (A.playing && A.sel !== i) { A.sel = i; renderTL(); renderKey(); } }
  const c = $('apc'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); if (A.spr.bad) return;
  g.save(); g.translate(80, 100); g.scale(3, 3); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1 / 3; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.moveTo(0, -40); g.lineTo(0, 10); g.stroke();
  const e = (clip() || [])[i]; if (e) drawFrame(g, A.spr, e.frame, e.dx || 0, e.dy || 0, e.flip || 0); g.restore();
}
function animKey(e) {
  const c = clip() || [];
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('asave').click(); }
  else if (e.key === ' ') { e.preventDefault(); $('aplay').click(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('akdel').click(); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); A.sel = Math.max(0, Math.min(c.length - 1, A.sel + (e.key === 'ArrowRight' ? 1 : -1))); A.t = keyStart(A.sel); A.playing = false; renderTL(); renderKey(); }
}
function initAnim() {
  document.querySelectorAll('#ptabs .tb').forEach(b => b.onclick = () => setPTab(b.dataset.p));
  addEventListener('pointerdown', e => { A.focus = !!e.target.closest('#anim'); }, true);
  $('asp').onchange = () => openAnimator($('asp').value, 0, 0); $('apal').onchange = () => openAnimator(A.id, +$('apal').value, A.idx);
  const go = n => { if (!A.spr) return; const N = A.spr.info.animations.length; A.idx = Math.max(0, Math.min(N - 1, n | 0)); A.sel = 0; A.t = 0; A.playing = false; $('aplay').textContent = '▶'; renderTL(); renderKey(); };
  $('aprev').onclick = () => go(A.idx - 1); $('anext').onclick = () => go(A.idx + 1); $('aidx').onchange = () => go(+$('aidx').value);
  $('aplay').onclick = () => { if (!A.spr) return; A.playing = !A.playing; $('aplay').textContent = A.playing ? '⏸' : '▶'; if (A.playing && A.t >= total()) A.t = 0; };
  $('azm').oninput = () => { A.K = +$('azm').value; renderTL(); };
  $('akadd').onclick = () => { if (!A.spr) return; snap(); const c = clip(), src = c[A.sel] || { frame: 0, time: 2, dx: 0, dy: 0, flip: 0 }; c.splice(c.length ? A.sel + 1 : 0, 0, { ...src }); A.sel = c.length > 1 ? A.sel + 1 : 0; touch(); };
  $('akdel').onclick = () => { const c = clip(); if (!c || !c.length) return; snap(); c.splice(A.sel, 1); A.sel = Math.max(0, Math.min(A.sel, c.length - 1)); touch(); };
  const mv = d => { const c = clip(), j = A.sel + d; if (!c || j < 0 || j >= c.length) return; snap(); [c[A.sel], c[j]] = [c[j], c[A.sel]]; A.sel = j; touch(); };
  $('akl').onclick = () => mv(-1); $('akr').onclick = () => mv(1);
  $('aclone').onclick = () => { if (!A.spr) return; const an = A.spr.info.animations; an.push(JSON.parse(JSON.stringify(clip() || []))); A.idx = an.length - 1; A.sel = 0; A.dirty = true; $('adirty').textContent = '● не сохранено'; toast('Клон добавлен в конец: клип ' + A.idx); renderTL(); renderKey(); };
  $('anew').onclick = () => { if (!A.spr) return; const an = A.spr.info.animations; an.push([{ frame: 0, time: 2, dx: 0, dy: 0, flip: 0 }]); A.idx = an.length - 1; A.sel = 0; A.dirty = true; $('adirty').textContent = '● не сохранено'; toast('Новый клип: ' + A.idx); renderTL(); renderKey(); };
  $('aundo').onclick = undo;
  [['akf', 'frame'], ['akt', 'time'], ['akx', 'dx'], ['aky', 'dy'], ['akfl', 'flip']].forEach(([id, k]) => { const el = $(id); el.onfocus = () => snap(); el.oninput = () => { const e = (clip() || [])[A.sel]; if (!e) return; let v = +el.value || 0; if (k === 'time') v = Math.max(1, v); if (k === 'flip') v = Math.max(0, Math.min(3, v)); e[k] = v; A.dirty = true; $('adirty').textContent = '● не сохранено'; renderTL(); A.pk.forEach((c, f) => c.classList.toggle('on', e.frame === f)); }; });
  $('asave').onclick = async () => { if (!A.spr) return; try { toast(await writeFile(P(meta.paths.sprites + '/' + A.id + '/sprite.json'), JSON.stringify(A.spr.info))); A.dirty = false; $('adirty').textContent = ''; } catch (e) { toast('Не сохранено: ' + e.message, true); } };
  const scrub = ev => { const r = $('lr0').getBoundingClientRect(); A.t = xToTime(ev.clientX - r.left); A.playing = false; $('aplay').textContent = '▶'; };
  $('lr0').onpointerdown = ev => { scrub(ev); const m = scrub, up = () => { removeEventListener('pointermove', m); removeEventListener('pointerup', up); }; addEventListener('pointermove', m); addEventListener('pointerup', up); };
  let last = 0; (function loop(ts) { requestAnimationFrame(loop); const dt = Math.min(100, ts - last); last = ts; if (S.ptab !== 'anim' || !A.spr) return; if (A.playing) { const tt = total(); A.t += dt * $('aspd').value; if (tt && A.t >= tt) { if ($('aloop').checked) A.t %= tt; else { A.t = Math.max(0, tt - 1); A.playing = false; $('aplay').textContent = '▶'; } } } updatePlay(); })(0);
}

initAnim();
// ---------- boot: built-in metafile first, so docs are readable before any project is opened ----------
fetch('editor.meta.json').then(r => r.json()).then(m => { meta = defaultMeta = m; renderTree(); renderGrid(); renderInsp(); })
  .catch(e => showErr('Не удалось загрузить editor.meta.json рядом с index.html: ' + e.message));

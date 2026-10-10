// Mini "Unity-style" editor for the mygame web port. Same stack: vanilla ES modules + Canvas 2D, engine.js for assets.
import { loadMap, loadSprite, drawFrame, animAt } from './engine.js';
const $ = id => document.getElementById(id);
const MAPS = ['city1_h', 'city2_s'];
// Prefabs = entity kinds of the game (sprite id, start animation, palette). Animation numbers come from README.
const PREFABS = [
  { name: 'Hero',        kind: 'player', icon: '🧍', spr: 'i_00', anim: 90,  pal: 0 },
  { name: 'Pedestrian',  kind: 'ped',    icon: '🚶', spr: 'i_00', anim: 90,  pal: 1 },
  { name: 'Woman',       kind: 'ped',    icon: '🚶‍♀️', spr: 'i_00', anim: 208, pal: 2 },
  { name: 'Cop',         kind: 'cop',    icon: '👮', spr: 'i_00', anim: 164, pal: 0 },
  { name: 'PoliceCar',   kind: 'car',    icon: '🚓', spr: 'k_00', anim: 0,   pal: 0 },
  ...[1, 2, 3, 4].map(n => ({ name: 'Car ' + n, kind: 'car', icon: '🚗', spr: 'k_0' + n, anim: 0, pal: 0 })),
];
const S = { map: null, tag: MAPS[0], objs: [], sel: null, cam: { x: 0, y: 0 }, zoom: 2, tab: 'Prefabs', n: 0 };
const sprs = {}, pending = {};
function getSpr(id, pal) { // cached sprite or kick off async load
  const k = id + '#' + pal; if (sprs[k]) return sprs[k];
  if (!pending[k]) pending[k] = loadSprite(id, pal).then(s => (sprs[k] = s)).catch(() => (sprs[k] = { bad: 1 }));
  return null;
}
const cv = $('cv'), ctx = cv.getContext('2d');
const frameOf = o => { const s = getSpr(o.spr, o.pal); if (!s || s.bad) return null; const e = animAt(s, o.anim, $('anm').checked ? performance.now() : 0); return e ? { s, e } : null; };
function bbox(o) { // world-space box of the current frame
  const r = frameOf(o); if (!r) return { x0: o.x - 8, y0: o.y - 8, x1: o.x + 8, y1: o.y + 8 };
  const f = r.e.frame ?? r.e.f ?? r.e.i, m = r.s.info.frames[f], im = r.s.frames[f]; if (!m || !im) return { x0: o.x - 8, y0: o.y - 8, x1: o.x + 8, y1: o.y + 8 };
  const dx = r.e.dx || 0, dy = r.e.dy || 0, w = im.width, h = im.height;
  const fx = (o.flip ^ (r.e.flip || 0)) & 1, fy = ((o.flip ^ (r.e.flip || 0)) >> 1) & 1;
  const x0 = fx ? o.x - dx - m.ox - w : o.x + dx + m.ox, y0 = fy ? o.y - dy - m.oy - h : o.y + dy + m.oy;
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}
function drawObj(g, o) {
  const r = frameOf(o);
  if (!r) { g.fillStyle = '#f0f'; g.fillRect(o.x - 6, o.y - 6, 12, 12); return; }
  const f = r.e.frame ?? r.e.f ?? r.e.i;
  drawFrame(g, r.s, f, o.x + (r.e.dx || 0), o.y + (r.e.dy || 0), (o.flip ^ (r.e.flip || 0)) & 3);
}
// ---------- scene ----------
function add(p, x, y) {
  const o = { id: ++S.n, name: p.name + ' (' + S.n + ')', kind: p.kind, spr: p.spr, pal: p.pal, anim: p.anim, flip: 0, x: Math.round(x), y: Math.round(y) };
  getSpr(o.spr, o.pal); S.objs.push(o); select(o); return o;
}
function select(o) { S.sel = o; renderHier(); renderInsp(); }
async function setMap(tag, keep = true) {
  S.tag = tag; S.map = await loadMap(tag);
  if (!keep) S.objs = [];
  renderTree(); renderGrid();
  if (!keep) { // drop the hero on the first road tile near the middle and a few friends beside
    const cx = S.map.w / 2, cy = S.map.h / 2; let hx = cx, hy = cy;
    search: for (let r = 0; r < 800; r += 24) for (let a = 0; a < 6.28; a += .4) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (S.map.tileAt(x, y).collision === 0) { hx = x; hy = y; break search; } }
    add(PREFABS[0], hx, hy); add(PREFABS[5], hx + 60, hy); add(PREFABS[1], hx - 40, hy + 30); add(PREFABS[3], hx, hy - 50);
    select(S.objs[0]); S.cam = { x: hx - cv.width / 2 / S.zoom, y: hy - cv.height / 2 / S.zoom };
  }
}
// ---------- panels ----------
function renderHier() {
  const h = $('hl'); h.innerHTML = '<div class="root">▾ ' + S.tag + ' (Scene)</div>';
  for (const o of S.objs) {
    const d = document.createElement('div'); d.className = 'row' + (o === S.sel ? ' sel' : ''); d.style.paddingLeft = '22px';
    d.innerHTML = '<i>' + (PREFABS.find(p => p.spr === o.spr && p.kind === o.kind)?.icon || '▫') + '</i>' + o.name + '<span class="k">' + o.kind + '</span>';
    d.onclick = () => select(o); d.ondblclick = () => { S.cam = { x: o.x - cv.width / 2 / S.zoom, y: o.y - cv.height / 2 / S.zoom }; };
    h.appendChild(d);
  }
}
function renderInsp() {
  const o = S.sel, b = $('il'); if (!o) { b.innerHTML = '<div class="empty">Ничего не выбрано</div>'; return; }
  b.innerHTML = '<div class="root">' + o.kind + ' · ' + o.spr + '</div>' +
    '<div class="f"><label>Name</label><input type="text" data-p="name" value="' + o.name + '"></div>' +
    ['x', 'y', 'anim', 'pal', 'flip'].map(k => '<div class="f"><label>' + ({ x: 'Position X', y: 'Position Y', anim: 'Animation', pal: 'Palette', flip: 'Flip (0-3)' })[k] + '</label><input type="number" data-p="' + k + '" value="' + o[k] + '"></div>').join('') +
    '<div class="f"><label></label><button id="del">Удалить (Del)</button></div>';
  b.querySelectorAll('input').forEach(i => i.oninput = () => { o[i.dataset.p] = i.type === 'number' ? +i.value || 0 : i.value; if (i.dataset.p === 'pal') getSpr(o.spr, o.pal); if (i.dataset.p === 'name') renderHier(); });
  $('del').onclick = del;
}
function del() { if (!S.sel) return; S.objs = S.objs.filter(o => o !== S.sel); select(null); }
function renderTree() {
  $('tree').innerHTML = '<div class="root">Assets</div>' + ['Prefabs', 'Maps'].map(t => '<div class="row' + (S.tab === t ? ' sel' : '') + '" style="padding-left:18px" data-t="' + t + '">📁 ' + t + '</div>').join('');
  $('tree').querySelectorAll('[data-t]').forEach(r => r.onclick = () => { S.tab = r.dataset.t; renderTree(); renderGrid(); });
}
async function renderGrid() {
  const g = $('grid'); g.innerHTML = '';
  if (S.tab === 'Maps') {
    for (const t of MAPS) {
      const d = document.createElement('div'); d.className = 'it map'; d.innerHTML = '<canvas width="76" height="50"></canvas><span>' + t + '</span>';
      d.style.background = t === S.tag ? 'var(--hi)' : ''; d.onclick = () => setMap(t, true);
      const im = new Image(); im.onload = () => { const c = d.firstChild.getContext('2d'); c.drawImage(im, 0, 0, 76, 50); }; im.src = 'assets/maps/' + t + '_preview.png';
      g.appendChild(d);
    }
    return;
  }
  for (const p of PREFABS) {
    const d = document.createElement('div'); d.className = 'it'; d.draggable = true; d.title = 'Перетащи в сцену (или двойной клик)';
    d.innerHTML = '<canvas width="64" height="64"></canvas><span>' + p.name + '</span>';
    d.ondragstart = e => e.dataTransfer.setData('text/plain', PREFABS.indexOf(p));
    d.ondblclick = () => add(p, S.cam.x + cv.width / 2 / S.zoom, S.cam.y + cv.height / 2 / S.zoom);
    g.appendChild(d);
    loadSprite(p.spr, p.pal).then(s => { // thumbnail from the real frame
      const o = { ...p, x: 0, y: 0, flip: 0 }, r = frameOf(o), c = d.firstChild.getContext('2d'); if (!r) return;
      const t = document.createElement('canvas'); t.width = t.height = 128; const tc = t.getContext('2d'); tc.translate(64, 64); drawObj(tc, o);
      const b = bbox(o), k = Math.min(1, 56 / Math.max(b.x1 - b.x0, b.y1 - b.y0)); c.imageSmoothingEnabled = false;
      c.save(); c.translate(32, 32); c.scale(k, k); c.drawImage(t, -64, -64); c.restore();
    }).catch(() => {});
  }
}
// ---------- scene view ----------
const world = (px, py) => ({ x: S.cam.x + px / S.zoom, y: S.cam.y + py / S.zoom });
function fit() { const r = cv.parentElement.getBoundingClientRect(); if (cv.width !== (r.width | 0) || cv.height !== (r.height | 0)) { cv.width = r.width | 0; cv.height = r.height | 0; } }
function frame() {
  requestAnimationFrame(frame); fit(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#111'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!S.map) return;
  ctx.save(); ctx.scale(S.zoom, S.zoom); ctx.translate(-S.cam.x, -S.cam.y); ctx.drawImage(S.map.image, 0, 0);
  if ($('col').checked) { // collision overlay: 1 sidewalk blue, 2 solid red, 3 door yellow
    const T = S.map.data.tileSize, x0 = Math.max(0, Math.floor(S.cam.x / T)), y0 = Math.max(0, Math.floor(S.cam.y / T)), x1 = Math.ceil((S.cam.x + cv.width / S.zoom) / T), y1 = Math.ceil((S.cam.y + cv.height / S.zoom) / T);
    const col = ['', 'rgba(60,140,255,.25)', 'rgba(255,40,40,.35)', 'rgba(255,220,0,.4)'];
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) { const c = S.map.tileAt(tx * T + 1, ty * T + 1).collision; if (col[c]) { ctx.fillStyle = col[c]; ctx.fillRect(tx * T, ty * T, T, T); } }
  }
  for (const o of [...S.objs].sort((a, b) => a.y - b.y)) drawObj(ctx, o);
  const o = S.sel; if (o) { const b = bbox(o); ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 1 / S.zoom; ctx.strokeRect(b.x0 - .5, b.y0 - .5, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
    ctx.strokeStyle = '#f33'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + 14, o.y); ctx.stroke(); ctx.strokeStyle = '#3f3'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y - 14); ctx.stroke(); }
  ctx.restore();
  $('zl').textContent = Math.round(S.zoom * 100) + '%';
}
let drag = null;
const pick = w => [...S.objs].sort((a, b) => b.y - a.y).find(o => { const b = bbox(o); return w.x >= b.x0 && w.x <= b.x1 && w.y >= b.y0 && w.y <= b.y1; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); const w = world(e.offsetX, e.offsetY);
  if (e.button === 1 || e.button === 2 || e.altKey) { drag = { pan: 1, sx: e.clientX, sy: e.clientY, cx: S.cam.x, cy: S.cam.y }; return; }
  const o = pick(w); select(o || null); if (o) drag = { o, dx: o.x - w.x, dy: o.y - w.y };
});
cv.addEventListener('pointermove', e => {
  const w = world(e.offsetX, e.offsetY); $('hud').textContent = 'x ' + (w.x | 0) + '  y ' + (w.y | 0) + (S.map ? '  tile ' + JSON.stringify(S.map.tileAt(w.x, w.y).collision) : '');
  if (!drag) return;
  if (drag.pan) { S.cam.x = drag.cx - (e.clientX - drag.sx) / S.zoom; S.cam.y = drag.cy - (e.clientY - drag.sy) / S.zoom; }
  else { drag.o.x = Math.round(w.x + drag.dx); drag.o.y = Math.round(w.y + drag.dy); renderInsp(); }
});
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); const w = world(e.offsetX, e.offsetY); S.zoom = Math.max(.25, Math.min(8, S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); S.cam.x = w.x - e.offsetX / S.zoom; S.cam.y = w.y - e.offsetY / S.zoom; }, { passive: false });
cv.addEventListener('dragover', e => e.preventDefault());
cv.addEventListener('drop', e => { e.preventDefault(); const p = PREFABS[+e.dataTransfer.getData('text/plain')]; if (p) { const w = world(e.offsetX, e.offsetY); add(p, w.x, w.y); } });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Delete' || e.key === 'Backspace') del();
  if ((e.ctrlKey || e.metaKey) && e.key === 'd' && S.sel) { e.preventDefault(); const o = add({ ...S.sel, name: S.sel.name.replace(/ \(\d+\)$/, '') }, S.sel.x + 12, S.sel.y + 12); o.anim = S.sel.anim; o.pal = S.sel.pal; o.flip = S.sel.flip; renderInsp(); }
  if (S.sel && e.key.startsWith('Arrow')) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; S.sel.x += e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0; S.sel.y += e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0; renderInsp(); }
});
// ---------- toolbar ----------
$('play').onclick = () => open('index.html', '_blank');
$('save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ map: S.tag, objects: S.objs }, null, 1)], { type: 'application/json' })); a.download = S.tag + '.scene.json'; a.click(); };
$('open').onclick = () => $('file').click();
$('file').onchange = async e => { const f = e.target.files[0]; if (!f) return; const d = JSON.parse(await f.text()); await setMap(d.map, true); S.objs = d.objects; S.n = Math.max(0, ...S.objs.map(o => o.id || 0)); S.objs.forEach(o => getSpr(o.spr, o.pal)); select(null); e.target.value = ''; };
// ---------- boot ----------
renderTree(); renderInsp(); fit();
setMap(S.tag, false).then(() => { renderGrid(); renderHier(); frame(); });

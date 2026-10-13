/* dragfx.js — (1) пока что-то тянут из Project, Inspector растягивается на всю высоту поверх Project (body #app.pdrag), чтобы были видны все поля.
   (2) пока что-то тянут в Inspector, поля, куда это можно вставить, увеличиваются и светятся.
   body[data-drag] = obj (объект из Hierarchy / Shift-перетаскивание со сцены / режим ⌖)
                   | sprite (спрайт из Project) | font (шрифт из Project).
   Поле под курсором (класс .o, его ставят обработчики dragover) подсвечивается сильнее. */
(()=>{
const B=document.body;
const mark=k=>{if(k)B.dataset.drag=k;else delete B.dataset.drag};
window.dragMark=mark;

const SL={
  obj:'#ins [data-ot],#ins [data-mo]',
  sprite:'#ins [data-slot],#ins [data-bs],#ins [data-as]',
  font:'#ins [data-fs]'};
let css='@keyframes dfxPulse{0%,100%{box-shadow:0 0 0 1px var(--iac,#5aa0e0),0 0 8px 1px #5aa0e088}50%{box-shadow:0 0 0 1px var(--iac,#5aa0e0),0 0 16px 4px #5aa0e0cc}}';
for(const k in SL){
  const s=SL[k].split(',').map(x=>`body[data-drag="${k}"] ${x}`);
  css+=`${s.join(',')}{position:relative;z-index:3;transform:scale(1.07);transform-origin:center;border:1px solid var(--iac,#5aa0e0)!important;background:#5aa0e033!important;color:#fff;animation:dfxPulse 1s ease-in-out infinite;transition:transform .12s,background .12s}`;
  css+=`${s.map(x=>x+'.o').join(',')}{transform:scale(1.14);background:#5aa0e066!important;box-shadow:0 0 0 2px #fff,0 0 20px 6px #5aa0e0!important;animation:none}`}
css+='#app.pdrag #p3{grid-row:1/4;z-index:6;filter:drop-shadow(-8px 0 14px #000b)}';
const st=document.createElement('style');st.id='dragfx';st.textContent=css;document.head.appendChild(st);

// что именно тянут: данные читаем в dragstart (в dragover getData недоступен)
let nat=false;
document.addEventListener('dragstart',e=>{
  nat=true;
  const t=(e.dataTransfer&&e.dataTransfer.getData('text/plain'))||'';
  if(t.startsWith('obj:'))mark('obj');
  else if(t.startsWith('asset:')){let f=false;try{f=!!isFont(+t.slice(6))}catch(_){}mark(f?'font':'sprite')}
  else mark(null)});
// Inspector поверх Project: включаем чуть позже dragstart (изменение раскладки прямо в нём может сорвать перетаскивание)
const A=document.getElementById('app');let pd=0;
const pOff=()=>{clearTimeout(pd);A&&A.classList.remove('pdrag')};
document.addEventListener('dragstart',e=>{const t=e.target;if(!A||!t||!t.closest||!t.closest('#proj'))return;
  clearTimeout(pd);pd=setTimeout(()=>A.classList.add('pdrag'),0)},true);
// завершение: dragend может не прийти, если источник удалён из DOM при перерисовке, поэтому ещё и drop / Esc / mouseup
addEventListener('dragend',()=>{nat=false;mark(null);pOff()},true);
addEventListener('drop',()=>{nat=false;mark(null);setTimeout(pOff,0)},true);
// во время нативного drag мышиные события не приходят; если пришло mousemove без кнопки — перетаскивание уже закончилось (dragend потерялся)
addEventListener('mousemove',e=>{if(nat&&!e.buttons){nat=false;mark(null);pOff()}},true);
addEventListener('keydown',e=>{if(e.key=='Escape'&&B.dataset.drag){mark(null);pOff()}},true);
})();

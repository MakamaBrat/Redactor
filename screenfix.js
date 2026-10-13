/* screenfix.js — у Screen Scale и Size одно и то же.
   o.sx / o.sy экрана = screen.w/PPU, screen.h/PPU (1 = 100 px). Запись в Scale (Inspector, gizmo, анимация, drag) меняет размер экрана.
   Матрица экрана не масштабируется (см. locM), поэтому дети экрана не раздуваются, а рамка и gizmo всегда совпадают. */
(()=>{
const MIN=.01;
function fix(o){
  const sc=o.screen;if(!sc)return;
  const d=Object.getOwnPropertyDescriptor(o,'sx');if(d&&d.get)return;
  // старые данные: масштаб, выставленный вручную, «вшиваем» в размер
  const fx=d&&isFinite(+d.value)&&+d.value?Math.abs(+d.value):1,dy=Object.getOwnPropertyDescriptor(o,'sy'),fy=dy&&isFinite(+dy.value)&&+dy.value?Math.abs(+dy.value):1;
  sc.w=rd((sc.w||480)*fx);sc.h=rd((sc.h||270)*fy);
  const def=(k,wh)=>Object.defineProperty(o,k,{configurable:true,enumerable:true,get:()=>o.screen?o.screen[wh]/PPU:1,set:v=>{if(o.screen&&isFinite(v))o.screen[wh]=rd(Math.max(MIN,Math.abs(v))*PPU)}});
  def('sx','w');def('sy','h');
  // в сохранение/копирование уходит sx=sy=1, размер лежит в screen.w/h — формат файла прежний
  Object.defineProperty(o,'toJSON',{configurable:true,enumerable:false,value:()=>{const c={};for(const k of Object.keys(o))c[k]=o[k];c.sx=c.sy=1;return c}});
}
const all=()=>{for(const o of objs)if(o.screen)fix(o)};
for(const n of['refresh','inspect','hier','render']){const f=window[n];if(typeof f=='function')window[n]=function(){all();return f.apply(this,arguments)}}
all();window.draw&&draw();
})();

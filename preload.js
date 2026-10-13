const {contextBridge,ipcRenderer:ipc}=require('electron');
const inv=(c,a)=>ipc.invoke(c,a);
contextBridge.exposeInMainWorld('native',{
  defaults:()=>inv('app:defaults'),
  recent:{get:()=>inv('recent:get'),add:(dir,name)=>inv('recent:add',{dir,name}),remove:dir=>inv('recent:remove',dir)},
  pickDir:o=>inv('dlg:dir',o),
  createProject:o=>inv('proj:create',o),
  readProject:dir=>inv('proj:read',dir),
  saveProject:o=>inv('proj:save',o),
  reveal:dir=>inv('proj:reveal',dir),
  writeBuild:o=>inv('build:write',o),
  mp4:{probe:()=>inv('mp4:probe'),start:o=>inv('mp4:start',o),frame:o=>inv('mp4:frame',o),end:o=>inv('mp4:end',o),read:o=>inv('mp4:read',o),save:o=>inv('mp4:save',o),reveal:p=>inv('mp4:reveal',p),discard:o=>inv('mp4:discard',o)},
  setDirty:b=>ipc.send('win:dirty',!!b),
  closeNow:()=>ipc.send('win:close'),
  onAskClose:cb=>ipc.on('ask-close',()=>cb())
});

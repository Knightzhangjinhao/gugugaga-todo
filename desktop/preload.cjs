
'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('guguDesktop',{
  read:()=>ipcRenderer.invoke('note:read'),
  write:(text,revision)=>ipcRenderer.invoke('note:write',{text,revision}),
  open:()=>ipcRenderer.invoke('note:open'),
  pin:()=>ipcRenderer.invoke('note:pin'),
  collapse:()=>ipcRenderer.invoke('note:collapse'),
  expand:()=>ipcRenderer.invoke('note:expand'),
  hide:()=>ipcRenderer.invoke('note:hide'),
  main:()=>ipcRenderer.invoke('note:main'),
  onState:callback=>{
    const listener=(_event,state)=>callback(state);
    ipcRenderer.on('note:state',listener);
    return ()=>ipcRenderer.removeListener('note:state',listener);
  }
});

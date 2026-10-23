
'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const subscribe=(channel,callback)=>{const listener=(_event,state)=>callback(state);ipcRenderer.on(channel,listener);return ()=>ipcRenderer.removeListener(channel,listener);};
contextBridge.exposeInMainWorld('guguDesktop',{
  read:()=>ipcRenderer.invoke('note:read'),
  write:(text,revision,html)=>ipcRenderer.invoke('note:write',{text,revision,html}),
  open:()=>ipcRenderer.invoke('note:open'),pin:()=>ipcRenderer.invoke('note:pin'),
  collapse:()=>ipcRenderer.invoke('note:collapse'),expand:()=>ipcRenderer.invoke('note:expand'),
  hide:()=>ipcRenderer.invoke('note:hide'),main:()=>ipcRenderer.invoke('note:main'),
  dock:side=>ipcRenderer.invoke('note:dock',side),autoHide:on=>ipcRenderer.invoke('note:autoHide',on),
  dragStart:mode=>ipcRenderer.invoke('note:dragStart',mode),dragEnd:()=>ipcRenderer.invoke('note:dragEnd'),
  activity:()=>ipcRenderer.invoke('note:activity'),interact:on=>ipcRenderer.invoke('note:interact',on),
  onState:callback=>subscribe('note:state',callback),onFocus:callback=>subscribe('note:focus',callback)
});


'use strict';
const assert=require('node:assert/strict');
module.exports=async({mainWindow,stickyWindow,store})=>{
  async function loaded(win){
    if(win.webContents.isLoading())await new Promise((resolve,reject)=>{
      win.webContents.once('did-finish-load',resolve);
      win.webContents.once('did-fail-load',(_e,code,reason)=>reject(Error(code+': '+reason)));
    });
  }
  await Promise.all([loaded(mainWindow),loaded(stickyWindow)]);
  async function ready(win,id){
    await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
      let tries=0;const timer=setInterval(()=>{
        const el=document.getElementById('${id}');
        if(el&&!el.disabled){clearInterval(timer);resolve(true);}
        else if(++tries>200){clearInterval(timer);reject(Error('Editor not ready'));}
      },25);
    })`);
  }
  await Promise.all([ready(mainWindow,'memoTextarea'),ready(stickyWindow,'text')]);
  async function waitText(win,id,text){
    await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
      let tries=0;const timer=setInterval(()=>{
        if(document.getElementById('${id}').value===${JSON.stringify(text)}){clearInterval(timer);resolve(true);}
        else if(++tries>200){clearInterval(timer);reject(Error('Memo sync timed out'));}
      },25);
    })`);
  }
  const edit=(win,id,text)=>win.webContents.executeJavaScript(`{
    const field=document.getElementById('${id}');
    field.value=${JSON.stringify(text)};field.dispatchEvent(new Event('input',{bubbles:true}));
  }`);
  await edit(stickyWindow,'text','便利贴 → 主界面');
  await waitText(mainWindow,'memoTextarea','便利贴 → 主界面');
  await edit(mainWindow,'memoTextarea','主界面 → 便利贴');
  await waitText(stickyWindow,'text','主界面 → 便利贴');
  assert.equal(store.state.text,'主界面 → 便利贴');
  const old=stickyWindow.isAlwaysOnTop();
  await stickyWindow.webContents.executeJavaScript('window.guguDesktop.pin()');
  assert.equal(stickyWindow.isAlwaysOnTop(),!old);
  await stickyWindow.webContents.executeJavaScript('window.guguDesktop.collapse()');
  assert.equal(stickyWindow.getBounds().width,40);
  await stickyWindow.webContents.executeJavaScript('window.guguDesktop.expand()');
  assert.ok(stickyWindow.getBounds().width>=280);
  await edit(stickyWindow,'text','');
  await waitText(mainWindow,'memoTextarea','');
  assert.equal(store.state.text,'');
  console.log('PASS: real Electron windows, bidirectional sync, clear, pin, collapse and expand');
};

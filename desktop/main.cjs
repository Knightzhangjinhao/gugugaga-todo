
'use strict';
const {app,BrowserWindow,ipcMain,screen,Menu,dialog}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Store}=require('./store.cjs');
const geometry=require('./geometry.cjs');
const ROOT=path.join(__dirname,'..');
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'gugu-smoke-')));
let mainWindow,stickyWindow,store,expandedBounds,collapsed=false,side='right',moving=false,moveTimer,userMoving=false;
const urls=new Set([pathToFileURL(path.join(ROOT,'index.html')).href,pathToFileURL(path.join(__dirname,'sticky.html')).href]);
function valid(event){
  if(![mainWindow,stickyWindow].some(w=>w&&!w.isDestroyed()&&w.webContents===event.sender)||event.senderFrame!==event.sender.mainFrame||!urls.has(event.senderFrame.url))throw Error('Untrusted sender');
}
function snapshot(){return {...store.state,collapsed};}
function broadcast(except){
  for(const win of [mainWindow,stickyWindow])if(win&&!win.isDestroyed()&&win.webContents!==except)win.webContents.send('note:state',snapshot());
}
function windowOptions(extra){
  return {...extra,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}};
}
function secure(win){
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  if(smoke)win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
}
function main(){
  if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.show();mainWindow.focus();return;}
  mainWindow=new BrowserWindow(windowOptions({width:1200,height:850,minWidth:760,minHeight:560,title:'咕咕嘎嘎'}));
  secure(mainWindow);
  mainWindow.loadFile(path.join(ROOT,'index.html'));
  mainWindow.once('ready-to-show',()=>{if(!smoke)mainWindow.show();});
  mainWindow.on('closed',()=>{mainWindow=null;});
}
function areaFor(bounds){return screen.getDisplayMatching(bounds).workArea;}
function saveBounds(){
  if(!stickyWindow||stickyWindow.isDestroyed()||collapsed||moving)return;
  expandedBounds=geometry.fit(stickyWindow.getBounds(),areaFor(stickyWindow.getBounds()));
  try{store.commit({bounds:expandedBounds});}catch(error){dialog.showErrorBox('无法保存窗口位置',error.message);}
}
function collapse(){
  if(!stickyWindow||stickyWindow.isDestroyed()||collapsed)return snapshot();
  expandedBounds=stickyWindow.getBounds();
  const area=areaFor(expandedBounds);
  side=geometry.edge(expandedBounds,area)||(expandedBounds.x+expandedBounds.width/2<area.x+area.width/2?'left':'right');
  store.commit({bounds:expandedBounds});
  collapsed=true;moving=true;
  stickyWindow.setMinimumSize(40,108);stickyWindow.setResizable(false);
  stickyWindow.setBounds(geometry.tab(expandedBounds,area,side));
  moving=false;broadcast();return snapshot();
}
function expand(){
  if(!stickyWindow||stickyWindow.isDestroyed()||!collapsed)return snapshot();
  const area=areaFor(stickyWindow.getBounds());
  collapsed=false;moving=true;
  stickyWindow.setResizable(true);
  stickyWindow.setBounds(geometry.fit(expandedBounds,area));
  stickyWindow.setMinimumSize(280,240);
  moving=false;broadcast();return snapshot();
}
function sticky(){
  if(stickyWindow&&!stickyWindow.isDestroyed()){stickyWindow.show();return;}
  const area=store.state.bounds?areaFor(store.state.bounds):screen.getPrimaryDisplay().workArea;
  expandedBounds=geometry.fit(store.state.bounds||{},area);collapsed=false;
  stickyWindow=new BrowserWindow(windowOptions({...expandedBounds,minWidth:280,minHeight:240,frame:false,alwaysOnTop:!!store.state.pinned,title:'咕咕嘎嘎 · 便利贴',backgroundColor:'#fff5d6'}));
  secure(stickyWindow);
  stickyWindow.loadFile(path.join(__dirname,'sticky.html'));
  stickyWindow.once('ready-to-show',()=>{if(!smoke)stickyWindow.showInactive();});
  stickyWindow.on('will-move',()=>{userMoving=true;});
  stickyWindow.on('moved',()=>{
    if(moving||collapsed||!userMoving)return;
    clearTimeout(moveTimer);
    moveTimer=setTimeout(()=>{
      if(!stickyWindow||stickyWindow.isDestroyed()||moving||collapsed)return;
      userMoving=false;
      saveBounds();
      if(geometry.edge(stickyWindow.getBounds(),areaFor(stickyWindow.getBounds())))collapse();
    },250);
  });
  stickyWindow.on('resized',saveBounds);
  stickyWindow.on('closed',()=>{clearTimeout(moveTimer);stickyWindow=null;});
}
function handle(channel,fn){ipcMain.handle(channel,(event,arg)=>{valid(event);return fn(event,arg);});}
if(!app.requestSingleInstanceLock()){app.quit();}
else{
app.on('second-instance',()=>{main();sticky();});
app.whenReady().then(async()=>{
  try{store=new Store(path.join(app.getPath('userData'),'sticky-note.json'));}
  catch(error){dialog.showErrorBox('便利贴数据无法读取','已保留原文件，请先备份后修复：'+error.message);app.quit();return;}
  handle('note:read',()=>snapshot());
  handle('note:write',(event,arg)=>{
    const result=store.write(arg?.text,arg?.revision);
    if(result.ok)broadcast(event.sender);
    return result;
  });
  handle('note:open',()=>{sticky();return snapshot();});
  handle('note:main',()=>{main();return snapshot();});
  handle('note:pin',()=>{
    const pinned=!store.state.pinned;store.commit({pinned});
    if(stickyWindow&&!stickyWindow.isDestroyed())stickyWindow.setAlwaysOnTop(pinned);
    broadcast();return snapshot();
  });
  handle('note:collapse',collapse);
  handle('note:expand',expand);
  handle('note:hide',()=>{if(!mainWindow||mainWindow.isDestroyed())main();stickyWindow?.hide();return snapshot();});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'咕咕嘎嘎',submenu:[
    {label:'打开主界面',click:main},
    {label:'显示便利贴',accelerator:'CmdOrCtrl+Shift+N',click:sticky},
    {type:'separator'},{role:'quit',label:'退出咕咕嘎嘎'}
  ]},{role:'editMenu',label:'编辑'}]));
  main();sticky();
  screen.on('display-removed',()=>{if(stickyWindow&&!stickyWindow.isDestroyed()){if(collapsed)expand();moving=true;stickyWindow.setBounds(geometry.fit(stickyWindow.getBounds(),areaFor(stickyWindow.getBounds())));moving=false;saveBounds();}});
  if(smoke){
    try{await require('./smoke.cjs')({mainWindow,stickyWindow,store});app.exit(0);}
    catch(error){console.error(error);app.exit(1);}
  }
}).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
app.on('activate',main);
}

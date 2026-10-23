
'use strict';
const {app,BrowserWindow,ipcMain,screen,Menu,dialog,globalShortcut,Tray,nativeImage}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Store}=require('./store.cjs');
const geometry=require('./geometry.cjs');
const ROOT=path.join(__dirname,'..'),smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'gugu-smoke-')));
let mainWindow,stickyWindow,store,tray,quitting=false,expandedBounds,collapsed=false;
let moving=false,drag=null,dragTimer,hoverTimer,moveTimer,previewSide=null,awaySince=0,activeUntil=0,interacting=false,keyboardReveal=false,shortcut='';
const urls=new Set([pathToFileURL(path.join(ROOT,'index.html')).href,pathToFileURL(path.join(__dirname,'sticky.html')).href]);
const alive=win=>win&&!win.isDestroyed();
function valid(event){
  if(![mainWindow,stickyWindow].some(w=>alive(w)&&w.webContents===event.sender)||event.senderFrame!==event.sender.mainFrame||!urls.has(event.senderFrame.url))throw Error('Untrusted sender');
}
function snapshot(){return {...store.state,collapsed,previewSide,shortcut,dragging:!!drag};}
function broadcast(except){
  for(const win of [mainWindow,stickyWindow])if(alive(win)&&win.webContents!==except)win.webContents.send('note:state',snapshot());
}
function options(extra){return {...extra,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}};}
function secure(win){
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  if(smoke)win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
}
function main(){
  if(alive(mainWindow)){mainWindow.show();mainWindow.focus();return;}
  mainWindow=new BrowserWindow(options({width:1200,height:850,minWidth:760,minHeight:560,title:'咕咕嘎嘎'}));secure(mainWindow);
  mainWindow.loadFile(path.join(ROOT,'index.html'));mainWindow.once('ready-to-show',()=>{if(!smoke)mainWindow.show();});
  mainWindow.on('close',event=>{if(!quitting&&!smoke){event.preventDefault();mainWindow.hide();}});
  mainWindow.on('closed',()=>{mainWindow=null;});
}
const areaFor=bounds=>screen.getDisplayMatching(bounds).workArea;
function setBounds(bounds){moving=true;stickyWindow.setBounds(bounds);moving=false;}
function persist(patch){store.commit(patch);broadcast();}
function saveBounds(){if(alive(stickyWindow)&&!collapsed&&!moving&&!drag){expandedBounds=geometry.fit(stickyWindow.getBounds(),areaFor(stickyWindow.getBounds()));persist({bounds:expandedBounds});}}
function collapse(){
  if(!alive(stickyWindow)||collapsed)return snapshot();
  const bounds=stickyWindow.getBounds(),area=areaFor(bounds);
  const side=store.state.dockSide||geometry.edge(bounds,area)||(bounds.x+bounds.width/2<area.x+area.width/2?'left':'right');
  expandedBounds=geometry.snap(bounds,area,side);store.commit({bounds:expandedBounds,dockSide:side});
  collapsed=true;previewSide=null;
  stickyWindow.setMinimumSize(40,108);stickyWindow.setResizable(false);setBounds(geometry.tab(expandedBounds,area,side));
  awaySince=0;broadcast();return snapshot();
}
function expand(focus=false){
  if(!alive(stickyWindow))return snapshot();
  if(collapsed){
    const area=areaFor(stickyWindow.getBounds());collapsed=false;stickyWindow.setResizable(true);
    setBounds(geometry.snap(expandedBounds,area,store.state.dockSide));stickyWindow.setMinimumSize(280,240);
    activeUntil=Date.now()+800;awaySince=0;broadcast();
  }
  if(focus){keyboardReveal=true;stickyWindow.show();stickyWindow.focus();stickyWindow.webContents.send('note:focus');}
  return snapshot();
}
function dock(side){
  if(!alive(stickyWindow))sticky();
  if(collapsed)expand();
  const bounds=stickyWindow.getBounds(),area=areaFor(bounds);
  expandedBounds=geometry.snap(bounds,area,side);setBounds(expandedBounds);
  persist({bounds:expandedBounds,dockSide:side});activeUntil=Date.now()+1200;awaySince=0;return snapshot();
}
function startDrag(mode){
  if(!alive(stickyWindow)||collapsed)return snapshot();
  if(!['move','resize'].includes(mode))throw Error('Invalid drag');
  clearInterval(dragTimer);drag={mode,start:screen.getCursorScreenPoint(),bounds:stickyWindow.getBounds()};
  awaySince=0;
  dragTimer=setInterval(()=>updateDrag(screen.getCursorScreenPoint()),16);broadcast();return snapshot();
}
function updateDrag(point){
  if(!drag||!alive(stickyWindow))return;
  const x=point.x-drag.start.x,y=point.y-drag.start.y,b=drag.bounds;
  const next=drag.mode==='move'?{...b,x:b.x+x,y:b.y+y}:{...b,width:Math.max(300,b.width+x),height:Math.max(280,b.height+y)};
  setBounds(next);
  const side=drag.mode==='move'?geometry.edge(next,areaFor(next)):null;
  if(side!==previewSide){previewSide=side;broadcast();}
}
function endDrag(){
  if(!drag)return snapshot();
  updateDrag(screen.getCursorScreenPoint());const mode=drag.mode;drag=null;clearInterval(dragTimer);
  const bounds=stickyWindow.getBounds(),side=mode==='move'?geometry.edge(bounds,areaFor(bounds)):store.state.dockSide;
  previewSide=null;expandedBounds=geometry.snap(bounds,areaFor(bounds),side);setBounds(expandedBounds);
  persist({bounds:expandedBounds,dockSide:side});activeUntil=Date.now()+900;return snapshot();
}
function hoverTick(point=screen.getCursorScreenPoint(),now=Date.now()){
  if(!alive(stickyWindow)||!stickyWindow.isVisible()||drag||moving||!store.state.dockSide||!store.state.autoHide||interacting)return;
  const inside=geometry.contains(stickyWindow.getBounds(),point);
  if(keyboardReveal&&!inside&&stickyWindow.isFocused())return;
  if(inside)keyboardReveal=false;
  if(collapsed){if(inside)expand();return;}
  if(inside||now<activeUntil){awaySince=0;return;}
  if(!awaySince)awaySince=now;
  if(now-awaySince>=800)collapse();
}
function sticky(focus=false){
  if(alive(stickyWindow)){if(focus)expand(true);else stickyWindow.showInactive();return;}
  const area=store.state.bounds?areaFor(store.state.bounds):screen.getPrimaryDisplay().workArea;
  expandedBounds=geometry.snap(store.state.bounds||{},area,store.state.dockSide);collapsed=false;
  stickyWindow=new BrowserWindow(options({...expandedBounds,minWidth:300,minHeight:280,frame:false,alwaysOnTop:!!store.state.pinned,title:'咕咕嘎嘎 · 便利贴',backgroundColor:'#fff5d6'}));
  secure(stickyWindow);stickyWindow.loadFile(path.join(__dirname,'sticky.html'));
  stickyWindow.once('ready-to-show',()=>{if(!smoke){if(focus){stickyWindow.show();stickyWindow.focus();}else stickyWindow.showInactive();}});
  stickyWindow.on('close',event=>{if(!quitting&&!smoke){event.preventDefault();stickyWindow.hide();}});
  // Retain native move support for keyboard/system moves; custom header dragging uses cursor DIP coordinates.
  stickyWindow.on('will-move',()=>{if(drag||moving)return;clearTimeout(moveTimer);moveTimer=setTimeout(()=>{if(alive(stickyWindow)&&!drag&&!collapsed){const side=geometry.edge(stickyWindow.getBounds(),areaFor(stickyWindow.getBounds()));dock(side);}},180);});
  stickyWindow.on('resized',()=>{if(!drag)saveBounds();});
  stickyWindow.on('closed',()=>{clearInterval(dragTimer);clearTimeout(moveTimer);stickyWindow=null;drag=null;});
  activeUntil=Date.now()+1500;
}
function handle(channel,fn,stickyOnly=false){ipcMain.handle(channel,(event,arg)=>{valid(event);if(stickyOnly&&event.sender!==stickyWindow?.webContents)throw Error('Sticky window required');return fn(event,arg);});}
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>sticky(true));
  app.on('before-quit',()=>{quitting=true;});
  app.on('will-quit',()=>{clearInterval(hoverTimer);clearInterval(dragTimer);globalShortcut.unregisterAll();});
  app.whenReady().then(async()=>{
    try{store=new Store(path.join(app.getPath('userData'),'sticky-note.json'));}
    catch(error){dialog.showErrorBox('便利贴数据无法读取','已保留原文件，请先备份后修复：'+error.message);app.quit();return;}
    handle('note:read',()=>snapshot());
    handle('note:write',(event,arg)=>{const result=store.write(arg?.text,arg?.revision,arg?.html);if(result.ok)broadcast(event.sender);return result;});
    handle('note:open',()=>{sticky(true);return snapshot();});
    handle('note:main',()=>{main();return snapshot();});
    handle('note:pin',()=>{const pinned=!store.state.pinned;store.commit({pinned});if(alive(stickyWindow))stickyWindow.setAlwaysOnTop(pinned);broadcast();return snapshot();});
    handle('note:collapse',collapse,true);handle('note:expand',()=>expand(true),true);
    handle('note:hide',()=>{stickyWindow?.hide();return snapshot();},true);
    handle('note:dock',(_event,side)=>{if(side!==null&&!['left','right'].includes(side))throw Error('Invalid dock side');return dock(side);},true);
    handle('note:autoHide',(_event,on)=>{if(typeof on!=='boolean')throw Error('Invalid setting');persist({autoHide:on});if(!on&&collapsed)expand();return snapshot();},true);
    handle('note:dragStart',(_event,mode)=>startDrag(mode),true);handle('note:dragEnd',endDrag,true);
    handle('note:activity',()=>{activeUntil=Date.now()+1800;return true;});
    handle('note:interact',(_event,on)=>{interacting=on===true;activeUntil=Date.now()+800;return true;},true);
    const menu=Menu.buildFromTemplate([{label:'咕咕嘎嘎',submenu:[{label:'打开主界面',click:main},{label:'显示便利贴',click:()=>sticky(true)},{type:'separator'},{role:'quit',label:'退出咕咕嘎嘎'}]},{role:'editMenu',label:'编辑'}]);
    Menu.setApplicationMenu(menu);
    tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'tray.png')));
    tray.setToolTip('咕咕嘎嘎 · 桌面便利贴');
    tray.setContextMenu(Menu.buildFromTemplate([{label:'显示便利贴',click:()=>sticky(true)},{label:'打开主界面',click:main},{type:'separator'},{label:'退出咕咕嘎嘎',click:()=>app.quit()}]));
    tray.on('double-click',()=>sticky(true));
    for(const accelerator of ['CommandOrControl+Alt+N','CommandOrControl+Alt+Shift+N']){
      if(globalShortcut.register(accelerator,()=>sticky(true))){shortcut=accelerator.replace('CommandOrControl','Ctrl');break;}
    }
    if(!shortcut)shortcut='快捷键被占用，请使用托盘打开';
    main();sticky();
    if(!smoke)hoverTimer=setInterval(()=>hoverTick(),120);
    const recover=()=>{if(alive(stickyWindow)){if(collapsed)expand();dock(store.state.dockSide);}};
    screen.on('display-removed',recover);screen.on('display-metrics-changed',recover);
    if(smoke){
      try{await require('./smoke.cjs')({mainWindow,stickyWindow,store,dock,startDrag,updateDrag,endDrag,hoverTick,globalShortcut,shortcut});app.exit(0);}
      catch(error){console.error(error);app.exit(1);}
    }
  }).catch(error=>{console.error(error);app.exit(1);});
  app.on('window-all-closed',()=>{if(quitting)app.quit();});
  app.on('activate',main);
}

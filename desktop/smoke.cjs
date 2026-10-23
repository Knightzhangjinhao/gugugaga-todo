
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({mainWindow,stickyWindow,store,dock,hoverTick,globalShortcut,shortcut})=>{
  const js=(win,code)=>win.webContents.executeJavaScript(code);
  async function wait(win,predicate){
    await js(win,`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(${predicate}){clearInterval(timer);resolve(true);}else if(++tries>400){clearInterval(timer);reject(Error('Timed out: '+${JSON.stringify(predicate)}));}},25);})`);
  }
  const loaded=win=>win.webContents.isLoading()?new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,code,message)=>reject(Error(code+message)));}):Promise.resolve();
  await Promise.all([loaded(mainWindow),loaded(stickyWindow)]);
  await Promise.all([wait(mainWindow,"document.getElementById('memoRich')?.contentEditable==='true'"),wait(stickyWindow,"document.getElementById('text')?.contentEditable==='true'")]);
  const edit=(win,id,html)=>js(win,`{const field=document.getElementById('${id}');field.innerHTML=${JSON.stringify(html)};field.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await edit(stickyWindow,'text','<b>加粗</b><i>斜体</i><s>删除线</s><span style="font-family: KaiTi; font-size:24px">字体</span><ul><li>列表</li></ul>');
  await wait(mainWindow,"document.querySelector('#memoRich b')?.textContent==='加粗'");
  assert.match(store.state.html,/<b>加粗<\/b>/);
  assert.match(await js(mainWindow,"document.getElementById('memoRich').innerHTML"),/font-size: 24px/);
  await edit(mainWindow,'memoRich','<p>主界面 → 便利贴</p>');
  await wait(stickyWindow,"document.getElementById('text').textContent==='主界面 → 便利贴'");
  assert.match(store.state.text,/主界面 → 便利贴/);
  console.log('PASS: initial bidirectional rich sync');
  // Exercise toolbar selection and actual Chromium formatting commands.
  await js(stickyWindow,`{
    const field=document.getElementById('text');field.focus();
    const range=document.createRange();range.selectNodeContents(field);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    document.querySelector('[data-command=bold]').click();
  }`);
  await wait(mainWindow,"!!document.querySelector('#memoRich b, #memoRich strong')");
  await js(stickyWindow,`{
    const size=document.querySelector('select[aria-label="字号"]');size.value='5';size.dispatchEvent(new Event('change'));
  }`);
  await wait(mainWindow,"document.getElementById('memoRich').innerHTML.includes('24px')");
  console.log('PASS: formatting toolbar');
  // Pasted executable markup and unsupported styles never survive rendering.
  const safe=await js(stickyWindow,`GuguRich.clean('<img src=x onerror=alert(1)><script>alert(1)</script><b onclick="bad()">safe</b><span style="position:fixed;font-size:999px">x</span>')`);
  assert.equal(safe,'<b>safe</b><span>x</span>');
  assert.equal(await js(stickyWindow,"GuguRich.plain('第一行<div>第二行</div>')"),'第一行\n第二行');
  const old=stickyWindow.isAlwaysOnTop();
  await js(stickyWindow,'window.guguDesktop.pin()');assert.equal(stickyWindow.isAlwaysOnTop(),!old);
  await js(stickyWindow,"window.guguDesktop.dock('left')");
  assert.equal(store.state.dockSide,'left');
  assert.equal(stickyWindow.getBounds().x,require('electron').screen.getDisplayMatching(stickyWindow.getBounds()).workArea.x);
  await js(stickyWindow,'window.guguDesktop.collapse()');assert.ok(Math.abs(stickyWindow.getBounds().width-40)<=2);
  await js(stickyWindow,'window.guguDesktop.expand()');assert.ok(stickyWindow.getBounds().width>=300);
  console.log('PASS: dock/collapse/expand');
  // Cursor-driven hover behavior with real window bounds and a deterministic clock.
  stickyWindow.showInactive();dock('right');
  const b=stickyWindow.getBounds(),outside={x:b.x-100,y:b.y-100},future=Date.now()+5000;
  hoverTick({x:b.x+10,y:b.y+10},future);
  hoverTick(outside,future+1000);hoverTick(outside,future+2000);assert.ok(Math.abs(stickyWindow.getBounds().width-40)<=2);
  const tab=stickyWindow.getBounds();hoverTick({x:tab.x+10,y:tab.y+10},future+2100);assert.ok(stickyWindow.getBounds().width>=300);
  console.log('PASS: hover behavior'); stickyWindow.hide();
  assert.ok(shortcut==='Ctrl+Alt+N'||shortcut==='Ctrl+Alt+Shift+N');
  assert.ok(globalShortcut.isRegistered(shortcut.replace('Ctrl','CommandOrControl')));
  await edit(stickyWindow,'text','');await wait(mainWindow,"document.getElementById('memoRich').textContent===''");
  assert.equal(store.state.text,'');
  const {Store}=require('./store.cjs'),restored=new Store(store.file);assert.equal(restored.state.html,'');
  console.log('PASS: clear and persisted state');
  console.log('PASS: starting visual sample');
  // Render the finished editor as a visual QA artifact.
  await edit(stickyWindow,'text','<b>今天，慢慢做好一件事。</b><p><br></p><ul><li>整理本周项目进展</li><li><i>给自己留十分钟休息</i></li></ul><p><br></p><s>把所有事情都挤在今天</s>');
  await wait(mainWindow,"document.getElementById('memoRich').textContent.includes('今天')");
  if(process.env.GUGU_SCREENSHOT_DIR){
    console.log('PASS: visual sample synced');
    stickyWindow.showInactive();mainWindow.showInactive();
    await new Promise(resolve=>setTimeout(resolve,400));
    fs.mkdirSync(process.env.GUGU_SCREENSHOT_DIR,{recursive:true});
    fs.writeFileSync(path.join(process.env.GUGU_SCREENSHOT_DIR,'sticky.png'),(await stickyWindow.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(process.env.GUGU_SCREENSHOT_DIR,'main-memo.png'),(await mainWindow.webContents.capturePage()).toPNG());
  }
  console.log('PASS: rich text, toolbar/font size, sanitization, bidirectional sync, persistence, native pin, docking/hover and global shortcut registration.');
};

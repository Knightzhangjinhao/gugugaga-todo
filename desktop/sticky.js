
'use strict';
const api=window.guguDesktop,status=document.getElementById('status'),editor=document.getElementById('text');
const report=error=>{status.textContent='操作失败，请重试：'+error.message;};
function render(state){
  document.getElementById('pin').setAttribute('aria-pressed',String(state.pinned));
  document.getElementById('pin').title=state.pinned?'取消置顶':'置顶到其他窗口上方';
  const place=state.dockSide==='left'?'左侧吸附':state.dockSide==='right'?'右侧吸附':'自由摆放';
  document.getElementById('hint').textContent=(state.pinned?'已置顶':'普通窗口')+' · '+place+' · 拖动顶部移动';
  document.getElementById('tab').hidden=!state.collapsed;document.getElementById('note').hidden=state.collapsed;
  document.getElementById('dock').value=state.dockSide||'';
  document.getElementById('autoHide').checked=state.autoHide;
  document.getElementById('shortcut').textContent='快捷唤出：'+state.shortcut;
  const preview=document.getElementById('snapPreview');preview.hidden=!state.previewSide;
  preview.textContent='松开后吸附'+(state.previewSide==='left'?'左侧':'右侧');preview.dataset.side=state.previewSide||'';
}
for(const [id,method] of [['pin','pin'],['fold','collapse'],['hide','hide'],['main','main'],['tab','expand']]){
  document.getElementById(id).addEventListener('click',async()=>{try{render(await api[method]());}catch(error){report(error);}});
}
document.getElementById('settings').onclick=()=>{const el=document.getElementById('preferences');el.hidden=!el.hidden;api.activity().catch(report);};
document.getElementById('dock').onchange=async event=>{try{render(await api.dock(event.target.value||null));}catch(error){report(error);}};
document.getElementById('autoHide').onchange=async event=>{try{render(await api.autoHide(event.target.checked));}catch(error){report(error);}};
document.getElementById('toolbar').replaceWith(window.buildGuguToolbar(editor));
for(const [id,mode] of [['dragHandle','move'],['resizeHandle','resize']]){
  const handle=document.getElementById(id);let dragging=false;
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button,select,input'))return;
    event.preventDefault();dragging=true;handle.setPointerCapture(event.pointerId);
    api.dragStart(mode).catch(report);
  });
  const end=()=>{if(dragging){dragging=false;api.dragEnd().catch(report);}};
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
}
document.addEventListener('pointerdown',()=>api.interact(true).catch(report));
document.addEventListener('pointerup',()=>api.interact(false).catch(report));
window.addEventListener('blur',()=>api.interact(false).catch(report));
api.onFocus(()=>editor.focus());
window.guguMemoReady=window.connectGuguMemo(editor,status,document.getElementById('retry'),render);

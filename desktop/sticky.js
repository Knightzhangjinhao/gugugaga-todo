
'use strict';
const api=window.guguDesktop;
const status=document.getElementById('status');
function render(state){
  document.getElementById('pin').setAttribute('aria-pressed',String(state.pinned));
  document.getElementById('pin').title=state.pinned?'取消置顶':'置顶到其他窗口上方';
  document.getElementById('pin').setAttribute('aria-label',document.getElementById('pin').title);
  document.getElementById('hint').textContent=state.pinned?'已置顶 · 拖动顶部可移动':'普通窗口 · 点击小钉子置顶';
  document.getElementById('tab').hidden=!state.collapsed;
  document.getElementById('note').hidden=state.collapsed;
}
for(const [id,method] of [['pin','pin'],['fold','collapse'],['hide','hide'],['main','main'],['tab','expand']]){
  document.getElementById(id).addEventListener('click',async()=>{
    try{render(await api[method]());}catch(error){status.textContent='操作失败，请重试';}
  });
}
void window.connectGuguMemo(document.getElementById('text'),status,document.getElementById('retry'),render);

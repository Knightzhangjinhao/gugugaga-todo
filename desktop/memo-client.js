
/* Shared by the desktop memo and the detached note; inert in ordinary browsers. */
window.connectGuguMemo=async function(editor,status,retry,onState=()=>{}){
  const api=window.guguDesktop;
  let revision=0,dirty=false,busy=false,conflict=false,ready=false;
  let latestText='',latestRevision=-1,version=0;
  const show=(message,bad=false)=>{status.textContent=message;status.style.color=bad?'#a13724':'';};
  const receive=state=>{
    onState(state);
    if(!ready||state.revision<=revision)return;
    if(dirty||busy){
      latestText=state.text??'';latestRevision=state.revision;
      conflict=true;retry.hidden=false;show('另一窗口有更新；此处草稿已保留',true);
    }else{
      revision=state.revision;editor.value=state.text??'';
      localStorage.setItem('mira_memo',editor.value);show('已同步');
    }
  };
  api.onState(receive);
  async function push(){
    if(!ready||busy||conflict||!dirty)return;
    busy=true;const sent=editor.value;const sentVersion=version;show('保存中…');
    try{
      const result=await api.write(sent,revision);
      if(!result.ok){
        conflict=true;latestText=result.state.text??'';latestRevision=result.state.revision;
        retry.hidden=false;show('另一窗口有更新；此处草稿已保留',true);
      }else{
        revision=result.state.revision;
        dirty=version!==sentVersion;
        localStorage.setItem('mira_memo',sent);
        if(conflict&&latestRevision<=revision){conflict=false;retry.hidden=true;}
        if(!conflict)show(dirty?'保存中…':'已保存 · 与咕咕嘎嘎同步');
      }
    }catch(error){conflict=true;retry.hidden=false;show('保存失败，草稿仍在；请重试',true);}
    finally{busy=false;if(!conflict&&dirty)void push();}
  }
  editor.disabled=true;
  try{
    const initial=await api.read();revision=initial.revision;
    const old=localStorage.getItem('mira_memo')||'';
    editor.value=initial.text??old;ready=true;onState(initial);
    editor.disabled=false;show('已保存 · 与咕咕嘎嘎同步');
    // Only seed a new desktop note; an intentionally cleared note stays empty.
    if(initial.text===null&&old){dirty=true;await push();}
  }catch(error){show('无法读取便利贴，请重新打开窗口',true);return;}
  editor.addEventListener('input',()=>{dirty=true;version++;void push();});
  retry.addEventListener('click',async()=>{
    if(busy)return;
    // Keep both versions when resolving a conflict; do not silently discard either.
    try{
      const current=await api.read();
      if(current.revision!==revision&&current.text!==editor.value){
        if(!window.confirm('另一窗口已修改内容。将两份内容合并后保存，是否继续？'))return;
        editor.value=(current.text||'')+'\n\n—— 此窗口保留的草稿 ——\n'+editor.value;
      }
      revision=current.revision;conflict=false;dirty=true;version++;retry.hidden=true;void push();
    }catch(error){show('重试失败，请保留当前窗口和草稿',true);}
  });
  window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
};
if(window.guguDesktop&&document.getElementById('memoTextarea')){
  const editor=document.getElementById('memoTextarea');
  editor.removeAttribute('oninput');
  const status=document.getElementById('memoIndicator');
  status.style.opacity='1';
  const retry=document.createElement('button');retry.textContent='合并 / 重试保存';retry.hidden=true;retry.className='settings-btn';
  status.after(retry);
  const open=document.createElement('button');open.textContent='📌 桌面便利贴';open.className='settings-btn';
  open.onclick=()=>window.guguDesktop.open().catch(()=>{status.textContent='便利贴打开失败，请重试';});
  document.querySelector('.header-settings-row')?.append(open);
  void window.connectGuguMemo(editor,status,retry);
}

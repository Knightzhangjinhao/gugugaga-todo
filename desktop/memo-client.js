
/* Rich memo shared with the desktop window. Ordinary browsers keep their original memo. */
window.connectGuguMemo=async function(editor,status,retry,onState=()=>{}){
  const api=window.guguDesktop,rich=window.GuguRich;
  let revision=0,dirty=false,busy=false,conflict=false,ready=false,version=0,latestRevision=-1,composing=false,saveTimer;
  const show=(message,bad=false)=>{status.textContent=message;status.classList.toggle('save-error',bad);};
  const html=()=>rich.clean(editor.innerHTML);
  const stateHtml=state=>state.html==null?rich.fromText(state.text):rich.clean(state.html);
  const mirror=value=>{
    try{localStorage.setItem('mira_memo',value);}catch(_error){}
    const legacy=document.getElementById('memoTextarea');if(legacy)legacy.value=value;
  };
  const apply=state=>{editor.innerHTML=stateHtml(state);mirror(state.text??'');};
  api.onState(state=>{
    onState(state);if(!ready||state.revision<=revision)return;
    if(dirty||busy||composing){latestRevision=state.revision;conflict=true;retry.hidden=false;show('另一窗口有更新；此处草稿已保留',true);}
    else{revision=state.revision;apply(state);show('已同步');}
  });
  async function push(){
    clearTimeout(saveTimer);if(!ready||busy||conflict||!dirty||composing)return;
    busy=true;const sent=html(),text=rich.plain(sent),sentVersion=version;show('保存中…');
    try{
      const result=await api.write(text,revision,sent);
      if(!result.ok){conflict=true;latestRevision=result.state.revision;retry.hidden=false;show('另一窗口有更新；此处草稿已保留',true);}
      else{
        revision=result.state.revision;dirty=version!==sentVersion;mirror(text);
        if(conflict&&latestRevision<=revision){conflict=false;retry.hidden=true;}
        if(!conflict)show(dirty?'保存中…':'已保存 · 与咕咕嘎嘎同步');
      }
    }catch(error){conflict=true;retry.hidden=false;show('保存失败，草稿仍在；请重试',true);}
    finally{busy=false;if(!conflict&&dirty&&!composing)void push();}
  }
  editor.contentEditable='false';editor.setAttribute('aria-busy','true');
  try{
    const initial=await api.read();revision=initial.revision;
    let old='';try{old=localStorage.getItem('mira_memo')||'';}catch(_error){}
    apply(initial.text===null?{...initial,text:old}:initial);
    ready=true;onState(initial);editor.contentEditable='true';editor.setAttribute('aria-busy','false');show('已保存 · 与咕咕嘎嘎同步');
    if(initial.text===null&&old){dirty=true;await push();}
  }catch(error){show('无法读取便利贴，请重新打开窗口',true);return;}
  const change=()=>{dirty=true;version++;api.activity().catch(()=>{});clearTimeout(saveTimer);saveTimer=setTimeout(push,180);};
  editor.addEventListener('input',change);
  editor.addEventListener('compositionstart',()=>{composing=true;});
  editor.addEventListener('compositionend',()=>{composing=false;change();});
  editor.addEventListener('paste',event=>{
    event.preventDefault();const pasted=event.clipboardData.getData('text/html');
    document.execCommand(pasted?'insertHTML':'insertText',false,pasted?rich.clean(pasted):event.clipboardData.getData('text/plain'));
  });
  retry.addEventListener('click',async()=>{
    if(busy)return;
    try{
      const current=await api.read(),draft=html();
      if(current.revision!==revision&&stateHtml(current)!==draft){
        if(!window.confirm('另一窗口已修改内容。将两份内容合并后保存，是否继续？'))return;
        editor.innerHTML=stateHtml(current)+'<p>—— 此窗口保留的草稿 ——</p>'+draft;
      }
      revision=current.revision;conflict=false;dirty=true;version++;retry.hidden=true;void push();
    }catch(error){show('重试失败，请保留当前窗口和草稿',true);}
  });
  window.addEventListener('beforeunload',event=>{if(dirty||busy||composing){void push();event.preventDefault();event.returnValue='';}});
  return {flush:push,isDirty:()=>dirty||busy||composing};
};
window.buildGuguToolbar=function(editor){
  const bar=document.createElement('div');bar.className='gugu-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','文字格式');
  const font=document.createElement('select');font.setAttribute('aria-label','字体');font.title='所选文字的字体';
  for(const [value,label] of [['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['KaiTi','楷体'],['Segoe UI','系统字体'],['Consolas','等宽字体']])font.add(new Option(label,value));
  const size=document.createElement('select');size.setAttribute('aria-label','字号');size.title='所选文字的字号';
  for(const [value,label] of Object.entries(window.GuguRich.sizes))size.add(new Option(label.replace('px',''),value));size.value='3';
  let selection;
  document.addEventListener('selectionchange',()=>{
    const current=window.getSelection();
    if(current.rangeCount&&editor.contains(current.anchorNode)&&editor.contains(current.focusNode)){
      selection=current.getRangeAt(0).cloneRange();
      const node=current.anchorNode.nodeType===1?current.anchorNode:current.anchorNode.parentElement;
      const computed=getComputedStyle(node);const family=computed.fontFamily.split(',')[0].replace(/[\"']/g,'').trim();
      if(window.GuguRich.fonts.includes(family))font.value=family;
      const entry=Object.entries(window.GuguRich.sizes).find(([,value])=>value===computed.fontSize);if(entry)size.value=entry[0];
      for(const button of bar.querySelectorAll('[data-command]'))button.setAttribute('aria-pressed',String(document.queryCommandState(button.dataset.command)));
    }
  });
  function command(name,value){
    if(editor.contentEditable!=='true')return;
    editor.focus();const current=window.getSelection();
    if(selection&&editor.contains(selection.commonAncestorContainer)){current.removeAllRanges();current.addRange(selection);}
    document.execCommand(name,false,value);editor.dispatchEvent(new Event('input',{bubbles:true}));
  }
  font.addEventListener('change',()=>command('fontName',font.value));size.addEventListener('change',()=>command('fontSize',size.value));bar.append(font,size);
  for(const [name,label,title] of [['bold','B','加粗 Ctrl+B'],['italic','I','斜体 Ctrl+I'],['strikeThrough','S','删除线 Ctrl+Shift+X'],['insertUnorderedList','•','项目列表'],['insertOrderedList','1.','编号列表']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.command=name;button.title=title;button.setAttribute('aria-label',title);button.setAttribute('aria-pressed','false');
    button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>command(name));bar.append(button);
  }
  editor.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&!event.altKey){
      const key=event.key.toLowerCase(),name=key==='b'?'bold':key==='i'?'italic':key==='x'&&event.shiftKey?'strikeThrough':null;
      if(name){event.preventDefault();command(name);}
    }
  });
  return bar;
};
if(window.guguDesktop&&document.getElementById('memoTextarea')){
  const legacy=document.getElementById('memoTextarea');legacy.removeAttribute('oninput');legacy.hidden=true;
  const editor=document.createElement('div');editor.id='memoRich';editor.className='gugu-editor';editor.setAttribute('role','textbox');editor.setAttribute('aria-label','备忘录内容');editor.setAttribute('aria-multiline','true');
  const wrap=document.createElement('div');wrap.className='gugu-memo';legacy.before(wrap);wrap.append(window.buildGuguToolbar(editor),editor);
  const status=document.getElementById('memoIndicator');status.style.opacity='1';
  const retry=document.createElement('button');retry.textContent='合并 / 重试保存';retry.hidden=true;retry.className='settings-btn';status.after(retry);
  const open=document.createElement('button');open.textContent='📌 桌面便利贴';open.className='settings-btn';
  open.onclick=()=>window.guguDesktop.open().catch(()=>{status.textContent='便利贴打开失败，请重试';});document.querySelector('.header-settings-row')?.append(open);
  window.guguMemoReady=window.connectGuguMemo(editor,status,retry);
}

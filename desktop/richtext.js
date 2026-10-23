/* Narrow HTML vocabulary: renderer content never gets scripts, links or pasted styles. */
(function(root){
  'use strict';
  const fonts=['Microsoft YaHei','SimSun','KaiTi','Segoe UI','Consolas'];
  const sizes={'1':'12px','2':'14px','3':'16px','4':'18px','5':'24px','6':'32px','7':'40px'};
  const tags=new Set(['B','STRONG','I','EM','S','STRIKE','U','BR','DIV','P','UL','OL','LI','SPAN','FONT']);
  function clean(html){
    const source=new DOMParser().parseFromString(String(html||''),'text/html');
    const target=document.createElement('div');
    function copy(node,parent){
      if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return;}
      if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','TEMPLATE'].includes(node.tagName))return;
      if(!tags.has(node.tagName)){for(const child of node.childNodes)copy(child,parent);return;}
      const el=document.createElement(node.tagName==='FONT'?'span':node.tagName.toLowerCase());
      const font=(node.getAttribute('face')||node.style.fontFamily||'').replace(/["']/g,'').trim();
      const size=sizes[node.getAttribute('size')]||node.style.fontSize;
      if(fonts.includes(font))el.style.fontFamily=font;
      if(Object.values(sizes).includes(size))el.style.fontSize=size;
      if(['bold','700'].includes(node.style.fontWeight))el.style.fontWeight='bold';
      if(node.style.fontStyle==='italic')el.style.fontStyle='italic';
      if(node.style.textDecorationLine==='line-through')el.style.textDecoration='line-through';
      parent.append(el);for(const child of node.childNodes)copy(child,el);
    }
    for(const child of source.body.childNodes)copy(child,target);
    return target.innerHTML;
  }
  function plain(html){
    const holder=document.createElement('div');holder.innerHTML=clean(html);
    let output='',synthetic=false;
    function line(){if(output&&!output.endsWith('\n')){output+='\n';synthetic=true;}}
    function walk(node){
      if(node.nodeType===3){output+=node.textContent;synthetic=false;return;}
      if(node.nodeName==='BR'){output+='\n';synthetic=false;return;}
      const block=['DIV','P','LI','UL','OL'].includes(node.nodeName);
      if(block)line();
      for(const child of node.childNodes)walk(child);
      if(block)line();
    }
    for(const child of holder.childNodes)walk(child);
    return synthetic?output.slice(0,-1):output;
  }
  function fromText(text){const el=document.createElement('div');el.textContent=text||'';return el.innerHTML.replace(/\n/g,'<br>');}
  root.GuguRich={clean,plain,fromText,fonts,sizes};
})(window);

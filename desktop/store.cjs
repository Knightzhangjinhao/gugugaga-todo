
'use strict';
const fs=require('node:fs'),path=require('node:path');
class Store{
  constructor(file){
    this.file=file;
    this.state={text:null,html:null,revision:0,pinned:true,bounds:null,dockSide:null,autoHide:true};
    try{
      const saved=JSON.parse(fs.readFileSync(file,'utf8'));
      if((typeof saved.text!=='string'&&saved.text!==null)||!Number.isSafeInteger(saved.revision)||saved.revision<0)throw Error('Invalid note file');
      if(saved.html!=null&&typeof saved.html!=='string')throw Error('Invalid rich note');
      this.state={...this.state,...saved};
      if(!['left','right'].includes(this.state.dockSide))this.state.dockSide=null;
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  commit(patch){
    const next={...this.state,...patch};
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    fs.writeFileSync(this.file+'.tmp',JSON.stringify(next),'utf8');fs.renameSync(this.file+'.tmp',this.file);
    this.state=next;return {...next};
  }
  write(text,revision,html=null){
    if(typeof text!=='string'||text.length>100000)throw Error('便利贴最多支持 100,000 个字符');
    if(html!==null&&(typeof html!=='string'||html.length>500000))throw Error('便利贴格式数据过大');
    if(revision!==this.state.revision)return {ok:false,state:{...this.state}};
    return {ok:true,state:this.commit({text,html,revision:revision+1})};
  }
}
module.exports={Store};

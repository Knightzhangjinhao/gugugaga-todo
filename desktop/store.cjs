
'use strict';
const fs=require('node:fs');
const path=require('node:path');
class Store{
  constructor(file){
    this.file=file;
    this.state={text:null,revision:0,pinned:true,bounds:null};
    try{
      const saved=JSON.parse(fs.readFileSync(file,'utf8'));
      if((typeof saved.text!=='string'&&saved.text!==null)||!Number.isSafeInteger(saved.revision)||saved.revision<0)throw Error('Invalid note file');
      this.state={...this.state,...saved};
    }catch(error){
      if(error.code!=='ENOENT')throw error; // Do not silently overwrite damaged notes.
    }
  }
  commit(patch){
    const next={...this.state,...patch};
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp';
    fs.writeFileSync(temp,JSON.stringify(next),'utf8');
    fs.renameSync(temp,this.file);
    this.state=next;
    return {...next};
  }
  write(text,revision){
    if(typeof text!=='string'||text.length>100000)throw Error('便利贴最多支持 100,000 个字符');
    if(revision!==this.state.revision)return {ok:false,state:{...this.state}};
    return {ok:true,state:this.commit({text,revision:revision+1})};
  }
}
module.exports={Store};

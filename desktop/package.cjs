
'use strict';
const fs=require('node:fs');
const path=require('node:path');
if(process.platform!=='win32')throw Error('Windows packaging must run on Windows');
const root=path.join(__dirname,'..');
const out=path.join(root,'dist','gugugaga-win32-x64');
fs.mkdirSync(out,{recursive:true});
const electronDir=path.dirname(require('electron'));
fs.cpSync(electronDir,out,{recursive:true});
fs.renameSync(path.join(out,'electron.exe'),path.join(out,'Gugugaga.exe'));
const appDir=path.join(out,'resources','app');
fs.mkdirSync(appDir,{recursive:true});
for(const name of ['index.html','manifest.json','sw.js','package.json','desktop',...fs.readdirSync(root).filter(n=>/\.(webp|mp3)$/.test(n))]){
  fs.cpSync(path.join(root,name),path.join(appDir,name),{recursive:true});
}
console.log('Portable app: '+path.join(out,'Gugugaga.exe'));

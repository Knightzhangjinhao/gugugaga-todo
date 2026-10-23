
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
for(const name of fs.readdirSync(__dirname).filter(n=>/\.(js|cjs)$/.test(n))){
  const result=spawnSync(process.execPath,['--check',path.join(__dirname,name)],{encoding:'utf8'});
  if(result.status!==0){console.error(result.stderr);process.exit(1);}
}
console.log('All desktop modules passed syntax checks.');


'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Store}=require('../store.cjs');
const {fit,edge,tab}=require('../geometry.cjs');
test('notes persist, stale editors cannot overwrite, and clearing survives restart',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gugu-store-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'note.json');
  const first=new Store(file);
  assert.equal(first.write('写周报 🐧',0).ok,true);
  assert.equal(first.write('stale text',0).ok,false);
  assert.equal(new Store(file).state.text,'写周报 🐧');
  first.write('',1);
  assert.equal(new Store(file).state.text,'');
  first.commit({pinned:false});
  assert.equal(new Store(file).state.pinned,false);
});
test('invalid data never silently replaces the original',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gugu-bad-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'note.json');
  fs.writeFileSync(file,'broken');
  assert.throws(()=>new Store(file));
  assert.equal(fs.readFileSync(file,'utf8'),'broken');
});
test('screen-edge tabs support a monitor left of primary and remain in work area',()=>{
  const area={x:-1920,y:0,width:1920,height:1040};
  const bounds=fit({x:-2000,y:1000,width:340,height:400},area);
  assert.equal(bounds.x,-1920);
  assert.equal(bounds.y,640);
  assert.equal(edge(bounds,area),'left');
  assert.deepEqual(tab(bounds,area,'right'),{x:-40,y:640,width:40,height:108});
  const recovered=fit({x:-1700,y:60,width:340,height:400},{x:0,y:0,width:1440,height:900});
  assert.equal(recovered.x,0);
});

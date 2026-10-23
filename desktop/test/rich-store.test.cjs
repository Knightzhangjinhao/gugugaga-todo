
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../store.cjs'),g=require('../geometry.cjs');
test('old plain notes migrate without losing data; rich formatting persists and detects conflicts',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gugu-rich-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'note.json');
  fs.writeFileSync(file,JSON.stringify({text:'旧笔记\n第二行',revision:7,pinned:false,bounds:{x:10,y:10,width:340,height:400}}));
  const store=new Store(file);
  assert.equal(store.state.html,null);assert.equal(store.state.text,'旧笔记\n第二行');
  assert.equal(store.write('旧笔记',7,'<b>旧笔记</b>').ok,true);
  assert.equal(store.write('并发草稿',7,'<i>并发草稿</i>').ok,false);
  store.commit({dockSide:'right',autoHide:false});
  const restored=new Store(file);assert.equal(restored.state.html,'<b>旧笔记</b>');assert.equal(restored.state.dockSide,'right');assert.equal(restored.state.autoHide,false);
  restored.write('',8,'');assert.equal(new Store(file).state.html,'');
});
test('snapping accepts overshoot, supports negative display coordinates and clamps tiny displays',()=>{
  const area={x:-1600,y:-100,width:1600,height:1000};
  assert.equal(g.edge({x:-1650,y:0,width:360,height:440},area),'left');
  const right=g.snap({x:-40,y:2000,width:360,height:440},area,'right');
  assert.equal(right.x,-360);assert.equal(right.y,460);
  assert.equal(g.edge({x:-1000,y:0,width:360,height:440},area),null);
  assert.equal(g.contains(g.tab(right,area,'right'),{x:-10,y:470}),true);
  assert.equal(g.fit({}, {x:0,y:0,width:250,height:200}).width,250);
});

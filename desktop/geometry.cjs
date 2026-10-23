
'use strict';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function fit(bounds,area){
  const width=clamp(Math.round(bounds.width||340),280,Math.max(280,area.width));
  const height=clamp(Math.round(bounds.height||400),240,Math.max(240,area.height));
  return {width,height,x:clamp(Math.round(bounds.x??area.x+area.width-width),area.x,area.x+area.width-width),y:clamp(Math.round(bounds.y??area.y+80),area.y,area.y+area.height-height)};
}
function edge(bounds,area,threshold=20){
  if(Math.abs(bounds.x-area.x)<=threshold)return 'left';
  if(Math.abs(bounds.x+bounds.width-area.x-area.width)<=threshold)return 'right';
  return null;
}
function tab(bounds,area,side){
  return {x:side==='left'?area.x:area.x+area.width-40,y:clamp(bounds.y,area.y,area.y+area.height-108),width:40,height:108};
}
module.exports={fit,edge,tab};

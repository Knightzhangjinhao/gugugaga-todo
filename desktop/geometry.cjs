
'use strict';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function fit(bounds,area){
  const width=clamp(Math.round(bounds.width||360),Math.min(300,area.width),area.width);
  const height=clamp(Math.round(bounds.height||440),Math.min(280,area.height),area.height);
  return {width,height,x:clamp(Math.round(bounds.x??area.x+area.width-width),area.x,area.x+area.width-width),y:clamp(Math.round(bounds.y??area.y+80),area.y,area.y+area.height-height)};
}
function edge(bounds,area,threshold=28){
  const left=bounds.x-area.x,right=area.x+area.width-bounds.x-bounds.width;
  if(left<=threshold&&left<=right)return 'left';
  if(right<=threshold)return 'right';return null;
}
function snap(bounds,area,side){
  const result=fit(bounds,area);
  if(side==='left')result.x=area.x;
  if(side==='right')result.x=area.x+area.width-result.width;
  return result;
}
function tab(bounds,area,side){return {x:side==='left'?area.x:area.x+area.width-40,y:clamp(bounds.y,area.y,area.y+area.height-108),width:40,height:108};}
function contains(bounds,point){return point.x>=bounds.x&&point.x<bounds.x+bounds.width&&point.y>=bounds.y&&point.y<bounds.y+bounds.height;}
module.exports={fit,edge,tab,snap,contains};

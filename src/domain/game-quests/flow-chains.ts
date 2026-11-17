import {coordinateKey,type Coordinate} from './index';
import type {QuestFlowEdge} from './path-flow';

export type QuestFlowChain={edges:readonly QuestFlowEdge[];indices:readonly number[]};

/** Join only consecutive captured edges with no intervening choice or merge. */
export function questFlowChains(edges:readonly QuestFlowEdge[]):QuestFlowChain[]{
  const outgoing=new Map<string,number[]>(),incoming=new Map<string,number>();
  edges.forEach((edge,index)=>{
    const from=coordinateKey(edge.from),to=coordinateKey(edge.to),next=outgoing.get(from)??[];
    next.push(index);outgoing.set(from,next);incoming.set(to,(incoming.get(to)??0)+1);
  });
  const visited=new Set<number>(),chains:QuestFlowChain[]=[];
  const walk=(start:number)=>{
    if(visited.has(start))return;
    const indices:number[]=[];let index=start;
    while(!visited.has(index)){
      visited.add(index);indices.push(index);
      const edge=edges[index],to=coordinateKey(edge.to),next=outgoing.get(to)??[];
      if(edge.portal||incoming.get(to)!==1||next.length!==1||edges[next[0]].portal)break;
      index=next[0];
    }
    chains.push({indices,edges:indices.map(position=>edges[position])});
  };
  edges.forEach((edge,index)=>{
    const from=coordinateKey(edge.from);
    if(edge.portal||incoming.get(from)!==1||outgoing.get(from)?.length!==1)walk(index);
  });
  // Any remaining edges belong to a cycle or begin immediately after a portal.
  edges.forEach((_,index)=>walk(index));
  return chains;
}

/** SVG geometry and decorative midpoint; native placements are never changed. */
export function questFlowChainGeometry(chain:QuestFlowChain,point:(coordinate:Coordinate)=>Coordinate){
  if(!chain.edges.length)return {d:'',length:0,cue:{x:0,y:0,angle:0}};
  const first=point(chain.edges[0].from),samples:Coordinate[]=[first];
  let d=`M${first[0]},${first[1]}`;
  for(const edge of chain.edges){
    const a=point(edge.from),b=point(edge.to);
    if(!edge.portal){d+=` L${b[0]},${b[1]}`;samples.push(b);continue;}
    const control:Coordinate=[(a[0]+b[0])/2+(b[1]-a[1])*.12,(a[1]+b[1])/2-(b[0]-a[0])*.12];
    d+=` Q${control[0]},${control[1]} ${b[0]},${b[1]}`;
    for(let index=1;index<=12;index++){
      const t=index/12,u=1-t;
      samples.push([u*u*a[0]+2*u*t*control[0]+t*t*b[0],u*u*a[1]+2*u*t*control[1]+t*t*b[1]]);
    }
  }
  const lengths=samples.slice(1).map((next,index)=>Math.hypot(next[0]-samples[index][0],next[1]-samples[index][1]));
  const length=lengths.reduce((sum,value)=>sum+value,0);let remaining=length/2;
  let cue={x:first[0],y:first[1],angle:0};
  for(let index=0;index<lengths.length;index++){
    const part=lengths[index];
    if(remaining>part){remaining-=part;continue;}
    const from=samples[index],to=samples[index+1],ratio=part?remaining/part:0;
    cue={x:from[0]+(to[0]-from[0])*ratio,y:from[1]+(to[1]-from[1])*ratio,angle:Math.atan2(to[1]-from[1],to[0]-from[0])*180/Math.PI};break;
  }
  return {d,length,cue};
}

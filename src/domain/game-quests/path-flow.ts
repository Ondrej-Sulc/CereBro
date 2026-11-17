import {coordinateKey,type Coordinate} from './index';

export type QuestFlowEdge={from:Coordinate;to:Coordinate;portal:boolean};
const edgeKey=(from:Coordinate,to:Coordinate)=>`${coordinateKey(from)}>${coordinateKey(to)}`;

function connectionLength(edge:QuestFlowEdge,point:(coordinate:Coordinate)=>Coordinate){
  const a=point(edge.from),b=point(edge.to);
  if(!edge.portal)return Math.hypot(b[0]-a[0],b[1]-a[1]);
  // Sample the same quadratic used by the portal's visible SVG connection.
  const control:Coordinate=[(a[0]+b[0])/2+(b[1]-a[1])*.12,(a[1]+b[1])/2-(b[0]-a[0])*.12];
  let previous=a,length=0;
  for(let step=1;step<=12;step++){
    const t=step/12,u=1-t;
    const current:Coordinate=[u*u*a[0]+2*u*t*control[0]+t*t*b[0],u*u*a[1]+2*u*t*control[1]+t*t*b[1]];
    length+=Math.hypot(current[0]-previous[0],current[1]-previous[1]);previous=current;
  }
  return length;
}

/** A visual phase forest, never a traversal, progress state, or new connection. */
export function questPathFlowDistances({edges,point,starts=[],selectedPath=[]}:{
  edges:readonly QuestFlowEdge[];point:(coordinate:Coordinate)=>Coordinate;starts?:readonly Coordinate[];selectedPath?:readonly Coordinate[];
}):Map<string,number>{
  const outgoing=new Map<string,QuestFlowEdge[]>(),nodes=new Map<string,Coordinate>(),incoming=new Set<string>(),lengths=new Map<string,number>();
  for(const edge of edges){
    const from=coordinateKey(edge.from),to=coordinateKey(edge.to);
    nodes.set(from,edge.from);nodes.set(to,edge.to);incoming.add(to);
    const next=outgoing.get(from)??[];next.push(edge);outgoing.set(from,next);
    lengths.set(edgeKey(edge.from,edge.to),connectionLength(edge,point));
  }
  const distances=new Map<string,number>(),queue:string[]=[];
  let head=0;
  const seed=(key:string)=>{if(!distances.has(key)){distances.set(key,0);queue.push(key);}};
  const drain=()=>{while(head<queue.length){const from=queue[head++];for(const edge of outgoing.get(from)??[]){const to=coordinateKey(edge.to);if(!distances.has(to)){distances.set(to,distances.get(from)!+lengths.get(edgeKey(edge.from,edge.to))!);queue.push(to);}}}};
  for(const start of starts)seed(coordinateKey(start));drain();
  for(const key of nodes.keys())if(!incoming.has(key)){seed(key);drain();}
  for(const key of nodes.keys()){seed(key);drain();}
  const phases=new Map(edges.map(edge=>[edgeKey(edge.from,edge.to),distances.get(coordinateKey(edge.from))!]));
  // Unequal merges and cycles cannot share a single continuous phase everywhere.
  // Prefer continuity along the route the user is currently inspecting.
  const prioritized=new Set<string>();let distance=0;
  for(let index=1;index<selectedPath.length;index++){
    const from=selectedPath[index-1],to=selectedPath[index],key=edgeKey(from,to);
    if(phases.has(key)&&!prioritized.has(key)){phases.set(key,distance);prioritized.add(key);}
    distance+=lengths.get(key)??Math.hypot(point(to)[0]-point(from)[0],point(to)[1]-point(from)[1]);
  }
  return phases;
}

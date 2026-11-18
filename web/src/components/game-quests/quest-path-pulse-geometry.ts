import type {Coordinate} from '@cerebro/core/domain/game-quests';

export type QuestPathPulsePoint=readonly [number,number];
export type QuestPathPulseStroke=Readonly<{from:QuestPathPulsePoint;to:QuestPathPulsePoint;control:QuestPathPulsePoint|null}>;
export type QuestPathPulseGeometry=QuestPathPulseStroke&Readonly<{
  key:string;bounds:Readonly<{minX:number;minY:number;maxX:number;maxY:number}>;
  length:number;phase:number;category:'normal-active'|'normal-quiet'|'portal-active'|'portal-quiet';samples:readonly number[];
}>;
export type QuestPathPulseMotion=Readonly<{distance:number;period:number}>;
type Edge=Readonly<{from:Coordinate;to:Coordinate;portal:boolean}>;
const freezePoint=(x:number,y:number):QuestPathPulsePoint=>Object.freeze([x,y] as const);
function pointAt(edge:QuestPathPulseStroke,t:number):QuestPathPulsePoint{
  if(t<=0)return edge.from;
  if(t>=1)return edge.to;
  const [ax,ay]=edge.from,[bx,by]=edge.to,c=edge.control,u=1-t;
  return c?[u*u*ax+2*u*t*c[0]+t*t*bx,u*u*ay+2*u*t*c[1]+t*t*by]:[ax+(bx-ax)*t,ay+(by-ay)*t];
}

/** Snapshots captured connections only; distances and geometry remain in world units. */
export function createQuestPathPulseGeometry({edges,point,distances,selectedEdges,highlightRoute}:{
  edges:readonly Edge[];point:(coordinate:Coordinate)=>Coordinate;distances:ReadonlyMap<string,number>;
  selectedEdges:ReadonlySet<string>;highlightRoute:boolean;
}):readonly QuestPathPulseGeometry[]{
  return Object.freeze(edges.flatMap((edge):QuestPathPulseGeometry[]=>{
    const a=point(edge.from),b=point(edge.to),from=freezePoint(a[0],a[1]),to=freezePoint(b[0],b[1]);
    const key=`${edge.from.join(',')}>${edge.to.join(',')}`;
    const control=edge.portal?freezePoint((from[0]+to[0])/2+(to[1]-from[1])*.12,(from[1]+to[1])/2-(to[0]-from[0])*.12):null;
    if(![...from,...to,...(control??[])].every(Number.isFinite))return [];
    const stroke={from,to,control},samples=[0];let previous=from,length=0;
    for(let step=1;step<=(control?12:1);step++){
      const current=pointAt(stroke,step/(control?12:1));
      length+=Math.hypot(current[0]-previous[0],current[1]-previous[1]);samples.push(length);previous=current;
    }
    if(!Number.isFinite(length)||length<=0)return [];
    const category:QuestPathPulseGeometry['category']=`${edge.portal?'portal':'normal'}-${highlightRoute&&!selectedEdges.has(key)?'quiet':'active'}`;
    const hull=control?[from,to,control]:[from,to];
    const sourcePhase=distances.get(key)??0,phase=Number.isFinite(sourcePhase)?sourcePhase:0;
    return [Object.freeze({key,from,to,control,length,phase,category,samples:Object.freeze(samples),
      bounds:Object.freeze({minX:Math.min(...hull.map(p=>p[0])),minY:Math.min(...hull.map(p=>p[1])),maxX:Math.max(...hull.map(p=>p[0])),maxY:Math.max(...hull.map(p=>p[1]))})})];
  }));
}

/** World-space fronts and spacing stay fixed across zoom; only tail length uses screen pixels. */
export function visitQuestPathPulseIntervals(edge:QuestPathPulseGeometry,motion:QuestPathPulseMotion,scale:number,lengthPx:number,
  visit:(fromDistance:number,toDistance:number)=>void):void{
  if(!Number.isFinite(motion.distance)||!Number.isFinite(motion.period)||motion.period<=0||
    !Number.isFinite(scale)||scale<=0||!Number.isFinite(lengthPx)||lengthPx<=0)return;
  const length=lengthPx/scale;
  if(!Number.isFinite(length)||length<=0)return;
  const tip=((motion.distance-edge.phase)%motion.period+motion.period)%motion.period;
  for(let end=tip;end<edge.length+length;end+=motion.period){
    const from=Math.max(0,end-length),to=Math.min(edge.length,end);
    if(to>from)visit(from,to);
  }
}

/** Reconstruct a pulse stroke on its existing connection. */
export function questPathPulseSubcurve(edge:QuestPathPulseGeometry,start:number,end:number):QuestPathPulseStroke{
  const parameter=(distance:number):number=>{
    if(distance<=0)return 0;
    if(distance>=edge.length)return 1;
    const {samples}=edge;
    for(let step=1;step<samples.length;step++)if(samples[step]>=distance)
      return (step-1+(distance-samples[step-1])/(samples[step]-samples[step-1]))/(samples.length-1);
    return 1;
  };
  const a=parameter(start),b=parameter(end),from=pointAt(edge,a),to=pointAt(edge,b),c=edge.control;
  const control:QuestPathPulsePoint|null=c?[from[0]+(b-a)*((1-a)*(c[0]-edge.from[0])+a*(edge.to[0]-c[0])),
    from[1]+(b-a)*((1-a)*(c[1]-edge.from[1])+a*(edge.to[1]-c[1]))]:null;
  return {from,to,control};
}

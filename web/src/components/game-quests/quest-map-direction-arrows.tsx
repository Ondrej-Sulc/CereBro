import {useId,useMemo} from 'react';
import {coordinateKey,type Coordinate} from '@cerebro/core/domain/game-quests';
import type {QuestFlowEdge} from '@cerebro/core/domain/game-quests/path-flow';
import {questFlowChains,questFlowChainGeometry,type QuestFlowChain} from '@cerebro/core/domain/game-quests/flow-chains';
import styles from './quest-map-direction-arrows.module.css';

type Props={edges:readonly QuestFlowEdge[];point:(coordinate:Coordinate)=>Coordinate;routeEdges:ReadonlySet<string>;highlightRoute:boolean;scale:number};
const edgeKey=(edge:QuestFlowEdge)=>`${coordinateKey(edge.from)}>${coordinateKey(edge.to)}`;

function selectedRuns(chain:QuestFlowChain,routeEdges:ReadonlySet<string>,highlightRoute:boolean):QuestFlowChain[]{
  if(!highlightRoute)return [chain];
  const result:QuestFlowChain[]=[];let start=0;
  for(let index=1;index<=chain.edges.length;index++){
    if(index<chain.edges.length&&routeEdges.has(edgeKey(chain.edges[index]))===routeEdges.has(edgeKey(chain.edges[start])))continue;
    result.push({edges:chain.edges.slice(start,index),indices:chain.indices.slice(start,index)});start=index;
  }
  return result;
}

function Chevron({color,unit}:{color:string;unit:number}){
  return <g data-flow-glyph transform={`scale(${unit})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-3.5-3.2 .8 0-3.5 3.2" stroke="#03101c" strokeWidth="3.8" strokeOpacity=".95"/>
    <path d="M-3.5-3.2 .8 0-3.5 3.2" stroke={color} strokeWidth="1.9"/>
  </g>;
}

/** Screen-sized direction cues over source paths, with no frame-by-frame JS. */
export function QuestMapDirectionArrows({edges,point,routeEdges,highlightRoute,scale}:Props){
  const uid=useId().replace(/[^a-zA-Z0-9_-]/g,''),zoom=Number.isFinite(scale)&&scale>0?scale:1;
  const chains=useMemo(()=>questFlowChains(edges),[edges]);
  const runs=useMemo(()=>chains.flatMap(chain=>selectedRuns(chain,routeEdges,highlightRoute)).map(chain=>({...chain,geometry:questFlowChainGeometry(chain,point)})),[chains,routeEdges,highlightRoute,point]);
  return <g data-map-directions aria-hidden="true" pointerEvents="none" className={styles.directions}>
    <defs>{runs.map((run,index)=><path key={run.indices.join(',')} id={`${uid}-direction-${index}`} d={run.geometry.d}/>)}</defs>
    {runs.map((run,index)=>{
      const first=run.edges[0],last=run.edges.at(-1)!;
      const selected=highlightRoute&&routeEdges.has(edgeKey(first)),quiet=highlightRoute&&!selected;
      const portal=first.portal,color=selected?(portal?'#fff0ff':'#f0fcff'):(portal?'#ebceff':'#c5efff');
      const screenLength=run.geometry.length*zoom,small=screenLength<24,count=Math.min(12,Math.max(1,Math.ceil(screenLength/60))),duration=screenLength/25;
      const opacity=selected?1:quiet?.48:.86;
      return <g key={run.indices.join(',')} data-flow-chain={index} data-from={coordinateKey(first.from)} data-to={coordinateKey(last.to)} data-edge-indices={run.indices.join(',')}
        data-flow-selected={selected} data-flow-portal={portal||undefined} opacity={opacity}>
        {!small&&Array.from({length:count},(_,arrow)=><g data-flow-arrow className={styles.moving} key={arrow}>
          <animateMotion dur={`${duration}s`} begin={`${-arrow*duration/count}s`} repeatCount="indefinite" rotate="auto" calcMode="paced"><mpath href={`#${uid}-direction-${index}`}/></animateMotion>
          <Chevron color={color} unit={1/zoom}/>
        </g>)}
        <g data-flow-static data-small={small} className={styles.resting} transform={`translate(${run.geometry.cue.x} ${run.geometry.cue.y}) rotate(${run.geometry.cue.angle})`}>
          <Chevron color={color} unit={1/zoom}/>
        </g>
      </g>;
    })}
  </g>;
}

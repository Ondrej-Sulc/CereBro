import {describe,expect,it} from 'vitest';
import type {Coordinate} from '../../domain/game-quests';
import type {QuestFlowEdge} from '../../domain/game-quests/path-flow';
import {questFlowChains,questFlowChainGeometry} from '../../domain/game-quests/flow-chains';

const edge=(from:Coordinate,to:Coordinate,portal=false):QuestFlowEdge=>({from,to,portal});
const point=(coordinate:Coordinate)=>coordinate;
describe('quest flow chains',()=>{
  it('groups short ordinary segments without crossing a fork or merge',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[20,0]),edge([20,0],[30,0]),edge([20,0],[20,10]),edge([30,0],[40,0]),edge([20,10],[40,0]),edge([40,0],[50,0])];
    expect(questFlowChains(edges).map(chain=>chain.indices)).toEqual([[0,1],[2,4],[3,5],[6]]);
  });
  it('keeps portals independent and preserves duplicate edges, cycles and source bytes',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[20,0],true),edge([20,0],[30,0]),edge([30,0],[20,0]),edge([100,0],[110,0]),edge([100,0],[110,0]),edge([110,0],[120,0])];
    const before=JSON.stringify(edges),chains=questFlowChains(edges);
    expect(chains.find(chain=>chain.indices.includes(1))?.indices).toEqual([1]);
    expect(chains.flatMap(chain=>chain.indices).sort((a,b)=>a-b)).toEqual(edges.map((_,index)=>index));
    expect(chains.every(chain=>chain.edges.every((row,index)=>index===0||row.from.join(',')===chain.edges[index-1].to.join(',')))).toBe(true);
    expect(JSON.stringify(edges)).toBe(before);
    expect(questFlowChains([])).toEqual([]);
  });
  it('forms a bounded chain for an isolated directed cycle',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[10,10]),edge([10,10],[0,0])];
    expect(questFlowChains(edges).map(chain=>chain.indices)).toEqual([[0,1,2]]);
  });
  it('builds the exact directed line and quadratic geometry with a derived resting cue',()=>{
    const linear=questFlowChainGeometry({indices:[0,1],edges:[edge([0,0],[10,0]),edge([10,0],[10,20])]},point);
    expect(linear.d).toBe('M0,0 L10,0 L10,20');
    expect(linear.length).toBe(30);
    expect(linear.cue).toEqual({x:10,y:5,angle:90});
    const portal=questFlowChainGeometry({indices:[0],edges:[edge([0,0],[100,0],true)]},point);
    expect(portal.d).toBe('M0,0 Q50,-12 100,0');
    expect(portal.length).toBeGreaterThan(100);
    expect(portal.length).toBeLessThan(102);
    expect(portal.cue.x).toBeCloseTo(50);
    expect(portal.cue.y).toBeCloseTo(-6);
  });
});

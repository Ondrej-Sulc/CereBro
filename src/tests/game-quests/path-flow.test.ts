import {describe,expect,it} from 'vitest';
import type {Coordinate} from '../../domain/game-quests';
import {questPathFlowDistances,type QuestFlowEdge} from '../../domain/game-quests/path-flow';

const point=(coordinate:Coordinate)=>coordinate;
const edge=(from:Coordinate,to:Coordinate,portal=false):QuestFlowEdge=>({from,to,portal});
describe('quest path flow direction',()=>{
  it('continues the flow through short directed segments and outward branches',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[20,0]),edge([10,0],[10,8])];
    const phases=questPathFlowDistances({edges,point,starts:[[0,0]]});
    expect([...phases]).toEqual([['0,0>10,0',0],['10,0>20,0',10],['10,0>10,8',10]]);
  });
  it('prioritizes the selected path at a merge while retaining every other direction',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[20,0]),edge([0,8],[10,8]),edge([10,8],[10,0])];
    const before=JSON.stringify(edges);
    const phases=questPathFlowDistances({edges,point,starts:[[0,0],[0,8]],selectedPath:[[0,8],[10,8],[10,0],[20,0]]});
    expect(phases.get('0,8>10,8')).toBe(0);
    expect(phases.get('10,8>10,0')).toBe(10);
    expect(phases.get('10,0>20,0')).toBe(18);
    expect(phases.get('0,0>10,0')).toBe(0);
    expect(phases.size).toBe(edges.length);
    expect(JSON.stringify(edges)).toBe(before);
  });
  it('terminates on directed cycles and covers disconnected components without adding edges',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[20,0]),edge([20,0],[0,0]),edge([100,100],[110,100]),edge([110,100],[120,100])];
    const phases=questPathFlowDistances({edges,point,starts:[[0,0]]});
    expect([...phases.values()]).toEqual([0,10,20,0,10]);
    expect(questPathFlowDistances({edges:[],point}).size).toBe(0);
  });
  it('carries the visible portal curve length into the next directed connection',()=>{
    const edges=[edge([0,0],[100,0],true),edge([100,0],[110,0])];
    const phases=questPathFlowDistances({edges,point,starts:[[0,0]]});
    expect(phases.get('0,0>100,0')).toBe(0);
    expect(phases.get('100,0>110,0')).toBeGreaterThan(100);
    expect(phases.get('100,0>110,0')).toBeLessThan(102);
  });
});

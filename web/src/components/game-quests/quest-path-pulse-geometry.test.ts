import {describe,expect,it} from 'vitest';
import type {Coordinate} from '@cerebro/core/domain/game-quests';
import {questPathFlowDistances} from '../../../../src/domain/game-quests/path-flow';
import {
  createQuestPathPulseGeometry,questPathPulseSubcurve,visitQuestPathPulseIntervals,
  type QuestPathPulseGeometry,
} from './quest-path-pulse-geometry';

const point=(coordinate:Coordinate)=>coordinate;
const edge=(from:Coordinate,to:Coordinate,portal=false)=>({from,to,portal});
const geometry=(edges:ReturnType<typeof edge>[],distances=new Map<string,number>())=>
  createQuestPathPulseGeometry({edges,point,distances,selectedEdges:new Set(),highlightRoute:false});
function intervals(connection:QuestPathPulseGeometry,seconds:number,scale=1,length=4){
  const result:[number,number][]=[];
  visitQuestPathPulseIntervals(connection,seconds,scale,length,(from,to)=>result.push([from,to]));
  return result;
}

describe('quest path pulse geometry',()=>{
  it('moves the leading end from the captured source toward its target at 25 screen pixels per second',()=>{
    const [connection]=geometry([edge([0,0],[100,0])]);
    expect(questPathPulseSubcurve(connection,...intervals(connection,.4)[0])).toMatchObject({from:[6,0],to:[10,0],control:null});
    expect(questPathPulseSubcurve(connection,...intervals(connection,.8)[0])).toMatchObject({from:[16,0],to:[20,0]});
    expect(questPathPulseSubcurve(connection,...intervals(connection,.8,2)[0])).toMatchObject({from:[8,0],to:[10,0]});
  });
  it('retains the visible portal curve and exact endpoints when clipping a quadratic stroke',()=>{
    const [portal]=geometry([edge([0,0],[100,0],true)]);
    expect(portal.control).toEqual([50,-12]);
    expect(portal.length).toBeGreaterThan(100);
    expect(portal.length).toBeLessThan(102);
    expect(questPathPulseSubcurve(portal,0,portal.length)).toEqual({from:[0,0],to:[100,0],control:[50,-12]});
    const firstHalf=questPathPulseSubcurve(portal,0,portal.length/2);
    const secondHalf=questPathPulseSubcurve(portal,portal.length/2,portal.length);
    expect(firstHalf.to[0]).toBeCloseTo(50);
    expect(firstHalf.to[1]).toBeCloseTo(-6);
    expect(firstHalf.control![0]).toBeCloseTo(25);
    expect(firstHalf.control![1]).toBeCloseTo(-6);
    expect(secondHalf.from).toEqual(firstHalf.to);
    expect(secondHalf.to).toEqual([100,0]);
    for(let distance=0;distance<=portal.length;distance+=portal.length/20){
      const {from:[x,y]}=questPathPulseSubcurve(portal,distance,distance);
      expect(x).toBeGreaterThanOrEqual(portal.bounds.minX);
      expect(x).toBeLessThanOrEqual(portal.bounds.maxX);
      expect(y).toBeGreaterThanOrEqual(portal.bounds.minY);
      expect(y).toBeLessThanOrEqual(portal.bounds.maxY);
    }
  });
  it('omits non-finite or collapsed geometry and defaults unusable source phases to zero',()=>{
    const connections=geometry([
      edge([0,0],[10,0]),edge([NaN,0],[10,0]),edge([0,0],[Infinity,0],true),
      edge([5,5],[5,5]),edge([-1e308,0],[1e308,0]),
    ],new Map([['0,0>10,0',Infinity]]));
    expect(connections).toHaveLength(1);
    expect(connections[0].phase).toBe(0);
    expect(intervals(connections[0],.4)).toEqual([[6,10]]);
    for(const scale of [0,-1,NaN,Infinity])expect(intervals(connections[0],.4,scale)).toEqual([]);
    for(const time of [NaN,Infinity])expect(intervals(connections[0],time)).toEqual([]);
    for(const length of [0,-1,NaN,Infinity])expect(intervals(connections[0],.4,1,length)).toEqual([]);
    expect(intervals(connections[0],.4,1e308)).toEqual([]);
  });
  it('clips a traveling pulse at edge ends and carries it continuously through reversed diagonal segments',()=>{
    const edges=[edge([30,40],[24,32]),edge([24,32],[18,24])];
    const distances=questPathFlowDistances({edges,point,starts:[[30,40]]});
    const [first,second]=geometry(edges,distances);
    const [whole]=geometry([edge([30,40],[18,24])]);
    expect(intervals(first,.08)).toEqual([[0,2]]);
    expect(intervals(first,.48)).toEqual([[8,10]]);
    expect(intervals(first,.64)).toEqual([]);
    const firstStroke=questPathPulseSubcurve(first,...intervals(first,.48)[0]);
    const secondStroke=questPathPulseSubcurve(second,...intervals(second,.48)[0]);
    const wholeStroke=questPathPulseSubcurve(whole,...intervals(whole,.48)[0]);
    expect(firstStroke.to).toEqual([24,32]);
    expect(secondStroke.from).toEqual(firstStroke.to);
    expect(firstStroke.from).toEqual(wholeStroke.from);
    expect(secondStroke.to).toEqual(wholeStroke.to);
    expect(secondStroke.to[0]).toBeLessThan(secondStroke.from[0]);
    expect(secondStroke.to[1]).toBeLessThan(secondStroke.from[1]);
  });
  it('wraps negative time and source phases while aligning repeated pulse layers on the same leading end',()=>{
    const [connection]=geometry([edge([0,0],[130,0])]);
    expect(intervals(connection,-.4)).toEqual(intervals(connection,2));
    expect(intervals(connection,.4)).toEqual([[6,10],[66,70],[126,130]]);
    expect(intervals(connection,.4,1,13)).toEqual([[0,10],[57,70],[117,130]]);
    expect(intervals(connection,.4,1,26)).toEqual([[0,10],[44,70],[104,130]]);
    const [negativePhase]=geometry([edge([0,0],[130,0])],new Map([['0,0>130,0',-10]]));
    expect(intervals(negativePhase,0)).toEqual(intervals(connection,.4));
    expect(intervals(negativePhase,0,2)[0]).toEqual([8,10]);
  });
  it('snapshots only the supplied directed edges without changing their coordinates or route state',()=>{
    const edges=[edge([0,0],[10,0]),edge([10,0],[0,0],true)];
    const before=JSON.stringify(edges),distances=new Map([['0,0>10,0',12]]),selectedEdges=new Set(['0,0>10,0']);
    const connections=createQuestPathPulseGeometry({edges,point,distances,selectedEdges,highlightRoute:true});
    expect(JSON.stringify(edges)).toBe(before);
    expect([...distances]).toEqual([['0,0>10,0',12]]);
    expect([...selectedEdges]).toEqual(['0,0>10,0']);
    expect(connections.map(c=>[c.key,c.category])).toEqual([['0,0>10,0','normal-active'],['10,0>0,0','portal-quiet']]);
    edges[0].from[0]=99;distances.set('0,0>10,0',99);selectedEdges.clear();
    expect(connections[0]).toMatchObject({from:[0,0],to:[10,0],phase:12,category:'normal-active'});
    expect(Reflect.set(connections[0].from,0,99)).toBe(false);
    expect(Reflect.set(connections[0].bounds,'minX',99)).toBe(false);
    expect(Reflect.set(connections[0].samples,0,99)).toBe(false);
    expect(Reflect.set(connections[0],'phase',99)).toBe(false);
    expect(Reflect.set(connections,0,connections[1])).toBe(false);
    expect(geometry([edge([0,0],[10,0],true)])[0].category).toBe('portal-active');
  });
  it('uses the source forest’s portal distance so reverse portal motion meets its following edge',()=>{
    const edges=[edge([8,6],[0,0],true),edge([0,0],[-10,0])];
    const distances=questPathFlowDistances({edges,point,starts:[[8,6]]});
    const [portal,next]=geometry(edges,distances);
    expect(next.phase).toBe(portal.length);
    const moving=questPathPulseSubcurve(portal,0,1);
    expect(moving.from).toEqual([8,6]);
    expect(moving.to[0]).toBeLessThan(8);
    expect(moving.to[1]).toBeLessThan(6);
    const seconds=(portal.length+2)/25;
    const arriving=questPathPulseSubcurve(portal,...intervals(portal,seconds)[0]);
    const departing=questPathPulseSubcurve(next,...intervals(next,seconds)[0]);
    expect(arriving.to).toEqual([0,0]);
    expect(departing.from).toEqual(arriving.to);
    expect(departing.to[0]).toBeCloseTo(-2);
    expect(departing.to[1]).toBe(0);
  });
});

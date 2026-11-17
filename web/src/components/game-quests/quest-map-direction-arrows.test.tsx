// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import type {Coordinate} from '@cerebro/core/domain/game-quests';
import type {QuestFlowEdge} from '@cerebro/core/domain/game-quests/path-flow';
import {QuestMapDirectionArrows} from './quest-map-direction-arrows';

const edges:QuestFlowEdge[]=[{from:[0,0],to:[50,0],portal:false},{from:[50,0],to:[100,0],portal:false},{from:[100,0],to:[200,50],portal:true}];
const point=(coordinate:Coordinate)=>coordinate;
function render(scale=1,highlightRoute=false){const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<svg><QuestMapDirectionArrows edges={edges} point={point} scale={scale} highlightRoute={highlightRoute} routeEdges={new Set(['0,0>50,0'])}/></svg>);return host;}
describe('quest map direction arrows',()=>{
  it('animates screen-sized chevrons along exact native chain paths in their recorded direction',()=>{
    const host=render(),chains=[...host.querySelectorAll('[data-flow-chain]')];
    expect(chains.map(chain=>chain.getAttribute('data-edge-indices'))).toEqual(['0,1','2']);
    expect([...host.querySelectorAll('defs path')].map(path=>path.getAttribute('d'))).toEqual(['M0,0 L50,0 L100,0','M100,0 Q156,13 200,50']);
    const motion=host.querySelector('animateMotion')!;
    expect(motion.getAttribute('rotate')).toBe('auto');
    expect(motion.getAttribute('dur')).toBe('4s');
    expect(motion.getAttribute('repeatCount')).toBe('indefinite');
    expect(motion.querySelector('mpath')?.getAttribute('href')).toMatch(/^#/);
    expect(host.querySelector('[data-flow-glyph]')?.getAttribute('transform')).toBe('scale(1)');
    expect(host.querySelector('[data-route-edge]')).toBeNull();
    expect(host.querySelector('filter')).toBeNull();
  });
  it('splits selected runs so highlighted chevrons cannot extend onto unselected edges',()=>{
    const host=render(1,true),chains=[...host.querySelectorAll('[data-flow-chain]')];
    expect(chains.map(chain=>chain.getAttribute('data-edge-indices'))).toEqual(['0','1','2']);
    expect(chains.map(chain=>chain.getAttribute('data-flow-selected'))).toEqual(['true','false','false']);
  });
  it('uses static direction on tiny chains and bounds moving heads on very long connections',()=>{
    const tiny=render(.1);
    expect(tiny.querySelector('animateMotion')).toBeNull();
    expect(tiny.querySelectorAll('[data-flow-static]')).toHaveLength(2);
    expect(tiny.querySelector('[data-flow-static]')?.getAttribute('data-small')).toBe('true');
    const host=document.createElement('div');
    host.innerHTML=renderToStaticMarkup(<svg><QuestMapDirectionArrows edges={[{from:[0,0],to:[100000,0],portal:true}]} point={point} scale={1} highlightRoute={false} routeEdges={new Set()}/></svg>);
    expect(host.querySelectorAll('[data-flow-arrow]')).toHaveLength(12);
    expect(host.querySelector('[data-flow-static]')).not.toBeNull();
    expect(host.querySelector('[data-map-directions]')?.getAttribute('aria-hidden')).toBe('true');
  });
});

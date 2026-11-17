// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {loadQuestMap} from '@cerebro/core/data/game-quests';
import {gameText,type QuestApplication} from '@cerebro/core/domain/game-quests';
import {QuestModifierGroups} from './quest-modifier-groups';

vi.mock('next/link',()=>({default:({prefetch,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>;}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
async function fixture(){const map=(await loadQuestMap('a09_ch01_q02'))!;return {applications:map.tiles.find(tile=>tile.coordinate.join(',')==='16,31')!.applications,questId:map.questId,sourceHash:map.sourceHash,shareUrl:'/quests/a09_ch01_q02?node=16%2C31',choose:vi.fn(),positionLabel:()=> 'Guillotine 2099'};}
async function render(props:React.ComponentProps<typeof QuestModifierGroups>){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<QuestModifierGroups {...props}/>));return host;}
async function click(element:Element){await act(async()=>{(element as HTMLElement).click();await new Promise(resolve=>setTimeout(resolve,0));});}
function media(initial=false){let matches=initial;const listeners=new Set<()=>void>();vi.stubGlobal('matchMedia',vi.fn(()=>({get matches(){return matches;},addEventListener:(_type:string,callback:()=>void)=>listeners.add(callback),removeEventListener:(_type:string,callback:()=>void)=>listeners.delete(callback)})));return {listeners,change:async(value:boolean)=>act(async()=>{matches=value;listeners.forEach(listener=>listener());})};}

describe('encounter modifier inspector',()=>{
  it('tabs between exact scopes while retaining every application once and a single expanded desktop row',async()=>{
    media();const props=await fixture(),host=await render(props);
    expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(13);
    expect([...host.querySelectorAll('[data-quest-application]')].map(row=>row.getAttribute('data-quest-application')).sort()).toEqual(props.applications.map(application=>application.id).sort());
    const linked=host.querySelector<HTMLButtonElement>('[role="tab"][data-modifier-tab="Link"]')!,global=host.querySelector<HTMLButtonElement>('[role="tab"][data-modifier-tab="Global"]')!;
    expect(linked.textContent).toContain('5');expect(global.textContent).toContain('8');expect(linked.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector<HTMLElement>('[data-modifier-scope="Global"]')!.hidden).toBe(true);
    const rows=host.querySelectorAll<HTMLDetailsElement>('[data-modifier-scope="Link"] [data-quest-application]');
    await click(rows[0].querySelector('summary')!);await click(rows[1].querySelector('summary')!);
    expect(rows[0].open).toBe(false);expect(rows[1].open).toBe(true);
    await click(global);
    expect(host.querySelector<HTMLElement>('[data-modifier-scope="Global"]')!.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-modifier-scope="Link"]')!.hidden).toBe(true);
    expect([...host.querySelectorAll('[data-modifier-scope="Global"] summary')].filter(row=>row.textContent==='Health')).toHaveLength(2);
    await act(async()=>global.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
    expect(linked.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(linked);
  });
  it('opens the exact highlighted Global application and retains definition navigation without per-modifier permalinks',async()=>{
    media();const props=await fixture(),target=props.applications.filter(application=>application.name==='Health').at(-1)!;
    const host=await render({...props,selectedApplication:target.id});
    expect(host.querySelector('[data-modifier-tab="Global"]')?.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector<HTMLDetailsElement>(`[data-quest-application="${target.id}"]`)!.open).toBe(true);
    expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(13);
    expect(host.querySelector('a[aria-label^="Link to "]')).toBeNull();
    const defined=props.applications.find(application=>application.definitionHref)!;
    expect(host.querySelector(`[data-quest-application="${defined.id}"] a`)?.getAttribute('href')).toBe(defined.definitionHref);
  });
  it('uses selectable chips and only one visible phone reader, retaining context and exact hidden records',async()=>{
    media(true);const props=await fixture(),host=await render(props);
    expect(host.querySelector('[data-modifier-reader-layout]')).not.toBeNull();
    expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(13);
    expect(host.querySelectorAll('[data-quest-application]:not([hidden])')).toHaveLength(1);
    expect([...host.querySelectorAll('[data-quest-application]')].map(row=>row.getAttribute('data-quest-application')).sort()).toEqual(props.applications.map(application=>application.id).sort());
    const target=props.applications.find(application=>application.name==='Act of War - 2')!;
    const choice=host.querySelector<HTMLButtonElement>(`[data-modifier-choice="${target.id}"]`)!;
    await click(choice);
    const reader=host.querySelector<HTMLElement>(`[data-quest-application="${target.id}"]`)!;
    expect(reader.hidden).toBe(false);expect(reader.textContent).toContain(gameText(target.description));
    expect(choice.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelectorAll('[data-quest-application]:not([hidden])')).toHaveLength(1);
    expect(host.querySelector('[data-shared-modifier-context="5"]')).not.toBeNull();
    await click(host.querySelector('[data-shared-modifier-context="5"] button')!);
    expect(props.choose).toHaveBeenCalledWith(target.sourceCoordinate,true);
    expect(host.querySelector('a[aria-label^="Link to "]')).toBeNull();
  });
  it('preserves selection across responsive changes and cleans up its media subscription',async()=>{
    const screen=media();const props=await fixture(),host=await render(props),target=props.applications.find(application=>application.name==='Down and Out - 1')!;
    await click(host.querySelector(`[data-quest-application="${target.id}"] summary`)!);
    await screen.change(true);
    expect(host.querySelector<HTMLElement>(`[data-quest-application="${target.id}"]`)!.hidden).toBe(false);
    expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(13);
    await screen.change(false);
    expect(host.querySelector<HTMLDetailsElement>(`[data-quest-application="${target.id}"]`)!.open).toBe(true);
    await act(async()=>root?.unmount());root=undefined;expect(screen.listeners.size).toBe(0);
  });
  it('retains unknown scopes and distinct context instead of merging records by display name',async()=>{
    media();const props=await fixture(),base=props.applications[0];
    const applications:QuestApplication[]=[{...base,id:'unknown-a',sourceType:'Future',name:'Same name',amount:1},{...base,id:'unknown-b',sourceType:'Future',name:'Same name',amount:2}];
    const host=await render({...props,applications,selectedApplication:'unknown-b'});
    expect(host.querySelector('[data-modifier-tab="Future"]')?.textContent).toContain('2');
    expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(2);
    expect(host.querySelectorAll('[data-shared-modifier-context]')).toHaveLength(0);
    expect(host.querySelector<HTMLDetailsElement>('[data-quest-application="unknown-b"]')!.open).toBe(true);
    expect(host.textContent).toContain('Quantity 2');
  });
  it('hydrates the desktop server markup into a phone reader without replacing source records',async()=>{
    media(true);const props=await fixture(),host=document.createElement('div');document.body.append(host);
    host.innerHTML=renderToString(<QuestModifierGroups {...props}/>);
    const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
    await act(async()=>{root=hydrateRoot(host,<QuestModifierGroups {...props}/>);});
    expect(host.querySelector('[data-modifier-reader-layout]')).not.toBeNull();
    expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(13);
    expect(errors.mock.calls.some(args=>String(args[0]).match(/hydration|did not match|server rendered/i))).toBe(false);
  });
});

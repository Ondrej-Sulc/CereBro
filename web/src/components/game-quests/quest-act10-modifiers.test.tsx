// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import type {AnchorHTMLAttributes} from 'react';
import {expect,it,vi} from 'vitest';
import {loadQuestMap} from '@cerebro/core/data/game-quests';
import {act10Data} from '@cerebro/core/data/game-quests/act10';
import {act10ModifierIcons,resolveAct10ModifierIcon} from '@cerebro/core/data/game-quests/act10-modifier-icons';
import {gameText} from '@cerebro/core/domain/game-quests';
import {QuestNodeModifierIcon} from './quest-node-modifier-icon';
import {QuestApplicationDetails} from './quest-application-details';
import {QuestMapExplorer} from './quest-map-explorer';

vi.mock('next/link',()=>({default:({prefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>;}}));

it('shows the actual Act 10 names, descriptions and independent observation date in the sidebar',async()=>{
  const map=(await loadQuestMap('epilogue_ch01_q01'))!,before=JSON.stringify(map),host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestMapExplorer map={map} initialNode="12,12"/>);
  expect(host.querySelectorAll('[data-quest-application]')).toHaveLength(10);
  expect(host.textContent).toContain('Brace For Impact (Punish Special) - 1');
  expect(host.textContent).toContain('disables it for 20 seconds');
  expect(host.textContent).not.toContain('Modifier details unavailable');
  expect(host.querySelector('[data-modifier-coverage]')).toBeNull();
  expect(host.querySelector('[data-modifier-definition-date] time')?.textContent).toBe('16 Nov 2026');
  expect(host.querySelectorAll('[data-game-modifier-icon]').length).toBeGreaterThan(0);
  expect(JSON.stringify(map)).toBe(before);
});

it('uses an additional outline for a real source-bound Act 10 application',async()=>{
  for(const id of Object.keys(act10Data.maps)){
    const map=(await loadQuestMap(id))!;
    const application=map.tiles.flatMap(tile=>tile.applications).find(a=>resolveAct10ModifierIcon(a.iconKey));
    if(!application)continue;
    const icon=resolveAct10ModifierIcon(application.iconKey)!,host=document.createElement('div');
    host.innerHTML=renderToStaticMarkup(<QuestApplicationDetails application={application} questId={id} sourceHash={map.sourceHash} shareUrl={'/quests/'+id} choose={()=>{}}/>);
    expect(host.querySelector('[data-act10-modifier-icon]')?.getAttribute('data-game-modifier-icon')).toBe(icon.key);
    expect(host.textContent).toContain(gameText(application.name));
    expect(host.textContent).toContain(gameText(application.description));
    return;
  }
  throw new Error('The actual observation must contain an additional native icon application');
});

it('renders every additional native outline decoratively and refuses arbitrary URLs',()=>{
  for(const icon of act10ModifierIcons){
    const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<QuestNodeModifierIcon iconKey={icon.key} size={19}/>);
    const element=host.querySelector<HTMLElement>('[data-act10-modifier-icon]')!;
    expect(element.getAttribute('aria-hidden')).toBe('true');expect(element.textContent).toBe('');
    expect(element.hasAttribute('role')).toBe(false);expect(element.hasAttribute('tabindex')).toBe(false);
    expect(element.style.width).toBe('19px');expect(element.style.maskImage).toContain(icon.src);
  }
  expect(renderToStaticMarkup(<QuestNodeModifierIcon iconKey="https://example.com/icon.svg"/>)).toBe('');
});

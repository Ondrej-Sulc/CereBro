// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { act, type AnchorHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { expect,it,vi } from "vitest";
import { loadQuestOpponentMatches } from "@cerebro/core/data/game-quests/opponent-lookup";
import { findQuest } from "@cerebro/core/data/game-quests";
import { getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import { QuestOpponentResults } from "./quest-opponent-results";
import { QuestOpponentSort } from "./quest-opponent-sort";
const navigation=vi.hoisted(()=>({push:vi.fn<(href:string)=>void>()}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation}));

vi.mock("next/link",()=>({default:({prefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>;}}));
const render=async(filters={})=>{const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<QuestOpponentResults gameId="absorbingman" matches={await loadQuestOpponentMatches("absorbingman")} filters={filters}/>);return host;};

it("renders compact exact encounter destinations with prominent numbers and meaningful collection names",async()=>{
  const host=await render();
  expect(host.querySelectorAll('[data-quest-opponent-result]')).toHaveLength(5);
  expect(host.textContent).toContain('9.2.4');expect(host.textContent).toContain('Apostasy');expect(host.textContent).toContain('The Epoch of Pain');
  expect(host.textContent).not.toMatch(/Character data|gameId|recorded routes|recorded encounter|placed encounters/i);
  expect(host.textContent).not.toMatch(/\b\d+,\d+\b/);
  const links=[...host.querySelectorAll<HTMLAnchorElement>('[data-quest-opponent-result] a')];
  expect(links).toHaveLength(5);expect(links.every(a=>new URL(a.href).searchParams.has('node'))).toBe(true);
});

it("preserves active filters in category links and form controls",async()=>{
  const host=await render({query:'pain',rarity:'7',section:'Special'});
  expect(host.querySelectorAll('[data-quest-opponent-result]')).toHaveLength(2);
  const form=host.querySelector('form')!;
  expect(form.querySelector<HTMLInputElement>('[name="gameId"]')?.value).toBe('absorbingman');
  expect(form.querySelector<HTMLInputElement>('[name="category"]')?.value).toBe('Special');
  expect(form.querySelector<HTMLInputElement>('[name="q"]')?.value).toBe('pain');
  const story=host.querySelector<HTMLAnchorElement>('nav a[href*="category=Story"]')!;
  expect(new URL(story.href).searchParams.get('q')).toBe('pain');expect(new URL(story.href).searchParams.get('rarity')).toBe('7');
  expect(form.querySelector<HTMLInputElement>('[name="rarity"]')?.value).toBe('7');
  expect(host.querySelector('nav[aria-label="Filter by star level"] a[aria-current="page"]')?.textContent).toContain('7★');
});

it("provides filter recovery without implying a champion is unavailable in the game",async()=>{
  const host=await render({bossOnly:true});
  expect(host.querySelectorAll('[data-quest-opponent-result]')).toHaveLength(0);
  expect(host.textContent).toContain('No quests match these filters');
  expect(host.querySelector('a[data-clear-opponent-filters]')?.getAttribute('href')).toBe('/quests/encounters?gameId=absorbingman');
  expect(host.textContent).not.toContain('does not appear');
});

it("identifies approximate NPC region results and links to regions rather than inventing fixed fights",async()=>{
  const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<QuestOpponentResults gameId="ex_agentvenom" matches={await loadQuestOpponentMatches("ex_agentvenom")} filters={{}}/>);
  expect(host.textContent).toContain("Encounter region");expect(host.textContent).toContain("exact trigger tile can vary");
  expect(host.textContent).not.toContain("1.3.1");
  const links=[...host.querySelectorAll<HTMLAnchorElement>('[data-quest-opponent-result] a')];
  expect(links.length).toBeGreaterThan(0);expect(links.some(link=>new URL(link.href).searchParams.has('region'))).toBe(true);
});

it("retains distinct matches in one quest and labels only the actual final boss",async()=>{
  const first=(await loadQuestOpponentMatches("absorbingman"))[0];
  const second={...first,key:"second-match",href:"/quests/a09_ch02_q04?node=1%2C1",rarity:6,boss:true};
  const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<QuestOpponentResults gameId="absorbingman" matches={[first,second]} filters={{}}/>);
  expect(host.querySelectorAll('[data-quest-opponent-result]')).toHaveLength(1);
  expect(host.querySelectorAll('[data-quest-opponent-result] a')).toHaveLength(2);
  expect(host.textContent).toContain("Match 1");expect(host.textContent).toContain("Match 2");
  expect([...host.querySelectorAll('[data-quest-opponent-result] a')].filter(a=>a.textContent?.includes('Boss'))).toHaveLength(1);
});

it("uses the exact parent Act artwork for Story and Special encounter groups",async()=>{
  const matches=await loadQuestOpponentMatches("absorbingman");
  const host=await render();
  const story=findQuest("a09_ch02_q04")!;
  const special=matches.filter(match=>match.quest.section==="Special").map(match=>findQuest(match.quest.id)!);
  const expected=[
    ["Act 9",getGroupMenuArtwork([story],{kind:"act",id:story.hierarchy[0].actId})],
    ["The Epoch of Pain",getGroupMenuArtwork(special)],
  ] as const;
  for(const [title,art] of expected){
    expect(art?.role).toBe("act");
    const group=host.querySelector(`section[aria-label="${title}"]`)!;
    const decorative=group.querySelector('[data-quest-opponent-group-art]')!;
    expect(decorative?.getAttribute('aria-hidden')).toBe('true');
    const image=decorative?.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('');
    const source=image?.getAttribute('src')??'';
    expect(new URL(source,'https://cerebro.test').searchParams.get('url')??source).toBe(art?.url);
  }
});

it.each(["missing quest","mismatched act"])("keeps the group and map link when artwork cannot bind: %s",async reason=>{
  const match=(await loadQuestOpponentMatches("absorbingman"))[0];
  const quest={...match.quest,...(reason==="missing quest"?{id:"unbound-quest"}:{actIndex:99})};
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestOpponentResults gameId="absorbingman" matches={[{...match,quest}]} filters={{}}/>);
  expect(host.querySelector('[data-quest-opponent-group-art]')).toBeNull();
  expect(host.querySelector('[data-quest-opponent-result] a')?.getAttribute('href')).toBe(match.href);
  expect(host.textContent).toContain(quest.name);
});

it("shows contextual quest counts beside quick filters and preserves search, category and sorting",async()=>{
  const host=await render({query:'pain',rarity:'6',section:'Special',sort:'rarity'});
  const rarity=host.querySelector<HTMLElement>('nav[aria-label="Filter by star level"]')!;
  expect(rarity).not.toBeNull();
  const seven=[...rarity.querySelectorAll<HTMLAnchorElement>('a')].find(link=>link.textContent?.startsWith('7★'))!;
  expect(seven.textContent).toMatch(/7★\s*2/);
  const six=[...rarity.querySelectorAll<HTMLAnchorElement>('a')].find(link=>link.textContent?.startsWith('6★'))!;
  expect(six.textContent).toMatch(/6★\s*0/);
  expect(six.getAttribute('aria-current')).toBe('page');
  const change=new URL(seven.href);
  expect(change.searchParams.get('q')).toBe('pain');expect(change.searchParams.get('category')).toBe('Special');
  expect(change.searchParams.get('rarity')).toBe('7');expect(change.searchParams.get('sort')).toBe('rarity');expect(change.searchParams.has('page')).toBe(false);
  const boss=host.querySelector<HTMLAnchorElement>('[data-boss-filter]')!;
  expect(boss.textContent).toMatch(/Bosses only\s*0/);
  expect(new URL(boss.href).searchParams.get('sort')).toBe('rarity');
  const select=host.querySelector<HTMLSelectElement>('select[name="sort"]')!;
  expect(select.value).toBe('rarity');expect(select.getAttribute('form')).toBe(host.querySelector('form')?.id);
  expect(host.querySelector('a[href*="category=Story"]')?.getAttribute('href')).toContain('sort=rarity');
});

it("keeps active zero-count filters clearable and shows truthful collapsible group counts",async()=>{
  const empty=await render({bossOnly:true,sort:'boss'});
  const toggle=empty.querySelector<HTMLAnchorElement>('[data-boss-filter]')!;
  expect(toggle.getAttribute('aria-current')).toBe('page');expect(toggle.textContent).toMatch(/0/);
  expect(new URL(toggle.href).searchParams.get('role')).toBe('');expect(new URL(toggle.href).searchParams.get('sort')).toBe('boss');
  const host=await render();
  const story=host.querySelector('section[aria-label="Act 9"]')!;
  const disclosure=story.querySelector('details')!;
  expect(disclosure.hasAttribute('open')).toBe(true);
  expect(disclosure.querySelector('summary')?.textContent).toMatch(/3\s+quests/);
  disclosure.open=false;
  expect(disclosure.hasAttribute('open')).toBe(false);
  expect(disclosure.querySelectorAll('[data-quest-opponent-result] a')).toHaveLength(3);
  const source=(await loadQuestOpponentMatches('absorbingman'))[0];
  const many=Array.from({length:49},(_,index)=>({...source,key:`paged:${index}`,href:`/quests/quest-${index}?node=1%2C1`,quest:{...source.quest,id:`quest-${index}`,questIndex:index+1}}));
  const paged=document.createElement('div');paged.innerHTML=renderToStaticMarkup(<QuestOpponentResults gameId="absorbingman" matches={many} filters={{page:'2'}}/>);
  expect(paged.querySelector('section[aria-label="Act 9"] summary')?.textContent).toMatch(/24 of 49\s+quests/);
  expect(paged.querySelectorAll('[data-quest-opponent-result]')).toHaveLength(24);
});

it("shows recorded rank/level after stars and leaves unavailable builds absent",async()=>{
  const first=(await loadQuestOpponentMatches("absorbingman"))[0];
  const matches=[{...first,key:'known',rank:3,level:45},{...first,key:'unknown',rank:undefined,level:undefined},{...first,key:'invalid',rank:0,level:45}];
  const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<QuestOpponentResults gameId="absorbingman" matches={matches} filters={{}}/>);
  const badges=[...host.querySelectorAll('[data-encounter-build]')];
  expect(badges).toHaveLength(1);expect(badges[0].textContent).toBe('R3/L45');
  expect(badges[0].parentElement?.textContent).toMatch(/7★\s*R3\/L45/);
  expect(host.textContent).not.toContain('R0');expect(host.textContent).not.toContain('undefined');
});

it("applies sorting immediately with the edited query and resets pagination",async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);navigation.push.mockClear();
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<><form id="sort-test-form"><input name="q" defaultValue="original"/></form><QuestOpponentSort value="quest" formId="sort-test-form" options={[{value:'quest',label:'Quest order',href:'/quests/encounters?gameId=absorbingman&category=Story&rarity=7&role=boss&page=2&sort=quest'},{value:'rarity',label:'Lowest star level',href:'/quests/encounters?gameId=absorbingman&category=Story&rarity=7&role=boss&page=2&sort=rarity'}]}/></>));
    host.querySelector<HTMLInputElement>('[name=q]')!.value='new query';
    const select=host.querySelector<HTMLSelectElement>('select')!;select.value='rarity';
    await act(async()=>select.dispatchEvent(new Event('change',{bubbles:true})));
    const target=new URL(navigation.push.mock.calls[0][0],'https://cerebro.test');
    expect(target.searchParams.get('sort')).toBe('rarity');expect(target.searchParams.get('q')).toBe('new query');expect(target.searchParams.has('page')).toBe(false);
    expect(target.searchParams.get('category')).toBe('Story');expect(target.searchParams.get('rarity')).toBe('7');expect(target.searchParams.get('role')).toBe('boss');
  }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});

// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import { expect,it,vi } from "vitest";
import { loadQuestOpponentMatches } from "@cerebro/core/data/game-quests/opponent-lookup";
import { QuestOpponentResults } from "./quest-opponent-results";

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
  expect(host.querySelector('details[open]')).not.toBeNull();
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

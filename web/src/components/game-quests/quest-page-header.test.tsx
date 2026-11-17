// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";
import { findQuest,loadQuestMap } from "@cerebro/core/data/game-quests";
import { getQuestMenuArtwork,getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import { getBossPreview } from "@cerebro/core/data/game-quests/permanent";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { QuestPageHeader } from "./quest-page-header";
import { projectQuestPortraits } from "@/lib/game-quests/presentation";

vi.mock("next/link", () => ({ default: ({prefetch,...props}: AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean}) => {void prefetch;return <a {...props}/>;} }));
vi.mock("next/image", () => ({ default: ({ fill, priority, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  void fill; void priority;
  // eslint-disable-next-line @next/next/no-img-element -- Native image mock preserves decorative alt semantics.
  return <img alt={alt ?? ""} {...props}/>;
} }));
const render = (id: string, stale = false) => {
  const quest = findQuest(id)!;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestPageHeader quest={stale ? { ...quest, sourceHash: "changed" } : quest}/>);
  return host;
};

it.each(["pve_may2023_shootingstar_6","a05_ch03_q03","realm3"])("keeps %s's exact artwork at its intrinsic aspect ratio",id=>{
  const q=findQuest(id)!,art=getQuestMenuArtwork(q)!;
  expect(art).not.toBeNull();
  const host=render(id),image=[...host.querySelectorAll('header [data-quest-category-art] img')].find(image=>image.getAttribute('src')===art.url)!;
  expect(image).toBeDefined();
  expect(image.getAttribute('src')).toBe(art.url);
  expect(image.getAttribute('width')).toBe(String(art.width));
  expect(image.getAttribute('height')).toBe(String(art.height));
  expect(image.getAttribute('alt')).toBe('');
  expect(image.closest('h1')).toBeNull();
});

it("layers exact Act and Chapter art and lists all three Consul bosses without the selected map defender",()=>{
  const q=findQuest('a09_ch03_q03')!,bosses=getBossPreview(q)!.bosses;
  const portraits:Record<string,QuestPortrait>=Object.fromEntries([...bosses.map(b=>[b.gameId,{name:b.champion?.name??b.name,imageUrl:`/test/${b.gameId}.png`,href:`/champions/${b.champion?.slug}`,className:'Boss',color:'#abc'}]),['iceman',{name:'Iceman',imageUrl:'/test/iceman.png',href:'/champions/iceman',className:'Mutant',color:'#abc'}]]);
  const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<QuestPageHeader quest={q} portraits={portraits}/>);
  const art=[...host.querySelectorAll('[data-quest-category-art] img')].map(image=>image.getAttribute('src'));
  for(const kind of ['act','chapter'] as const){
    const image=getGroupMenuArtwork([q],{kind,id:kind==='act'?q.hierarchy[0].actId:q.hierarchy[0].chapterId})!;
    expect(art).toContain(image.url);
  }
  expect(new Set(art).size).toBe(art.length);
  expect([...host.querySelectorAll('[data-quest-header-boss]')].map(row=>row.getAttribute('data-quest-header-boss'))).toEqual(bosses.map(b=>b.gameId));
  expect(host.querySelector('[data-quest-header-boss="iceman"]')).toBeNull();
  expect(host.querySelector('ul[aria-label="Bosses"]')).not.toBeNull();
  for(const boss of bosses){
    const row=host.querySelector(`[data-quest-header-boss="${boss.gameId}"]`)!;
    expect(row.textContent).toContain(boss.champion!.name);
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/champions/'+boss.champion!.slug);
  }
});

it("preserves distinct native NPC bosses and never links them through a playable alias",()=>{
  const q=findQuest('me_crucible_ch01_q01')!,bosses=getBossPreview(q)!.bosses,host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestPageHeader quest={q} portraits={{kang_boss_tech:{name:'Playable Kang alias',imageUrl:'/test/playable-kang.png',href:'/champions/kang',className:'Tech',color:'#abc'}}}/>);
  expect(host.querySelectorAll('[data-quest-header-boss]')).toHaveLength(bosses.length);
  for(const boss of bosses){
    const row=host.querySelector(`[data-quest-header-boss="${boss.gameId}"]`)!;
    expect(row.querySelector('img')).not.toBeNull();
    expect(row.querySelector('a')).toBeNull();
    expect(row.textContent).toContain(boss.name);
  }
  expect(host.textContent).not.toContain('Playable Kang alias');
});

it("uses an explicit final boss from the matching map when the menu preview is empty",async()=>{
  const q=findQuest('me_pain2024_fin_ques2')!,map=(await loadQuestMap(q.id))!;
  expect(getBossPreview(q)?.bosses).toHaveLength(0);
  const before=JSON.stringify(map),host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestPageHeader quest={q} map={map}/>);
  expect([...host.querySelectorAll('[data-quest-header-boss]')].map(row=>row.getAttribute('data-quest-header-boss'))).toEqual(['ares']);
  expect(host.querySelector('[data-quest-header-boss="ares"] a')).toBeNull();
  expect(JSON.stringify(map)).toBe(before);
  host.innerHTML=renderToStaticMarkup(<QuestPageHeader quest={q} map={{...map,sourceHash:'mismatched'}}/>);
  expect(host.querySelector('[data-quest-header-boss]')).toBeNull();
  host.innerHTML=renderToStaticMarkup(<QuestPageHeader quest={{...q,sourceHash:'stale'}} map={map}/>);
  expect(host.querySelector('[data-quest-header-boss]')).toBeNull();
});

it("links an exact DB-bound Ares while keeping unrelated and invalid NPC portraits unlinked", async () => {
  const q = findQuest("me_pain2024_fin_ques2")!, map = (await loadQuestMap(q.id))!, before = JSON.stringify(map);
  const portraits = projectQuestPortraits(map, [{ id: 809, gameId: "ares", name: "Ares", slug: "ares", class: "SKILL", images: { p_128: "/test/ares.png" } }]);
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestPageHeader quest={q} map={map} portraits={portraits} />);
  expect(host.querySelector('[data-quest-header-boss="ares"] a')?.getAttribute("href")).toBe("/champions/ares");
  const invalid: QuestPortrait = { name: "Wrong alias", href: "/champions/kang", imageUrl: "/test/kang.png", className: "Tech", color: "blue", championBinding: { id: 809, gameId: "kang" } };
  host.innerHTML = renderToStaticMarkup(<QuestPageHeader quest={q} map={map} portraits={{ ares: invalid }} />);
  expect(host.querySelector('[data-quest-header-boss="ares"] a')).toBeNull();
  expect(host.textContent).not.toContain("Wrong alias"); expect(host.querySelector('img[src="/test/kang.png"]')).toBeNull();
  expect(JSON.stringify(map)).toBe(before);
});

it("links Grandmaster through the exact native boss ID without turning the snapshot into a playable identity", () => {
  const quest = findQuest("a06_ch04_q06")!, bosses = getBossPreview(quest)!.bosses, before = JSON.stringify(bosses);
  expect(bosses.find(boss => boss.gameId === "grandmaster_boss")!.champion).toBeNull();
  const portraits = projectQuestPortraits({ encounters: bosses, rewards: { fixedChampions: [] } }, [{ id: 810, gameId: "grandmaster_boss", name: "Grandmaster", slug: "grandmaster-boss", class: "SUPERIOR", images: { p_128: "/test/grandmaster.png" } }]);
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestPageHeader quest={quest} portraits={portraits} />);
  expect(host.querySelector('[data-quest-header-boss="grandmaster_boss"] a')?.getAttribute("href")).toBe("/champions/grandmaster-boss");
  expect(JSON.stringify(bosses)).toBe(before);
});

it("keeps the Story quest identity and links to its exact Act and Chapter", () => {
  const host = render("a05_ch03_q03");
  expect(host.querySelector("h1")?.textContent).toBe("Dire Warning");
  expect(host.querySelector('[data-quest-number]')?.textContent).toBe("5.3.3");
  const links = [...host.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Quest location"] a')];
  expect(links.map(a => a.getAttribute("href"))).toContain("/quests?category=Story&act=act5&chapter=a05_ch03");
  expect(host.textContent).toContain("The Struggle");
  expect(host.textContent).not.toMatch(/Chapter artwork|Act artwork|sourceHash/);
});

it("uses the Special collection without exposing the single native Stars wrapper", () => {
  const host = render("realm3");
  expect(host.querySelector("h1")?.textContent).toBe("DESPAIR GIVEN FORM");
  expect(host.textContent).toContain("Abyss of Legends");
  expect(host.textContent).not.toMatch(/1 Stars|artwork/);
  expect(host.querySelector('a[href="/quests?category=Special&collection=realm3_abyss"]')).not.toBeNull();
});

it("retains the title, number and hierarchy when artwork is unavailable", () => {
  const host = render("a05_ch03_q03", true);
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector('[data-quest-header-boss]')).toBeNull();
  expect(host.querySelector("h1")?.textContent).toBe("Dire Warning");
  expect(host.querySelector('[data-quest-number]')?.textContent).toBe("5.3.3");
  expect(host.querySelector('nav[aria-label="Quest location"]')).not.toBeNull();
});

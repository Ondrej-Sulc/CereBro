// @vitest-environment jsdom
import {renderToStaticMarkup} from "react-dom/server";
import type {ImgHTMLAttributes} from "react";
import {expect,it,vi} from "vitest";
import {findQuest,questCatalog} from "@cerebro/core/data/game-quests";
import {getGroupMenuArtwork} from "@cerebro/core/data/game-quests/menu-art";
import {getQuestArtwork} from "@cerebro/core/data/game-quests/artwork";
import {QuestExplorerHeader} from "./quest-explorer-header";

vi.mock("next/image",()=>({default:({priority,alt,...props}:ImgHTMLAttributes<HTMLImageElement>&{priority?:boolean})=>{
  void priority;
  // eslint-disable-next-line @next/next/no-img-element -- Preserve native sizing and decorative semantics at the framework boundary.
  return <img alt={alt??""} {...props}/>;
}}));

it("combines four distinct Story and Special posters without repeating a stretched background",()=>{
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestExplorerHeader quests={questCatalog} totalCount={234} mappedCount={230}/>);
  expect(host.querySelector('h1')?.textContent).toBe('Quest explorer');
  const images=[...host.querySelectorAll('[data-poster-section] img')];
  expect(images).toHaveLength(4);
  expect(new Set(images.map(image=>image.getAttribute('src'))).size).toBe(4);
  for(const image of images){
    expect(image.getAttribute('alt')).toBe('');
    expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    expect(image.closest('[aria-hidden="true"]')).not.toBeNull();
  }
  expect(new Set([...host.querySelectorAll('[data-poster-section]')].map(row=>row.getAttribute('data-poster-section')))).toEqual(new Set(['Story','Special']));
  expect(host.textContent).toContain('234 permanent quests');
  expect(host.textContent).toContain('230 with maps');
  const background=host.querySelector<HTMLImageElement>('[data-explorer-atmosphere] img')!;
  expect(background).not.toBeNull();
  expect(questCatalog.some(q=>getQuestArtwork(q.id)?.url===background.getAttribute('src'))).toBe(true);
  expect(images.some(image=>image.getAttribute('src')===background.getAttribute('src'))).toBe(false);
});

it("keeps a selected collection's artwork first and uses only that collection's verified art",()=>{
  const q=findQuest('me_crucible_ch01_q01')!,quests=questCatalog.filter(other=>other.containerSetId===q.containerSetId);
  const art=getGroupMenuArtwork(quests,{kind:'act',id:q.hierarchy[0].actId})!;
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestExplorerHeader quests={quests} primaryArtwork={art} totalCount={234} mappedCount={230}/>);
  const sources=[...host.querySelectorAll('[data-poster-section] img')].map(image=>image.getAttribute('src'));
  expect(sources[0]).toBe(art.url);
  expect(new Set(sources).size).toBe(sources.length);
  expect(host.querySelectorAll('[data-poster-section="Story"]')).toHaveLength(0);
  expect(sources.length).toBeLessThanOrEqual(4);
});

it("does not repeat the quest count when every quest has a map",()=>{
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestExplorerHeader quests={questCatalog} totalCount={234} mappedCount={234}/>);
  expect(host.textContent).toContain('234 permanent quests');
  expect(host.textContent).toContain('All with maps');
  expect(host.textContent).not.toContain('234 with maps');
});

it("retains the title and counts when no verified art is available",()=>{
  const quests=[{...findQuest('a06_ch02_q01')!,sourceHash:'stale'}];
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<QuestExplorerHeader quests={quests} totalCount={1} mappedCount={0}/>);
  expect(host.querySelectorAll('img')).toHaveLength(0);
  expect(host.querySelector('h1')?.textContent).toBe('Quest explorer');
  expect(host.textContent).toContain('1 permanent quest');
});

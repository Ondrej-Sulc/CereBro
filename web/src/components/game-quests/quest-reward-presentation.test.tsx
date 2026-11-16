// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes, type ReactNode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findQuest } from "@cerebro/core/data/game-quests";
import { getParentRewardRecord } from "@cerebro/core/data/game-quests/rewards";
import { projectRewardRecord, type QuestRewardView } from "@/lib/game-quests/presentation";
import { QuestRewards } from "./quest-rewards";

vi.mock("next/image", () => ({ default: ({alt = '', ...props}: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", {...props,alt}) }));

let mounted: Root | undefined;
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(async () => {
  if (mounted) await act(async () => mounted!.unmount());
  mounted = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function render(element:ReactNode) {
  const host = document.createElement('div'); document.body.append(host);
  mounted = createRoot(host);
  await act(async () => mounted!.render(element));
  return host;
}
const reward = (overrides:Partial<QuestRewardView>={}):QuestRewardView => ({ key:'gold',scope:'firstCompletionRewards',name:'Gold',quantity:750000,type:'item',sourceType:'res',token:'sc',imageUrl:'https://example.com/gold.png',href:null,...overrides });

it('defaults to compact tiles while preserving exact chapter quantities and separate reward scopes', async () => {
  const q = findQuest('a06_ch02_q01')!;
  const record = getParentRewardRecord([q], 'chapter', 'a06_ch02')!;
  const rewards = projectRewardRecord(record);
  const host = await render(<QuestRewards rewards={rewards} title="Chapter rewards"/>);
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Show reward names"]')?.checked).toBe(false);
  expect(host.querySelectorAll('[data-quest-reward]')).toHaveLength(rewards.filter(r=>!r.recordedOutcome).length);
  expect(host.querySelector('[data-quest-reward-scope="firstCompletionRewards"]')?.textContent).toContain('First completion');
  expect(host.querySelector('[data-quest-reward-scope="masteryCompletionRewards"]')?.textContent).toContain('100% exploration');
  const gold = [...host.querySelectorAll('[data-quest-reward]')].find(tile => tile.querySelector('button')?.getAttribute('aria-label')?.includes('Gold'))!;
  expect(gold.textContent).toContain('×750,000');
  expect(gold.querySelector('[data-reward-name]')).toBeNull();
  expect(host.textContent).not.toContain('Where to earn');
});

it('remembers names across remounts and keeps multiple reward sections synchronized', async () => {
  const host = await render(<><QuestRewards rewards={[reward()]} title="Act rewards" id="act-rewards"/><QuestRewards rewards={[reward()]} title="Chapter rewards" id="chapter-rewards"/></>);
  const toggles = [...host.querySelectorAll<HTMLInputElement>('input[aria-label="Show reward names"]')];
  await act(async () => toggles[0].click());
  expect(toggles.every(toggle=>toggle.checked)).toBe(true);
  expect(host.querySelectorAll('[data-reward-name]')).toHaveLength(2);
  await act(async () => mounted!.render(null));
  await act(async () => mounted!.render(<QuestRewards rewards={[reward()]}/>));
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Show reward names"]')?.checked).toBe(true);
});

it('opens accessible reward details with exact amounts and links, then restores focus on Escape', async () => {
  const host = await render(<QuestRewards rewards={[reward({type:'crystal',name:'Mythic Crystal',sourceType:'gs',token:'mythic_shard_crystal',href:'/crystals/mythic_shard_crystal',quantity:0,amount:'5–10'})]}/>);
  const trigger = host.querySelector<HTMLButtonElement>('[data-quest-reward] button')!;
  trigger.focus();
  await act(async () => trigger.click());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute('aria-label')).toContain('Mythic Crystal');
  expect(dialog.textContent).toContain('5–10');
  expect(dialog.querySelector('a[href="/crystals/mythic_shard_crystal"]')).not.toBeNull();
  expect(dialog.querySelector('a[href^="/rewards?"]')).not.toBeNull();
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); });
  await act(async () => { await new Promise(resolve=>setTimeout(resolve,10)); });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('keeps names for missing and failed artwork, without inventing placeholder quantities', async () => {
  const host = await render(<QuestRewards rewards={[reward({key:'missing',imageUrl:null,name:'Unknown material'}),reward(),reward({key:'placeholder',placeholder:true,imageUrl:null,name:'Reward details not specified',amount:''})]}/>);
  expect(host.querySelectorAll('[data-reward-name]')).toHaveLength(2);
  await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')));
  expect(host.querySelectorAll('[data-reward-name]')).toHaveLength(3);
  const placeholder = host.querySelector('[data-quest-reward="placeholder"]')!;
  expect(placeholder.textContent).not.toContain('×');
});

it('supports the toggle when storage is blocked and keeps possible outcomes distinct', async () => {
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
  const host = await render(<QuestRewards rewards={[reward({quantity:0}),reward({key:'potential',scope:'potentialCompletionRewards'}),reward({key:'recorded',name:'Recorded offer',recordedOutcome:true})]}/>);
  await act(async () => host.querySelector<HTMLInputElement>('input')!.click());
  expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
  expect(host.textContent).toContain('×0');
  expect(host.querySelector('[data-quest-reward-scope="potentialCompletionRewards"]')?.textContent).toContain('not guaranteed');
  expect(host.querySelectorAll('[data-quest-reward]')).toHaveLength(2);
  expect(host.querySelector('details')?.textContent).toContain('Recorded offer');
});

it('honors compact mode for rewards sharing artwork while retaining overlays and accessible names', async () => {
  const host = await render(<QuestRewards rewards={[reward({key:'alpha',name:'Alpha material'}),reward({key:'beta',name:'Beta material'}),reward({key:'stone',name:'Signature stone',signaturePoints:5,itemRarity:6,quantity:7})]}/>);
  expect(host.querySelectorAll('[data-reward-name]')).toHaveLength(0);
  expect(host.querySelector('[data-quest-reward="alpha"] button')?.getAttribute('aria-label')).toContain('Alpha material');
  expect(host.querySelector('[data-quest-reward="beta"] button')?.getAttribute('title')).toContain('Beta material');
  expect(host.querySelector('[data-reward-signature-points="5"]')).not.toBeNull();
  await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="Show reward names"]')!.click());
  expect([...host.querySelectorAll('[data-reward-name]')].map(label=>label.textContent)).toEqual(['Alpha material','Beta material','Signature stone']);
  await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="Show reward names"]')!.click());
  expect(host.querySelectorAll('[data-reward-name]')).toHaveLength(0);
});

it('keeps actual Act 8 crystal rewards compact even when the hero and class selector share an icon', async()=>{
  const record=getParentRewardRecord([findQuest('a08_ch04_q06')!],'act','act_08')!;
  const rewards=projectRewardRecord(record);
  const crystals=rewards.filter(r=>r.type==='crystal');
  const hero=crystals.find(r=>r.name==='7-STAR HERO CRYSTAL')!;
  const selector=crystals.find(r=>r.name==='7-STAR CLASS HERO CRYSTAL SELECTOR CRYSTAL')!;
  expect(hero.imageUrl).toBeTruthy();
  expect(selector.imageUrl).toBe(hero.imageUrl);
  const host=await render(<QuestRewards rewards={rewards} title="Act rewards"/>);
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Show reward names"]')?.checked).toBe(false);
  for(const crystal of [hero,selector]){
    const tile=[...host.querySelectorAll('[data-quest-reward]')].find(row=>row.getAttribute('data-quest-reward')===crystal.key)!;
    expect(tile.querySelector('img')).not.toBeNull();
    expect(tile.querySelector('[data-reward-name]')).toBeNull();
    const trigger=tile.querySelector<HTMLButtonElement>('button')!;
    await act(async()=>trigger.click());
    expect(document.querySelector('[role="dialog"] h4')?.textContent).toBe(crystal.name);
    expect(document.querySelector(`[role="dialog"] a[href="${crystal.href}"]`)).not.toBeNull();
    await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Close reward details"]')!.click());
  }
});

it('hydrates compact server markup before restoring the remembered names preference', async () => {
  const element = <QuestRewards rewards={[reward()]}/>;
  const first = await render(element);
  await act(async () => first.querySelector<HTMLInputElement>('input')!.click());
  await act(async () => mounted!.unmount()); mounted=undefined; first.remove();
  const host=document.createElement('div');host.innerHTML=renderToString(element);document.body.append(host);
  expect(host.querySelector('[data-reward-name]')).toBeNull();
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  await act(async () => { mounted=hydrateRoot(host,element); });
  expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
  expect(host.querySelector('[data-reward-name]')?.textContent).toBe('Gold');
  expect(errors).not.toHaveBeenCalled();
});

it("renders the actual Act 10 exploration gem with its rank numbers on the icon and in its name", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const record = getParentRewardRecord([findQuest("epilogue_ch04_q04")!], "act", "epilogue")!;
  const gem = projectRewardRecord(record).find(r => r.token === "rankup_t73")!;
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<QuestRewards rewards={[gem]}/>));
    expect(host.querySelector('button[aria-label*="7-Star"]')?.getAttribute('aria-label')).toContain("Rank 3 → 4");
    expect(host.querySelector('[data-reward-rank="3-4"]')?.textContent).toBe("34");
    expect(host.querySelectorAll('[data-reward-stars="7"] svg')).toHaveLength(7);
    expect(host.querySelectorAll("img")).toHaveLength(1);
    expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.textContent).toContain("×1");
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it("keeps a stone's +1 or +5 separate from the quantity of stones", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const record = getParentRewardRecord([findQuest("epilogue_ch04_q04")!], "act", "epilogue")!;
  const one = projectRewardRecord(record).find(r => r.token === "sigup_t7")!;
  const five = projectRewardRecord({ ...record, scopes: { firstCompletionRewards: [
    { sourceIndex: 0, type: "inv", data: "sigupfive_t6", quantity: 7 },
  ] } })[0];
  expect(one.signaturePoints).toBe(1);
  expect(one.quantity).toBe(200);
  expect(five.signaturePoints).toBe(5);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<QuestRewards rewards={[one, five]}/>));
    expect(host.querySelector('[data-reward-signature-points="1"]')?.textContent).toBe("+1");
    expect(host.querySelector('[data-reward-signature-points="5"]')?.textContent).toBe("+5");
    expect(host.querySelectorAll('[data-reward-stars="7"] svg')).toHaveLength(7);
    expect(host.querySelectorAll('[data-reward-stars="6"] svg')).toHaveLength(6);
    expect(host.textContent).toContain("×200");
    expect(host.textContent).toContain("×7");
    expect(host.textContent).not.toContain("+200");
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

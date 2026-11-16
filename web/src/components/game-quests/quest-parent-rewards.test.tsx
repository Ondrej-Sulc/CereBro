// @vitest-environment jsdom
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,expect,it,vi} from "vitest";
import {findQuest} from "@cerebro/core/data/game-quests";
import {getParentRewardRecord} from "@cerebro/core/data/game-quests/rewards";
import {loadRewardPortraits} from "@/lib/game-quests/champions";
import {QuestParentRewards} from "./quest-parent-rewards";

vi.mock("@/lib/game-quests/champions",()=>({loadRewardPortraits:vi.fn(async()=>({}))}));
vi.mock("next/image",()=>({default:()=>null}));
beforeEach(()=>vi.clearAllMocks());

it.each([['act','me_crucible_act'],['chapter','me_crucible_ch01'],['chapter','me_crucible_ch02']] as const)("omits Crucible's placeholder-only %s rewards without altering the native record",async(kind,id)=>{
  const q=findQuest(id==='me_crucible_ch02'?'me_crucible_ch02_q01':'me_crucible_ch01_q01')!;
  const record=getParentRewardRecord([q],kind,id)!;
  const before=JSON.stringify(record);
  expect(await QuestParentRewards({quests:[q],kind,id})).toBeNull();
  expect(loadRewardPortraits).not.toHaveBeenCalled();
  expect(JSON.stringify(record)).toBe(before);
});

it("keeps real Story Act and Chapter reward headings",async()=>{
  const q=findQuest('a05_ch01_q01')!;
  for(const [kind,id,title] of [['act','act5','Act rewards'],['chapter','a05_ch01','Chapter rewards']] as const){
    const host=document.createElement('div');
    host.innerHTML=renderToStaticMarkup(await QuestParentRewards({quests:[q],kind,id}));
    expect(host.querySelector('h2')?.textContent).toBe(title);
    expect(host.querySelectorAll('[data-quest-reward]').length).toBeGreaterThan(0);
  }
});

it("labels the recorded Shooting Stars Special rewards as Collection rewards",async()=>{
  const q=findQuest('pve_may2023_shootingstar_1')!;
  const record=getParentRewardRecord([q],'act',q.hierarchy[0].actId)!;
  const before=JSON.stringify(record),host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(await QuestParentRewards({quests:[q],kind:'act',id:q.hierarchy[0].actId}));
  expect(host.querySelector('h2')?.textContent).toBe('Collection rewards');
  expect(host.querySelectorAll('[data-quest-reward]')).toHaveLength(Object.values(record.scopes).flat().length);
  expect(host.textContent).not.toContain('Act rewards');
  expect(JSON.stringify(record)).toBe(before);
});

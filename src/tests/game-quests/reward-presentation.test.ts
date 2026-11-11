import { expect, it } from "vitest";
import { getNativeRewardPresentation, nativeRewardName } from "../../data/game-reward-presentation";
import { findQuest } from "../../data/game-quests";
import { getParentRewardRecord, getQuestRewardRecord } from "../../data/game-quests/rewards";
import { projectRewardRecord } from "../../../web/src/lib/game-quests/presentation";

it("shows the actual Act 10 gem's native rarity and rank range without changing its quantity", () => {
  const record = getParentRewardRecord([findQuest("epilogue_ch04_q04")!], "act", "epilogue")!;
  const gem = projectRewardRecord(record).find(r => r.token === "rankup_t73")!;
  expect(gem.quantity).toBe(1);
  expect(gem.name).toContain("7-Star");
  expect(gem.name).toContain("3 → 4");
  expect(gem.rankChange).toEqual({ from: 3, to: 4 });
  expect(gem.imageUrl).toBeTruthy();
});

it("renders every concrete Act 10 exploration prize with artwork, including its selector, badge and title", () => {
  const record = getParentRewardRecord([findQuest("epilogue_ch04_q04")!], "act", "epilogue")!;
  const sourceBefore = JSON.stringify(record);
  const prizes = projectRewardRecord(record).filter(r => r.scope === "masteryCompletionRewards" && !r.recordedOutcome && !r.placeholder);
  for (const token of ["6a1634a25c05d7cb80f87fdd", "epilogue_completion_pic_rar", "spec_happilyeverafter"]) {
    const prize = prizes.find(r => r.token === token)!;
    expect(prize, token).toBeDefined();
    expect(prize.imageUrl, token).toMatch(/^\/game-rewards\/definitions\/[a-f0-9]{64}\.png$/);
    expect(prize.name.trim()).not.toBe("");
  }
  expect(prizes.every(r => r.imageUrl)).toBe(true);
  expect(prizes.find(r => r.token === "spec_happilyeverafter")?.name).toBe("Happily Ever After?");
  expect(JSON.stringify(record)).toBe(sourceBefore);
});

it("fills exact native item names in new quest responses rather than generic Item reward copy", () => {
  const record = getQuestRewardRecord(findQuest("epilogue_ch04_q04")!)!;
  const views = projectRewardRecord(record);
  expect(views.find(r => r.token === "ascension_token_champion_carina_white")?.name).toContain("CARINA");
  expect(views.some(r => r.sourceType === "inv" && r.name === "Item reward")).toBe(false);
});

it("uses exact native inventory identities, and keeps rank decoration out of unrelated rewards", () => {
  const gem = getNativeRewardPresentation("inv", "rankup_t73")!;
  expect(gem.rankChange).toEqual({ from: 3, to: 4 });
  expect(nativeRewardName(gem)).toContain("3 → 4");
  expect(getNativeRewardPresentation("inv", "unrecorded_rankup_t73")).toBeNull();
  expect(getNativeRewardPresentation("ebp", "rankup_t73")).toBeNull();
  expect(getNativeRewardPresentation("inv", "sigup_t7")?.rankChange).toBeUndefined();
  expect(getNativeRewardPresentation("inv", "awaken_t6_mutant")?.className?.toLowerCase()).toBe("mutant");
  expect(getNativeRewardPresentation("inv", "rankup_relic_t6_1")?.rankChange).toEqual({ from: 1, to: 2 });
  expect(getNativeRewardPresentation("inv", "rankup_relic_t6_2")?.rankChange).toEqual({ from: 2, to: 3 });
  expect(nativeRewardName(getNativeRewardPresentation("inv", "rankup_relic_t6_2")!)).toContain("6-Star");
});

it("projects native signature point values from each item rather than its awarded quantity", () => {
  expect(getNativeRewardPresentation("inv", "sigup_t7")?.signaturePoints).toBe(1);
  expect(getNativeRewardPresentation("inv", "sigupfive_t6")?.signaturePoints).toBe(5);
  expect(getNativeRewardPresentation("inv", "siguptwo_legendary")?.signaturePoints).toBe(2);
  expect(getNativeRewardPresentation("inv", "carina_sigstone_7star")?.signaturePoints).toBe(1);
  expect(getNativeRewardPresentation("inv", "awaken_t6_mutant")?.signaturePoints).toBeUndefined();
  expect(nativeRewardName(getNativeRewardPresentation("inv", "sigupfive_t6")!)).toContain("+5");
});

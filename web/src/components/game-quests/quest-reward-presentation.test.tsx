// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { findQuest } from "@cerebro/core/data/game-quests";
import { getParentRewardRecord } from "@cerebro/core/data/game-quests/rewards";
import { projectRewardRecord } from "@/lib/game-quests/presentation";
import { QuestRewards } from "./quest-rewards";

vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props) }));

it("renders the actual Act 10 exploration gem with its rank numbers on the icon and in its name", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const record = getParentRewardRecord([findQuest("epilogue_ch04_q04")!], "act", "epilogue")!;
  const gem = projectRewardRecord(record).find(r => r.token === "rankup_t73")!;
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<QuestRewards rewards={[gem]}/>));
    expect(host.textContent).toContain("7-Star");
    expect(host.textContent).toContain("Rank 3 → 4");
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

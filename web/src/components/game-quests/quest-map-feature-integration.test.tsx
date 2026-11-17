// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { loadQuestMap } from "@cerebro/core/data/game-quests";
import { projectQuestMapFeatures } from "@/lib/game-quests/map-features";
import { QuestMapExplorer } from "./quest-map-explorer";
import { QuestPathRewards } from "./quest-path-rewards";

vi.mock("next/image", () => ({ default: ({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", { ...props, alt }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
HTMLElement.prototype.scrollBy = vi.fn();
HTMLElement.prototype.scrollTo = vi.fn();
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

it("opens a Mausoleum gate and its original path pickup without multiplying shared rewards", async () => {
  const map = (await loadQuestMap("me_mausoleum_ch01_q02"))!;
  const before = JSON.stringify(map), features = projectQuestMapFeatures(map);
  window.history.replaceState(null, "", `/quests/${map.questId}`);
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<><QuestMapExplorer map={map} featureLocations={features}/><QuestPathRewards questId={map.questId} pickups={features.flatMap(location => location.pickups)}/></>));
  expect(host.querySelectorAll('#quest-path-rewards [data-quest-reward]')).toHaveLength(4);
  const gate = host.querySelector<SVGGElement>('[data-map-feature][data-coordinate="16,18"]')!;
  await act(async () => gate.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  const inspector = () => host.querySelector('section[aria-labelledby="coordinate-heading"]')!;
  expect(inspector().textContent).toContain("GUILLOTINE (DEATHLESS) required");
  const pickup = host.querySelector<SVGGElement>('[data-map-feature][data-coordinate="4,15"]')!;
  expect(pickup.getAttribute("aria-label")).toContain("7-Star DEATHLESS SIGNATURE STONE");
  await act(async () => pickup.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(new URL(window.location.href).searchParams.get("node")).toBe("4,15");
  expect(inspector().textContent).toContain("×10");
  expect(inspector().textContent).not.toMatch(/collected|owned/i);
  expect(host.querySelectorAll('#quest-path-rewards [data-quest-reward]')).toHaveLength(4);
  await act(async () => host.querySelector<HTMLButtonElement>('#quest-path-rewards [data-quest-reward] button')!.click());
  const link = document.querySelector<HTMLAnchorElement>('[role="dialog"] a[href*="node=4%2C15"]');
  expect(link?.textContent).toContain("Show on map");
  expect(JSON.stringify(map)).toBe(before);
}, 15000);

it("keeps uncaptured path rewards distinct from a known empty list", async () => {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<QuestPathRewards questId="q" pickups={[]} coverage="uncaptured"/>));
  expect(host.textContent).toContain("weren’t recorded");
  await act(async () => root!.render(<QuestPathRewards questId="q" pickups={[]} coverage="captured"/>));
  expect(host.textContent).toBe("");
});

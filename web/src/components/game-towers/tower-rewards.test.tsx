// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { QuestRewards } from "@/components/game-quests/quest-rewards";
import { TowerRewards } from "./tower-rewards";

vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
  // eslint-disable-next-line @next/next/no-img-element -- Framework image boundary.
  <img alt="" {...props}/>
) }));
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
  void prefetch;
  return <a {...props}/>;
} }));

let root: Root | undefined;
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; document.body.innerHTML = "";
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function render(element: ReactNode) {
  const host = document.createElement("div"); document.body.append(host);
  root = createRoot(host); await act(async () => root!.render(element));
  return host;
}
const reward = (overrides: Partial<QuestRewardView> = {}): QuestRewardView => ({
  key: "gold", scope: "Block rewards", name: "Gold", quantity: 750000,
  type: "item", sourceType: "res", token: "sc", imageUrl: "/gold.png", href: null, ...overrides,
});

it("uses compact reward tiles for block and floor rewards while retaining exact amounts and overlays", async () => {
  const host = await render(<TowerRewards rewards={[
    reward(), reward({ key: "zero", quantity: 0 }),
    reward({ key: "range", name: "Rank-up gem", quantity: 0, amount: "5–10", rankChange: { from: 3, to: 4 }, itemRarity: 7 }),
    reward({ key: "unknown-amount", quantity: 0, amount: "Quantity unavailable" }),
  ]}/>);
  const tiles = [...host.querySelectorAll("[data-quest-reward]")];
  expect(tiles).toHaveLength(4);
  expect(tiles.map(tile => tile.querySelector("button")?.getAttribute("aria-label"))).toEqual([
    "Reward details: Gold · ×750,000", "Reward details: Gold · ×0", "Reward details: Rank-up gem · 5–10", "Reward details: Gold · Quantity unavailable",
  ]);
  expect(host.querySelector("[data-reward-name]")).toBeNull();
  expect(host.querySelector('[data-reward-rank="3-4"]')).not.toBeNull();
  expect(host.querySelector('[data-reward-stars="7"]')).not.toBeNull();
  expect(host.querySelector('button[aria-label="Show reward names"]')?.getAttribute("aria-pressed")).toBe("false");
  await act(async () => root!.render(<TowerRewards rewards={[reward({ scope: "Floor rewards" })]} compact/>));
  expect(host.querySelectorAll("[data-quest-reward]")).toHaveLength(1);
  expect(host.querySelector("[data-reward-name]")).toBeNull();
});

it("synchronizes the names button across Tower and quest sections and remembers the preference", async () => {
  const host = await render(<>
    <TowerRewards rewards={[reward()]}/>
    <TowerRewards rewards={[reward({ scope: "Floor rewards" })]} compact/>
    <QuestRewards rewards={[reward({ scope: "firstCompletionRewards" })]}/>
  </>);
  const toggles = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Show reward names"]')];
  expect(toggles).toHaveLength(3);
  await act(async () => toggles[0].click());
  expect(toggles.every(toggle => toggle.getAttribute("aria-pressed") === "true")).toBe(true);
  expect(host.querySelectorAll("[data-reward-name]")).toHaveLength(3);
  await act(async () => root!.render(null));
  await act(async () => root!.render(<TowerRewards rewards={[reward()]}/>));
  expect(host.querySelector('button[aria-label="Show reward names"]')?.getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector("[data-reward-name]")?.textContent).toBe("Gold");
});

it("opens exact reward links and sources in details, but never offers entry costs as earnable rewards", async () => {
  const host = await render(<TowerRewards rewards={[reward({ type: "crystal", name: "Mythic Crystal", sourceType: "gs", token: "mythic_shard_crystal", href: "/crystals/mythic_shard_crystal" })]}/>);
  const trigger = host.querySelector<HTMLButtonElement>("[data-quest-reward] button")!;
  trigger.focus(); await act(async () => trigger.click());
  expect(document.querySelector('[role="dialog"] a[href="/crystals/mythic_shard_crystal"]')).not.toBeNull();
  expect(document.querySelector('[role="dialog"] a[href^="/rewards?"]')).not.toBeNull();
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await vi.waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  await act(async () => root!.render(<TowerRewards rewards={[reward({ scope: "Entry cost" })]}/>));
  await act(async () => host.querySelector<HTMLButtonElement>("[data-quest-reward] button")!.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Entry cost");
  expect(document.querySelector('[role="dialog"] a[href^="/rewards?"]')).toBeNull();
});

it("retains separate unresolved rating and entry-cost records without invented identities or amounts", async () => {
  const unknown = ["one", "two"].map((key, i) => reward({ key, token: key, name: "Rating reward", scope: "Rating rewards", quantity: 0, amount: i ? "Quantity unavailable" : "5–10", imageUrl: null }));
  const host = await render(<TowerRewards rewards={unknown}/>);
  expect(host.querySelector("[data-quest-reward]")).toBeNull();
  expect(host.querySelector('button[aria-label="Show reward names"]')).toBeNull();
  expect(host.querySelector("details")?.open).toBe(false);
  expect(host.querySelector("summary")?.textContent).toContain("Rating reward details unavailable");
  expect(host.querySelector("summary")?.textContent).toContain("2 records");
  expect([...host.querySelectorAll("ol > li > strong")].map(row => row.textContent)).toEqual(["5–10", "Quantity unavailable"]);
  expect(host.textContent).not.toContain("×0");
  await act(async () => root!.render(<TowerRewards rewards={[reward({ name: "Item", scope: "Entry cost", imageUrl: null, quantity: 3 })]}/>));
  expect(host.querySelector("summary")?.textContent).toContain("Entry-cost item unresolved");
  expect(host.querySelector("ol > li > strong")?.textContent).toBe("×3");
});

it("keeps missing and failed artwork identifiable and leaves placeholder quantities unspecified", async () => {
  const host = await render(<TowerRewards rewards={[
    reward(), reward({ key: "missing", imageUrl: null, name: "Named material" }),
    reward({ key: "placeholder", imageUrl: null, placeholder: true, name: "Reward details not specified", amount: "" }),
    reward({ key: "stone", name: "Signature stone", signaturePoints: 5, itemRarity: 6 }),
  ]}/>);
  expect(host.querySelectorAll("[data-reward-name]")).toHaveLength(2);
  await act(async () => host.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(host.querySelectorAll("[data-reward-name]")).toHaveLength(3);
  expect(host.querySelector('[data-quest-reward="placeholder"]')?.textContent).not.toContain("×");
  expect(host.querySelector('[data-reward-signature-points="5"]')).not.toBeNull();
  await act(async () => root!.render(<TowerRewards rewards={[]}/>));
  expect(host.textContent).toBe("None listed in this definition.");
});

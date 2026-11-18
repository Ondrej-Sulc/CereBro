// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { QuestMapFeatureDetails, QuestMapFeatureMarker } from "./quest-map-features";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
async function render(element: ReactNode, svg = true) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(svg ? <svg>{element}</svg> : element));
  return host;
}
const gateLocation = (): QuestMapFeatureLocation => ({
  coordinate: [7, 12],
  gates: [{ id: "internal-gate", coordinate: [7, 12], pathIndices: [0, 2], label: "Skill gate", kind: "class", requirements: ["2 Skill champions"], resolved: true }],
  pickups: [],
});
const reward = (overrides: Partial<QuestRewardView> = {}): QuestRewardView => ({
  key: "internal-reward", scope: "pathRewards", token: "internal-item", sourceType: "inv", name: "Revive", quantity: 7,
  amount: "×7", type: "item", imageUrl: "/exact-revive.webp", href: null, ...overrides,
});
const pickupLocation = (rows: QuestRewardView[] = [reward()]): QuestMapFeatureLocation => ({
  coordinate: [7, 12], gates: [],
  pickups: [{ id: "internal-pickup", coordinate: [7, 12], pathIndices: [0, 2, 4], rewards: rows }],
});

it("makes a visible gate selectable by pointer and keyboard using its human name", async () => {
  const onChoose = vi.fn();
  const host = await render(<QuestMapFeatureMarker location={gateLocation()} x={100} y={120} selected active onChoose={onChoose}/>);
  const marker = host.querySelector<SVGGElement>('[role="button"]')!;
  expect(marker).not.toBeNull();
  expect(marker.getAttribute("tabindex")).toBe("0");
  expect(marker.getAttribute("aria-pressed")).toBe("true");
  expect(marker.getAttribute("aria-label")).toContain("Skill gate");
  expect(marker.querySelector("title")?.textContent).toContain("Skill gate");
  expect(marker.querySelector("path")?.getAttribute("d")).toBeTruthy();
  expect(marker.querySelector('image')).toBeNull();
  expect(host.textContent).not.toMatch(/internal-gate|7,12|unlocked|eligible|collected/i);
  await act(async () => {
    marker.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  });
  expect(onChoose).toHaveBeenCalledTimes(3);
});

it("shows recorded pickup artwork and its own amount without multiplying shared routes", async () => {
  const host = await render(<QuestMapFeatureMarker location={pickupLocation()} x={100} y={120} selected={false} active onChoose={vi.fn()}/>);
  const marker = host.querySelector('[role="button"]')!;
  expect(marker.getAttribute("aria-label")).toContain("Revive");
  expect(marker.getAttribute("aria-label")).toContain("×7");
  expect(marker.querySelector("image")?.getAttribute("href")).toBe("/exact-revive.webp");
  expect(marker.querySelector("text")?.textContent).toBe("×7");
  expect(host.textContent).not.toMatch(/×21|internal-pickup|internal-item|internal-reward|7,12/);
  await act(async () => root!.render(<svg><QuestMapFeatureMarker location={pickupLocation([reward({ quantity: 0, amount: "5–10" })])} x={100} y={120} selected={false} active onChoose={vi.fn()}/></svg>));
  expect(host.querySelector("text")?.textContent).toBe("5–10");
  expect(host.querySelector('[role="button"]')?.getAttribute("aria-label")).toContain("5–10");
});

it("keeps compact encounter badges decorative with one parent selection target", async () => {
  const onChoose = vi.fn(), parentChoose = vi.fn();
  const location = { ...gateLocation(), pickups: pickupLocation().pickups };
  const host = await render(<g role="button" tabIndex={0} aria-label="Boss, Skill gate and Revive pickup" onClick={parentChoose}>
    <circle cx="100" cy="120" r="33"/>
    <QuestMapFeatureMarker location={location} x={100} y={120} selected={false} active onChoose={onChoose} compact/>
  </g>);
  const badge = host.querySelector<SVGGElement>('[data-map-feature]')!;
  expect(host.querySelectorAll('[role="button"]')).toHaveLength(1);
  expect(host.querySelectorAll('[tabindex]')).toHaveLength(1);
  expect(badge.getAttribute("aria-hidden")).toBe("true");
  expect(badge.getAttribute("pointer-events")).toBe("none");
  expect(badge.querySelector("image")?.getAttribute("href")).toBe("/exact-revive.webp");
  expect(badge.querySelector("text")?.textContent).toBe("×7");
  await act(async () => {
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    badge.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  expect(onChoose).not.toHaveBeenCalled();
  expect(parentChoose).toHaveBeenCalledOnce();
});

it("shows recorded gate requirements and keeps colocated pickup placements separate", async () => {
  const location: QuestMapFeatureLocation = {
    ...gateLocation(),
    gates: [...gateLocation().gates, { ...gateLocation().gates[0], id: "unresolved-gate", label: "Gate", requirements: [], resolved: false }],
    pickups: [...pickupLocation().pickups, { ...pickupLocation().pickups[0], id: "second-pickup", rewards: [reward({ key: "second-reward", quantity: 2, amount: "×2" })] }],
  };
  const host = await render(<QuestMapFeatureDetails location={location}/>, false);
  expect(host.textContent).toContain("Gate requirements");
  expect(host.textContent).toContain("Skill gate");
  expect(host.textContent).toContain("2 Skill champions");
  expect(host.textContent).toContain("Requirements not specified in the recorded definition.");
  expect(host.textContent).toContain("Path pickups");
  const rewardTiles = [...host.querySelectorAll('[data-quest-reward]')];
  expect(rewardTiles).toHaveLength(2);
  expect(rewardTiles[0].querySelector("button")?.getAttribute("aria-label")).toContain("Revive · ×7");
  expect(rewardTiles[1].querySelector("button")?.getAttribute("aria-label")).toContain("Revive · ×2");
  expect(rewardTiles.every(tile => tile.querySelector("[data-reward-name]")?.textContent === "Revive")).toBe(true);
  expect(host.textContent).not.toMatch(/×9|×21|internal-|unresolved-gate|second-pickup|eligible|unlocked|collected|owned/i);
});

it("uses a neutral public gate label when its recorded definition is unresolved", async () => {
  const location = gateLocation();
  location.gates[0] = { ...location.gates[0], label: "internal_barrier_token", resolved: false, requirements: [] };
  const host = await render(<>
    <svg><QuestMapFeatureMarker location={location} x={100} y={120} selected={false} active onChoose={vi.fn()}/></svg>
    <QuestMapFeatureDetails location={location}/>
  </>, false);
  expect(host.querySelector('[role="button"]')?.getAttribute("aria-label")).toBe("Gate");
  expect(host.textContent).not.toContain("internal_barrier_token");
  expect(host.textContent).toContain("Requirements not specified in the recorded definition.");
});

it("shows selectable chest artwork and its location without inventing reward contents", async () => {
  const location: QuestMapFeatureLocation = { ...gateLocation(), gates: [],
    chests: [{ id: "native-chest", coordinate: [7,12], pathIndices: [0,2], imageUrl: "/exact-chest.webp" }] };
  const choose=vi.fn();
  const host=await render(<><svg><QuestMapFeatureMarker location={location} x={100} y={120} selected active onChoose={choose}/></svg><QuestMapFeatureDetails location={location}/></>,false);
  const marker=host.querySelector('[role="button"]')!;
  expect(marker.getAttribute("aria-label")).toBe("Chest");
  expect(marker.querySelector("image")?.getAttribute("href")).toBe("/exact-chest.webp");
  expect(marker.querySelector("text")).toBeNull();
  expect(host.textContent).toContain("Contents not specified.");
  expect(host.textContent).toContain("Route 1");expect(host.textContent).toContain("Route 3");
  expect(host.textContent).not.toMatch(/native-chest|gold|guaranteed|collected|×1|7,12/i);
  await act(async()=>marker.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
  expect(choose).toHaveBeenCalledOnce();
});

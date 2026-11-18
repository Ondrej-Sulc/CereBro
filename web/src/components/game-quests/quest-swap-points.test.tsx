// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Coordinate, QuestMap } from "@cerebro/core/domain/game-quests";
import { projectQuestMapFeatures, type QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import { questFeatureLocationLabel } from "@/lib/game-quests/feature-label";
import { QuestMapFeatureDetails, QuestMapFeatureMarker } from "./quest-map-features";
import { QuestMapExplorer } from "./quest-map-explorer";
import { questMapMarkerLayout } from "./quest-map-marker-layout";
import { regionBoardGeometry } from "./quest-spawn-region-presentation";
import { questGateMarkerWidth } from "./quest-gate-marker";

vi.mock("next/image", () => ({ default: ({ alt = "", unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => { void unoptimized; return createElement("img", { ...props, alt }); } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
HTMLElement.prototype.scrollBy = vi.fn();
HTMLElement.prototype.scrollTo = vi.fn();
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
async function render(element: ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element));
  return host;
}

const source = { file: "public-preview.json", sha256: "b".repeat(64), pointer: "/quest/tileList/1", capturedAt: "2026-11-18T00:00:00Z" };
function swapMap(): QuestMap {
  const coordinates: Coordinate[] = [[0,0], [4,0], [8,0], [12,0]];
  return {
    version: 1, questId: "swap-fixture", mapId: "swap-map", sourceHash: "a".repeat(64), sourceFile: "frozen.json", capturedAt: source.capturedAt,
    gridDimension: 20, adaptive: false, rewards: { fixedChampions: [], possibleCrystals: [] },
    tiles: coordinates.map((coordinate, index) => ({ coordinate, nodeNumber: index, start: index === 0, final: index === 3, hidden: false,
      links: index < 3 ? [coordinates[index + 1]] : [], portals: [], randomPortal: false, barrier: index === 2 ? "gate" : "", applications: [] })),
    paths: [{ index: 0, coordinates }],
    encounters: [{ id: "defender", coordinate: [8,0], bossKey: "defender", tierId: "tier", gameId: "champion", rarity: 7, name: "Recorded defender", champion: null,
      rank: 1, level: 1, signature: 0, ascension: 0, final: false, candidates: [], pathIndices: [0] }],
    swapPoints: { questId: "swap-fixture", mapId: "swap-map", sourceHash: "a".repeat(64), publicMapSha256: source.sha256, coverage: "captured", unresolvedChoiceCoordinates: [], definitionSources: { [source.file]: source.sha256 },
      points: [
        { id: "swap-one", coordinate: [4,0], pathIndices: [0], source, options: [{ choiceId: "teamswap", swapCount: 1, minSwaps: 1, nativeDefaultsApplied: [] }] },
        { id: "swap-two", coordinate: [8,0], pathIndices: [0], source, options: [{ choiceId: "swapteamselect_alt1", swapCount: 0, minSwaps: 0, nativeDefaultsApplied: [] }] },
      ] },
    features: { questId: "swap-fixture", mapId: "swap-map", sourceHash: "a".repeat(64), publicMapSha256: source.sha256,
      coverage: { gates: "complete", pathRewards: "captured", unresolvedGateCount: 0 },
      gates: [{ id: "gate", barrierId: "gate", coordinate: [8,0], pathIndices: [0], kind: "class", label: "Skill gate", requirements: ["One Skill champion"], resolved: true, source }],
      pathRewards: [{ id: "pickup", coordinate: [8,0], pathIndices: [0], source, rewards: [{ sourceIndex: 0, type: "inv", data: "fixture-revive", quantity: 2, displayName: "Recorded revive" }] }] },
  };
}

it("projects only established swap points once, retaining routes and co-located features", () => {
  const map = swapMap(), before = JSON.stringify(map);
  const locations = projectQuestMapFeatures(map), standalone = locations.find(location => location.coordinate.join(",") === "4,0")!;
  expect(standalone?.swaps).toEqual([map.swapPoints!.points[0]]);
  expect(questFeatureLocationLabel(standalone)).toBe("Champion swap");
  const shared = locations.find(location => location.coordinate.join(",") === "8,0")!;
  expect(shared.swaps).toHaveLength(1);
  expect(shared.gates).toHaveLength(1);
  expect(shared.pickups).toHaveLength(1);
  expect(questFeatureLocationLabel(shared)).toContain("Champion swap");
  expect(projectQuestMapFeatures({ ...map, features: undefined, swapPoints: undefined })).toEqual([]);
  const partial = projectQuestMapFeatures({ ...map, features: undefined, swapPoints: { ...map.swapPoints!, coverage: "partial", unresolvedChoiceCoordinates: [[12,0]] } });
  expect(partial).toHaveLength(2);
  expect(partial.some(location => location.coordinate.join(",") === "12,0")).toBe(false);
  expect(JSON.stringify(map)).toBe(before);
});

it("gives swap points a keyboard target, visible symbol and label, with only positive recorded limits", async () => {
  const locations = projectQuestMapFeatures(swapMap()), location = locations.find(location => location.coordinate.join(",") === "4,0")!;
  const choose = vi.fn();
  const host = await render(<><svg><QuestMapFeatureMarker location={location} x={100} y={120} selected active onChoose={choose}/></svg><QuestMapFeatureDetails location={location}/></>);
  const marker = host.querySelector<SVGGElement>('[data-map-feature]')!;
  expect(marker.getAttribute("role")).toBe("button");
  expect(marker.getAttribute("tabindex")).toBe("0");
  expect(marker.getAttribute("aria-label")).toContain("Champion swap");
  expect(marker.querySelector("title")?.textContent).toContain("Champion swap");
  expect(marker.querySelector('[data-champion-swap] path')).not.toBeNull();
  expect(marker.querySelector('[data-champion-swap] text')?.textContent).toBe("Swap");
  expect(host.querySelector('[aria-label="Champion swaps"]')?.textContent).toContain("Up to 1 champion");
  expect(host.textContent).not.toMatch(/mandatory|required|eligible|used|remaining|teamswap|native-constructor/i);
  await act(async () => {
    marker.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  });
  expect(choose).toHaveBeenCalledTimes(3);
  await act(async () => root!.render(<QuestMapFeatureDetails location={locations.find(location => location.coordinate.join(",") === "8,0")!}/>));
  const swapDetails = host.querySelector('[aria-label="Champion swaps"]')!;
  expect(swapDetails).not.toBeNull();
  expect(swapDetails.textContent).not.toMatch(/up to|0 champion|unlimited|mandatory|required|eligible|used|remaining/i);
});

it("opens swap details, preserves a co-located defender and features, and marks swaps in the key and overview", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
  const map = swapMap(), before = JSON.stringify(map);
  window.history.replaceState(null, "", "/quests/swap-fixture");
  const host = await render(<QuestMapExplorer map={map} initialNode="0,0" featureLocations={projectQuestMapFeatures(map)}/>);
  const standalone = host.querySelector<SVGGElement>('[data-map-feature][data-coordinate="4,0"]')!;
  await act(async () => standalone.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  const inspector = () => host.querySelector('section[aria-labelledby="coordinate-heading"]')!;
  expect(inspector().querySelector("h2")?.textContent).toBe("Champion swap");
  expect(inspector().textContent).toContain("Up to 1 champion");
  expect(inspector().textContent).not.toContain("Node modifiers");
  expect(new URL(window.location.href).searchParams.get("node")).toBe("4,0");
  const defender = host.querySelector<SVGGElement>('[data-map-encounter="defender"]')!;
  expect(defender.getAttribute("aria-label")).toContain("Champion swap");
  const badge = defender.querySelector('[data-map-feature]')!;
  expect(badge.getAttribute("aria-hidden")).toBe("true");
  expect(badge.querySelector("[data-champion-swap]")).not.toBeNull();
  expect(badge.querySelector("[data-pickup-amount]")).not.toBeNull();
  expect(defender.querySelectorAll('[role="button"]')).toHaveLength(0);
  await act(async () => defender.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(inspector().textContent).toContain("Skill gate");
  expect(inspector().textContent).toContain("Champion swaps");
  expect(inspector().textContent).toContain("Node modifiers");
  expect(host.querySelector("details[class*=mapKey]")?.textContent).toContain("Champion swap");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click());
  expect(host.querySelectorAll('[aria-label="Map overview"] [data-overview-swap]')).toHaveLength(2);
  expect(JSON.stringify(map)).toBe(before);
});

it("reserves combined swap badges in collision sizing while preserving native marker centers", () => {
  const map = swapMap(), locations = projectQuestMapFeatures(map), board = regionBoardGeometry(map);
  const full = questMapMarkerLayout(map, board, locations, 1);
  const withoutSwaps: QuestMapFeatureLocation[] = locations.filter(location => location.gates.length || location.pickups.length).map(location => ({ ...location, swaps: [] }));
  const baseline = questMapMarkerLayout(map, board, withoutSwaps, 1);
  expect(full.radii.has("4,0")).toBe(true);
  expect(full.radii.get("8,0")!).toBeGreaterThan(baseline.radii.get("8,0")!);
  const [x,y] = board.point([4,0]);
  expect(full.obstacles).toContainEqual({ x, y, radius: full.radii.get("4,0") });
});

it("leaves a wide gate readable beside its co-located swap badge", async () => {
  const location = projectQuestMapFeatures(swapMap()).find(location => location.gates.length)!;
  location.pickups = [];
  location.gates[0] = { ...location.gates[0], kind: "tags", visual: { kind: "tags", images: [], caption: "#Hero and #Stark Tech",
    tagGroups: [[{ label: "Hero", negated: false }, { label: "Stark Tech", negated: false }]] } };
  const host = await render(<svg><QuestMapFeatureMarker location={location} x={100} y={120} selected active onChoose={vi.fn()}/></svg>);
  const gate = host.querySelector('[data-gate-kind]')!;
  const swap = host.querySelector('[data-champion-swap]')!;
  const centerX = (element: Element) => Number(element.parentElement!.getAttribute("transform")!.match(/translate\(([-.\d]+)/)![1]);
  expect(centerX(swap) - centerX(gate)).toBeGreaterThan(questGateMarkerWidth(location.gates[0]) / 2 + 28);
});

it("keeps portal artwork and destinations when a swap shares the same tile", async () => {
  const map=swapMap();
  map.tiles[1].portals=[{target:[12,0],label:"Boss island",randomChance:0,tags:[]}];
  window.history.replaceState(null,"","/quests/swap-fixture?node=4%2C0");
  const host=await render(<QuestMapExplorer map={map} initialNode="4,0" featureLocations={projectQuestMapFeatures(map)}/>);
  const marker=host.querySelector('[data-map-feature][data-coordinate="4,0"]')!;
  expect(marker.querySelector('[data-portal-artwork]')).not.toBeNull();
  expect(marker.getAttribute('aria-label')).toContain('Portal');
  expect(host.querySelector('section[aria-label="Portal destinations"]')).not.toBeNull();
  expect(marker.querySelectorAll('[role="button"]')).toHaveLength(0);
});

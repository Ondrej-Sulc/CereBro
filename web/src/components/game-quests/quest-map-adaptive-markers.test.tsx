// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { loadQuestMap } from "@cerebro/core/data/game-quests";
import { questBoardGeometry } from "@cerebro/core/domain/game-quests/board";
import { projectQuestMapFeatures } from "@/lib/game-quests/map-features";
import { QuestBoard } from "./quest-board";

let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("enlarges sparse-map portraits and features at fit, preserving centers, labels and selection while zooming", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(760);
  HTMLElement.prototype.scrollTo = vi.fn();
  const map = (await loadQuestMap("me_mausoleum_ch01_q02"))!;
  const original = JSON.stringify(map), board = questBoardGeometry(map), features = projectQuestMapFeatures(map);
  const choose = vi.fn(), host = document.createElement("div");
  document.body.append(host); root = createRoot(host);
  const encounter = map.encounters[0];
  await act(async () => root!.render(<QuestBoard map={map} portraits={{}} selected={encounter.coordinate.join(",")} pathIndex={0}
    onChoose={choose} viewportRef={createRef<HTMLDivElement>()} featureLocations={features}/>));
  const zoom = () => Number(host.querySelector("[data-zoom]")!.getAttribute("data-zoom"));
  expect(zoom()).toBeLessThan(.6);
  const marker = host.querySelector(`[data-map-encounter="${encounter.id}"]`)!;
  expect(Number(marker.getAttribute("data-marker-scale"))).toBeGreaterThan(1.5);
  const [x,y] = board.point(encounter.coordinate);
  const scaled = marker.querySelector("[data-map-marker-visual]")!;
  expect(scaled.getAttribute("transform")).toContain(`translate(${x} ${y}) scale(`);
  expect(marker.querySelector("[data-map-hit-target]")!.closest("[data-map-marker-visual]")).toBe(scaled);
  expect(marker.querySelector("[data-map-nameplate]")!.closest("[data-map-marker-visual]")).toBeNull();
  const pickup = host.querySelector('[data-map-feature][data-coordinate="4,15"]')!;
  expect(Number(pickup.getAttribute("data-marker-scale"))).toBeGreaterThan(1);
  await act(async () => pickup.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true})));
  expect(choose).toHaveBeenLastCalledWith([4,15]);
  const transitPath = host.querySelector('[data-map-junctions] path')!;
  const transitGeometry = transitPath.getAttribute('d');
  expect(transitGeometry).toBeTruthy();
  const plus = host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!;
  for (let step=0; zoom()<1 && step<10; step++) await act(async () => plus.click());
  expect(zoom()).toBeGreaterThanOrEqual(1);
  expect(marker.getAttribute("data-marker-scale")).toBe("1");
  expect(pickup.getAttribute("data-marker-scale")).toBe("1");
  expect(host.querySelector('[data-map-junctions] path')).toBe(transitPath);
  expect(transitPath.getAttribute('d')).toBe(transitGeometry);
  expect(host.querySelectorAll("[data-map-encounter]")).toHaveLength(map.encounters.length);
  expect(JSON.stringify(map)).toBe(original);
}, 60000);

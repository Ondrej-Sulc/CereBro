// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadQuestMap } from "@cerebro/core/data/game-quests";
import type { QuestMap } from "@cerebro/core/domain/game-quests";
import { QuestMapEncounterMarker } from "./quest-map-encounter-marker";
import { QuestMapNameplate } from "./quest-map-nameplate";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let encounter: QuestMap["encounters"][number];
beforeAll(async () => { encounter = (await loadQuestMap("a05_ch01_q01"))!.encounters[0]; });
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ""; });
async function render(element: React.ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<svg>{element}</svg>)); return host;
}
const base = () => ({ encounter, x: 100, y: 120, uid: "map-fixture", index: 2, selected: false, active: true,
  showLabel: false, labelUnit: 1, onChoose: vi.fn(), onHover: vi.fn() });

describe("quest encounter map marker", () => {
  it("retains exact encounter identity, native placement and clipped portrait without alias lookup", async () => {
    const props = base();
    const host = await render(<QuestMapEncounterMarker {...props} portrait={{ name: "Exact public name", imageUrl: "/exact-native.webp", color: "#23b7d8", href: null, className: "Cosmic" }} />);
    const marker = host.querySelector('[data-map-encounter]')!;
    expect(marker.getAttribute('data-map-encounter')).toBe(encounter.id);
    expect(marker.getAttribute('data-coordinate')).toBe(encounter.coordinate.join(','));
    expect(marker.getAttribute('data-map-coordinate')).toBe(encounter.coordinate.join(','));
    expect(marker.getAttribute('aria-label')).toContain(`Exact public name, ${encounter.rarity} stars`);
    expect(marker.getAttribute('role')).toBe('button');
    expect(marker.getAttribute('tabindex')).toBe('0');
    expect(marker.querySelector('[data-map-hit-target]')?.getAttribute('pointer-events')).toBe('all');
    const image = marker.querySelector('image')!;
    expect(image.getAttribute('data-map-portrait')).toBe(encounter.gameId);
    expect(image.getAttribute('href')).toBe('/exact-native.webp');
    expect(image.getAttribute('clip-path')).toBe('url(#map-fixture-portrait-2)');
    expect(image.getAttribute('width')).toBe(encounter.final ? '62' : '50');
    expect(marker.querySelector('a')).toBeNull();
  });

  it("supports pointer, Enter, Space and focus selection while ignoring other keys", async () => {
    const props = base(), host = await render(<QuestMapEncounterMarker {...props} />);
    const marker = host.querySelector<SVGGElement>('[data-map-encounter]')!;
    await act(async () => {
      marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      marker.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      marker.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      marker.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(props.onChoose).toHaveBeenCalledTimes(3);
    expect(props.onHover.mock.calls).toEqual([[true], [false]]);
  });

  it("distinguishes the selected boss with decorative flame/skull and retains shared-route meaning", async () => {
    const boss = { ...encounter, final: true, pathIndices: [0, 2, 5] }, props = base();
    const host = await render(<QuestMapEncounterMarker {...props} encounter={boss} selected portalTarget />);
    const marker = host.querySelector('[data-map-encounter]')!;
    expect(marker.getAttribute('aria-pressed')).toBe('true');
    expect(marker.getAttribute('aria-label')).toContain(', final boss, shared by 3 recorded routes');
    expect(marker.querySelector('[data-map-selection]')).not.toBeNull();
    expect(marker.querySelector('[data-map-boss-emblem]')?.getAttribute('aria-hidden')).toBe('true');
    expect(marker.querySelector('[data-map-portal-target]')).not.toBeNull();
    expect(marker.querySelector('[data-map-shared-routes]')?.textContent).toBe('3');
  });

  it("keeps a one-star NPC portrait unresolved and its actual star count visible", async () => {
    const props = base(), npc = { ...encounter, champion: null, rarity: 1, gameId: 'unmapped_native', name: 'Native NPC' };
    const host = await render(<QuestMapEncounterMarker {...props} encounter={npc} />);
    expect(host.querySelector('image')).toBeNull();
    expect(host.querySelector('[data-map-portrait-fallback]')).not.toBeNull();
    expect(host.querySelector('[data-map-rarity]')?.textContent).toBe('1★');
    expect(host.querySelector('[data-map-encounter]')?.getAttribute('aria-label')).toContain('Native NPC, 1 stars');
  });
});

it("keeps the nameplate within its supplied collision box with screen-scaled readable text", async () => {
  const box = { x: 8, y: 16, width: 180, height: 30 }, host = await render(<QuestMapNameplate box={box} name="Cosmic Ghost Rider" accent="#29b1d2" selected unit={.5} />);
  const panel = host.querySelector('[data-map-nameplate-panel]')!;
  expect(['x', 'y', 'width', 'height'].map(key => Number(panel.getAttribute(key)))).toEqual([8, 16, 180, 30]);
  expect(host.querySelector('[data-map-nameplate]')?.getAttribute('pointer-events')).toBe('none');
  expect(Number(host.querySelector('text')?.getAttribute('font-size'))).toBe(6);
  expect(host.textContent).toContain('Cosmic Ghost Rider');
});

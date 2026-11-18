import { describe, expect, it } from "vitest";
import { questMarkerScales, type QuestMarkerFootprint } from "../../domain/game-quests/marker-scale";

const bounds = { width: 1200, height: 1000 };
const portrait: QuestMarkerFootprint = { id: "portrait", x: 400, y: 400, radius: 27 };

function expectNoOverlaps(markers: readonly QuestMarkerFootprint[], scales: Map<string, number>) {
  for (const [index, marker] of markers.entries()) {
    for (const other of markers.slice(index + 1)) {
      const distance = Math.hypot(marker.x - other.x, marker.y - other.y);
      expect(marker.radius * scales.get(marker.id)! + other.radius * scales.get(other.id)!).toBeLessThanOrEqual(distance + 1e-9);
    }
  }
}

describe("quest marker display scales", () => {
  it("enlarges sparse portraits toward a readable screen radius without moving them", () => {
    const markers = [portrait, { ...portrait, id: "other", x: 800 }];
    const scales = questMarkerScales(markers, 0.32, bounds);
    expect(scales.get("portrait")).toBeCloseTo(24 / (27 * 0.32));
    expect(scales.get("other")).toBeCloseTo(scales.get("portrait")!);
    expectNoOverlaps(markers, scales);
  });

  it("caps extreme zoom-out and returns to the base size as zoom increases", () => {
    const zooms = [0.05, 0.2, 0.32, 0.5, 0.75, 1, 2];
    const scales = zooms.map(zoom => questMarkerScales([portrait], zoom, bounds).get("portrait")!);
    expect(scales[0]).toBe(6);
    expect(scales.at(-1)).toBe(1);
    for (let index = 1; index < scales.length; index++) expect(scales[index]).toBeLessThanOrEqual(scales[index - 1]);
    const justBefore = questMarkerScales([portrait], 0.5 - 1e-6, bounds).get("portrait")!;
    const justAfter = questMarkerScales([portrait], 0.5 + 1e-6, bounds).get("portrait")!;
    expect(Math.abs(justBefore - justAfter)).toBeLessThan(0.00001);
  });

  it("uses spare room on phone-sized overviews instead of capping portraits at tiny sizes", () => {
    const scale = questMarkerScales([portrait], .15, bounds).get(portrait.id)!;
    expect(27 * 2 * .15 * scale).toBeGreaterThanOrEqual(40);
  });

  it("limits growth in dense maps using only supplied important footprints", () => {
    const dense = [portrait, { ...portrait, id: "neighbor", x: 470 }];
    const scales = questMarkerScales(dense, 0.32, bounds);
    expect(scales.get("portrait")).toBeGreaterThanOrEqual(1);
    expect(scales.get("portrait")).toBeLessThan(1.3);
    expect(scales.get("portrait")).toBe(scales.get("neighbor"));
    expectNoOverlaps(dense, scales);
    expect(questMarkerScales([portrait], 0.32, bounds).get("portrait")).toBeGreaterThan(scales.get("portrait")!);
  });

  it("shares expansion between unequal reward and gate footprints without shrinking either", () => {
    const markers = [
      { id: "gate", x: 400, y: 400, radius: 100, preferredRadius: 100 },
      { id: "reward", x: 600, y: 400, radius: 20 },
    ];
    const scales = questMarkerScales(markers, 0.5, bounds);
    expect(scales.get("gate")).toBeGreaterThan(1);
    expect(scales.get("reward")).toBeGreaterThan(1);
    const gateExpansion = 100 * (scales.get("gate")! - 1);
    const rewardExpansion = 20 * (scales.get("reward")! - 1);
    expect(gateExpansion / rewardExpansion).toBeCloseTo(100 / 28);
    expectNoOverlaps(markers, scales);
  });

  it("accepts a desired screen radius for wide gate labels", () => {
    const gate = { ...portrait, radius: 112, preferredRadius: 112 * 24 / 27 };
    expect(questMarkerScales([gate], 0.32, bounds).get(gate.id)).toBeCloseTo(24 / (27 * 0.32));
    expect(questMarkerScales([{ ...gate, preferredRadius: undefined }], 0.32, bounds).get(gate.id)).toBe(1);
  });

  it("keeps enlarged footprints inside the board with a margin", () => {
    const marker = { ...portrait, x: 40, y: 40 };
    const scale = questMarkerScales([marker], 0.32, bounds).get(marker.id)!;
    expect(scale).toBeGreaterThan(1);
    expect(marker.radius * scale).toBeLessThan(40);
    const rightBottom = { ...portrait, x: bounds.width - 40, y: bounds.height - 40 };
    expect(questMarkerScales([rightBottom], 0.32, bounds).get(portrait.id)).toBe(scale);
  });

  it("never shrinks already crowded or clipped base footprints", () => {
    const markers = [
      { ...portrait, id: "edge", x: 10 },
      { ...portrait, id: "touching", x: 454 },
      portrait,
    ];
    const scales = questMarkerScales(markers, 0.2, bounds);
    expect([...scales.values()]).toEqual([1, 1, 1]);
    const overlapping = [portrait, { ...portrait, id: "overlap", x: 430 }];
    expect([...questMarkerScales(overlapping, 0.2, bounds).values()]).toEqual([1, 1]);
  });

  it("handles coincident features conservatively when they have not been merged", () => {
    const markers = [portrait, { ...portrait, id: "gate", radius: 70, preferredRadius: 70 }];
    expect([...questMarkerScales(markers, 0.32, bounds).values()]).toEqual([1, 1]);
  });

  it("is independent of marker order and does not mutate input geometry", () => {
    const markers = Object.freeze([
      Object.freeze(portrait),
      Object.freeze({ id: "gate", x: 580, y: 420, radius: 100, preferredRadius: 100 }),
      Object.freeze({ id: "reward", x: 640, y: 560, radius: 20 }),
    ]);
    const before = JSON.stringify(markers);
    const scales = questMarkerScales(markers, 0.32, Object.freeze(bounds));
    const reversed = questMarkerScales([...markers].reverse(), 0.32, bounds);
    for (const marker of markers) expect(reversed.get(marker.id)).toBe(scales.get(marker.id));
    expect(JSON.stringify(markers)).toBe(before);
    expectNoOverlaps(markers, scales);
  });

  it("preserves pairwise separation across zoom levels and mixed-size fixtures", () => {
    const markers: QuestMarkerFootprint[] = Array.from({ length: 25 }, (_, index) => {
      const radius = [16, 27, 52][index % 3];
      return { id: String(index), x: 180 + index % 5 * 160, y: 180 + Math.floor(index / 5) * 160, radius, preferredRadius: radius * 24 / 27 };
    });
    for (const zoom of [0.12, 0.32, 0.6, 1, 2]) {
      const scales = questMarkerScales(markers, zoom, bounds);
      for (const scale of scales.values()) {
        expect(scale).toBeGreaterThanOrEqual(1);
        expect(scale).toBeLessThanOrEqual(6);
      }
      expectNoOverlaps(markers, scales);
    }
  });

  it("returns safe base scales for invalid zoom or board dimensions", () => {
    for (const zoom of [0, -1, NaN, Infinity]) expect(questMarkerScales([portrait], zoom, bounds).get(portrait.id)).toBe(1);
    for (const invalid of [{ width: 0, height: 1000 }, { width: 1200, height: NaN }, { width: Infinity, height: 1000 }]) {
      expect(questMarkerScales([portrait], 0.32, invalid).get(portrait.id)).toBe(1);
    }
  });

  it("ignores invalid footprints as obstacles and falls back from invalid preferred sizes", () => {
    const invalid = [
      { ...portrait, id: "nan", x: NaN },
      { ...portrait, id: "infinite", y: Infinity },
      { ...portrait, id: "zero", radius: 0 },
      { ...portrait, id: "negative", radius: -27 },
      { ...portrait, id: "unbounded", radius: Infinity },
    ];
    const scales = questMarkerScales([portrait, ...invalid], 0.32, bounds);
    expect(scales.get(portrait.id)).toBeCloseTo(24 / (27 * 0.32));
    for (const marker of invalid) expect(scales.get(marker.id)).toBe(1);
    for (const preferredRadius of [0, -1, NaN, Infinity]) {
      expect(questMarkerScales([{ ...portrait, preferredRadius }], 0.32, bounds).get(portrait.id)).toBeCloseTo(scales.get(portrait.id)!);
    }
  });

  it("returns an empty map for no markers", () => {
    expect(questMarkerScales([], 0.32, bounds).size).toBe(0);
  });
});

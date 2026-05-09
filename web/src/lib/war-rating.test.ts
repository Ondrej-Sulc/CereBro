import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/cache", () => ({ getFromCache: vi.fn() }));

import { calculateSoloBonus } from "./war-rating";

describe("war rating", () => {
  it("rewards above-average solo rate with the stronger 6x multiplier", () => {
    expect(calculateSoloBonus(1, 0.9, 10)).toBeCloseTo(6);
  });

  it("keeps below-average solo penalties damped while using the stronger multiplier", () => {
    expect(calculateSoloBonus(0.8, 0.9, 10)).toBeCloseTo(-1.5);
  });
});

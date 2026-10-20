import { describe, expect, it } from "vitest";
import { paginateChampionText } from "./pagination";

describe("champion text pagination", () => {
  it.each([
    "Long paragraph without line breaks. ".repeat(500),
    "unbroken".repeat(2000),
    ("a".repeat(3499) + "👋").repeat(4),
    "## Section\n> Source condition\n\n".repeat(500),
  ])("preserves all text and Unicode across bounded, nonempty pages", text => {
    const { totalPages } = paginateChampionText(text);
    const pages = Array.from({ length: totalPages }, (_, index) => paginateChampionText(text, index + 1));
    expect(pages.map(page => page.content).join("")).toBe(text);
    for (const page of pages) {
      expect(page.content.length).toBeGreaterThan(0);
      expect(page.content.length).toBeLessThanOrEqual(4000);
      for (const character of page.content) {
        const point = character.codePointAt(0)!;
        expect(point < 0xd800 || point > 0xdfff).toBe(true);
      }
    }
  });

  it("clamps stale or invalid page requests and handles empty text", () => {
    const text = "word ".repeat(2000);
    expect(paginateChampionText(text, -2).currentPage).toBe(1);
    expect(paginateChampionText(text, Number.NaN).currentPage).toBe(1);
    const last = paginateChampionText(text, 999);
    expect(last.currentPage).toBe(last.totalPages);
    expect(paginateChampionText("").totalPages).toBe(1);
  });
});

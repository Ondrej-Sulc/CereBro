import { describe, expect, it } from "vitest";
import { relicRuneSections } from "./relic-rune-sections";

describe("relic detail rune sections", () => {
  const items = {
    first: { id: "first", name: "Same label" },
    second: { id: "second", name: "Same label" },
    attribute: { id: "attribute", name: "Shock Potency Up" },
  };
  it("shows repeated slot options once in source order, without merging distinct IDs", () => {
    const groups = relicRuneSections(
      {
        type: "battlecast",
        slots: [
          { type: "ability", socketItemIds: ["second", "first"] },
          { type: "ability", socketItemIds: ["second", "first"] },
          { type: "attribute", socketItemIds: ["attribute"] },
          { type: "attribute", socketItemIds: ["attribute"] },
        ],
      },
      items,
    );
    expect(groups.abilities.map((item) => item.id)).toEqual([
      "second",
      "first",
    ]);
    expect(groups.attributes.map((item) => item.id)).toEqual(["attribute"]);
  });
  it("presents both Statcast primary and secondary bonuses as attributes", () => {
    const groups = relicRuneSections(
      {
        type: "statcast",
        slots: [
          { type: "ability", socketItemIds: ["first"] },
          { type: "attribute", socketItemIds: ["attribute"] },
        ],
      },
      items,
    );
    expect(groups.abilities).toEqual([]);
    expect(groups.attributes.map((item) => item.id)).toEqual([
      "first",
      "attribute",
    ]);
  });
  it("does not silently hide a broken item reference", () => {
    expect(() =>
      relicRuneSections(
        {
          type: "battlecast",
          slots: [{ type: "ability", socketItemIds: ["missing"] }],
        },
        items,
      ),
    ).toThrow(/Missing relic rune/);
  });
});

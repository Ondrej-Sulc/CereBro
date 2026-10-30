import { describe, expect, it } from "vitest";
import { buildRelicAttributeIcons } from "./relic-attribute-icons";

describe("relic attribute icon presentation", () => {
  it.each([null, "/legacy/energy.svg"])("provides the source Energy Penetration glyph regardless of glossary availability (%s)", (iconUrl) => {
    const icons = buildRelicAttributeIcons([{ id: "energy_penetration", iconUrl, raw: {} }]);
    expect(icons["Energy Penetration"]).toEqual({ iconUrl: "/icons/relic-attributes/energy-penetration.svg", color: "#b8c5d6" });
  });
  it("uses the Statcast game-font glyph instead of the incorrect legacy Physical Penetration artwork", () => {
    const icons = buildRelicAttributeIcons([{id:'physical_pen',iconUrl:'/legacy/wrong-burst.svg',raw:{}}]);
    expect(icons['Physical Penetration']).toEqual({iconUrl:'/icons/relic-attributes/physical-penetration.svg',color:'#b8c5d6'});
  });
  it("uses the matching game glyph and source color while retaining the stat's name", () => {
    expect(
      buildRelicAttributeIcons([
        {
          id: "cruelty",
          iconUrl: "/effects/cruelty.svg",
          raw: { color_primary: "ffd738" },
        },
        { id: "energy_res", iconUrl: "/effects/energy.svg", raw: null },
      ]),
    ).toEqual({
      "Energy Penetration": { iconUrl: "/icons/relic-attributes/energy-penetration.svg", color: "#b8c5d6" },
      "Physical Penetration": { iconUrl: "/icons/relic-attributes/physical-penetration.svg", color: "#b8c5d6" },
      "Critical Damage Rating": {
        iconUrl: "/effects/cruelty.svg",
        color: "#ffd738",
      },
      "Energy Resistance": { iconUrl: "/effects/energy.svg", color: "#b8c5d6" },
    });
  });

  it("leaves unavailable icons and unrelated effects out instead of inventing a match", () => {
    expect(
      buildRelicAttributeIcons([
        { id: "energy_penetration", iconUrl: null, raw: null },
        { id: "cruelty", iconUrl: "  ", raw: null },
        { id: "fury", iconUrl: "/effects/fury.svg", raw: null },
      ]),
    ).toEqual({
      "Energy Penetration": { iconUrl: "/icons/relic-attributes/energy-penetration.svg", color: "#b8c5d6" },
      "Physical Penetration": { iconUrl: "/icons/relic-attributes/physical-penetration.svg", color: "#b8c5d6" },
    });
  });

  it("does not substitute a Critical Rating icon for other critical attributes", () => {
    const icons = buildRelicAttributeIcons([
      {
        id: "precision",
        iconUrl: "/effects/precision.svg",
        raw: { color_primary: "ffd738" },
      },
    ]);
    expect(icons["Critical Rating"]?.iconUrl).toBe("/effects/precision.svg");
    expect(icons["Critical Damage Rating"]).toBeUndefined();
    expect(icons["Critical Resistance"]).toBeUndefined();
  });
});

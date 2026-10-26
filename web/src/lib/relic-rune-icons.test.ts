import { describe, expect, it } from "vitest";
import { buildRelicRuneIcons, relicRuneGlossaryId } from "./relic-rune-icons";

describe("relic rune effect icons", () => {
  it("matches the effect in a modifier label, including Buff/Debuff qualifiers", () => {
    expect(relicRuneGlossaryId("Shock Debuff Potency Up")).toBe("shock");
    expect(relicRuneGlossaryId("Unstoppable Buff Duration Up")).toBe(
      "unstoppable",
    );
    expect(relicRuneGlossaryId("Armor Potency Up")).toBe("armor_up");
    expect(relicRuneGlossaryId("Armor Up Potency Up")).toBe("armor_up");
    expect(relicRuneGlossaryId("Bleed Potency Down")).toBe("bleed");
  });
  it("shares precise stat matches with primary and secondary Statcast runes", () => {
    expect(relicRuneGlossaryId("Critical Damage Rating Primary")).toBe(
      "cruelty",
    );
    expect(relicRuneGlossaryId("Critical Rating Secondary")).toBe("precision");
    expect(relicRuneGlossaryId("Critical Resistance Secondary")).toBe(
      "critical_resistance",
    );
  });
  it("does not choose one effect from mixed names or infer effects from trigger wording", () => {
    for (const name of [
      "Fury & Cruelty Buff Potency Up",
      "Attack While Bleeding",
      "Shock Repulsors",
      "Taunt & Enervate Duration Up",
      "Heavy Finisher",
    ]) {
      expect(relicRuneGlossaryId(name)).toBeUndefined();
    }
  });
  it("uses source colors, preserves item identity, and omits missing assets", () => {
    expect(
      buildRelicRuneIcons(
        [
          { id: "shock", name: "Shock Debuff Potency Up" },
          { id: "armor", name: "Armor Potency Up" },
          { id: "unknown", name: "Heavy Finisher" },
        ],
        [
          {
            id: "shock",
            iconUrl: "/effects/shock.svg",
            raw: { color_primary: "ed3838" },
          },
          { id: "armor_up", iconUrl: "  ", raw: null },
        ],
      ),
    ).toEqual({ shock: { iconUrl: "/effects/shock.svg", color: "#ed3838" } });
  });
});

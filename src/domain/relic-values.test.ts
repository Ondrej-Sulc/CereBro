import { describe, expect, it } from "vitest";
import { relicParameterDisplay } from "./relic-values";
import type { RelicValueDisplay } from "./relic-values";
import {
  resolveRelicDescription,
  type RelicScalingContext,
} from "./relic-catalog";

const percent = { multiplier: 100, basis: "number" as const };
function context(
  min: string,
  max: string,
  display: RelicValueDisplay = percent,
): RelicScalingContext {
  return {
    parameters: {
      effect: {
        a: {
          minAtRarity: min,
          maxAtRarity: max,
          usesChallengeRating: false,
          exponent: 1.75,
          display,
        },
      },
    },
  };
}
const text = (template: string, ctx?: RelicScalingContext) =>
  resolveRelicDescription(template, ctx)
    .map((part) => part.text)
    .join("");

describe("relic progression range presentation", () => {
  it("uses the display formula rather than guessing from a percent suffix", () => {
    expect(text("+{effect.a}% potency", context("0.4", "0.8"))).toBe(
      "+40–80% potency",
    );
    expect(
      text(
        "{effect.a}%",
        context("3", "6", { multiplier: 1, basis: "number" }),
      ),
    ).toBe("3–6%");
  });
  it("formats reductions as magnitudes only where the wording already supplies direction", () => {
    const ctx = context("-0.048", "-0.096");
    expect(
      text("lowering Combat Power Rate by [16982bff]{effect.a}%[-].", ctx),
    ).toBe("lowering Combat Power Rate by [16982bff]4.8–9.6%[-].");
    expect(text("-{effect.a}% Opponent Power Rate", ctx)).toBe(
      "-4.8–9.6% Opponent Power Rate",
    );
    expect(text("{effect.a}% Opponent Power Rate", ctx)).toBe(
      "−9.6–−4.8% Opponent Power Rate",
    );
  });
  it("adds unbound percentage units without duplicating template units", () => {
    const ctx = context("-0.06", "-0.12", {
      multiplier: 100,
      basis: "unbound-percent",
    });
    expect(text("lowering Energy Resistance by {effect.a}", ctx)).toBe(
      "lowering Energy Resistance by 6–12%",
    );
    expect(text("lowering Energy Resistance by {effect.a}%", ctx)).toBe(
      "lowering Energy Resistance by 6–12%",
    );
  });
  it("shows Brooklyn Headbutt's source Attack coefficient as a relative rarity range", () => {
    const display = relicParameterDisplay("a", {
      modSource: "relic.A",
      durSource: "relic.B",
      chanceSource: "1",
      formulaId: "mod_x_atk",
      formula: { formulaType: "mod_x_attk", reqAttrData: true, vara: 1 },
    });
    const ctx = context("0.0060", "0.0120");
    ctx.parameters.effect.a.display = display ?? null;
    expect(
      text("increasing Attack Rating by [16982bff]{effect.a}[-].", ctx),
    ).toBe("increasing Attack Rating by [16982bff]0.6–1.2% of Attack[-].");
  });
  it("labels Attack-based damage without confusing it with a flat amount or potency increase", () => {
    const ctx = context("0.4", "0.8", {
      multiplier: 100,
      basis: "attack-percent",
    });
    expect(text("deal [16982bff]{effect.a}[-] Direct Damage.", ctx)).toBe(
      "deal [16982bff]40–80% of Attack as[-] Direct Damage.",
    );
    expect(text("deals {effect.a} as a Burst of Physical Damage.", ctx)).toBe(
      "deals 40–80% of Attack as a Burst of Physical Damage.",
    );
    expect(text("+{effect.a} Attack Rating on Special 2 Hits.", ctx)).toBe(
      "+40–80% Attack Rating on Special 2 Hits.",
    );
    expect(text("{effect.a}% Attack Rating", ctx)).toBe("40–80% Attack Rating");
  });
  it("shows Health-based healing with one Health unit, including constant coefficients", () => {
    const ctx = context("0.01", "0.03", {
      multiplier: 100,
      basis: "health-percent",
    });
    expect(
      text("recovering [16982bff]{effect.a}[-] Health over 2s.", ctx),
    ).toBe("recovering [16982bff]1–3%[-] Health over 2s.");
    expect(text("recover {effect.a}.", ctx)).toBe("recover 1–3% of Health.");
    ctx.parameters.effect.a.constantRaw = "0.015";
    expect(text("recovering {effect.a} Health over 2s.", ctx)).toBe(
      "recovering 1.5% Health over 2s.",
    );
  });
  it("collapses equal endpoints and rounds noise to at most two decimal places", () => {
    expect(text("{effect.a}%", context("0.039999999", "0.04"))).toBe("4%");
    expect(text("{effect.a}%", context("0.067125", "0.08"))).toBe("6.71–8%");
  });
  it("does not invent a zero endpoint or format invalid and champion-scaled inputs", () => {
    for (const min of ["", "NaN", "Infinity", "hulkbuster"]) {
      expect(text("{effect.a}", context(min, "0.4"))).toBe("Build-dependent");
    }
    const ctx = context("0.2", "0.4");
    ctx.parameters.effect.a.usesChallengeRating = true;
    expect(text("{effect.a}", ctx)).toBe("Build-dependent");
    delete ctx.parameters.effect.a.display;
    ctx.parameters.effect.a.usesChallengeRating = false;
    expect(text("{effect.a}", ctx)).toBe("Build-dependent");
  });
  it("formats proven constants using the same modifier metadata", () => {
    expect(
      text("{effect.a}%", {
        parameters: {
          effect: {
            a: {
              constantRaw: "0.5",
              exponent: 0,
              usesChallengeRating: false,
              display: percent,
            },
          },
        },
      }),
    ).toBe("50%");
  });
  it("shows recorded trigger chances despite the snapshot's unused Challenge Rating flag", () => {
    const display = relicParameterDisplay("c", {
      modSource: "1",
      durSource: "1",
      chanceSource: "relic.C",
      formulaId: null,
      formula: null,
    });
    const ctx: RelicScalingContext = {
      parameters: {
        trigger: {
          c: {
            minAtRarity: "0.1176",
            maxAtRarity: "0.2353",
            usesChallengeRating: true,
            exponent: 1.75,
            display: display ?? null,
          },
        },
      },
    };
    expect(text("independent {trigger.c}% chance to trigger again", ctx)).toBe(
      "independent 11.76–23.53% chance to trigger again",
    );
    expect(text("Chance: {trigger.c}", ctx)).toBe("Chance: 11.76–23.53%");
    ctx.parameters.trigger.c.display = { multiplier: 100, basis: "number" };
    expect(text("{trigger.c}%", ctx)).toBe("Build-dependent%");
  });
  it("does not bypass a failed display dependency with a raw constant", () => {
    expect(
      text("{effect.a}", {
        parameters: {
          effect: {
            a: {
              constantRaw: "0.5",
              exponent: 0,
              usesChallengeRating: false,
              display: null,
            },
          },
        },
      }),
    ).toBe("Build-dependent");
  });
  it("preserves crossing-zero bounds and does not generate negative zero", () => {
    expect(text("reduced by {effect.a}%", context("-0.1", "0.2"))).toBe(
      "reduced by −10–20%",
    );
    expect(text("{effect.a}%", context("-0.000000001", "0.04"))).toBe("0–4%");
  });
});

describe("relic source display rules", () => {
  it("distinguishes modifier, duration and chance parameters", () => {
    const source = {
      modSource: "relic.A",
      durSource: "relic.B",
      chanceSource: "relic.C",
      formula: { formulaType: "mod_x_vara", reqAttrData: false, vara: 100 },
    };
    expect(relicParameterDisplay("a", source)).toEqual(percent);
    expect(relicParameterDisplay("b", source)).toEqual({
      multiplier: 1,
      basis: "number",
    });
    expect(relicParameterDisplay("c", source)).toEqual({
      multiplier: 100,
      basis: "chance-percent",
    });
  });
  it("keeps the basis of attribute-dependent formulas explicit", () => {
    for (const [formulaType, basis] of [
      ["standard", "unbound-percent"],
      ["standard_critdam", "unbound-percent"],
      ["mod_x_attk", "attack-percent"],
      ["mod_x_hp", "health-percent"],
    ]) {
      expect(
        relicParameterDisplay("a", {
          modSource: "relic.A",
          chanceSource: "1",
          durSource: "1",
          formula: { formulaType, reqAttrData: true, vara: 1 },
        }),
      ).toEqual({ multiplier: 100, basis });
    }
  });
  it("refuses unknown formulas, missing modifiers and source expressions", () => {
    expect(relicParameterDisplay("a", null)).toBeUndefined();
    expect(
      relicParameterDisplay("a", {
        modSource: "relic.A",
        chanceSource: "1",
        durSource: "1",
        formulaId: "missing",
        formula: null,
      }),
    ).toBeUndefined();
    expect(
      relicParameterDisplay("a", {
        modSource: "relic.A * 2",
        chanceSource: "1",
        durSource: "1",
      }),
    ).toBeUndefined();
    expect(
      relicParameterDisplay("a", {
        modSource: "relic.A",
        chanceSource: "1",
        durSource: "1",
        formula: { formulaType: "future", reqAttrData: false, vara: 100 },
      }),
    ).toBeUndefined();
  });
});

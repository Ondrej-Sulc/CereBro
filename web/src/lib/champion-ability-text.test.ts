import { describe, expect, it } from "vitest";
import { buildDescriptionTemplate } from "@cerebro/core/services/mcocGameDescriptionsImportService";
import {
  buildMultiCurveData,
  normalizeChampionAbilityTextTemplate,
  prepareChampionAbilityCurveView,
  prepareChampionAbilityText,
  resolveChampionAbilityTextValue,
  validateChampionAbilityTextTemplate,
  type ChampionAbilityCurve,
  type TextTemplate,
} from "./champion-ability-text";

const furyCurve: ChampionAbilityCurve = {
  id: 1,
  curveId: "champion:fury",
  kind: "signature",
  formula: "linear",
  minSig: 1,
  maxSig: 20,
  params: {
    f2: 2,
    f3: 0,
    f4: 0,
    source: {
      componentId: "component-1",
      ability: {
        buffType: "fury",
        paramName: "attackPercent",
      },
    },
    display: {
      precision: 1,
    },
  },
};

const serpentDeathInfoCurve: ChampionAbilityCurve = {
  id: 2,
  curveId: "serpent:srpnt_sig_dth_imm_info_200:crv_srpnt_dur_200",
  kind: "signature",
  formula: "sig",
  minSig: 0,
  maxSig: 200,
  params: {
    f2: 0.001067999983206391,
    f3: 0,
    f4: 0,
    f5: 1.5,
    f6: 3.001068115234375,
    source: {
      panelId: "serpent_sig_200",
      componentId: "srpnt_sig_dth_imm_info_200",
      ability: {
        chance: 0.01250000018626451,
        baseVal: 1.25,
        buffType: "dummy_info",
        duration: 4.998931884765625,
        paramName: "duration",
      },
    },
    display: { baseField: "chance", precision: 1, multiplier: 100 },
    sourceCurveId: "crv_srpnt_dur_200",
  },
};

describe("Champion Ability Text", () => {
  it("validates imported template shape", () => {
    expect(validateChampionAbilityTextTemplate({
      raw: "Gain {0} Attack.",
      blocks: [{
        type: "paragraph",
        children: [{
          type: "value",
          key: "placeholder_0",
          placeholderIndex: 0,
          source: { kind: "abilityParam", rawValue: 10 },
        }],
      }],
    })).toMatchObject({ raw: "Gain {0} Attack." });

    expect(() => validateChampionAbilityTextTemplate({ raw: 123 })).toThrow(/template.raw/);
  });

  it("prepares render-ready blocks through one interface", () => {
    const prepared = prepareChampionAbilityText({
      template: {
        raw: "Gain {0} Attack.",
        blocks: [{
          type: "paragraph",
          children: [
            { type: "text", value: "Gain " },
            {
              type: "value",
              key: "placeholder_0",
              placeholderIndex: 0,
              source: {
                kind: "abilityParam",
                buffType: "fury",
                paramName: "attackPercent",
                rawValue: 0.15,
              },
            },
            { type: "text", value: " Attack." },
          ],
        }],
      },
      curves: [],
      sigLevel: 1,
      stat: { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
    });

    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") return;
    const valueNode = prepared.blocks[0].children[1];
    expect(valueNode).toMatchObject({
      type: "value",
      placeholderIndex: 0,
      resolution: {
        status: "resolved",
        displayValue: "150",
      },
    });
  });

  it("returns malformed templates as structured preparation errors", () => {
    const prepared = prepareChampionAbilityText({ template: { raw: 123 } });

    expect(prepared).toMatchObject({
      status: "error",
      error: {
        code: "MALFORMED_TEMPLATE",
      },
    });
  });

  it("prepares templates produced by the game descriptions importer", () => {
    const template = buildDescriptionTemplate("Projectile hits deal {0} Energy Damage.", {
      placeholder_sources: {
        0: {
          kind: "abilityParam",
          componentId: "sp1_damage",
          buffType: "coldsnap",
          paramName: "modifier",
          field: "chance",
          rawValue: 0.25,
          scaleVar: "self.attack",
          display: { multiplier: 1, precision: 1 },
        },
      },
    });

    const prepared = prepareChampionAbilityText({
      template,
      sigLevel: 1,
      stat: { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
    });

    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") return;
    const valueNode = prepared.blocks[0].children[1];
    expect(valueNode).toMatchObject({
      type: "value",
      resolution: {
        status: "resolved",
        displayValue: "250",
      },
    });
  });

  it("resolves static attack-scaled fury values", () => {
    const result = resolveChampionAbilityTextValue({
      node: {
        type: "value",
        key: "placeholder_0",
        placeholderIndex: 0,
        source: {
          kind: "abilityParam",
          buffType: "fury",
          paramName: "attackPercent",
          rawValue: 0.15,
        },
      },
      curves: [],
      sigLevel: 1,
      stat: { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.value).toBe(150);
      expect(result.displayValue).toBe("150");
    }
  });

  it("resolves curve-backed fury values against selected sig", () => {
    const result = resolveChampionAbilityTextValue({
      node: {
        type: "value",
        key: "placeholder_0",
        placeholderIndex: 0,
        source: {
          kind: "abilityParam",
          componentId: "component-1",
          buffType: "fury",
          paramName: "attackPercent",
        },
      },
      curves: [furyCurve],
      sigLevel: 10,
      stat: { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.value).toBe(200);
      expect(result.detail).toBe("Resolved at Sig 10.");
    }
  });

  it("reports unresolved placeholders as structured errors", () => {
    const result = resolveChampionAbilityTextValue({
      node: { type: "value", key: "placeholder_9", placeholderIndex: 9, source: { kind: "placeholder" } },
      curves: [],
      sigLevel: 99,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toMatchObject({
        code: "UNRESOLVED_PLACEHOLDER",
        placeholderIndex: 9,
      });
    }
  });

  it("builds chart-ready curve points through the same output conversion", () => {
    const data = buildMultiCurveData(
      [furyCurve],
      { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
      10
    );

    expect(data).toContainEqual({ sig: 10, curve0: 200 });
    expect(data.at(-1)).toEqual({ sig: 20, curve0: 400 });
  });

  it("prepares chart-ready curve view data with domain and series labels", () => {
    const view = prepareChampionAbilityCurveView({
      curves: [furyCurve],
      stat: { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
      sigLevel: 10,
    });

    expect(view.data).toContainEqual({ sig: 10, curve0: 200 });
    expect(view.domain).toEqual([-18, 438]);
    expect(view.series).toMatchObject([
      { id: 1, dataKey: "curve0", label: "Fury" },
    ]);
  });

  it("resolves Serpent duration from duration field, not curve display chance", () => {
    const result = resolveChampionAbilityTextValue({
      node: {
        type: "value",
        key: "placeholder_2",
        placeholderIndex: 2,
        source: {
          kind: "abilityParam",
          componentId: "srpnt_sig_dth_imm_info_200",
          buffType: "dummy_info",
          paramName: "duration",
          field: "duration",
          rawValue: 4.998931884765625,
          curveId: "crv_srpnt_dur_200",
          baseVal: 1.25,
          chance: 0.01250000018626451,
          duration: 4.998931884765625,
          scaleVar: "1",
          display: { precision: 0, multiplier: 1 },
        },
      },
      curves: [serpentDeathInfoCurve],
      sigLevel: 40,
      stat: { attack: 5549, challengeRating: 220, sigAbilityIds: ["serpent_sig_200"] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.displayValue).toBe("5.27");
    }
  });

  it("uses static Serpent recovery and power placeholders when import metadata is incomplete", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "this effect recovers " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "srpnt_sig_dth_imm_info_200",
              buffType: "dummy_info",
              paramName: "duration",
              field: "duration",
              rawValue: 4.998931884765625,
              curveId: "crv_srpnt_dur_200",
              baseVal: 1.25,
              f24: 10,
              display: { precision: 0, multiplier: 1 },
            },
          },
          { type: "text", value: "% Max Health per second. While active, gains " },
          { type: "value", key: "placeholder_3", placeholderIndex: 3, source: { kind: "placeholder" } },
          { type: "text", value: "% of a Bar of Power per second." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const recoveryNode = block.children[1];
    const powerNode = block.children[3];

    expect(recoveryNode.type).toBe("value");
    expect(powerNode.type).toBe("value");
    if (recoveryNode.type !== "value" || powerNode.type !== "value") return;

    const recovery = resolveChampionAbilityTextValue({
      node: recoveryNode,
      curves: [serpentDeathInfoCurve],
      sigLevel: 40,
      stat: { attack: 5549, challengeRating: 220, sigAbilityIds: ["serpent_sig_200"] },
    });
    const power = resolveChampionAbilityTextValue({
      node: powerNode,
      curves: [],
      sigLevel: 40,
    });

    expect(recovery.status).toBe("resolved");
    if (recovery.status === "resolved") expect(recovery.displayValue).toBe("1.25");
    expect(power.status).toBe("resolved");
    if (power.status === "resolved") expect(power.displayValue).toBe("10");
  });

  it("uses Serpent static defensive percent values from chance and baseVal metadata", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "prevents his Ability Power Rate from being reduced below " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              field: "base_val",
              chance: 0.5,
              baseVal: 1,
              rawValue: 1,
              display: { precision: 1, multiplier: 100 },
            },
          },
          { type: "text", value: "% by non-Mystic Champions. Bleed effects by " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              field: "base_val",
              buffType: "duration_percent",
              chance: -0.8999999761581421,
              baseVal: 1,
              rawValue: 1,
              display: { precision: 1, multiplier: 100 },
            },
          },
          { type: "text", value: "%. The Serpent's Combat Power Rate is reduced by " },
          {
            type: "value",
            key: "placeholder_0",
            placeholderIndex: 0,
            source: {
              kind: "abilityParam",
              field: "chance",
              chance: 60,
              baseVal: 0.300000011920929,
              rawValue: 60,
              display: { precision: 1, multiplier: 100 },
            },
          },
          { type: "text", value: "% and cannot be reduced further, and he reduces the potency of incoming Power Drain and Burn effects by " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              field: "base_val",
              chance: 60,
              baseVal: 0.300000011920929,
              rawValue: 0.300000011920929,
              display: { precision: 1, multiplier: 100 },
            },
          },
          { type: "text", value: "%." },
        ],
      }],
    };

    const [block] = normalizeChampionAbilityTextTemplate(template);
    const values = block.children.filter((node): node is Extract<typeof node, { type: "value" }> => node.type === "value");
    expect(values[1].source).toMatchObject({ buffType: "duration_percent", chance: -0.8999999761581421 });
    const resolved = values.map(node => resolveChampionAbilityTextValue({ node, curves: [], sigLevel: 1 }));

    expect(resolved.map(result => result.status === "resolved" ? result.displayValue : "error")).toEqual([
      "50",
      "90",
      "30",
      "60",
    ]);
  });

  it("scales special attack damage placeholders from selected Attack", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Projectile hits deal a burst of " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "srpnt_sp2_dmg_info",
              buffType: "dummy_info",
              paramName: "ratingPercent",
              field: "chance",
              rawValue: 0.6499999761581421,
              scaleVar: "1",
              baseVal: 2.5,
              chance: 0.6499999761581421,
              display: { multiplier: 1, precision: 2 },
            },
          },
          { type: "text", value: " Direct Damage, multiplied by " },
          {
            type: "value",
            key: "placeholder_0",
            placeholderIndex: 0,
            source: {
              kind: "abilityParam",
              componentId: "srpnt_sp2_dmg_info",
              buffType: "dummy_info",
              paramName: "chance",
              field: "chance",
              rawValue: 0.6499999761581421,
              scaleVar: "1",
              baseVal: 2.5,
              chance: 0.6499999761581421,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: "% of the Opponents Armor Rating." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const damageNode = block.children[1];
    const percentNode = block.children[3];
    if (damageNode.type !== "value" || percentNode.type !== "value") throw new Error("Expected value nodes");

    const stat = { attack: 6774, challengeRating: 220, sigAbilityIds: [] };
    const damage = resolveChampionAbilityTextValue({ node: damageNode, curves: [], sigLevel: 1, stat });
    const percent = resolveChampionAbilityTextValue({ node: percentNode, curves: [], sigLevel: 1, stat });

    expect(damage.status).toBe("resolved");
    if (damage.status === "resolved") expect(damage.displayValue).toBe("4,403.1");
    expect(percent.status).toBe("resolved");
    if (percent.status === "resolved") expect(percent.displayValue).toBe("250");
  });

  it("scales self.attack special attack damage even when display multiplier is 100", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Projectile hits inflict an instant Coldsnap dealing " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "srpnt_sp1_cold_inst",
              buffType: "coldsnap",
              paramName: "modifier",
              field: "chance",
              rawValue: 0.25,
              scaleVar: "self.attack",
              baseVal: 1,
              chance: 0.25,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " Energy Damage." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 1,
      stat: { attack: 6774, challengeRating: 220, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("1,693.5");
  });

  it("uses negative chance as duration reduction percent", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "reduces Buffs by " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "carl_ind_nerf",
              buffType: "duration_percent",
              paramName: "modifier",
              field: "base_val",
              rawValue: 1,
              scaleVar: "1",
              baseVal: 1,
              chance: -0.8999999761581421,
              duration: -1,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: "%." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({ node, curves: [], sigLevel: 1 });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("90");
  });

  it("converts potency text from percent to challenge rating", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "inflicts a " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "carl_light_ui",
              buffType: "dummy_ui",
              paramName: "modifier",
              field: "base_val",
              rawValue: 0.15000000596046448,
              scaleVar: "1",
              baseVal: 0.15000000596046448,
              chance: 0.15000000596046448,
              duration: 6,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " potency Vulnerability." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 1,
      stat: { attack: 5953, challengeRating: 220, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("458.8");
  });

  it("converts critical rating text from chance percent to challenge rating", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "gains " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "carl_sp3_crit",
              buffType: "crit_rating",
              paramName: "modifier",
              field: "base_val",
              rawValue: 1,
              scaleVar: "1",
              baseVal: 1,
              chance: 0.800000011920929,
              duration: 15,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " Critical Rating." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 1,
      stat: { attack: 5953, challengeRating: 220, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("10,400");
  });

  it("converts resistance and vulnerability potency text to challenge rating", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "gain a " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "srpnt_chnl_res",
              buffType: "resist_up",
              paramName: "modifier",
              field: "chance",
              rawValue: 0.4000000059604645,
              scaleVar: "1",
              baseVal: 1,
              chance: 0.4000000059604645,
              duration: -1,
              display: { multiplier: 1, precision: 1 },
            },
          },
          { type: "text", value: " Resistance Up." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 1,
      stat: { attack: 5549, challengeRating: 220, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("1,733");
  });

  it("converts rating-like dummy info labels such as Pierce", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "gain a " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "srpnt_chnl_prc_info",
              buffType: "dummy_info",
              paramName: "modifier",
              field: "chance",
              rawValue: 0.20000000298023224,
              scaleVar: "1",
              baseVal: 0.10000000149011612,
              chance: 0.20000000298023224,
              duration: -1,
              display: { multiplier: 1, precision: 1 },
            },
          },
          { type: "text", value: " Pierce." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 1,
      stat: { attack: 5549, challengeRating: 220, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("650");
  });

  it("resolves Scorpion time placeholders before percent fallbacks", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "inflicts a Petrify Debuff of " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "scrpn_sp2_info1",
              buffType: "dummy_ui",
              paramName: "modifier",
              field: "base_val",
              rawValue: 0.20000000298023224,
              baseVal: 0.20000000298023224,
              chance: 0.4000000059604645,
              duration: 2,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: "% Potency that lasts for " },
          {
            type: "value",
            key: "placeholder_0",
            placeholderIndex: 0,
            source: {
              kind: "abilityParam",
              componentId: "scrpn_sp2_info1",
              buffType: "dummy_ui",
              paramName: "chance",
              field: "chance",
              rawValue: 0.4000000059604645,
              baseVal: 0.20000000298023224,
              chance: 0.4000000059604645,
              duration: 2,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " seconds." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const values = block.children.filter((node): node is Extract<typeof node, { type: "value" }> => node.type === "value");
    const resolved = values.map(node => resolveChampionAbilityTextValue({ node, curves: [], sigLevel: 1 }));

    expect(resolved.map(result => result.status === "resolved" ? result.displayValue : "error")).toEqual(["20", "40"]);
  });

  it("resolves Scorpion second values from baseVal when that is the source field", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "inflict 10 Torment Debuffs that last for " },
          {
            type: "value",
            key: "placeholder_0",
            placeholderIndex: 0,
            source: {
              kind: "abilityParam",
              componentId: "scrpn_sp3_dummy_1",
              buffType: "dummy_ui",
              paramName: "modifier",
              field: "base_val",
              rawValue: 0.15000000596046448,
              baseVal: 0.15000000596046448,
              chance: 10,
              duration: 3,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " seconds." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({ node, curves: [], sigLevel: 1 });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("15");
  });
});

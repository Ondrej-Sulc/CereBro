import { describe, expect, it } from "vitest";
import { buildDescriptionTemplate } from "@cerebro/core/services/mcocGameDescriptionsImportService";
import {
  buildMultiCurveData,
  collectChampionAbilityTextGlossaryIds,
  normalizeChampionAbilityTextTemplate,
  prepareChampionAbilityCurveView,
  prepareChampionAbilityText,
  prepareChampionAbilityTextView,
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

  it("prepares the Champion Details ability text view through one interface", () => {
    const records = [
      {
        id: 1,
        group: "bio",
        title: null,
        sortOrder: 0,
        template: buildDescriptionTemplate("Bio with [k=glossary/fury]Fury[/k]."),
      },
      {
        id: 2,
        group: "signature",
        title: "[ff0000]Snake Sense[-]",
        sortOrder: 1,
        template: buildDescriptionTemplate("Gain {0} Attack.", {
          placeholder_sources: {
            0: {
              kind: "abilityParam",
              componentId: "component-1",
              buffType: "fury",
              paramName: "attackPercent",
            },
          },
        }),
      },
      {
        id: 3,
        group: "special",
        title: "Special 1",
        sortOrder: 2,
        template: buildDescriptionTemplate("Intro text."),
      },
      {
        id: 4,
        group: "special1",
        title: null,
        sortOrder: 3,
        template: buildDescriptionTemplate("Follow-up text."),
      },
    ];

    const view = prepareChampionAbilityTextView({
      records,
      curves: [
        furyCurve,
        { ...furyCurve, id: 22, curveId: "champion:fury:99", maxSig: 99 },
      ],
      maxSig: 20,
      sigLevel: 10,
      stat: { attack: 1000, challengeRating: 100, sigAbilityIds: [] },
    });

    expect(view.glossaryIds).toEqual(["fury"]);
    expect(view.selectedCurves.map(curve => curve.curveId)).toEqual(["champion:fury"]);
    expect(view.bioRecords).toHaveLength(1);
    expect(view.signaturePanel.recordGroups[0]).toMatchObject({
      title: "Snake Sense",
      records: [{ id: 2 }],
    });
    expect(view.descriptionPanels[0]).toMatchObject({
      group: "special1",
      title: "Special Attack 1 - Special 1",
      introRecord: { id: 3 },
      recordGroups: [{
        title: "Always Active",
        records: [{ id: 4 }],
      }],
    });
    expect(view.curveView.series).toHaveLength(1);
  });

  it("uses titled definition records as headings for the next ability text", () => {
    const view = prepareChampionAbilityTextView({
      records: [
        {
          id: 1,
          group: "base",
          title: "Missions From Thanos",
          sortOrder: 0,
          template: buildDescriptionTemplate("Each Persistent Charge represents a completed Mission."),
        },
        {
          id: 2,
          group: "base",
          title: null,
          sortOrder: 1,
          template: buildDescriptionTemplate("Corvus Glaive has {0} missions.", {
            placeholder_sources: {
              0: {
                kind: "abilityParam",
                componentId: "corvus_cruelty_ui",
                buffType: "dummy_ui",
                paramName: "count",
                field: "f24",
                rawValue: 4,
                f24: 4,
              },
            },
          }),
        },
      ],
      stat: { attack: 10462, challengeRating: 250, sigAbilityIds: [] },
    });

    expect(view.descriptionPanels[0].recordGroups).toMatchObject([{
      title: "Missions From Thanos",
      records: [{ id: 2 }],
    }]);
  });

  it("collects glossary IDs from imported ability text templates", () => {
    expect(collectChampionAbilityTextGlossaryIds([
      { template: buildDescriptionTemplate("[k=glossary/fury]Fury[/k] and [k=glossary/armor_up]Armor Up[/k].") },
      { template: buildDescriptionTemplate("[k=glossary/fury]Fury[/k] again.") },
    ])).toEqual(["armor_up", "fury"]);
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

  it("backfills missing importer placeholder sources from sibling ability metadata", () => {
    const template = buildDescriptionTemplate(
      "Gain a Cruelty Passive, increasing Critical Damage Rating by {1}. Max Stacks: {3}.",
      {
        placeholder_sources: {
          1: {
            kind: "abilityParam",
            componentId: "carl_sp3_cruelty",
            buffType: "crit_damage",
            paramName: "modifier",
            field: "base_val",
            rawValue: 1,
            baseVal: 1,
            chance: 0.25,
            duration: -1,
            f24: 5,
            display: { multiplier: 1, precision: 0 },
          },
        },
      }
    );

    const [block] = template.blocks ?? [];
    const maxStacksNode = block.children.find(
      node => node.type === "value" && node.placeholderIndex === 3
    );

    expect(maxStacksNode).toMatchObject({
      type: "value",
      placeholderIndex: 3,
      source: {
        kind: "abilityParam",
        componentId: "carl_sp3_cruelty",
        paramName: "maxStacks",
        field: "f24",
        rawValue: 5,
        display: { multiplier: 1, precision: 0 },
      },
    });
  });

  it("strips nested and orphaned game markup from prepared text and glossary labels", () => {
    const prepared = prepareChampionAbilityText({
      template: {
        raw: "",
        blocks: [{
          type: "paragraph",
          children: [
            { type: "text", value: "non-" },
            {
              type: "glossary",
              id: "energy_dmg_effects",
              label: "[k=glossary/energy_dmg_effects]Energy Damaging effects",
            },
            { type: "text", value: "[/k] and [fc9335]Fury[-]." },
          ],
        }],
      },
      curves: [],
      sigLevel: 1,
    });

    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") return;
    expect(prepared.blocks[0].children).toEqual([
      { type: "text", value: "non-" },
      { type: "glossary", id: "energy_dmg_effects", label: "Energy Damaging effects" },
      { type: "text", value: " and Fury." },
    ]);
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

  it("scales colored Nick Fury bleed damage while preserving duration seconds", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Ending a combo with a Light Attack has a 100% chance to inflict a Bleed, dealing " },
          {
            type: "color",
            color: "16982bff",
            children: [{
              type: "value",
              key: "placeholder_1",
              placeholderIndex: 1,
              source: {
                kind: "abilityParam",
                componentId: "nick_combo_bleed",
                buffType: "bleed",
                paramName: "modifier",
                field: "chance",
                rawValue: 0.449999988079071,
                scaleVar: "attack",
                chance: 0.449999988079071,
                duration: 1,
                display: { multiplier: 1, precision: 1 },
              },
            }],
          },
          { type: "text", value: " damage over " },
          {
            type: "value",
            key: "placeholder_2",
            placeholderIndex: 2,
            source: {
              kind: "abilityParam",
              componentId: "nick_combo_bleed",
              buffType: "bleed",
              paramName: "duration",
              field: "duration",
              rawValue: 1,
              scaleVar: "attack",
              chance: 0.449999988079071,
              duration: 1,
              display: { multiplier: 1, precision: 0 },
            },
          },
          { type: "text", value: " second." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const damageColor = block.children[1];
    const durationNode = block.children[3];
    if (damageColor.type !== "color" || damageColor.children[0].type !== "value" || durationNode.type !== "value") {
      throw new Error("Expected Nick Fury value nodes");
    }

    const stat = { attack: 10071, challengeRating: 250, sigAbilityIds: [] };
    const damage = resolveChampionAbilityTextValue({ node: damageColor.children[0], curves: [], sigLevel: 200, stat });
    const duration = resolveChampionAbilityTextValue({ node: durationNode, curves: [], sigLevel: 200, stat });

    expect(damage.status).toBe("resolved");
    if (damage.status === "resolved") expect(damage.displayValue).toBe("4,531.95");
    expect(duration.status).toBe("resolved");
    if (duration.status === "resolved") expect(duration.displayValue).toBe("1");
  });

  it("uses Nick Fury whole-number signature curve values as displayed percents", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Direct Damage equal to " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "nick_lmd_degen_5s_base",
              buffType: "damage",
              paramName: "modifier",
              field: "chance",
              rawValue: 5,
              curveId: "crv_nick_5s",
              scaleVar: "(self.hp.max/100)*0.5",
              chance: 5,
              display: { multiplier: 100, precision: 0 },
            },
          },
          { type: "text", value: "% of his health per second." },
        ],
      }],
    };
    const curve: ChampionAbilityCurve = {
      id: 4,
      curveId: "nickfury:nick_lmd_degen_5s_base:crv_nick_5s",
      kind: "signature",
      formula: "sig",
      minSig: 0,
      maxSig: 200,
      params: {
        f2: -0.0009800000116229057,
        f3: 0,
        f4: 0,
        f5: 1.5,
        f6: 999999,
        source: {
          componentId: "nick_lmd_degen_5s_base",
          ability: {
            chance: 5,
            buffType: "damage",
            paramName: "modifier",
          },
        },
        display: { baseField: "chance", precision: 1, multiplier: 100 },
        sourceCurveId: "crv_nick_5s",
      },
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({ node, curves: [curve], sigLevel: 200 });
    const chart = buildMultiCurveData([curve], undefined, 200);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("2.23");
    expect(chart.find(point => point.sig === 200)?.curve0).toBe(2.2281);
  });

  it("uses Nick Fury attackPercent chance when baseVal is a placeholder", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Additional " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "nick_sp3_dmg_boost_a",
              buffType: "fury",
              paramName: "attackPercent",
              field: "base_val",
              rawValue: 1,
              chance: 2,
              baseVal: 1,
              display: { multiplier: 1, precision: 2 },
            },
          },
          { type: "text", value: " Attack if Fury's Fury is active." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 200,
      stat: { attack: 10071, challengeRating: 250, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("20,142");
  });

  it("scales Fury attack rating even when later sentence text contains a percent", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "corvus_special3",
              buffType: "fury",
              paramName: "attackPercent",
              field: "chance",
              rawValue: 1.600000023841858,
              chance: 1.600000023841858,
              atkFrac: 0.10000000149011612,
              display: { multiplier: 1, precision: 2 },
            },
          },
          { type: "text", value: " Attack Rating if active. This amount is doubled below 10% Health." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[0];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 200,
      stat: { attack: 10462, challengeRating: 250, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("16,739.2");
  });

  it("converts Critical Damage Rating percentages to challenge rating", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Cruelty Buff, increasing Critical Damage Rating by " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "corvus_cruelty",
              buffType: "crit_damage",
              paramName: "ratingPercent",
              field: "chance",
              rawValue: 0.6000000238418579,
              chance: 0.6000000238418579,
              display: { multiplier: 1, precision: 0 },
            },
          },
          { type: "text", value: "." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 200,
      stat: { attack: 10462, challengeRating: 250, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("4,125");
  });

  it("scales static regeneration health values from fractional chance metadata", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Regenerate " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "wrlk_sp3_heal",
              buffType: "regen",
              paramName: "modifier",
              field: "base_val",
              rawValue: 1,
              baseVal: 1,
              chance: 0.03999999910593033,
              f27: 0.07999999821186066,
              scaleVar: "opp.passives.totv_inf",
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " Health for each Infection the Opponent has." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 200,
      stat: { attack: 9973, health: 134761, challengeRating: 250, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("5,390.4");
  });

  it("resolves Nico Minoru indexed percent and health-scaled values", () => {
    const stat = { attack: 9582, health: 151936, challengeRating: 250, sigAbilityIds: ["nico_sig"] };
    const nicoPoisonCurve: ChampionAbilityCurve = {
      id: 5,
      curveId: "nicominoru:nico_sig_psn:crv_nico_psn",
      kind: "signature",
      formula: "sig",
      minSig: 0,
      maxSig: 200,
      params: {
        f2: 0.00303000002168119,
        f3: 0,
        f4: 0,
        f5: 0.8700000047683716,
        f6: 0.3030300140380859,
        source: {
          panelId: "nico_sig",
          componentId: "nico_sig_psn",
          ability: {
            chance: 0.1969700008630753,
            atkFrac: 0.009999999776482582,
            buffType: "poison",
            paramName: "modifier",
          },
        },
        display: { baseField: "chance", precision: 1, multiplier: 100 },
        sourceCurveId: "crv_nico_psn",
      },
    };
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Nico inflicts a " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "nico_sig_psn",
              buffType: "poison",
              paramName: "modifier",
              field: "atk_frac",
              rawValue: 0.009999999776482582,
              curveId: "crv_nico_psn",
              scaleVar: "self.attack",
              chance: 0.1969700008630753,
              atkFrac: 0.009999999776482582,
              duration: 12,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " Poison Passive. Converts up to " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "nico_hemo_convert1",
              buffType: "rally_convert",
              paramName: "modifier",
              field: "base_val",
              rawValue: 1,
              scaleVar: "self.hp.max",
              chance: 0.03999999910593033,
              baseVal: 1,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: " Adrenaline to Health." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const values = block.children.filter((node): node is Extract<typeof node, { type: "value" }> => node.type === "value");
    const resolved = values.map(node => resolveChampionAbilityTextValue({ node, curves: [nicoPoisonCurve], sigLevel: 200, stat }));

    expect(resolved.map(result => result.status === "resolved" ? result.displayValue : "error")).toEqual([
      "4,791",
      "6,077.44",
    ]);
  });

  it("resolves Nico Minoru SP1 overloaded info placeholders by placeholder index", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "increased by " },
          {
            type: "value",
            key: "placeholder_0",
            placeholderIndex: 0,
            source: {
              kind: "abilityParam",
              componentId: "nico_sp1_info",
              buffType: "dummy_info",
              paramName: "modifier",
              field: "chance",
              rawValue: 1.5,
              chance: 1.5,
              baseVal: 0.2000000029802322,
              duration: 50,
              f24: 10,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: "% for each Damaging effect, up to " },
          {
            type: "value",
            key: "placeholder_3",
            placeholderIndex: 3,
            source: {
              kind: "abilityParam",
              componentId: "nico_sp1_info",
              buffType: "dummy_info",
              paramName: "maxStacks",
              field: "f24",
              rawValue: 10,
              chance: 1.5,
              baseVal: 0.2000000029802322,
              duration: 50,
              f24: 10,
            },
          },
          { type: "text", value: ". As a Defender, potency is reduced by " },
          {
            type: "value",
            key: "placeholder_2",
            placeholderIndex: 2,
            source: {
              kind: "abilityParam",
              componentId: "nico_sp1_info",
              buffType: "dummy_info",
              paramName: "modifier",
              field: "base_val",
              rawValue: 0.2000000029802322,
              chance: 1.5,
              baseVal: 0.2000000029802322,
              duration: 50,
              f24: 10,
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: "%." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const values = block.children.filter((node): node is Extract<typeof node, { type: "value" }> => node.type === "value");
    const resolved = values.map(node => resolveChampionAbilityTextValue({ node, curves: [], sigLevel: 1 }));

    expect(resolved.map(result => result.status === "resolved" ? result.displayValue : "error")).toEqual([
      "20",
      "10",
      "50",
    ]);
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

  it("resolves Spider-Ham curve-backed signature duration as seconds", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "Porker Poppers last for " },
          {
            type: "value",
            key: "placeholder_2",
            placeholderIndex: 2,
            source: {
              kind: "abilityParam",
              componentId: "spham_sig_ev_sting_5s",
              buffType: "power_sting",
              paramName: "duration",
              field: "duration",
              rawValue: 6.929500102996826,
              curveId: "crv_spham_sting_5s",
              baseVal: 1,
              chance: 0.3499999940395355,
              duration: 6.929500102996826,
              display: { multiplier: 1, precision: 0 },
            },
          },
          { type: "text", value: " second(s)." },
        ],
      }],
    };
    const curve: ChampionAbilityCurve = {
      id: 3,
      curveId: "spiderham:spham_sig_ev_sting_5s:crv_spham_sting_5s",
      kind: "signature",
      formula: "sig",
      minSig: 0,
      maxSig: 200,
      params: {
        f2: 0.07050000131130219,
        f3: 0,
        f4: 0,
        f5: 0.8700000047683716,
        f6: 7.070499897003174,
        source: {
          componentId: "spham_sig_ev_sting_5s",
          ability: {
            buffType: "power_sting",
            duration: 6.929500102996826,
            paramName: "duration",
          },
        },
        display: { baseField: "duration", precision: 0, multiplier: 1 },
        sourceCurveId: "crv_spham_sting_5s",
      },
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const node = block.children[1];
    if (node.type !== "value") throw new Error("Expected value node");

    const result = resolveChampionAbilityTextValue({ node, curves: [curve], sigLevel: 200 });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("14");
  });

  it("scales Spider-Ham Porker Popper damage from attack even when source scale metadata is generic", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "dealing " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "spham_sp2_ui",
              buffType: "dummy_ui",
              paramName: "modifier",
              field: "chance",
              rawValue: 0.6000000238418579,
              baseVal: 0.029999999329447746,
              chance: 0.6000000238418579,
              duration: 9,
              display: { multiplier: 1, precision: 1 },
            },
          },
          { type: "text", value: " Damage." },
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
      stat: { attack: 6762, challengeRating: 220, sigAbilityIds: [] },
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.displayValue).toBe("4,057.2");
  });

  it("keeps chance and duration placeholders from being treated as damage in damage sentences", () => {
    const template: TextTemplate = {
      raw: "",
      blocks: [{
        type: "paragraph",
        children: [
          { type: "text", value: "has a " },
          {
            type: "value",
            key: "placeholder_0",
            placeholderIndex: 0,
            source: {
              kind: "abilityParam",
              componentId: "bwmcu_baton_shk",
              buffType: "shock",
              paramName: "chance",
              field: "base_val",
              rawValue: 0.4000000059604645,
              baseVal: 0.4000000059604645,
              chance: 0.75,
              atkFrac: 0.07000000029802322,
              duration: 3.650000095367432,
              scaleVar: "self.attack",
              display: { multiplier: 100, precision: 1 },
            },
          },
          { type: "text", value: "% chance to inflict Shock dealing " },
          {
            type: "value",
            key: "placeholder_1",
            placeholderIndex: 1,
            source: {
              kind: "abilityParam",
              componentId: "bwmcu_baton_shk",
              buffType: "shock",
              paramName: "modifier",
              field: "atk_frac",
              rawValue: 0.07000000029802322,
              baseVal: 0.4000000059604645,
              chance: 0.75,
              atkFrac: 0.07000000029802322,
              duration: 3.650000095367432,
              scaleVar: "self.attack",
              display: { multiplier: 1, precision: 1 },
            },
          },
          { type: "text", value: " Energy Damage for " },
          {
            type: "value",
            key: "placeholder_2",
            placeholderIndex: 2,
            source: {
              kind: "abilityParam",
              componentId: "bwmcu_baton_shk",
              buffType: "shock",
              paramName: "duration",
              field: "duration",
              rawValue: 3.650000095367432,
              baseVal: 0.4000000059604645,
              chance: 0.75,
              atkFrac: 0.07000000029802322,
              duration: 3.650000095367432,
              scaleVar: "self.attack",
              display: { multiplier: 1, precision: 2 },
            },
          },
          { type: "text", value: " seconds." },
        ],
      }],
    };
    const [block] = normalizeChampionAbilityTextTemplate(template);
    const values = block.children.filter((node): node is Extract<typeof node, { type: "value" }> => node.type === "value");
    const resolved = values.map(node => resolveChampionAbilityTextValue({
      node,
      curves: [],
      sigLevel: 1,
      stat: { attack: 10559, challengeRating: 220, sigAbilityIds: [] },
    }));

    expect(resolved.map(result => result.status === "resolved" ? result.displayValue : "error")).toEqual([
      "75",
      "739.13",
      "3.65",
    ]);
  });
});

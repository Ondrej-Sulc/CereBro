import { getGameEffectColors } from "@cerebro/core/domain/champion-kit";
import {
  RELIC_ATTRIBUTE_GLOSSARY_IDS,
  type RelicAttributeIcon,
} from "./relic-attribute-icons";

// Decorative subject glyphs, not claims that a rune grants the named effect.
const RUNE_GLOSSARY_IDS: Record<string, string> = {
  ...RELIC_ATTRIBUTE_GLOSSARY_IDS,
  "Ability Power Rate": "ability_power_rate",
  "Armor Up": "armor_up",
  "Armor Break": "armor_break",
  Bleed: "bleed",
  "Opp. Bleed": "bleed",
  "Combat Power Rate": "combat_power_rate",
  "Critical Damage": "cruelty",
  "Critical Resist": "critical_resistance",
  Disorient: "disorient",
  Evade: "evade",
  Fury: "fury",
  "Heal Block": "heal_block",
  Incinerate: "incinerate",
  Intimidation: "intimidate",
  "Perfect Block Chance": "perfect_block",
  "Physical Vuln.": "phys_vulnerability",
  "Power Gain": "power_gain",
  "Power Sting": "power_sting",
  Precision: "precision",
  Prowess: "prowess",
  Regen: "regeneration",
  Regeneration: "regeneration",
  Sabotage: "sabotage",
  Shock: "shock",
  "Special Attack Damage": "prowess",
  Stagger: "stagger",
  "True Damage": "true_damage",
  "True Strike": "true_strike",
  Unblockable: "unblockable",
  Unstoppable: "unstoppable",
};

export function relicRuneGlossaryId(name: string): string | undefined {
  const subject = name
    .replace(/ (?:Primary|Secondary)$/, "")
    .replace(
      /(?: (?:Buff|Debuff))? (?:Potency|Duration|Ability Accuracy)(?: (?:Up|Down))?$/,
      "",
    )
    .replace(/ (?:Up|Down)$/, "");
  return Object.hasOwn(RUNE_GLOSSARY_IDS, subject)
    ? RUNE_GLOSSARY_IDS[subject]
    : undefined;
}

export function buildRelicRuneIcons(
  items: readonly { id: string; name: string }[],
  terms: readonly { id: string; iconUrl: string | null; raw: unknown }[],
): Record<string, RelicAttributeIcon> {
  const byId = new Map(terms.map((term) => [term.id, term]));
  const icons: Record<string, RelicAttributeIcon> = {};
  for (const item of items) {
    const id = relicRuneGlossaryId(item.name);
    const term = id ? byId.get(id) : undefined;
    const iconUrl = term?.iconUrl?.trim();
    if (iconUrl)
      icons[item.id] = { iconUrl, color: getGameEffectColors(term?.raw).color };
  }
  return icons;
}

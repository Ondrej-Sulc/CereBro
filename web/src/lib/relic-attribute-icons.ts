import { getGameEffectColors } from "@cerebro/core/domain/champion-kit";

// Presentation glyphs only: these do not imply that the relic grants a Buff.
export const RELIC_ATTRIBUTE_GLOSSARY_IDS = {
  "Critical Damage Rating": "cruelty",
  "Critical Rating": "precision",
  "Critical Resistance": "critical_resistance",
  Armor: "armor_up",
  "Armor Penetration": "pierce",
  "Block Proficiency": "block_proficiency",
  "Energy Resistance": "energy_res",
  "Energy Penetration": "energy_penetration",
  "Physical Resistance": "phys_res",
  "Physical Penetration": "physical_pen",
  "Special Damage": "prowess",
} as const;

export type RelicAttributeIcon = { iconUrl: string; color: string };

export function buildRelicAttributeIcons(
  terms: readonly { id: string; iconUrl: string | null; raw: unknown }[],
): Record<string, RelicAttributeIcon> {
  const byId = new Map(terms.map((term) => [term.id, term]));
  const icons: Record<string, RelicAttributeIcon> = {};
  for (const [attribute, id] of Object.entries(RELIC_ATTRIBUTE_GLOSSARY_IDS)) {
    const term = byId.get(id);
    const iconUrl = term?.iconUrl?.trim();
    if (iconUrl) {
      icons[attribute] = {
        iconUrl,
        color: getGameEffectColors(term?.raw).color,
      };
    }
  }
  return icons;
}

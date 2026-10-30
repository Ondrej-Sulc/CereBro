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
  "Physical Resistance": "phys_res",
  "Special Damage": "prowess",
} as const;

export type RelicAttributeIcon = { iconUrl: string; color: string };

// Penetration glossary artwork is missing or differs from the Statcast Treatment glyph.
// See public/icons/relic-attributes/README.md for the game-source provenance.
const RELIC_SOURCE_ICONS: Record<string, RelicAttributeIcon> = {
  "Energy Penetration": { iconUrl: "/icons/relic-attributes/energy-penetration.svg", color: "#b8c5d6" },
  "Physical Penetration": { iconUrl: "/icons/relic-attributes/physical-penetration.svg", color: "#b8c5d6" },
};

export function buildRelicAttributeIcons(
  terms: readonly { id: string; iconUrl: string | null; raw: unknown }[],
): Record<string, RelicAttributeIcon> {
  const byId = new Map(terms.map((term) => [term.id, term]));
  const icons: Record<string, RelicAttributeIcon> = { ...RELIC_SOURCE_ICONS };
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

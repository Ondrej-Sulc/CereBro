import { ChampionClass, Hit, Tag } from "@prisma/client";
import { formatAbilitySource } from "../../domain/ability-source";
import {
  AttackWithHits,
  ChampionAbilityLinkWithRelations,
} from "../../services/championService";

export const CLASS_COLOR: Record<ChampionClass, number> = {
  MYSTIC: 0xc026d3, // vivid magenta-purple
  MUTANT: 0xffc300, // rich golden yellow (matches Option 3 gradient)
  SKILL: 0xe63946, // crimson red
  SCIENCE: 0x2ecc71, // fresh green
  COSMIC: 0x2dd4d4, // bright cyan
  TECH: 0x4a6cf7, // vivid blue
  SUPERIOR: 0x20c997, // teal-green
};

// Define interfaces for the expected structure of the 'fullAbilities' JSON field.
export interface SignatureAbility {
  name: string; // Title
  description: string; // Description
}
export interface AbilityBlock {
  title: string;
  description: string;
}

export interface FullAbilities {
  signature?: SignatureAbility;
  abilities_breakdown?: AbilityBlock[];
}

export function formatAttacks(
  attacks: AttackWithHits[],
  formattingStyle: "detailed" | "compact" = "compact"
): string {
  if (!attacks || attacks.length === 0) {
    return formattingStyle === "compact"
      ? "None"
      : "Sorry, Attack type values are missing for this champion.";
  }

  const groupedAttacks: { [key: string]: AttackWithHits[] } = {};

  for (const attack of attacks) {
    const key = attack.type.replace(/\d/g, ""); // Group by L, M, S, H

    if (!groupedAttacks[key]) {
      groupedAttacks[key] = [];
    }

    groupedAttacks[key].push(attack);
  }

  let attackStrings: string[] = [];

  for (const key in groupedAttacks) {
    const group = groupedAttacks[key];

    if (group.length > 1) {
      const firstAttackHits = JSON.stringify(
        group[0].hits.map((h: Hit) => h.properties).sort()
      );

      const allSame = group.every(
        (attack) =>
          JSON.stringify(attack.hits.map((h: Hit) => h.properties).sort()) ===
          firstAttackHits
      );

      if (allSame) {
        const attack = group[0];

        const hitCounts = attack.hits.reduce(
          (acc: Record<string, number>, hit: Hit) => {
            const key = hit.properties.join(" ");
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          {}
        );

        const types = Object.entries(hitCounts)
          .map(([detail, count]) => `${count}x ${detail}`)
          .join(", ");
        if (formattingStyle === "compact") {
          attackStrings.push(
            `**${key.toUpperCase()}${
              group.length > 1 ? ` 1-${group.length}` : ""
            } Attack**: ${types}`
          );
        } else {
          // Detailed formatting

          attackStrings.push(
            `### ${key.toUpperCase()}${
              group.length > 1 ? ` 1-${group.length}` : ""
            } Attack:`
          );

          Object.entries(hitCounts).forEach(([detail, count]) => {
            attackStrings.push(`- ${count}x ${detail}`);
          });
        }
      } else {
        for (const attack of group) {
          const hitCounts = attack.hits.reduce(
            (acc: Record<string, number>, hit: Hit) => {
              const key = hit.properties.join(" ");
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            },
            {}
          );

          const types = Object.entries(hitCounts)
            .map(([detail, count]) => `${count}x ${detail}`)
            .join(", ");

          if (formattingStyle === "compact") {
            attackStrings.push(`**${attack.type} Attack**: ${types}`);
          } else {
            // Detailed formatting

            attackStrings.push(`### ${attack.type} Attack:`);

            Object.entries(hitCounts).forEach(([detail, count]) => {
              attackStrings.push(`- ${count}x ${detail}`);
            });
          }
        }
      }
    } else {
      const attack = group[0];
      const hitCounts = attack.hits.reduce(
        (acc: Record<string, number>, hit: Hit) => {
          const key = hit.properties.join(" ");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {}
      );

      const types = Object.entries(hitCounts)
        .map(([detail, count]) => `${count}x ${detail}`)
        .join(", ");

      if (formattingStyle === "compact") {
        attackStrings.push(`**${attack.type} Attack**: ${types}`);
      } else {
        // Detailed formatting

        attackStrings.push(`### ${attack.type} Attack:`);

        Object.entries(hitCounts).forEach(([detail, count]) => {
          attackStrings.push(`- ${count}x ${detail}`);
        });
      }
    }
  }

  return attackStrings.join("\n");
}

export function formatLinkedAbilitySection(
  links: ChampionAbilityLinkWithRelations[],
  resolveEmoji: (text: string) => string,
  sectionTitle: string,
  formattingStyle: "detailed" | "compact"
): string {
  if (!links || links.length === 0) {
    return formattingStyle === "compact"
      ? "None"
      : `No ${sectionTitle.toLowerCase()} found.`;
  }

  // Group by ability name; collect distinct sources per ability
  const byName = new Map<
    string,
    {
      name: string;
      emoji?: string | null;
      sources: string[];
    }
  >();

  for (const link of links) {
    const name = link.ability.name;
    const key = name.toLowerCase();
    let source = formatAbilitySource(link);

    if (link.synergyChampions && link.synergyChampions.length > 0) {
      const synergyPart = link.synergyChampions
        .map((synergy) => {
          const emoji = synergy.champion.discordEmoji
            ? resolveEmoji(synergy.champion.discordEmoji)
            : "";
          return `${emoji}`.trim();
        })
        .join(" ");

      source = `Synergy ${synergyPart}${source && source !== 'Synergy' ? ` & ${source}` : ''}`;
    }

    if (!byName.has(key)) {
      byName.set(key, {
        name,
        emoji: link.ability.emoji || undefined,
        sources: [],
      });
    }
    if (source) {
      const entry = byName.get(key)!;
      if (
        !entry.sources.some(
          (s: string) => s.toLowerCase() === source.toLowerCase()
        )
      ) {
        entry.sources.push(source);
      }
    }
  }

  const items = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (formattingStyle === "compact") {
    const formattedItems = items.map((item) => {
      const emoji = item.emoji ? resolveEmoji(item.emoji) : "";
      const base = `${emoji ? `${emoji} ` : ""}**${item.name}**`;

      if (item.sources.length === 0) {
        return base;
      } else {
        // Sort sources for consistent ordering
        item.sources.sort((a: string, b: string) => a.localeCompare(b));
        return `${base} - ${item.sources.join(" | ")}`;
      }
    });
    return formattedItems.join("\n");
  } else {
    // 'detailed' style
    const lines: string[] = [];

    for (const item of items) {
      const emoji = item.emoji ? resolveEmoji(item.emoji) : "";
      const base = `### ${emoji ? `${emoji} ` : ""}${item.name}`;

      if (item.sources.length === 0) {
        lines.push(base);
      } else if (item.sources.length === 1) {
        lines.push(`${base}\n> ${item.sources[0]}`);
      } else {
        lines.push(base);
        // Sort sources for consistent ordering
        item.sources.sort((a: string, b: string) => a.localeCompare(b));
        for (const source of item.sources) {
          lines.push(`> ${source}`);
        }
      }
    }
    return lines.join("\n");
  }
}

export function formatAbilities(
  abilities: ChampionAbilityLinkWithRelations[],
  resolveEmoji: (text: string) => string
): string {
  return formatLinkedAbilitySection(
    abilities,
    resolveEmoji,
    "Abilities",
    "detailed"
  );
}

export function formatImmunities(
  immunities: ChampionAbilityLinkWithRelations[],
  resolveEmoji: (text: string) => string
): string {
  return formatLinkedAbilitySection(
    immunities,
    resolveEmoji,
    "Immunities",
    "detailed"
  );
}

export function formatTags(tags: Tag[]): string {
  if (!tags || tags.length === 0) {
    return "No tags found for this champion.";
  }
  return tags
    .map((t) => `\`${t.name}\``)
    .sort()
    .join(" ");
}

import { ChampionClass, Hit, Tag } from "@prisma/client";
import { formatAbilitySource, readAbilitySource } from "../../domain/ability-source";
import type { ChampionEffect } from "../../domain/champion-effects";
import { resistanceLabel } from "../../domain/champion-resistance";
import { formatChampionSynergySources, isSynergyEffect, type ChampionEffectDisplay } from "./effect-display";
import {
  AttackWithHits,
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
  links: ChampionEffect[],
  resolveEmoji: (text: string) => string,
  sectionTitle: string,
  formattingStyle: "detailed" | "compact",
  display?: ChampionEffectDisplay
): string {
  if (!links || links.length === 0) {
    return formattingStyle === "compact"
      ? "None"
      : `No ${sectionTitle.toLowerCase()} found.`;
  }

  // Keep each source application, even when independently reviewed copy is identical.
  const byName = new Map<
    string,
    {
      name: string;
      emoji?: string | null;
      sources: string[];
      links: ChampionEffect[];
    }
  >();

  for (const link of links) {
    const name = link.ability.name;
    const key = `${link.type}:${name.toLowerCase()}`;

    if (!byName.has(key)) {
      byName.set(key, {
        name,
        emoji: link.ability.emoji || undefined,
        sources: [],
        links: [],
      });
    }
    byName.get(key)!.links.push(link);
  }
  for (const entry of byName.values()) {
    entry.sources = formatChampionEffectSources(entry.links, resolveEmoji, display, formattingStyle);
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
        lines.push(`${base}\n> ${item.sources[0].replaceAll("\n", "\n> ")}`);
      } else {
        lines.push(base);
        // Sort sources for consistent ordering
        item.sources.sort((a: string, b: string) => a.localeCompare(b));
        for (const source of item.sources) {
          lines.push(`> ${source.replaceAll("\n", "\n> ")}`);
        }
      }
    }
    return lines.join("\n");
  }
}

export function formatAbilities(
  abilities: ChampionEffect[],
  resolveEmoji: (text: string) => string,
  display?: ChampionEffectDisplay
): string {
  if (!abilities.length) return "No abilities found.";
  return ([["GAIN", "Gains on self"], ["INFLICT", "Inflicts on opponent"], ["UNKNOWN", "Direction not recorded"]] as const)
    .flatMap(([direction, title]) => {
      const sources = abilities.filter(ability => ability.effectDirection === direction);
      return sources.length ? [`## ${title}\n${formatLinkedAbilitySection(sources, resolveEmoji, "Abilities", "detailed", display)}`] : [];
    }).join("\n\n");
}

export function formatImmunities(
  immunities: ChampionEffect[],
  resolveEmoji: (text: string) => string,
  display?: ChampionEffectDisplay
): string {
  if (!immunities.length) return "No immunities or resistances found.";
  return ([["IMMUNITY", "Immunities"], ["RESISTANCE", "Resistances"]] as const).flatMap(([type, title]) => {
    const sources = immunities.filter(effect => effect.type === type);
    return sources.length ? [`## ${title}\n${formatLinkedAbilitySection(sources, resolveEmoji, title, "detailed", display)}`] : [];
  }).join("\n\n");
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

/** Keep source metadata and teammate names even when reviewed copy replaces the prose. */
export function formatChampionEffectSource(link: ChampionEffect, resolveEmoji: (text: string) => string = text => text): string {
  if (isSynergyEffect(link)) return formatChampionSynergySources([link], resolveEmoji).join(" | ");
  const metadata = readAbilitySource({ ...link, source: link.overviewSummary ?? link.source });
  const source = formatAbilitySource({ ...metadata, source: metadata.condition,
    effectDirection: link.type === "ABILITY" ? metadata.effectDirection : "UNKNOWN" });
  const protection = link.type === "IMMUNITY" ? "Immunity" : link.resistance ? resistanceLabel(link.resistance) : "";
  return [protection, source].filter(Boolean).join(" — ");
}

export function formatChampionEffectSources(links: ChampionEffect[], resolveEmoji: (text: string) => string = text => text,
  display?: ChampionEffectDisplay, style: "compact" | "detailed" = "compact"): string[] {
  return [...links.filter(link => !isSynergyEffect(link)).map(link => formatChampionEffectSource(link, resolveEmoji)),
    ...formatChampionSynergySources(links, resolveEmoji, display, style)].filter(Boolean);
}

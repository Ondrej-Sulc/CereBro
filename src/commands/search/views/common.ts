import {
  ChampionWithRelations,
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../../types/search";
import { AttackType as AttackTypeEnum } from "@prisma/client";
import {
  isAttackType,
  MODIFIER_KEYWORDS,
} from "../queryBuilder";
import { projectChampionEffects, type ChampionEffect } from "../../../domain/champion-effects";
import { formatChampionEffectSources } from "../../champion/view";
import { prepareChampionEffectDisplay } from "../../champion/effect-display";
import { matchesAbilitySource, matchesProtection, type ParsedSearchCriteria } from "../utils";
import { getApplicationEmojiMarkupByName } from "../../../services/applicationEmojiService";



export function getCriteriaString(
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">
) {
  const criteriaParts: string[] = [];
  for (const [key, value] of Object.entries(searchCriteria)) {
    if (value != null && value !== "") {
      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      const display = key === "includeResistances" ? (value ? "Included" : "Full immunities only") : value;
      criteriaParts.push(`**${formattedKey}:** ${display}`);
    }
  }
  if (searchCriteria.immunities && searchCriteria.includeResistances == null) criteriaParts.push("**Include resistances:** Yes");
  return criteriaParts.join("\n");
}

export function getSearchHeader(criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">, total: number, roster = false): string {
  const text = getCriteriaString(criteria);
  // Keep room for results even for unusually long user-entered AND/OR expressions.
  const preview = text.length > 1000 ? `${text.slice(0, 999)}…` : text;
  return `Found **${total}** champion(s)${roster ? " in your roster" : ""} matching your criteria.\n${preview ? `\n${preview}` : ""}`;
}

export function getSearchPageLimit(criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">, total: number, roster = false): number {
  return 3900 - getSearchHeader(criteria, total, roster).length;
}

export function getChampionDetailsString(
  champion: ChampionWithRelations,
  parsedSearchCriteria: ParsedSearchCriteria
) {
  const details: string[] = [];

  const effects = champion.effects ?? projectChampionEffects(champion.abilities);
  const display = prepareChampionEffectDisplay(champion);
  const abilities = effects.filter(effect => matchesAbilitySource(effect, parsedSearchCriteria));
  const categoryMatches = (effect: ChampionEffect) => !parsedSearchCriteria.abilityCategory.length
    || effect.ability.categories?.some(category => parsedSearchCriteria.abilityCategory.includes(category.name.toLowerCase()));
  const formatEffects = (items: ChampionEffect[]) => {
    const groups = new Map<string, ChampionEffect[]>();
    for (const effect of items) {
      const sources = groups.get(effect.ability.name) ?? [];
      sources.push(effect);
      groups.set(effect.ability.name, sources);
    }
    return [...groups].map(([name, links]) => {
      const sources = formatChampionEffectSources(links, text => text, display);
      return `**${name}**${sources.length ? ` (${sources.join(" | ")})` : ""}`;
    }).join(", ");
  };
  if (parsedSearchCriteria.abilities.length || parsedSearchCriteria.effectForm || parsedSearchCriteria.effectDirection) {
    const matching = abilities.filter(effect => (!parsedSearchCriteria.abilities.length
      || parsedSearchCriteria.abilities.includes(effect.ability.name.toLowerCase())));
    if (matching.length) details.push(`> *Abilities:* ${formatEffects(matching)}`);
  }
  const protections = effects.filter(effect => matchesProtection(effect, parsedSearchCriteria)
    && (!parsedSearchCriteria.immunities.length || parsedSearchCriteria.immunities.includes(effect.ability.name.toLowerCase())));
  if (parsedSearchCriteria.immunities.length || parsedSearchCriteria.minResistance != null) {
    for (const [type, label] of [["IMMUNITY", "Immunities"], ["RESISTANCE", "Resistances"]] as const) {
      const matching = protections.filter(effect => effect.type === type);
      if (matching.length) details.push(`> *${label}:* ${formatEffects(matching)}`);
    }
  }

  if (parsedSearchCriteria.tags.length > 1) {
    const matchedTags = champion.tags
      .filter((tag) =>
        parsedSearchCriteria.tags.includes(tag.name.toLowerCase())
      )
      .map((tag) => tag.name);
    if (matchedTags.length > 0) {
      details.push(`> *Tags:* ${matchedTags.join(", ")}`);
    }
  }

  if (parsedSearchCriteria.abilityCategory.length) {
    const matching = abilities.filter(effect => categoryMatches(effect));
    if (matching.length) details.push(`> *Matching Abilities:* ${formatEffects(matching)}`);
  }

  if (parsedSearchCriteria.attackType.length > 0) {
    const matchedAttacksOutput = new Set<string>();

    parsedSearchCriteria.attackType.forEach((criteria: string) => {
      const parts = criteria.toLowerCase().split(/\s+/).filter(Boolean);
      const searchAttackTypes: AttackTypeEnum[] = [];
      const searchProperties: string[] = [];

      parts.forEach((part: string) => {
        const upperPart = part.toUpperCase();
        if (isAttackType(upperPart)) {
          searchAttackTypes.push(upperPart);
        } else if (part === "basic") {
          searchAttackTypes.push(
            ...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[])
          );
        } else if (part === "special") {
          searchAttackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
        } else if (!MODIFIER_KEYWORDS.includes(part)) {
          searchProperties.push(part);
        }
      });

      champion.attacks.forEach((attack) => {
        const attackTypeMatch =
          searchAttackTypes.length === 0 ||
          searchAttackTypes.includes(attack.type);

        if (attackTypeMatch) {
          const hasAllProperties = searchProperties.every((prop) => {
            if (prop === "non-contact") {
              return attack.hits.some(
                (h) =>
                  !h.properties.includes("Contact") && h.properties.length > 0
              );
            } else {
              return attack.hits.some((h) =>
                h.properties.some((p) => p.toLowerCase() === prop)
              );
            }
          });

          if (hasAllProperties) {
            const props =
              attack.hits.flatMap((h) => h.properties).join(", ") ||
              "No Properties";
            matchedAttacksOutput.add(`${attack.type} (${props})`);
          }
        }
      });
    });

    if (matchedAttacksOutput.size > 0) {
      details.push(
        `> Matched Attacks: *${[...matchedAttacksOutput].join("; ")}*`
      );
    }
  }

  const text = details.join("\n");
  if (text.length <= 1800) return text;
  // Search is a preview. Champion commands retain every source through pagination.
  return `${text.slice(0, 1600).replace(/\s+\S*$/, "")}…\n> Full sources: \`/champion overview champion:${champion.name}\``;
}

export function getChampionDisplayLength(
  champion: ChampionWithRelations,
  parsedSearchCriteria: ParsedSearchCriteria
): number {
  const details = getChampionDetailsString(champion, parsedSearchCriteria);
  const capitalizedClassName =
    champion.class.charAt(0).toUpperCase() +
    champion.class.slice(1).toLowerCase();
  const classEmojiMarkup = getApplicationEmojiMarkupByName(capitalizedClassName);
  const classDisplay = classEmojiMarkup || capitalizedClassName;
  const championEmoji = champion.discordEmoji || "";
  return (
    champion.name.length +
    details.length +
    classDisplay.length +
    championEmoji.length +
    10
  );
}

export function getRosterEntryDisplayLength(
  entry: RosterEntryWithChampionRelations,
  parsedSearchCriteria: ParsedSearchCriteria
): number {
  const championLength = getChampionDisplayLength(
    entry.champion,
    parsedSearchCriteria
  );
  const ascendedEmoji = entry.isAscended ? "🏆" : "";
  const awakenedEmoji = entry.isAwakened ? "★" : "☆";
  const rosterInfoLength =
    ` ${awakenedEmoji} ${entry.stars}* R${entry.rank} ${ascendedEmoji}`.length;
  return championLength + rosterInfoLength;
}

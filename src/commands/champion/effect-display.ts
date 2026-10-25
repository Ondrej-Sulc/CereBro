import type { ChampionEffect } from "../../domain/champion-effects";
import { buildChampionKitOverviewEffects, groupChampionKitSources } from "../../domain/champion-kit";
import { groupSynergySourceDisplay, type SynergySourceDisplay } from "../../domain/champion-kit-source-display";
import { buildChampionSynergyView, type ChampionSynergy } from "../../domain/champion-synergies";
import { formatSynergyRarities } from "../../domain/champion-synergy-display";
import { prepareChampionAbilityTextView, type ChampionAbilityTextRecord, type ChampionAbilityCurve, type ChampionAbilityStat } from "../../domain/champion-ability-text/renderer";
import { formatAbilitySource } from "../../domain/ability-source";
import { resistanceLabel } from "../../domain/champion-resistance";

type DisplayChampion = { id: number; name: string; shortName: string; gameId: string | null; obtainable: string[];
  gameSynergies?: ChampionSynergy[]; abilityTexts?: ChampionAbilityTextRecord[]; abilityCurves?: ChampionAbilityCurve[];
  stats?: Array<ChampionAbilityStat & { rarity: number | null; rank: number }>;
};

export function prepareChampionEffectDisplay(champion?: DisplayChampion) {
  const obtainable = new Set(champion?.obtainable.map(value => Number(value.trim().match(/^[1-7]/)?.[0])));
  const stat = champion?.stats?.filter(stat => stat.rarity != null && obtainable.has(stat.rarity))
    .sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || b.rank - a.rank)[0];
  const maxSig = stat?.rarity && stat.rarity < 5 ? 99 : 200;
  const synergies = buildChampionSynergyView(champion?.gameSynergies ?? [], champion?.id ?? 0, null);
  return {
    view: prepareChampionAbilityTextView({ records: champion?.abilityTexts ?? [], curves: champion?.abilityCurves, stat, maxSig, sigLevel: maxSig }),
    cards: [...synergies.owned, ...synergies.incoming],
    values: { championName: champion?.name, championAliases: [champion?.shortName, champion?.gameId?.replaceAll('_', ' ')].filter((name): name is string => !!name),
      stat, maxSig, sigLevel: maxSig },
  };
}
export type ChampionEffectDisplay = ReturnType<typeof prepareChampionEffectDisplay>;

export function isSynergyEffect(link: ChampionEffect): boolean {
  return link.synergyChampions.length > 0 || /^synergy\b/i.test(link.source?.trim() ?? "");
}

/** Same family grouping, activation variants and catalog bonus resolution as the website. */
export function formatChampionSynergySources(links: ChampionEffect[], resolveEmoji: (text: string) => string,
  display = prepareChampionEffectDisplay(), style: "compact" | "detailed" = "compact"): string[] {
  if (!links.some(isSynergyEffect)) return [];
  const emojis = new Map(links.flatMap(link => link.synergyChampions.map(({ champion }) => [champion.name, champion.discordEmoji] as const)));
  const kitLinks = links.map(link => ({ ...link, synergyChampions: link.synergyChampions.map(({ champion }) => ({
    champion: { ...champion, slug: champion.slug ?? null, images: champion.images ?? null },
  })) }));
  return buildChampionKitOverviewEffects(kitLinks, new Map()).flatMap(effect =>
    groupChampionKitSources(effect, display.view, display.cards, display.values).flatMap(group =>
      groupSynergySourceDisplay(group.synergies).map(source => {
        const icon = (name: string) => (emojis.get(name) ? resolveEmoji(emojis.get(name)!) : "") || name;
        const partners = partnerRequirements(source, icon);
        const header = `Synergy${partners ? ` · ${partners}` : ""}`;
        const references = source.references.map(reference => {
          const variant = reference.variantLabel && !/^Champion\s/i.test(reference.variantLabel) ? formatRequirements(source, reference.variantLabel, icon)
            : reference.level ? `Lv. ${reference.level}` : "";
          const details = reference.details?.filter(detail => !/^Champion\s/i.test(detail.text))
            .map(detail => formatRequirements(source, detail.text, icon)) ?? [];
          return variant ? `${variant}${details.length ? ` (${details.join("; ")})` : ""}` : details.join("; ");
        });
        const level = source.references[0]?.level;
        const commonLevel = source.references.length > 1 && level && source.references.every(reference => reference.level === level) ? `Lv. ${level}` : "";
        const requirements = [commonLevel, ...references].filter(Boolean).join(" · ");
        const protection = effect.type === "IMMUNITY" ? "Immunity" : source.resistance ? resistanceLabel(source.resistance) : "";
        const conditions = source.bonus ? [`${source.bonus.text}${source.bonus.nonStacking ? " Does not stack." : ""}`] : source.conditions;
        const body = conditions.map(condition => [protection, formatAbilitySource({ source: condition, effectForm: group.effectForm,
          effectDirection: effect.type === "ABILITY" ? group.effectDirection : "UNKNOWN" })].filter(Boolean).join(" — "));
        if (!body.length && protection) body.push(protection);
        const values = (source.values ?? []).map(value => `${compactStars(value.label)}: ${value.text}`);
        const applications = source.bonus ? [`Applies to: ${source.bonus.sources.map(application => application.label).join(", ")}.`] : [];
        return style === "detailed"
          ? [`**${header}**`, [requirements ? `**${requirements}**` : "", body.shift()].filter(Boolean).join(" — "), ...body, ...values, ...applications].filter(Boolean).join("\n")
          : [header, requirements, ...body, ...values, ...applications].filter(Boolean).join(" — ");
      })
    )
  );
}

function compactStars(text: string): string {
  return text.replace(/[1-7]★(?:\/[1-7]★)+/g, stars => formatSynergyRarities([...stars.matchAll(/[1-7]/g)].map(match => Number(match[0]))));
}

function partnerRequirements(source: SynergySourceDisplay, icon: (name: string) => string): string {
  const requirements = [...new Set(source.references.map(reference => reference.partnerRequirement).filter((text): text is string => !!text))];
  if (source.champions.length === 1) {
    const stars = source.partnerRarities;
    return `${icon(source.champions[0].name)}${stars?.length ? ` (${formatSynergyRarities(stars)})` : ""}`;
  }
  // Preserve the complete OR/AND expression, including each partner's own stars.
  if (requirements.length === 1) return formatRequirements(source, requirements[0], icon);
  return source.champions.map(champion => icon(champion.name)).join(" · ");
}

function formatRequirements(source: SynergySourceDisplay, text: string, icon: (name: string) => string): string {
  for (const champion of [...source.champions].sort((a, b) => b.name.length - a.name.length)) {
    const name = champion.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`${name}(?= \\([1-7]★)`, "g"), () => icon(champion.name));
  }
  return compactStars(text);
}

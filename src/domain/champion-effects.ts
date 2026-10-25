import { readAbilitySource, type EffectSourceMetadata } from "./ability-source";
import { getCurrentOverviewSummary, overviewSourceHash } from "./champion-overview-summary";
import { resistanceEvidenceHash, resistanceEvidenceRecords } from "./champion-resistance-classification";
import type { ResistanceDetail } from "./champion-resistance";

export type EffectAbility = {
  id: number; name: string; emoji?: string | null;
  categories?: Array<{ name: string }>;
};
export type EffectPartner = { championId: number; champion: { name: string; discordEmoji?: string | null; slug?: string | null; images?: unknown } };
export type ChampionEffectSource = EffectSourceMetadata & {
  id: number; championId: number; abilityId: number; type: "ABILITY" | "IMMUNITY"; source: string | null;
  ability: EffectAbility;
  synergyChampions?: EffectPartner[];
  overviewSummary?: { text: string; sourceHash: string } | null;
  resistances?: Array<ResistanceDetail & { effectId: number; effect: EffectAbility; sourceHash: string; evidence: unknown }>;
};
export type ChampionEffect = EffectSourceMetadata & {
  id: number; championId: number; type: "ABILITY" | "IMMUNITY" | "RESISTANCE"; source: string | null;
  ability: EffectAbility; synergyChampions: EffectPartner[]; overviewSummary: string | null;
  resistance?: ResistanceDetail;
};
export type EffectEvidenceRecord = { id: number; championId: number; template: unknown };

/** Project current protections without changing the stored applications or their reviewed copy. */
export function projectChampionEffects(links: ChampionEffectSource[], records: EffectEvidenceRecord[] = []): ChampionEffect[] {
  const evidenceById = new Map(records.map(record => [record.id, {
    championId: record.championId, hash: resistanceEvidenceHash(record.template),
  }]));
  return links.flatMap<ChampionEffect>(link => {
    const partners = link.synergyChampions ?? [];
    const boundSource = { ...link, name: link.ability.name, synergyChampionIds: partners.map(partner => partner.championId) };
    const summary = getCurrentOverviewSummary(boundSource, link.overviewSummary);
    const { effectForm, effectDirection } = readAbilitySource(link);
    const effect: ChampionEffect = { id: link.id, championId: link.championId, type: link.type,
      source: link.source, ability: link.ability, synergyChampions: partners,
      overviewSummary: summary, effectForm, effectDirection,
    };
    const resistances = link.type === "ABILITY" ? (link.resistances ?? []).filter(row => {
      const evidence = resistanceEvidenceRecords(row.evidence);
      return row.sourceHash === overviewSourceHash(boundSource) && evidence !== null
        && (row.percent === null || evidence.length > 0)
        && evidence.every(record => evidenceById.get(record.recordId)?.championId === link.championId
          && evidenceById.get(record.recordId)?.hash === record.templateHash);
    }) : [];
    return resistances.length ? resistances.map(row => ({ ...effect, type: "RESISTANCE" as const,
      ability: row.effect, effectDirection: "UNKNOWN" as const,
      resistance: { mechanism: row.mechanism, percent: row.percent },
    })) : [{ ...effect, effectDirection: effect.type === "IMMUNITY" ? "UNKNOWN" as const : effect.effectDirection }];
  });
}

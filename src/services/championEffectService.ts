import type { Prisma } from "@prisma/client";
import { prisma } from "./prismaService";
import { projectChampionEffects, type ChampionEffectSource } from "../domain/champion-effects";
import { resistanceEvidenceRecords } from "../domain/champion-resistance-classification";

export const CHAMPION_EFFECT_INCLUDE = {
  ability: { include: { categories: true } },
  synergyChampions: { include: { champion: true } },
  overviewSummary: true,
  resistances: { include: { effect: { include: { categories: true } } } },
} as const satisfies Prisma.ChampionAbilityLinkInclude;

/** Search reads only evidence referenced by the selected sources, in one batch. */
export async function attachChampionEffects<T extends { abilities: ChampionEffectSource[] }>(champions: T[]) {
  const recordIds = [...new Set(champions.flatMap(champion => champion.abilities.flatMap(link =>
    (link.resistances ?? []).flatMap(row => resistanceEvidenceRecords(row.evidence)?.map(record => record.recordId) ?? [])
  )))];
  const records = recordIds.length ? await prisma.championAbilityText.findMany({
    where: { id: { in: recordIds } }, select: { id: true, championId: true, template: true },
  }) : [];
  return champions.map(champion => ({ ...champion, effects: projectChampionEffects(champion.abilities, records) }));
}

export async function attachChampionSynergies<T extends { id: number }>(champions: T[]) {
  const ids = [...new Set(champions.map(champion => champion.id))];
  const rows = ids.length ? await prisma.gameSynergy.findMany({
    where: { enabled: true, members: { some: { championId: { in: ids } } } },
    select: { id: true, name: true, description: true, enabled: true, unique: true, requiredHeroGroups: true,
      members: { select: { role: true, rarity: true, champion: { select: {
        id: true, name: true, shortName: true, class: true, slug: true, images: true,
      } } } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  }) : [];
  return champions.map(champion => ({ ...champion,
    gameSynergies: rows.filter(row => row.members.some(member => member.champion.id === champion.id)),
  }));
}

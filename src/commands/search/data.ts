import { prisma } from "../../services/prismaService";
import { CHAMPION_EFFECT_INCLUDE, attachChampionEffects, attachChampionSynergies } from "../../services/championEffectService";
import { buildSearchWhereClause } from "./queryBuilder";
import { matchesAbilitySource, matchesProtection, parseSearchCriteria, matchesChampionEffectCriteria, type SearchCriteria } from "./utils";

const include = {
  tags: true, abilities: { include: CHAMPION_EFFECT_INCLUDE }, attacks: { include: { hits: true } },
} as const;

export async function findSearchChampions(criteria: SearchCriteria) {
  const candidates = await prisma.champion.findMany({
    where: await buildSearchWhereClause(criteria), include, orderBy: { name: "asc" },
  });
  return attachChampionSynergies((await attachChampionEffects(candidates)).filter(champion => matchesChampionEffectCriteria(champion.effects, criteria)));
}

export async function findSearchRoster(playerId: string, criteria: SearchCriteria) {
  const candidates = await prisma.roster.findMany({
    where: { playerId, champion: await buildSearchWhereClause(criteria) },
    include: { champion: { include } },
    orderBy: [{ stars: "desc" }, { rank: "desc" }, { champion: { name: "asc" } }],
  });
  const champions = await attachChampionSynergies(await attachChampionEffects(candidates.map(entry => entry.champion)));
  return candidates.map((entry, index) => ({ ...entry, champion: champions[index] }))
    .filter(entry => matchesChampionEffectCriteria(entry.champion.effects, criteria));
}

export async function getSearchEffectNames(kind: "abilities" | "immunities", search: string, criteria: SearchCriteria): Promise<string[]> {
  const name = { contains: search, mode: "insensitive" as const };
  const links = await prisma.championAbilityLink.findMany({
    where: { champion: { isPlayable: true }, ...(kind === "abilities"
      ? { type: "ABILITY", ability: { name } } as const
      : { OR: [
        { type: "IMMUNITY", ability: { name } },
        ...(criteria.includeResistances !== false ? [{ type: "ABILITY" as const, resistances: { some: { effect: { name } } } }] : []),
      ] }) },
    include: CHAMPION_EFFECT_INCLUDE,
  });
  const [champion] = await attachChampionEffects([{ abilities: links }]);
  const parsed = parseSearchCriteria(criteria);
  return [...new Set(champion.effects.filter(effect => kind === "abilities"
    ? matchesAbilitySource(effect, parsed) : matchesProtection(effect, parsed))
    .map(effect => effect.ability.name).filter(name => name.toLowerCase().includes(search.toLowerCase())))]
    .sort((a, b) => a.localeCompare(b)).slice(0, 25);
}

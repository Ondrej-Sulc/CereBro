import { AbilityLinkType, DuelStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { collectChampionAbilityTextGlossaryIds } from "@/lib/champion-ability-text"
import { serializeDuelUpdatedAt } from "./duel-targets"
import { collectSynergyGlossaryIds } from "@/lib/champion-synergies"
import { getObtainableChampionStats } from "@/lib/champion-obtainable"
import { getCurrentOverviewSummary } from "@cerebro/core/domain/champion-overview-summary"
import { getChampionSynergies } from "@/lib/data/champion-synergies"

const CHAMPION_DETAILS_TAG = "champion-details"
const CHAMPION_DETAILS_SHARED_TAG = "champion-details-shared"

export const getChampionMetadata = unstable_cache(
  async (slug: string) => prisma.champion.findUnique({
    where: { slug },
    select: { name: true },
  }),
  ["champion-details-metadata"],
  { revalidate: 3600, tags: [CHAMPION_DETAILS_TAG] }
)

const getChampionDetails = unstable_cache(
  async (slug: string) => prisma.champion.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      gameId: true,
      obtainable: true,
      class: true,
      images: true,
      tags: {
        select: { id: true, name: true, category: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      },
      abilities: {
        select: {
          id: true,
          abilityId: true,
          type: true,
          source: true,
          effectForm: true,
          effectDirection: true,
          ability: {
            select: {
              name: true,
              description: true,
              iconUrl: true,
              gameGlossaryTermId: true,
              categories: { select: { name: true } },
            },
          },
          synergyChampions: {
            select: {
              champion: { select: { id: true, name: true, slug: true, images: true } },
            },
          },
        },
        orderBy: [{ type: "asc" }, { ability: { name: "asc" } }],
      },
      abilityTexts: {
        select: {
          id: true,
          group: true,
          title: true,
          sortOrder: true,
          template: true,
        },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      },
      abilityCurves: {
        select: {
          id: true,
          curveId: true,
          kind: true,
          formula: true,
          params: true,
          minSig: true,
          maxSig: true,
        },
        orderBy: [{ kind: "asc" }, { curveId: "asc" }],
      },
      attacks: {
        select: {
          id: true,
          type: true,
          hits: {
            select: {
              id: true,
              properties: true,
            },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { type: "asc" },
      },
      stats: {
        select: {
          id: true,
          tierId: true,
          rarity: true,
          rarityLabel: true,
          rank: true,
          level: true,
          challengeRating: true,
          health: true,
          attack: true,
          healthRating: true,
          attackRating: true,
          prestige: true,
          armorRating: true,
          armorPenetration: true,
          criticalRating: true,
          criticalResistance: true,
          criticalDamageRating: true,
          blockProficiency: true,
          blockPenetration: true,
          specialDamageMultiplier: true,
          energyResistance: true,
          physicalResistance: true,
          baseAbilityIds: true,
          sigAbilityIds: true,
        },
        orderBy: [{ rarity: "desc" }, { rank: "desc" }],
      },
      prestigeData: {
        select: {
          id: true,
          rarity: true,
          rank: true,
          sig: true,
          prestige: true,
        },
        orderBy: [{ rarity: "desc" }, { rank: "desc" }, { sig: "asc" }],
      },
      duels: {
        where: {
          status: { in: [DuelStatus.ACTIVE, DuelStatus.OUTDATED] },
        },
        select: {
          id: true,
          playerName: true,
          rank: true,
          status: true,
          source: true,
          updatedAt: true,
        },
        orderBy: [{ status: "asc" }, { playerName: "asc" }],
      },
    },
  }),
  ["champion-details-game-bindings-v1"],
  { revalidate: 3600, tags: [CHAMPION_DETAILS_TAG] }
)

const getGlossaryTerms = unstable_cache(
  async (ids: string[]) => prisma.gameGlossaryTerm.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      iconUrl: true,
      raw: true,
    },
    orderBy: { name: "asc" },
  }),
  ["champion-details-glossary"],
  { revalidate: 3600, tags: [CHAMPION_DETAILS_SHARED_TAG] }
)

const getMaxStatsByTier = unstable_cache(
  async () => {
    const rows = await prisma.championStats.groupBy({
      by: ["rarity", "rank"],
      _max: {
        health: true,
        attack: true,
        armorRating: true,
        armorPenetration: true,
        criticalRating: true,
        criticalResistance: true,
        criticalDamageRating: true,
        blockProficiency: true,
        blockPenetration: true,
        specialDamageMultiplier: true,
        energyResistance: true,
        physicalResistance: true,
      },
    })

    return rows.reduce((acc, row) => {
      if (row.rarity != null && row.rank != null) {
        acc[`${row.rarity}-${row.rank}`] = row._max
      }
      return acc
    }, {} as Record<string, Record<string, number | null>>)
  },
  ["champion-details-max-stats"],
  { revalidate: 3600, tags: [CHAMPION_DETAILS_SHARED_TAG] }
)

export async function loadChampionDetails(slug: string) {
  const [champion, maxStatsByTier] = await Promise.all([
    getChampionDetails(slug),
    getMaxStatsByTier(),
  ])

  if (!champion) return null

  // Fetch display copy outside the long-lived champion cache so approved edits show immediately.
  const [gameSynergies, overviewSummaries] = await Promise.all([
    getChampionSynergies(champion.id),
    prisma.championAbilityOverview.findMany({ where: { championAbilityLinkId: { in: champion.abilities.map(link => link.id) } },
      select: { championAbilityLinkId: true, text: true, sourceHash: true,
        championAbilityLink: { select: { id: true, championId: true, abilityId: true, type: true, source: true,
          effectForm: true, effectDirection: true, ability: { select: { name: true } },
          synergyChampions: { select: { championId: true } } } },
      } }),
  ])
  const summaryByLink = new Map(overviewSummaries.map(summary => [summary.championAbilityLinkId, summary]))
  const glossaryIds = [...new Set([...collectChampionGlossaryIds(champion), ...collectSynergyGlossaryIds(gameSynergies)])].sort()
  const glossaryTerms = glossaryIds.length ? await getGlossaryTerms(glossaryIds) : []

  return {
    champion: {
      ...champion,
      stats: getObtainableChampionStats(champion),
      gameSynergies,
      abilities: champion.abilities.map(link => ({
        ...link,
        overviewSummary: (() => {
          const saved = summaryByLink.get(link.id)
          if (!saved) return null
          const current = saved.championAbilityLink
          return getCurrentOverviewSummary({ id: link.id, championId: champion.id, abilityId: link.abilityId, name: link.ability.name,
          type: link.type, source: link.source, effectForm: link.effectForm, effectDirection: link.effectDirection,
          synergyChampionIds: link.synergyChampions.map(partner => partner.champion.id) }, saved,
          { id: current.id, championId: current.championId, abilityId: current.abilityId, name: current.ability.name,
            type: current.type, source: current.source, effectForm: current.effectForm, effectDirection: current.effectDirection,
            synergyChampionIds: current.synergyChampions.map(partner => partner.championId) })
        })(),
        type: link.type === AbilityLinkType.IMMUNITY ? "IMMUNITY" as const : "ABILITY" as const,
      })),
      duels: champion.duels.map(duel => ({
        ...duel,
        status: duel.status === DuelStatus.OUTDATED ? "OUTDATED" as const : "ACTIVE" as const,
        updatedAt: serializeDuelUpdatedAt(duel.updatedAt),
      })),
    },
    glossaryTerms,
    maxStatsByTier,
  }
}

function collectChampionGlossaryIds(champion: NonNullable<Awaited<ReturnType<typeof getChampionDetails>>>) {
  const ids = new Set<string>()

  for (const link of champion.abilities) {
    if (link.ability.gameGlossaryTermId) ids.add(link.ability.gameGlossaryTermId)
    else ids.add(link.ability.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"))
  }

  for (const id of collectChampionAbilityTextGlossaryIds(champion.abilityTexts)) {
    ids.add(id)
  }

  return Array.from(ids).sort()
}

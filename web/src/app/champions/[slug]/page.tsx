import { notFound } from "next/navigation"
import { Metadata } from "next"
import { AbilityLinkType } from "@prisma/client"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { collectChampionAbilityTextGlossaryIds } from "@/lib/champion-ability-text"
import { ChampionDetailsClient } from "./champion-details-client"

type PageProps = {
  params: Promise<{ slug: string }>
}

const CHAMPION_DETAILS_TAG = "champion-details"
const CHAMPION_DETAILS_SHARED_TAG = "champion-details-shared"

const getChampionMetadata = unstable_cache(
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
      class: true,
      images: true,
      tags: {
        select: { id: true, name: true, category: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      },
      abilities: {
        select: {
          id: true,
          type: true,
          source: true,
          ability: {
            select: {
              name: true,
              iconUrl: true,
              gameGlossaryTermId: true,
              categories: { select: { name: true } },
            },
          },
          synergyChampions: {
            select: {
              champion: { select: { name: true, slug: true, images: true } },
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
    },
  }),
  ["champion-details"],
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
    const maxStatsByTierRaw = await prisma.championStats.groupBy({
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

    return maxStatsByTierRaw.reduce((acc, row) => {
      if (row.rarity != null && row.rank != null) {
        acc[`${row.rarity}-${row.rank}`] = row._max
      }
      return acc
    }, {} as Record<string, Record<string, number | null>>)
  },
  ["champion-details-max-stats"],
  { revalidate: 3600, tags: [CHAMPION_DETAILS_SHARED_TAG] }
)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const champion = await getChampionMetadata(slug)

  if (!champion) return { title: "Champion Not Found | CereBro" }

  return {
    title: `${champion.name} | CereBro`,
    description: `Champion details, abilities, tags, and game stats for ${champion.name}.`,
  }
}

export default async function ChampionDetailsPage({ params }: PageProps) {
  const { slug } = await params
  const [champion, maxStatsByTier] = await Promise.all([
    getChampionDetails(slug),
    getMaxStatsByTier(),
  ])

  if (!champion) notFound()

  const glossaryIds = collectChampionGlossaryIds(champion)
  const glossaryTerms = glossaryIds.length ? await getGlossaryTerms(glossaryIds) : []

  return (
    <ChampionDetailsClient
      champion={{
        ...champion,
        abilities: champion.abilities.map(link => ({
          ...link,
          type: link.type === AbilityLinkType.IMMUNITY ? "IMMUNITY" : "ABILITY",
        })),
      }}
      glossaryTerms={glossaryTerms}
      maxStatsByTier={maxStatsByTier}
    />
  )
}

function collectChampionGlossaryIds(champion: Awaited<ReturnType<typeof getChampionDetails>>) {
  const ids = new Set<string>()
  if (!champion) return []

  for (const link of champion.abilities) {
    if (link.ability.gameGlossaryTermId) ids.add(link.ability.gameGlossaryTermId)
  }

  for (const id of collectChampionAbilityTextGlossaryIds(champion.abilityTexts)) {
    ids.add(id)
  }

  return Array.from(ids).sort()
}

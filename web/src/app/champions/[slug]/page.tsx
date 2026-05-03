import { notFound } from "next/navigation"
import { Metadata } from "next"
import { AbilityLinkType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ChampionDetailsClient } from "./champion-details-client"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const champion = await prisma.champion.findUnique({
    where: { slug },
    select: { name: true },
  })

  if (!champion) return { title: "Champion Not Found | CereBro" }

  return {
    title: `${champion.name} | CereBro`,
    description: `Champion details, abilities, tags, and game stats for ${champion.name}.`,
  }
}

export default async function ChampionDetailsPage({ params }: PageProps) {
  const { slug } = await params
  const champion = await prisma.champion.findUnique({
    where: { slug },
    include: {
      tags: { orderBy: [{ category: "asc" }, { name: "asc" }] },
      abilities: {
        include: {
          ability: {
            include: { categories: { select: { name: true } } },
          },
          synergyChampions: {
            include: {
              champion: { select: { name: true, slug: true, images: true } },
            },
          },
        },
        orderBy: [{ type: "asc" }, { ability: { name: "asc" } }],
      },
      abilityTexts: {
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      },
      abilityCurves: {
        orderBy: [{ kind: "asc" }, { curveId: "asc" }],
      },
      stats: {
        orderBy: [{ rarity: "desc" }, { rank: "desc" }],
      },
      prestigeData: {
        orderBy: [{ rarity: "desc" }, { rank: "desc" }, { sig: "asc" }],
      },
    },
  })

  if (!champion) notFound()

  const glossaryTerms = await prisma.gameGlossaryTerm.findMany()

  const maxStatsByTierRaw = await prisma.championStats.groupBy({
    by: ['rarity', 'rank'],
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
    }
  })

  const maxStatsByTier = maxStatsByTierRaw.reduce((acc, row) => {
    if (row.rarity != null && row.rank != null) {
      acc[`${row.rarity}-${row.rank}`] = row._max
    }
    return acc
  }, {} as Record<string, any>)

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

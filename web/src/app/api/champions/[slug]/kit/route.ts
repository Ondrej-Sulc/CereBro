import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRouteContext } from "@/lib/with-request-context"
import { getCurrentOverviewSummary } from "@cerebro/core/domain/champion-overview-summary"
import { buildRosterKitDetails } from "@/lib/roster-kit-details"
import { getChampionSynergies } from "@/lib/data/champion-synergies"
import { buildChampionSynergyView } from "@/lib/champion-synergies"
import { attachResistances, getResistanceIndex } from "@/lib/data/champion-resistances"
import { maxSigForRarity } from "@/lib/mcoc-prestige"

export const GET = withRouteContext(async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params
  const rarityParam = request.nextUrl.searchParams.get("rarity")
  const rarity = rarityParam === null ? undefined : Number(rarityParam)
  if (rarity !== undefined && (!Number.isInteger(rarity) || rarity < 1 || rarity > 7)) {
    return NextResponse.json({ error: "Invalid rarity" }, { status: 400 })
  }
  const sigParam = request.nextUrl.searchParams.get("sig")
  const sigLevel = sigParam === null ? undefined : Number(sigParam)
  if (sigLevel !== undefined && (!sigParam?.trim() || !Number.isInteger(sigLevel) || sigLevel < 0 || sigLevel > maxSigForRarity(rarity))) {
    return NextResponse.json({ error: "Invalid signature level" }, { status: 400 })
  }
  const rankParam = request.nextUrl.searchParams.get("rank")
  const rank = rankParam === null ? undefined : Number(rankParam)
  if (rank !== undefined && (!rarity || !Number.isInteger(rank) || rank < 1 || rank > 10)) {
    return NextResponse.json({ error: "Invalid rank" }, { status: 400 })
  }
  // Read live source bindings with their summaries, outside the roster's long-lived catalog cache.
  const champion = await prisma.champion.findUnique({ where: { slug }, select: {
    id: true,
    name: true, shortName: true, gameId: true,
    abilities: { select: {
      id: true, championId: true, abilityId: true, type: true, source: true, effectForm: true, effectDirection: true,
      overviewSummary: { select: { text: true, sourceHash: true } },
      ability: { select: { name: true, description: true, iconUrl: true, gameGlossaryTermId: true,
        gameGlossaryTerm: { select: { raw: true } }, categories: { select: { name: true } } } },
      synergyChampions: { select: { championId: true, champion: { select: { name: true, slug: true, images: true } } } },
    } },
    abilityTexts: { select: { id: true, group: true, title: true, sortOrder: true, template: true }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
    abilityCurves: true,
    stats: { where: { ...(rarity ? { rarity } : {}), ...(rank ? { rank } : {}) },
      orderBy: [{ rarity: "desc" }, { rank: "desc" }], take: 1,
      select: { rarity: true, rank: true, attack: true, health: true, challengeRating: true, sigAbilityIds: true } },
  } })
  if (!champion) return NextResponse.json({ error: "Champion not found" }, { status: 404 })
  const synergies = buildChampionSynergyView(await getChampionSynergies(champion.id), champion.id, rarity ?? null)
  const entries = attachResistances(champion.abilities, await getResistanceIndex(champion.id)).map(link => ({ ...link, overviewSummary: getCurrentOverviewSummary({
    id: link.id, championId: link.championId, abilityId: link.abilityId, name: link.ability.name,
    type: link.type, source: link.source, effectForm: link.effectForm, effectDirection: link.effectDirection,
    synergyChampionIds: link.synergyChampions.map(partner => partner.championId),
  }, link.overviewSummary) }))
  return NextResponse.json(buildRosterKitDetails(entries, champion.abilityTexts, rarity, [...synergies.owned, ...synergies.incoming], {
    sigLevel, maxSig: maxSigForRarity(rarity ?? champion.stats[0]?.rarity), championName: champion.name,
    championAliases: [champion.shortName, champion.gameId?.replaceAll('_', ' ')].filter((name): name is string => !!name), stat: champion.stats[0],
  }, champion.abilityCurves), { headers: { "Cache-Control": "no-store" } })
})

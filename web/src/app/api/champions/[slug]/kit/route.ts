import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRouteContext } from "@/lib/with-request-context"
import { getCurrentOverviewSummary } from "@cerebro/core/domain/champion-overview-summary"
import { buildRosterKitDetails } from "@/lib/roster-kit-details"
import { getChampionSynergies } from "@/lib/data/champion-synergies"
import { buildChampionSynergyView } from "@/lib/champion-synergies"
import { attachResistances, getResistanceIndex } from "@/lib/data/champion-resistances"

export const GET = withRouteContext(async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params
  const rarityParam = request.nextUrl.searchParams.get("rarity")
  const rarity = rarityParam === null ? undefined : Number(rarityParam)
  if (rarity !== undefined && (!Number.isInteger(rarity) || rarity < 1 || rarity > 7)) {
    return NextResponse.json({ error: "Invalid rarity" }, { status: 400 })
  }
  // Read live source bindings with their summaries, outside the roster's long-lived catalog cache.
  const champion = await prisma.champion.findUnique({ where: { slug }, select: {
    id: true,
    abilities: { select: {
      id: true, championId: true, abilityId: true, type: true, source: true, effectForm: true, effectDirection: true,
      overviewSummary: { select: { text: true, sourceHash: true } },
      ability: { select: { name: true, description: true, iconUrl: true, gameGlossaryTermId: true,
        gameGlossaryTerm: { select: { raw: true } }, categories: { select: { name: true } } } },
      synergyChampions: { select: { championId: true, champion: { select: { name: true, slug: true, images: true } } } },
    } },
    abilityTexts: { select: { id: true, group: true, title: true, sortOrder: true, template: true }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
  } })
  if (!champion) return NextResponse.json({ error: "Champion not found" }, { status: 404 })
  const synergies = buildChampionSynergyView(await getChampionSynergies(champion.id), champion.id, rarity ?? null)
  const entries = attachResistances(champion.abilities, await getResistanceIndex(champion.id)).map(link => ({ ...link, overviewSummary: getCurrentOverviewSummary({
    id: link.id, championId: link.championId, abilityId: link.abilityId, name: link.ability.name,
    type: link.type, source: link.source, effectForm: link.effectForm, effectDirection: link.effectDirection,
    synergyChampionIds: link.synergyChampions.map(partner => partner.championId),
  }, link.overviewSummary) }))
  return NextResponse.json(buildRosterKitDetails(entries, champion.abilityTexts, rarity, [...synergies.owned, ...synergies.incoming]), { headers: { "Cache-Control": "no-store" } })
})

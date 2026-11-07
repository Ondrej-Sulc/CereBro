import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getChampionCrystals } from "@cerebro/core/data/game-crystals"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rarity = new URL(request.url).searchParams.get("rarity")
  if (!rarity || !/^[1-7]$/.test(rarity)) return NextResponse.json({ error: "Invalid star level" }, { status: 400 })
  const { slug } = await params
  const champion = await prisma.champion.findUnique({ where: { slug }, select: { gameId: true } })
  if (!champion) return NextResponse.json({ error: "Champion not found" }, { status: 404 })
  const data = getChampionCrystals(champion.gameId)
  return NextResponse.json({ ...data, crystals: data.crystals.filter(crystal => !crystal.isMainPool && crystal.rarities.includes(Number(rarity))) },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } })
}

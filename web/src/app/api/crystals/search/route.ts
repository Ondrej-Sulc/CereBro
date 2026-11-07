import { NextRequest, NextResponse } from "next/server"
import { searchCrystalOptions } from "@/lib/data/crystals"

export function GET(request: NextRequest) {
  return NextResponse.json(searchCrystalOptions({ q: request.nextUrl.searchParams.get("q") ?? "", rarity: request.nextUrl.searchParams.get("rarity") ?? "" }), { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } })
}

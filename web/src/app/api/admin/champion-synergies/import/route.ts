import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBotAdmin } from "@/lib/auth-helpers"
import { withRouteContext } from "@/lib/with-request-context"
import { importMcocSynergies, parseMcocSynergiesJson } from "@cerebro/core/services/mcocSynergiesImportService"

export const runtime = "nodejs"
export const maxDuration = 120

export const POST = withRouteContext(async (req: NextRequest) => {
  try { await requireBotAdmin("MANAGE_CHAMPIONS") }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const limit = 25 * 1024 * 1024
  if (Number(req.headers.get("content-length") ?? 0) > limit) {
    return NextResponse.json({ error: "JSON file is too large" }, { status: 413 })
  }
  const text = await req.text()
  if (Buffer.byteLength(text, "utf8") > limit) return NextResponse.json({ error: "JSON file is too large" }, { status: 413 })
  let data
  try { data = parseMcocSynergiesJson(text) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid synergy snapshot" }, { status: 400 }) }
  const write = req.nextUrl.searchParams.get("write") === "true"
  const report = await importMcocSynergies(prisma, data, { write })
  if (write) {
    revalidatePath("/admin/champions")
    revalidatePath("/champions/[slug]", "page")
    revalidateTag("champion-details", "default")
    revalidateTag("champion-details-shared", "default")
  }
  return NextResponse.json(report)
})

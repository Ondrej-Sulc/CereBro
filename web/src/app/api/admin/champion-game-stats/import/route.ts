import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBotAdmin } from "@/lib/auth-helpers"
import {
  importMcocGameStats,
  parseMcocGameStatsJson,
} from "@cerebro/core/services/mcocGameStatsImportService"
import { withRouteContext } from "@/lib/with-request-context"

export const runtime = "nodejs"
export const maxDuration = 120

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    await requireBotAdmin("MANAGE_CHAMPIONS")

    const contentLength = Number(req.headers.get("content-length") ?? 0)
    if (contentLength > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "JSON file is too large" }, { status: 413 })
    }

    const text = await req.text()
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty JSON file" }, { status: 400 })
    }
    if (text.length > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "JSON file is too large" }, { status: 413 })
    }

    const data = parseMcocGameStatsJson(text)
    const report = await importMcocGameStats(prisma, data, { write: true })

    revalidatePath("/admin/champions")
    revalidatePath("/champions/[slug]", "page")
    revalidateTag("champion-details", "default")
    revalidateTag("champion-details-shared", "default")
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
})

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBotAdmin } from "@/lib/auth-helpers"
import {
  importMcocAbilityCurves,
  parseMcocAbilityCurvesJson,
} from "@cerebro/core/services/mcocAbilityCurvesImportService"
import { withRouteContext } from "@/lib/with-request-context"

export const runtime = "nodejs"
export const maxDuration = 120

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    await requireBotAdmin("MANAGE_CHAMPIONS")

    const contentLength = Number(req.headers.get("content-length") ?? 0)
    if (contentLength > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "JSON payload is too large" }, { status: 413 })
    }

    const payload = await req.json() as { curves?: unknown }
    if (!payload.curves) {
      return NextResponse.json({ error: "mcoc_ability_curves.json is required" }, { status: 400 })
    }

    const curves = parseMcocAbilityCurvesJson(JSON.stringify(payload.curves))
    const report = await importMcocAbilityCurves(prisma, curves, { write: true })

    revalidatePath("/admin/champions")
    revalidatePath("/champions/[slug]", "page")
    revalidateTag("champion-details", "default")
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
})

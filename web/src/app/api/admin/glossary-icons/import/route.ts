import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBotAdmin } from "@/lib/auth-helpers"
import { importGlossaryIcons, GlossaryIconUpdate } from "@cerebro/core/services/glossaryIconsImportService"
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

    let updates: GlossaryIconUpdate[]
    try {
      updates = JSON.parse(text)
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
    }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "JSON root must be an array" }, { status: 400 })
    }

    const report = await importGlossaryIcons(prisma, updates, { write: true })

    revalidatePath("/admin/champions")
    revalidatePath("/champions/[slug]", "page")
    revalidateTag("champion-details-shared", "default")
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
})

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireBotAdmin } from "@/lib/auth-helpers"
import {
  importMcocGameDescriptions,
  parseMcocGameDescriptionsJson,
  parseMcocGameGlossaryJson,
} from "@cerebro/core/services/mcocGameDescriptionsImportService"
import { withRouteContext } from "@/lib/with-request-context"

export const runtime = "nodejs"
export const maxDuration = 120

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    await requireBotAdmin("MANAGE_CHAMPIONS")

    const contentLength = Number(req.headers.get("content-length") ?? 0)
    if (contentLength > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "JSON payload is too large" }, { status: 413 })
    }

    const payload = await req.json() as { champions?: unknown; glossary?: unknown }
    if (!payload.champions || !payload.glossary) {
      return NextResponse.json(
        { error: "Both champions.json and glossary.json are required" },
        { status: 400 }
      )
    }

    const descriptions = parseMcocGameDescriptionsJson(JSON.stringify(payload.champions))
    const glossary = parseMcocGameGlossaryJson(JSON.stringify(payload.glossary))
    const report = await importMcocGameDescriptions(prisma, descriptions, glossary, { write: true })

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

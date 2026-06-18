import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { withRouteContext } from "@/lib/with-request-context";
import {
  importDuelCsv,
  isDuelImportSource,
} from "@cerebro/core/services/duelImportService";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CSV_SIZE = 5 * 1024 * 1024;

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    await requireBotAdmin("MANAGE_CHAMPIONS");

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_CSV_SIZE + 1024) {
      return NextResponse.json({ error: "CSV file is too large. Maximum size is 5 MB." }, { status: 413 });
    }

    const formData = await req.formData();
    const source = String(formData.get("source") ?? "");
    const file = formData.get("csv");

    if (!isDuelImportSource(source)) {
      return NextResponse.json({ error: "Unsupported duel source." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }
    if (file.size > MAX_CSV_SIZE) {
      return NextResponse.json({ error: "CSV file is too large. Maximum size is 5 MB." }, { status: 413 });
    }

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json({ error: "CSV file is empty." }, { status: 400 });
    }

    const report = await prisma.$transaction(
      (tx) => importDuelCsv(tx, text, source),
      { timeout: 120_000 }
    );

    revalidatePath("/admin/duels");
    revalidateTag("champion-details", "default");
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Duel import failed." },
      { status: 500 }
    );
  }
});

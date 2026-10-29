import { recordChampionPrestige } from "@cerebro/core/services/playerPrestigeService";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { z } from "zod";
import { withRouteContext } from "@/lib/with-request-context";

const updateSchema = z.object({
  championPrestige: z.number().int().positive(),
});

export const POST = withRouteContext(async (req: Request) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { championPrestige } = updateSchema.parse(body);

    await recordChampionPrestige(prisma, player.id, championPrestige);
    revalidatePath("/profile");
    revalidatePath("/relics", "layout");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error in update-prestige route");
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

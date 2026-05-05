import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";
import { expandMcocPrestigeCurve } from "@/lib/mcoc-prestige";

const querySchema = z.object({
  championId: z.coerce.number(),
  rarity: z.coerce.number(),
  rank: z.coerce.number(),
});

export const GET = withRouteContext(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const result = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!result.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { championId, rarity, rank } = result.data;

  try {
    const prestige = await prisma.championPrestige.findMany({
      where: {
        championId,
        rarity,
        rank,
      },
      orderBy: { sig: 'asc' },
      select: { championId: true, rarity: true, rank: true, sig: true, prestige: true },
    });

    if (prestige.length === 0) {
      return NextResponse.json({ error: "Prestige data not found" }, { status: 404 });
    }

    return NextResponse.json(
      expandMcocPrestigeCurve({
        prestigeData: prestige,
        stat: { rarity, rank, prestige: prestige.find(row => row.sig === 0)?.prestige ?? null },
      })
    );
  } catch (error) {
    logger.error({ error, championId }, "Error fetching prestige data");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

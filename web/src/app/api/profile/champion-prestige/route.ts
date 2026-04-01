import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

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
      select: { sig: true, prestige: true },
    });

    if (prestige.length === 0) {
      return NextResponse.json({ error: "Prestige data not found" }, { status: 404 });
    }

    // Interpolate missing sig levels between stored data points
    const interpolated: { sig: number; prestige: number }[] = [];
    for (let i = 0; i < prestige.length; i++) {
      interpolated.push(prestige[i]);
      if (i < prestige.length - 1) {
        const curr = prestige[i];
        const next = prestige[i + 1];
        for (let sig = curr.sig + 1; sig < next.sig; sig++) {
          const t = (sig - curr.sig) / (next.sig - curr.sig);
          interpolated.push({
            sig,
            prestige: Math.round((curr.prestige + t * (next.prestige - curr.prestige)) / 10) * 10,
          });
        }
      }
    }

    return NextResponse.json(interpolated);
  } catch (error) {
    logger.error({ error, championId }, "Error fetching prestige data");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

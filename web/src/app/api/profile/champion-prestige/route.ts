import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

const querySchema = z.object({
  championId: z.coerce.number(),
  stars: z.coerce.number().optional(), // Using as rarity
  rank: z.coerce.number().optional(),
});

export const GET = withRouteContext(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const result = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!result.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { championId, stars, rank } = result.data;

  try {
    const prestige = await prisma.championPrestige.findFirst({
      where: {
        championId,
        rarity: stars,
        rank,
      },
    });

    if (!prestige) {
      return NextResponse.json({ error: "Prestige data not found" }, { status: 404 });
    }

    return NextResponse.json(prestige);
  } catch (error) {
    logger.error({ error, championId }, "Error fetching prestige data");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

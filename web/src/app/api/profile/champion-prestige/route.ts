import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  championId: z.coerce.number(),
  rarity: z.coerce.number(),
  rank: z.coerce.number(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params = {
      championId: searchParams.get("championId"),
      rarity: searchParams.get("rarity"),
      rank: searchParams.get("rank"),
    };

    const { championId, rarity, rank } = querySchema.parse(params);

    const prestigeData = await prisma.championPrestige.findMany({
      where: {
        championId,
        rarity,
        rank,
      },
      select: {
        sig: true,
        prestige: true,
      },
      orderBy: {
        sig: 'asc',
      },
    });

    return NextResponse.json(prestigeData);
  } catch (error) {
    console.error("Error fetching prestige data:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

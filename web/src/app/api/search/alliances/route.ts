import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ alliances: [] });
  }

  try {
    const alliances = await prisma.alliance.findMany({
      where: {
        name: {
          contains: q,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
      },
      take: 20,
    });

    return NextResponse.json({ alliances });
  } catch (error) {
    console.error("Error searching alliances:", error);
    return NextResponse.json({ error: "Failed to search alliances" }, { status: 500 });
  }
}

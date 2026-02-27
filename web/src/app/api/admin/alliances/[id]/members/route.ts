import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10")));

    const [members, totalCount] = await Promise.all([
      prisma.player.findMany({
        where: { allianceId: id },
        orderBy: { ingameName: 'asc' },
        include: {
          _count: {
            select: { roster: true }
          }
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.player.count({
        where: { allianceId: id }
      })
    ]);

    return NextResponse.json({
      members,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

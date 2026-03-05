import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@cerebro/core/services/loggerService";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    // Search BotUsers by finding Users with matching names
    const users = await prisma.user.findMany({
      where: {
        name: {
          contains: q,
          mode: "insensitive",
        },
        accounts: {
          some: {
            provider: "discord"
          }
        }
      },
      select: {
        id: true,
        name: true,
        image: true,
        accounts: {
          where: { provider: "discord" },
          select: { providerAccountId: true }
        }
      },
      take: 20,
    });

    // Map to BotUser structure (we need the BotUser ID or Discord ID)
    const discordIds = users
        .map(u => u.accounts[0]?.providerAccountId)
        .filter((id): id is string => !!id);

    const botUsersFromDb = await prisma.botUser.findMany({
        where: { discordId: { in: discordIds } }
    });

    const botUserMap = new Map(botUsersFromDb.map(bu => [bu.discordId, bu]));

    const botUsers = users
        .map(u => {
            const discordId = u.accounts[0]?.providerAccountId;
            const botUser = discordId ? botUserMap.get(discordId) : null;
            if (!botUser || !u.name) return null;
            return {
                id: botUser.id,
                name: u.name,
                image: u.image
            };
        })
        .filter((bu): bu is { id: string, name: string, image: string | null } => !!bu);

    return NextResponse.json({ users: botUsers });
  } catch (error) {
    logger.error({ error }, "Error searching users");
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}

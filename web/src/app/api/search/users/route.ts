import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@cerebro/core/services/loggerService";

export async function GET(req: NextRequest) {
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
    const botUsers = [];
    for (const u of users) {
        if (u.accounts.length > 0 && u.name) {
            const botUser = await prisma.botUser.findUnique({
                where: { discordId: u.accounts[0].providerAccountId }
            });
            if (botUser) {
                botUsers.push({
                    id: botUser.id,
                    name: u.name,
                    image: u.image
                });
            }
        }
    }

    return NextResponse.json({ users: botUsers });
  } catch (error) {
    logger.error({ error }, "Error searching users");
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}

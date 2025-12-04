"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function addSeasonBan(season: number, minTier: number | undefined, maxTier: number | undefined, championId: number) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { accounts: true },
    });

    if (!user) throw new Error("User not found");

    const discordAccount = user.accounts.find((acc) => acc.provider === "discord");
    if (!discordAccount) throw new Error("Discord account not linked");

    const player = await prisma.player.findFirst({
        where: { discordId: discordAccount.providerAccountId },
    });

    if (!player?.isBotAdmin) {
        throw new Error("Unauthorized: Must be Bot Admin");
    }

    await prisma.seasonBan.create({
        data: {
            season,
            minTier,
            maxTier,
            championId,
        },
    });

    revalidatePath("/admin/bans");
}

export async function deleteSeasonBan(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { accounts: true },
    });

    if (!user) throw new Error("User not found");

    const discordAccount = user.accounts.find((acc) => acc.provider === "discord");
    if (!discordAccount) throw new Error("Discord account not linked");

    const player = await prisma.player.findFirst({
        where: { discordId: discordAccount.providerAccountId },
    });

    if (!player?.isBotAdmin) {
        throw new Error("Unauthorized: Must be Bot Admin");
    }

    await prisma.seasonBan.delete({
        where: { id },
    });

    revalidatePath("/admin/bans");
}

export async function searchChampions(query: string) {
    if (!query || query.length < 2) return [];

    return await prisma.champion.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { shortName: { contains: query, mode: "insensitive" } },
            ]
        },
        select: {
            id: true,
            name: true,
            images: true,
        },
        take: 10,
    });
}

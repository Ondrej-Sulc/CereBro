"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { withActionContext } from "@/lib/with-request-context";

export const addSeasonBan = withActionContext('addSeasonBan', async (season: number, minTier: number | undefined, maxTier: number | undefined, championId: number) => {
    await requireBotAdmin("MANAGE_WAR_CONFIG");

    await prisma.seasonBan.create({
        data: {
            season,
            minTier,
            maxTier,
            championId,
        },
    });

    revalidatePath("/admin/bans");
});

export const deleteSeasonBan = withActionContext('deleteSeasonBan', async (id: string) => {
    await requireBotAdmin("MANAGE_WAR_CONFIG");

    await prisma.seasonBan.delete({
        where: { id },
    });

    revalidatePath("/admin/bans");
});

export const searchChampions = withActionContext('searchChampions', async (query: string) => {
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
});

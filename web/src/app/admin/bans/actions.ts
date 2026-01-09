"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBotAdmin } from "@/lib/auth-helpers";

export async function addSeasonBan(season: number, minTier: number | undefined, maxTier: number | undefined, championId: number) {
    await requireBotAdmin();

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
    await requireBotAdmin();

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

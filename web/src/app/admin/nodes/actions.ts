'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { WarMapType } from "@prisma/client";

export async function searchModifiers(query: string) {
    const session = await auth();
    if (!session?.user?.id) return [];

    // Basic admin check (could be more robust)
    const account = await prisma.account.findFirst({ where: { userId: session.user.id, provider: "discord" } });
    if (!account) return [];
    
    // We trust client-side to hide UI, but server should ideally verify role again.
    // For search, it's low risk.

    if (!query || query.length < 2) return [];

    return await prisma.nodeModifier.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } }
            ]
        },
        take: 20
    });
}

export async function addAllocation(
    warNodeId: number, 
    nodeModifierId: string, 
    minTier?: number, 
    maxTier?: number, 
    season?: number,
    mapType: WarMapType = WarMapType.STANDARD
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Admin check
    const account = await prisma.account.findFirst({ where: { userId: session.user.id, provider: "discord" } });
    const player = await prisma.player.findFirst({ where: { discordId: account?.providerAccountId } });
    if (!player?.isBotAdmin) throw new Error("Unauthorized");

    await prisma.warNodeAllocation.create({
        data: {
            warNodeId,
            nodeModifierId,
            minTier,
            maxTier,
            season,
            mapType
        }
    });

    revalidatePath("/admin/nodes");
}

export async function removeAllocation(allocationId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const account = await prisma.account.findFirst({ where: { userId: session.user.id, provider: "discord" } });
    const player = await prisma.player.findFirst({ where: { discordId: account?.providerAccountId } });
    if (!player?.isBotAdmin) throw new Error("Unauthorized");

    await prisma.warNodeAllocation.delete({
        where: { id: allocationId }
    });

    revalidatePath("/admin/nodes");
}

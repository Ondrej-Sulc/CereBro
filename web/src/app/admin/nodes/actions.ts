'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { WarMapType } from "@prisma/client";
import { requireBotAdmin } from "@/lib/auth-helpers";

export async function searchModifiers(query: string) {
    const session = await auth();
    if (!session?.user?.id) return [];

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
    await requireBotAdmin();

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
    await requireBotAdmin();

    await prisma.warNodeAllocation.delete({
        where: { id: allocationId }
    });

    revalidatePath("/admin/nodes");
}

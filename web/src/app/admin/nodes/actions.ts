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
    minTier: number = 0, 
    maxTier: number = 0, 
    season: number = 0,
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

export async function updateAllocation(
    allocationId: string,
    data: {
        nodeModifierId?: string;
        minTier?: number;
        maxTier?: number;
        season?: number;
        mapType?: WarMapType;
    }
) {
    await requireBotAdmin();

    await prisma.warNodeAllocation.update({
        where: { id: allocationId },
        data
    });

    revalidatePath("/admin/nodes");
}

export async function copyAllocations(
    warNodeId: number,
    sourceMinTier: number | null,
    sourceMaxTier: number | null,
    targetMinTier: number | null,
    targetMaxTier: number | null,
    mapType: WarMapType
) {
    await requireBotAdmin();

    const sourceAllocations = await prisma.warNodeAllocation.findMany({
        where: {
            warNodeId,
            minTier: sourceMinTier ?? 0,
            maxTier: sourceMaxTier ?? 0,
            mapType
        }
    });

    if (sourceAllocations.length === 0) {
        return { count: 0, totalFound: 0 };
    }

    // Create new allocations for target tiers
    const newAllocations = sourceAllocations.map(alloc => ({
        warNodeId,
        nodeModifierId: alloc.nodeModifierId,
        minTier: targetMinTier ?? 0,
        maxTier: targetMaxTier ?? 0,
        season: alloc.season || 0,
        mapType
    }));

    const result = await prisma.warNodeAllocation.createMany({
        data: newAllocations,
        skipDuplicates: true
    });

    revalidatePath("/admin/nodes");
    return { count: result.count, totalFound: sourceAllocations.length };
}

export async function massCopyAllocations(
    sourceMinTier: number | null,
    sourceMaxTier: number | null,
    targetMinTier: number | null,
    targetMaxTier: number | null,
    mapType: WarMapType
) {
    await requireBotAdmin();

    const sourceAllocations = await prisma.warNodeAllocation.findMany({
        where: {
            minTier: sourceMinTier ?? 0,
            maxTier: sourceMaxTier ?? 0,
            mapType
        }
    });

    if (sourceAllocations.length === 0) {
        return { count: 0, totalFound: 0 };
    }

    // Create new allocations for target tiers for all nodes
    const newAllocations = sourceAllocations.map(alloc => ({
        warNodeId: alloc.warNodeId,
        nodeModifierId: alloc.nodeModifierId,
        minTier: targetMinTier ?? 0,
        maxTier: targetMaxTier ?? 0,
        season: alloc.season || 0,
        mapType
    }));

    const result = await prisma.warNodeAllocation.createMany({
        data: newAllocations,
        skipDuplicates: true
    });

    revalidatePath("/admin/nodes");
    return { count: result.count, totalFound: sourceAllocations.length };
}

export async function removeAllocation(allocationId: string) {
    await requireBotAdmin();

    await prisma.warNodeAllocation.delete({
        where: { id: allocationId }
    });

    revalidatePath("/admin/nodes");
}

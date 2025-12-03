'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function searchModifiers(query: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return await prisma.nodeModifier.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    },
    take: 50,
    orderBy: { name: 'asc' }
  });
}

export async function addAllocation(warNodeId: number, modifierId: string, minTier?: number, maxTier?: number, season?: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Check admin
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No discord account");
    
    const player = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId },
    });
    if (!player?.isBotAdmin) throw new Error("Must be bot admin");

    await prisma.warNodeAllocation.create({
        data: {
            warNodeId,
            nodeModifierId: modifierId,
            minTier,
            maxTier,
            season
        }
    });

    revalidatePath('/admin/nodes');
}

export async function removeAllocation(allocationId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Check admin
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No discord account");
    
    const player = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId },
    });
    if (!player?.isBotAdmin) throw new Error("Must be bot admin");

    await prisma.warNodeAllocation.delete({
        where: { id: allocationId }
    });

    revalidatePath('/admin/nodes');
}

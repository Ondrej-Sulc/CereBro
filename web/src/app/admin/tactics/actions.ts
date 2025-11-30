'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addTactic(season: number, minTier: number | undefined, maxTier: number | undefined, attackTag: string, defenseTag: string, name: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No discord account");
    
    const player = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId },
    });
    if (!player?.isBotAdmin) throw new Error("Must be bot admin");

    let attackTagId: number | null = null;
    if (attackTag) {
        const tag = await prisma.tag.findFirst({ where: { name: attackTag } });
        if (tag) {
            attackTagId = tag.id;
        } else {
            const newTag = await prisma.tag.create({
                data: { name: attackTag, category: 'Alliance War' }
            });
            attackTagId = newTag.id;
        }
    }

    let defenseTagId: number | null = null;
    if (defenseTag) {
        const tag = await prisma.tag.findFirst({ where: { name: defenseTag } });
        if (tag) {
            defenseTagId = tag.id;
        } else {
            const newTag = await prisma.tag.create({
                data: { name: defenseTag, category: 'Alliance War' }
            });
            defenseTagId = newTag.id;
        }
    }

    await prisma.warTactic.create({
        data: {
            season,
            minTier,
            maxTier,
            attackTagId,
            defenseTagId,
            name: name || null
        }
    });

    revalidatePath('/admin/tactics');
}

export async function deleteTactic(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No discord account");
    
    const player = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId },
    });
    if (!player?.isBotAdmin) throw new Error("Must be bot admin");

    await prisma.warTactic.delete({
        where: { id }
    });

    revalidatePath('/admin/tactics');
}

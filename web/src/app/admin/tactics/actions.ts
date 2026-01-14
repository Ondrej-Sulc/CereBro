'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBotAdmin } from "@/lib/auth-helpers";

export async function addTactic(season: number, minTier: number | undefined, maxTier: number | undefined, attackTag: string, defenseTag: string, name: string) {
    // Input Validation
    if (season <= 0 || !Number.isInteger(season)) {
        throw new Error("Season must be a positive integer.");
    }
    if (minTier !== undefined && (minTier < 1 || !Number.isInteger(minTier))) {
        throw new Error("Min Tier must be a positive integer.");
    }
    if (maxTier !== undefined && (maxTier < 1 || !Number.isInteger(maxTier))) {
        throw new Error("Max Tier must be a positive integer.");
    }
    if (minTier !== undefined && maxTier !== undefined && minTier > maxTier) {
        throw new Error("Min Tier cannot be greater than Max Tier.");
    }
    if (!attackTag || !attackTag.trim()) {
        throw new Error("Attack Tag cannot be empty.");
    }
    if (!defenseTag || !defenseTag.trim()) {
        throw new Error("Defense Tag cannot be empty.");
    }
    if (!name || !name.trim()) {
        throw new Error("Name cannot be empty.");
    }

    await requireBotAdmin();

    await prisma.$transaction(async (tx) => {
        let attackTagId: number | null = null;
        if (attackTag) {
            const tag = await tx.tag.upsert({
                where: { 
                    name_category: {
                        name: attackTag,
                        category: 'Alliance Wars'
                    }
                },
                update: {},
                create: { name: attackTag, category: 'Alliance Wars' }
            });
            attackTagId = tag.id;
        }

        let defenseTagId: number | null = null;
        if (defenseTag) {
            const tag = await tx.tag.upsert({
                where: { 
                    name_category: {
                        name: defenseTag,
                        category: 'Alliance Wars'
                    }
                },
                update: {},
                create: { name: defenseTag, category: 'Alliance Wars' }
            });
            defenseTagId = tag.id;
        }

        await tx.warTactic.create({
            data: {
                season,
                minTier,
                maxTier,
                attackTagId,
                defenseTagId,
                name: name || null
            }
        });
    });

    revalidatePath('/admin/tactics');
}

export async function deleteTactic(id: string) {
    await requireBotAdmin();

    await prisma.warTactic.delete({
        where: { id }
    });

    revalidatePath('/admin/tactics');
}

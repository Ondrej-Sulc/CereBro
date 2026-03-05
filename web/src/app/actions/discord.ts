'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { BotJobType } from "@prisma/client";
import { config } from "@cerebro/core/config";

export interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
    approximate_member_count?: number;
    approximate_presence_count?: number;
}

export async function getDiscordGuilds() {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser?.isBotAdmin) {
        throw new Error("Unauthorized");
    }

    if (!config.BOT_TOKEN) {
        throw new Error("BOT_TOKEN not configured");
    }

    // Get basic list of guilds
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
            Authorization: `Bot ${config.BOT_TOKEN}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch guilds: ${response.statusText}`);
    }

    const guilds = await response.json() as DiscordGuild[];

    // Fetch full details for each guild to get member counts
    // Note: This might be slow if there are many guilds. 
    // We could do it in chunks or on demand.
    // For 100 guilds, it's 100 requests. Let's try to fetch them in parallel.
    
    const detailedGuilds = await Promise.all(guilds.map(async (guild) => {
        try {
            const detailRes = await fetch(`https://discord.com/api/v10/guilds/${guild.id}?with_counts=true`, {
                headers: {
                    Authorization: `Bot ${config.BOT_TOKEN}`
                }
            });
            if (detailRes.ok) {
                return await detailRes.json() as DiscordGuild;
            }
        } catch (e) {
            console.error(`Failed to fetch details for guild ${guild.id}`, e);
        }
        return guild;
    }));

    return detailedGuilds.sort((a, b) => (a.approximate_member_count || 0) - (b.approximate_member_count || 0));
}

export async function leaveDiscordGuild(guildId: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser?.isBotAdmin) {
        throw new Error("Unauthorized");
    }

    // Protection for GLOBAL alliance
    const alliance = await prisma.alliance.findFirst({
        where: { guildId },
        select: { id: true }
    });
    
    if (alliance?.id === 'GLOBAL') {
        throw new Error("Cannot leave the GLOBAL alliance server.");
    }

    await prisma.botJob.create({
        data: {
            type: BotJobType.LEAVE_GUILD,
            payload: { guildId },
            status: 'PENDING'
        }
    });

    revalidatePath('/admin/discord');
    return { success: true };
}

export async function cleanupSmallGuilds() {
    const guilds = await getDiscordGuilds();
    const smallGuilds = guilds.filter(g => (g.approximate_member_count || 0) <= 1);
    
    let count = 0;
    for (const guild of smallGuilds) {
        try {
            await leaveDiscordGuild(guild.id);
            count++;
        } catch (e) {
            console.error(`Failed to queue leave for ${guild.id}`, e);
        }
    }

    return { success: true, count };
}

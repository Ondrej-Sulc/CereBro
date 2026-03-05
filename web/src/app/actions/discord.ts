'use server'

import { prisma } from "@/lib/prisma";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { BotJobType } from "@prisma/client";
import { config } from "@cerebro/core/config";
import { getFromCache } from "@/lib/cache";

export interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
    approximate_member_count?: number;
    approximate_presence_count?: number;
    alliances?: {
        id: string;
        name: string;
        playerCount: number;
    }[];
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
    const response = await fetch(url, options);
    
    if (response.status === 429 && retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1') * 1000;
        console.warn(`Discord Rate Limit (429) hit for ${url}. Retrying in ${retryAfter}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return fetchWithRetry(url, options, retries - 1);
    }
    
    return response;
}

/**
 * Splits an array into chunks of a given size.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export async function getDiscordGuilds() {
    await requireBotAdmin();

    if (!config.BOT_TOKEN) {
        throw new Error("BOT_TOKEN not configured");
    }

    return getFromCache('discord-guilds-detailed', 900, async () => {
        // 1. Get basic list of guilds
        const response = await fetchWithRetry('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                Authorization: `Bot ${config.BOT_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch guilds: ${response.statusText} (${response.status})`);
        }

        const guilds = await response.json() as DiscordGuild[];

        // 2. Fetch all alliances with their member counts from DB
        const dbAlliances = await prisma.alliance.findMany({
            where: { guildId: { in: guilds.map(g => g.id) } },
            select: {
                id: true,
                name: true,
                guildId: true,
                _count: {
                    select: { members: true }
                }
            }
        });

        // Group alliances by guildId
        const allianceGroupByGuild = dbAlliances.reduce((acc, alliance) => {
            if (!alliance.guildId) return acc;
            if (!acc[alliance.guildId]) acc[alliance.guildId] = [];
            acc[alliance.guildId].push({
                id: alliance.id,
                name: alliance.name,
                playerCount: alliance._count.members
            });
            return acc;
        }, {} as Record<string, { id: string, name: string, playerCount: number }[]>);

        // 3. Fetch full details for each guild to get member counts
        // Process in chunks to avoid overwhelming Discord API and hitting rate limits
        const guildChunks = chunkArray(guilds, 10);
        const detailedGuilds: DiscordGuild[] = [];

        for (const chunk of guildChunks) {
            const chunkResults = await Promise.all(chunk.map(async (guild) => {
                let memberCount = 0;
                let features = guild.features;
                let icon = guild.icon;

                try {
                    const detailRes = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guild.id}?with_counts=true`, {
                        headers: {
                            Authorization: `Bot ${config.BOT_TOKEN}`
                        }
                    });
                    
                    if (detailRes.ok) {
                        const data = await detailRes.json();
                        memberCount = data.approximate_member_count || 0;
                        features = data.features || features;
                        icon = data.icon || icon;
                    } else if (detailRes.status === 429) {
                        console.error(`Persistent 429 for guild ${guild.id} after retries.`);
                    }
                } catch (e) {
                    console.error(`Failed to fetch details for guild ${guild.id}`, e);
                }

                return {
                    ...guild,
                    icon,
                    features,
                    approximate_member_count: memberCount,
                    alliances: allianceGroupByGuild[guild.id] || []
                };
            }));
            
            detailedGuilds.push(...chunkResults);
            
            // Small delay between chunks if we have more than one
            if (guildChunks.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return detailedGuilds.sort((a, b) => (a.approximate_member_count || 0) - (b.approximate_member_count || 0));
    });
}

export async function leaveDiscordGuild(guildId: string) {
    await requireBotAdmin();

    // Protection for GLOBAL alliance
    const globalAlliance = await prisma.alliance.findFirst({
        where: { guildId, id: 'GLOBAL' },
        select: { id: true }
    });
    
    if (globalAlliance) {
        throw new Error("Cannot leave the GLOBAL alliance server.");
    }

    await prisma.botJob.create({
        data: {
            type: 'LEAVE_GUILD' as BotJobType,
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

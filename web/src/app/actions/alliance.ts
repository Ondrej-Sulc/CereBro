'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { clearCache } from "@/lib/cache";
import { BotJobType } from "@prisma/client";
import logger from "@/lib/logger";
import { withActionContext } from "@/lib/with-request-context";
import { canManageAllianceMembers } from "@/lib/alliance-permissions";
import { config } from "@cerebro/core/config";

export type DiscordRoleOption = {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
};

export type DiscordChannelOption = {
    id: string;
    name: string;
    type: number;
};

export type AllianceDiscordConfig = {
    officerRole: string | null;
    plannerRole: string | null;
    battlegroup1Role: string | null;
    battlegroup2Role: string | null;
    battlegroup3Role: string | null;
    warVideosChannelId: string | null;
    deathChannelId: string | null;
    battlegroup1ChannelId: string | null;
    battlegroup2ChannelId: string | null;
    battlegroup3ChannelId: string | null;
};

const DISCORD_CONFIG_FIELDS = {
    officerRole: true,
    plannerRole: true,
    battlegroup1Role: true,
    battlegroup2Role: true,
    battlegroup3Role: true,
    warVideosChannelId: true,
    deathChannelId: true,
    battlegroup1ChannelId: true,
    battlegroup2ChannelId: true,
    battlegroup3ChannelId: true,
} as const;

const ROLE_FIELDS = [
    "officerRole",
    "plannerRole",
    "battlegroup1Role",
    "battlegroup2Role",
    "battlegroup3Role",
] as const;

const CHANNEL_FIELDS = [
    "warVideosChannelId",
    "deathChannelId",
    "battlegroup1ChannelId",
    "battlegroup2ChannelId",
    "battlegroup3ChannelId",
] as const;

function pickDiscordConfig(alliance: AllianceDiscordConfig): AllianceDiscordConfig {
    return {
        officerRole: alliance.officerRole,
        plannerRole: alliance.plannerRole,
        battlegroup1Role: alliance.battlegroup1Role,
        battlegroup2Role: alliance.battlegroup2Role,
        battlegroup3Role: alliance.battlegroup3Role,
        warVideosChannelId: alliance.warVideosChannelId,
        deathChannelId: alliance.deathChannelId,
        battlegroup1ChannelId: alliance.battlegroup1ChannelId,
        battlegroup2ChannelId: alliance.battlegroup2ChannelId,
        battlegroup3ChannelId: alliance.battlegroup3ChannelId,
    };
}

function normalizeDiscordConfig(input: AllianceDiscordConfig): AllianceDiscordConfig {
    const normalize = (value: string | null | undefined) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : null;
    };

    return {
        officerRole: normalize(input.officerRole),
        plannerRole: normalize(input.plannerRole),
        battlegroup1Role: normalize(input.battlegroup1Role),
        battlegroup2Role: normalize(input.battlegroup2Role),
        battlegroup3Role: normalize(input.battlegroup3Role),
        warVideosChannelId: normalize(input.warVideosChannelId),
        deathChannelId: normalize(input.deathChannelId),
        battlegroup1ChannelId: normalize(input.battlegroup1ChannelId),
        battlegroup2ChannelId: normalize(input.battlegroup2ChannelId),
        battlegroup3ChannelId: normalize(input.battlegroup3ChannelId),
    };
}

async function fetchDiscordGuildOptions(guildId: string): Promise<{
    roles: DiscordRoleOption[];
    channels: DiscordChannelOption[];
}> {
    const headers = { Authorization: `Bot ${config.BOT_TOKEN}` };
    let rolesResponse: Response;
    let channelsResponse: Response;

    try {
        const signal = AbortSignal.timeout(10_000);
        [rolesResponse, channelsResponse] = await Promise.all([
            fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers, signal }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers, signal }),
        ]);
    } catch (error) {
        logger.warn({ guildId, error }, "Timed out fetching Discord guild options");
        throw new Error("CereBro cannot read this Discord server. Check that the bot is still installed and has permission.");
    }

    if (!rolesResponse.ok || !channelsResponse.ok) {
        const roleText = rolesResponse.ok ? undefined : await rolesResponse.text();
        const channelText = channelsResponse.ok ? undefined : await channelsResponse.text();
        logger.warn(
            {
                guildId,
                rolesStatus: rolesResponse.status,
                channelsStatus: channelsResponse.status,
                roleText,
                channelText,
            },
            "Failed to fetch Discord guild options"
        );
        throw new Error("CereBro cannot read this Discord server. Check that the bot is still installed and has permission.");
    }

    const roles = await rolesResponse.json() as DiscordRoleOption[];
    const channels = await channelsResponse.json() as DiscordChannelOption[];

    return {
        roles: roles
            .filter((role) => !role.managed)
            .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name)),
        channels: channels
            .filter((channel) => channel.type === 0 || channel.type === 5)
            .sort((a, b) => a.name.localeCompare(b.name)),
    };
}

export const updatePlayerRole = withActionContext('updatePlayerRole', async (targetPlayerId: string, data: { battlegroup?: number | null, isOfficer?: boolean, isPlanner?: boolean }) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    // Verify target player is in the same alliance
    const targetPlayer = await prisma.player.findUnique({
        where: { id: targetPlayerId }
    });

    if (!targetPlayer) {
        throw new Error("Target player not found");
    }

    if (targetPlayer.allianceId !== actingUser.allianceId) {
        // Allow Bot Admins to edit anyone? For now, stick to alliance scope.
        if (!actingUser.isBotAdmin) {
            throw new Error("Target player not in your alliance");
        }
    }

    // Verify acting user is Officer or Admin
    if (!canManageAllianceMembers(actingUser)) {
        throw new Error("Insufficient permissions");
    }

    // Update Player
    await prisma.player.update({
        where: { id: targetPlayerId },
        data: {
            battlegroup: data.battlegroup,
            isOfficer: data.isOfficer,
            isPlanner: data.isPlanner
        }
    });

    // Create Bot Job for Discord Sync
    await prisma.botJob.create({
        data: {
            type: BotJobType.UPDATE_MEMBER_ROLES,
            payload: { playerId: targetPlayerId },
            status: 'PENDING'
        }
    });

    clearCache(`alliance-members-${targetPlayer.allianceId}`);
    revalidatePath('/alliance');
    revalidatePath('/planning', 'layout');
    return { success: true };
});

export const updateAllianceGeneral = withActionContext('updateAllianceGeneral', async (data: {
    name: string;
    tag: string | null;
    description: string | null;
    inviteOnly: boolean;
}) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Unauthorized");
    if (!canManageAllianceMembers(actingUser)) throw new Error("Insufficient permissions");

    const name = data.name.trim();
    if (!name || name.length > 50) throw new Error("Alliance name must be between 1 and 50 characters");

    const tag = data.tag ? data.tag.trim() : null;
    if (tag && (tag.length < 2 || tag.length > 5 || /\s/.test(tag))) {
        throw new Error("Tag must be 2–5 characters with no spaces");
    }

    const description = data.description ? data.description.trim() : null;
    if (description && description.length > 200) throw new Error("Description must be 200 characters or fewer");

    try {
        await prisma.alliance.update({
            where: { id: actingUser.allianceId },
            data: { name, tag, description, inviteOnly: data.inviteOnly }
        });
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('Unique constraint') && e.message.includes('tag')) {
            throw new Error("That tag is already taken by another alliance");
        }
        throw e;
    }

    revalidatePath('/alliance');
    revalidatePath(`/alliance/${actingUser.allianceId}`);
    return { success: true };
});

export const updateAllianceColors = withActionContext('updateAllianceColors', async (colors: { bg1: string, bg2: string, bg3: string }) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    if (!canManageAllianceMembers(actingUser)) {
        throw new Error("Insufficient permissions");
    }

    await prisma.alliance.update({
        where: { id: actingUser.allianceId },
        data: {
            battlegroup1Color: colors.bg1,
            battlegroup2Color: colors.bg2,
            battlegroup3Color: colors.bg3,
        }
    });

    revalidatePath('/alliance');
    return { success: true };
});

export const updateAlliancePalette = withActionContext('updateAlliancePalette', async (paletteStyle: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    if (!canManageAllianceMembers(actingUser)) {
        throw new Error("Insufficient permissions");
    }

    await prisma.alliance.update({
        where: { id: actingUser.allianceId },
        data: { playerColorPalette: paletteStyle }
    });

    revalidatePath('/alliance');
    revalidatePath('/planning', 'layout');
    return { success: true };
});

export const updateAllianceSettings = withActionContext('updateAllianceSettings', async (settings: { removeMissingMembers: boolean }) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    if (!canManageAllianceMembers(actingUser)) {
        throw new Error("Insufficient permissions");
    }

    await prisma.alliance.update({
        where: { id: actingUser.allianceId },
        data: {
            removeMissingMembers: settings.removeMissingMembers,
        }
    });

    revalidatePath('/alliance');
    return { success: true };
});

export const getAllianceDiscordOptions = withActionContext('getAllianceDiscordOptions', async (): Promise<{
    roles: DiscordRoleOption[];
    channels: DiscordChannelOption[];
    config: AllianceDiscordConfig;
    guildLinked: boolean;
}> => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    if (!canManageAllianceMembers(actingUser)) {
        throw new Error("Insufficient permissions");
    }

    const alliance = await prisma.alliance.findUnique({
        where: { id: actingUser.allianceId },
        select: {
            guildId: true,
            ...DISCORD_CONFIG_FIELDS,
        },
    });

    if (!alliance) {
        throw new Error("Alliance not found");
    }

    const currentConfig = pickDiscordConfig(alliance);
    if (!alliance.guildId) {
        return { roles: [], channels: [], config: currentConfig, guildLinked: false };
    }

    const { roles, channels } = await fetchDiscordGuildOptions(alliance.guildId);
    return { roles, channels, config: currentConfig, guildLinked: true };
});

export const updateAllianceDiscordConfig = withActionContext('updateAllianceDiscordConfig', async (input: AllianceDiscordConfig): Promise<{
    success: true;
    queuedRoleSync: boolean;
}> => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    if (!canManageAllianceMembers(actingUser)) {
        throw new Error("Insufficient permissions");
    }

    const alliance = await prisma.alliance.findUnique({
        where: { id: actingUser.allianceId },
        select: {
            id: true,
            guildId: true,
            ...DISCORD_CONFIG_FIELDS,
        },
    });

    if (!alliance) {
        throw new Error("Alliance not found");
    }
    if (!alliance.guildId) {
        throw new Error("Alliance Discord server is not linked");
    }

    const normalized = normalizeDiscordConfig(input);
    const { roles, channels } = await fetchDiscordGuildOptions(alliance.guildId);
    const validRoleIds = new Set(roles.map((role) => role.id));
    const validChannelIds = new Set(channels.map((channel) => channel.id));

    for (const field of ROLE_FIELDS) {
        const value = normalized[field];
        if (value && !validRoleIds.has(value)) {
            throw new Error("One or more selected Discord roles no longer exist or cannot be managed.");
        }
    }

    for (const field of CHANNEL_FIELDS) {
        const value = normalized[field];
        if (value && !validChannelIds.has(value)) {
            throw new Error("One or more selected Discord channels no longer exist or cannot be used.");
        }
    }

    const previous = pickDiscordConfig(alliance);
    const roleChanged = ROLE_FIELDS.some((field) => previous[field] !== normalized[field]);

    await prisma.alliance.update({
        where: { id: alliance.id },
        data: normalized,
    });

    if (roleChanged) {
        await prisma.botJob.upsert({
            where: {
                type_referenceId: {
                    type: BotJobType.SYNC_ALLIANCE_ROLES,
                    referenceId: `sync-alliance-roles:${alliance.id}`,
                },
            },
            create: {
                type: BotJobType.SYNC_ALLIANCE_ROLES,
                referenceId: `sync-alliance-roles:${alliance.id}`,
                status: "PENDING",
                error: null,
                payload: {
                    allianceId: alliance.id,
                    guildId: alliance.guildId,
                    requestedByPlayerId: actingUser.id,
                },
            },
            update: {
                status: "PENDING",
                error: null,
                payload: {
                    allianceId: alliance.id,
                    guildId: alliance.guildId,
                    requestedByPlayerId: actingUser.id,
                },
            },
        });
    }

    revalidatePath('/alliance');
    revalidatePath('/planning');
    revalidatePath('/planning/defense');
    revalidatePath('/planning', 'layout');

    return { success: true, queuedRoleSync: roleChanged };
});

export const createAlliance = withActionContext('createAlliance', async (name: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    if (actingUser.allianceId) {
        logger.warn({ userId: actingUser.id, allianceName: name }, "Attempted to create alliance while already in one");
        return { error: "Already in an alliance" };
    }

    logger.info({ userId: actingUser.id, allianceName: name }, "Creating new alliance");
    const alliance = await prisma.alliance.create({
        data: {
            name,
            members: {
                connect: { id: actingUser.id }
            }
        }
    });

    // Creator becomes an officer
    await prisma.player.update({
        where: { id: actingUser.id },
        data: { isOfficer: true }
    });

    revalidatePath('/');
    revalidatePath('/alliance');
    return { success: true, allianceId: alliance.id };
});

export const leaveAlliance = withActionContext('leaveAlliance', async () => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Not in an alliance");

    await prisma.player.update({
        where: { id: actingUser.id },
        data: {
            allianceId: null,
            battlegroup: null,
            isOfficer: false,
            isPlanner: false
        }
    });

    clearCache(`alliance-members-${actingUser.allianceId}`);
    revalidatePath('/');
    revalidatePath('/alliance');
    revalidatePath('/planning', 'layout');
    return { success: true };
});

export const removeMember = withActionContext('removeMember', async (playerId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Unauthorized");
    if (!canManageAllianceMembers(actingUser)) throw new Error("Insufficient permissions");

    const targetPlayer = await prisma.player.findUnique({ where: { id: playerId } });
    if (!targetPlayer || targetPlayer.allianceId !== actingUser.allianceId) throw new Error("Player not in alliance");

    if (targetPlayer.id === actingUser.id && !actingUser.isBotAdmin) {
        throw new Error("Cannot remove yourself");
    }

    if (targetPlayer.isOfficer) {
        const officerCount = await prisma.player.count({
            where: { allianceId: actingUser.allianceId, isOfficer: true }
        });
        if (officerCount <= 1) {
            throw new Error("Cannot remove the last officer");
        }
    }

    await prisma.player.update({
        where: { id: playerId },
        data: {
            allianceId: null,
            battlegroup: null,
            isOfficer: false,
            isPlanner: false
        }
    });

    clearCache(`alliance-members-${actingUser.allianceId}`);
    revalidatePath('/alliance');
    revalidatePath('/planning', 'layout');
    return { success: true };
});

export const requestToJoinAlliance = withActionContext('requestToJoinAlliance', async (allianceId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    if (actingUser.allianceId) {
        logger.warn({ userId: actingUser.id, allianceId }, "Attempted to join alliance while already in one");
        return { error: "Already in an alliance" };
    }

    // Check for existing pending request
    const existing = await prisma.allianceMembershipRequest.findFirst({
        where: {
            allianceId,
            playerId: actingUser.id,
            status: 'PENDING'
        }
    });

    if (existing) {
        logger.warn({ userId: actingUser.id, allianceId }, "Attempted to join alliance with pending request");
        return { error: "Request already pending" };
    }

    logger.info({ userId: actingUser.id, allianceId }, "Requesting to join alliance");
    await prisma.allianceMembershipRequest.create({
        data: {
            allianceId,
            playerId: actingUser.id,
            type: 'REQUEST'
        }
    });

    return { success: true };
});

export const invitePlayerToAlliance = withActionContext('invitePlayerToAlliance', async (playerId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Unauthorized");
    if (!canManageAllianceMembers(actingUser)) throw new Error("Insufficient permissions");

    const targetPlayer = await prisma.player.findUnique({ where: { id: playerId } });
    if (!targetPlayer) {
        logger.warn({ userId: actingUser.id, targetPlayerId: playerId }, "Player not found for invite");
        return { error: "Player not found" };
    }
    if (targetPlayer.allianceId) {
        logger.warn({ userId: actingUser.id, targetPlayerId: playerId }, "Attempted to invite player already in an alliance");
        return { error: "Player already in an alliance" };
    }

    // Check for existing pending invite
    const existing = await prisma.allianceMembershipRequest.findFirst({
        where: {
            allianceId: actingUser.allianceId,
            playerId,
            status: 'PENDING'
        }
    });

    if (existing) {
        logger.warn({ userId: actingUser.id, targetPlayerId: playerId }, "Attempted to invite player with pending invite");
        return { error: "Invite already pending" };
    }

    logger.info({ userId: actingUser.id, targetPlayerId: playerId }, "Inviting player to alliance");
    await prisma.allianceMembershipRequest.create({
        data: {
            allianceId: actingUser.allianceId,
            playerId,
            inviterId: actingUser.id,
            type: 'INVITE'
        }
    });

    return { success: true };
});

export const respondToMembershipRequest = withActionContext('respondToMembershipRequest', async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const request = await prisma.allianceMembershipRequest.findUnique({
        where: { id: requestId },
        include: { alliance: true, player: true }
    });

    if (!request || request.status !== 'PENDING') {
        logger.warn({ userId: actingUser.id, requestId }, "Attempted to respond to invalid or non-pending request");
        return { error: "Invalid request" };
    }

    if (request.type === 'REQUEST') {
        // Only officers can accept/reject join requests
        if (!actingUser.allianceId || actingUser.allianceId !== request.allianceId || !canManageAllianceMembers(actingUser)) {
            logger.warn({ userId: actingUser.id, requestId, type: 'REQUEST' }, "Unauthorized response to join request");
            return { error: "Insufficient permissions" };
        }
    } else {
        // Only the invited player can accept/reject invitations
        if (actingUser.id !== request.playerId) {
            logger.warn({ userId: actingUser.id, requestId, type: 'INVITE' }, "Unauthorized response to invitation");
            return { error: "Insufficient permissions" };
        }
    }

    logger.info({ userId: actingUser.id, requestId, status, type: request.type }, "Responding to membership request");
    
    if (status === 'ACCEPTED') {
        const claimSuccess = await prisma.$transaction(async (tx) => {
            const updateCount = await tx.player.updateMany({
                where: { id: request.playerId, allianceId: null },
                data: { allianceId: request.allianceId }
            });

            if (updateCount.count === 1) {
                // Claim succeeded
                await tx.allianceMembershipRequest.update({
                    where: { id: requestId },
                    data: { status: 'ACCEPTED' }
                });

                // Cancel other pending requests for this player
                await tx.allianceMembershipRequest.updateMany({
                    where: { 
                        playerId: request.playerId,
                        status: 'PENDING',
                        id: { not: requestId }
                    },
                    data: { status: 'CANCELLED' }
                });
                return true;
            } else {
                // Player is already in an alliance, cannot accept
                await tx.allianceMembershipRequest.update({
                    where: { id: requestId },
                    data: { status: 'CANCELLED' }
                });
                return false;
            }
        });

        if (claimSuccess) {
            clearCache(`alliance-members-${request.allianceId}`);
        } else {
            logger.warn({ userId: actingUser.id, requestId, playerId: request.playerId }, "Attempted to accept request for player already in an alliance. Request cancelled.");
            return { error: "Player is already in an alliance" };
        }
    } else {
        await prisma.allianceMembershipRequest.update({
            where: { id: requestId },
            data: { status }
        });
    }

    revalidatePath('/alliance');
    revalidatePath('/');
    revalidatePath('/planning', 'layout');
    return { success: true };
});

export const generateAllianceLinkCode = withActionContext('generateAllianceLinkCode', async () => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Unauthorized");
    if (!canManageAllianceMembers(actingUser)) throw new Error("Insufficient permissions");

    // Generate CB-XXXXXX code
    const code = `CB-${Math.floor(100000 + Math.random() * 900000)}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.alliance.update({
        where: { id: actingUser.allianceId },
        data: {
            linkCode: code,
            linkCodeExpires: expires
        }
    });

    revalidatePath('/alliance');
    return { code, expires };
});

'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { clearCache } from "@/lib/cache";
import { BotJobType } from "@prisma/client";
import logger from "@/lib/logger";
import { withActionContext } from "@/lib/with-request-context";

export const updatePlayerRole = withActionContext('updatePlayerRole', async (targetPlayerId: string, data: { battlegroup?: number | null, isOfficer?: boolean }) => {
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
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) {
        throw new Error("Insufficient permissions");
    }

    // Update Player
    await prisma.player.update({
        where: { id: targetPlayerId },
        data: {
            battlegroup: data.battlegroup,
            isOfficer: data.isOfficer
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
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) throw new Error("Insufficient permissions");

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

    if (!actingUser.isOfficer && !actingUser.isBotAdmin) {
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

    if (!actingUser.isOfficer && !actingUser.isBotAdmin) {
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

    if (!actingUser.isOfficer && !actingUser.isBotAdmin) {
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
            isOfficer: false
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
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) throw new Error("Insufficient permissions");

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
            isOfficer: false
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
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) throw new Error("Insufficient permissions");

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
        if (!actingUser.allianceId || actingUser.allianceId !== request.allianceId || (!actingUser.isOfficer && !actingUser.isBotAdmin)) {
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
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) throw new Error("Insufficient permissions");

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

'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { BotJobType } from "@prisma/client";

export async function updatePlayerRole(targetPlayerId: string, data: { battlegroup?: number | null, isOfficer?: boolean }) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) {
        throw new Error("Unauthorized");
    }

    // Verify target player is in the same alliance
    const targetPlayer = await prisma.player.findUnique({
        where: { id: targetPlayerId }
    });

    if (!targetPlayer || targetPlayer.allianceId !== actingUser.allianceId) {
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

    revalidatePath('/alliance');
    return { success: true };
}

export async function updateAllianceColors(colors: { bg1: string, bg2: string, bg3: string }) {
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
}

export async function createAlliance(name: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    if (actingUser.allianceId) throw new Error("Already in an alliance");

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
}

export async function leaveAlliance() {
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

    revalidatePath('/');
    revalidatePath('/alliance');
    return { success: true };
}

export async function removeMember(playerId: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Unauthorized");
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) throw new Error("Insufficient permissions");

    const targetPlayer = await prisma.player.findUnique({ where: { id: playerId } });
    if (!targetPlayer || targetPlayer.allianceId !== actingUser.allianceId) throw new Error("Player not in alliance");

    await prisma.player.update({
        where: { id: playerId },
        data: { 
            allianceId: null,
            battlegroup: null,
            isOfficer: false
        }
    });

    revalidatePath('/alliance');
    return { success: true };
}

export async function requestToJoinAlliance(allianceId: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    if (actingUser.allianceId) throw new Error("Already in an alliance");

    // Check for existing pending request
    const existing = await prisma.allianceMembershipRequest.findFirst({
        where: {
            allianceId,
            playerId: actingUser.id,
            status: 'PENDING'
        }
    });

    if (existing) throw new Error("Request already pending");

    await prisma.allianceMembershipRequest.create({
        data: {
            allianceId,
            playerId: actingUser.id,
            type: 'REQUEST'
        }
    });

    return { success: true };
}

export async function invitePlayerToAlliance(playerId: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.allianceId) throw new Error("Unauthorized");
    if (!actingUser.isOfficer && !actingUser.isBotAdmin) throw new Error("Insufficient permissions");

    const targetPlayer = await prisma.player.findUnique({ where: { id: playerId } });
    if (!targetPlayer) throw new Error("Player not found");
    if (targetPlayer.allianceId) throw new Error("Player already in an alliance");

    // Check for existing pending invite
    const existing = await prisma.allianceMembershipRequest.findFirst({
        where: {
            allianceId: actingUser.allianceId,
            playerId,
            status: 'PENDING'
        }
    });

    if (existing) throw new Error("Invite already pending");

    await prisma.allianceMembershipRequest.create({
        data: {
            allianceId: actingUser.allianceId,
            playerId,
            inviterId: actingUser.id,
            type: 'INVITE'
        }
    });

    return { success: true };
}

export async function respondToMembershipRequest(requestId: string, status: 'ACCEPTED' | 'REJECTED') {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const request = await prisma.allianceMembershipRequest.findUnique({
        where: { id: requestId },
        include: { alliance: true, player: true }
    });

    if (!request || request.status !== 'PENDING') throw new Error("Invalid request");

    if (request.type === 'REQUEST') {
        // Only officers can accept/reject join requests
        if (!actingUser.allianceId || actingUser.allianceId !== request.allianceId || (!actingUser.isOfficer && !actingUser.isBotAdmin)) {
            throw new Error("Insufficient permissions");
        }
    } else {
        // Only the invited player can accept/reject invitations
        if (actingUser.id !== request.playerId) {
            throw new Error("Insufficient permissions");
        }
    }

    if (status === 'ACCEPTED') {
        // Add player to alliance
        await prisma.player.update({
            where: { id: request.playerId },
            data: { allianceId: request.allianceId }
        });

        // Cancel other pending requests for this player
        await prisma.allianceMembershipRequest.updateMany({
            where: { 
                playerId: request.playerId,
                status: 'PENDING',
                id: { not: requestId }
            },
            data: { status: 'CANCELLED' }
        });
    }

    await prisma.allianceMembershipRequest.update({
        where: { id: requestId },
        data: { status }
    });

    revalidatePath('/alliance');
    revalidatePath('/');
    return { success: true };
}

import { Client } from 'discord.js';
import { prisma } from '../prismaService';
import logger from '../loggerService';

interface UpdateMemberRolesPayload {
  playerId: string;
}

export async function handleUpdateMemberRoles(client: Client, payload: unknown) {
  const { playerId } = payload as UpdateMemberRolesPayload;
    
  const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { alliance: true }
  });

  if (!player || !player.alliance || !player.alliance.guildId) {
      logger.warn({ playerId }, 'Player not found or not in an alliance with a guildId during role update.');
      return;
  }

  try {
    const guild = await client.guilds.fetch(player.alliance.guildId);
    if (!guild) {
        logger.error({ guildId: player.alliance.guildId }, 'Guild not found during role update.');
        return;
    }

    let member;
    try {
        member = await guild.members.fetch(player.discordId);
    } catch (e) {
        logger.warn({ discordId: player.discordId, guildId: guild.id }, 'Member not found in guild.');
        return;
    }

    const alliance = player.alliance;
    const rolesToAdd: string[] = [];
    const rolesToRemove: string[] = [];

    // 1. Officer Role
    if (alliance.officerRole) {
        if (player.isOfficer) {
            rolesToAdd.push(alliance.officerRole);
        } else {
            rolesToRemove.push(alliance.officerRole);
        }
    }

    // 2. Battlegroup Roles
    const bgRoles = [
        alliance.battlegroup1Role,
        alliance.battlegroup2Role,
        alliance.battlegroup3Role
    ];

    // Map BG number (1-based) to Role ID
    const targetBgRole = player.battlegroup ? bgRoles[player.battlegroup - 1] : null;

    // Add target BG role if exists
    if (targetBgRole) {
        rolesToAdd.push(targetBgRole);
    }

    // Remove ALL OTHER BG roles
    // We iterate through all configured BG roles.
    // If it's NOT the target role, we queue it for removal.
    for (const roleId of bgRoles) {
        if (roleId && roleId !== targetBgRole) {
            rolesToRemove.push(roleId);
        }
    }

    // Execute Changes
    const currentRoleIds = new Set(member.roles.cache.keys());
    
    const finalToAdd = rolesToAdd.filter(r => !currentRoleIds.has(r));
    const finalToRemove = rolesToRemove.filter(r => currentRoleIds.has(r));

    if (finalToAdd.length > 0) {
        await member.roles.add(finalToAdd);
        logger.info({ member: member.displayName, roles: finalToAdd }, 'Added roles to member.');
    }

    if (finalToRemove.length > 0) {
        await member.roles.remove(finalToRemove);
        logger.info({ member: member.displayName, roles: finalToRemove }, 'Removed roles from member.');
    }
  } catch (error) {
    logger.error({ error, playerId }, 'Error executing handleUpdateMemberRoles');
    throw error; // Re-throw to fail the job
  }
}

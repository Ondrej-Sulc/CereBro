import { Client } from 'discord.js';
import logger from '../loggerService';

export interface AssignSupporterRolePayload {
  discordId: string;
  donationId?: string;
}

export async function handleAssignSupporterRole(client: Client, payload: unknown) {
  if (typeof payload !== 'object' || payload === null) {
    logger.warn('ASSIGN_SUPPORTER_ROLE job received with invalid payload type');
    return;
  }

  const { discordId } = payload as AssignSupporterRolePayload;
  
  if (!discordId) {
    logger.warn('ASSIGN_SUPPORTER_ROLE job received without discordId in payload');
    return;
  }

  const supportServerId = process.env.SUPPORT_SERVER_ID;
  const supportRoleId = process.env.SUPPORT_ROLE_ID;

  if (!supportServerId || !supportRoleId) {
    logger.warn('SUPPORT_SERVER_ID or SUPPORT_ROLE_ID is not configured in environment variables. Cannot assign supporter role.');
    return;
  }

  try {
    const guild = await client.guilds.fetch(supportServerId);
    if (!guild) {
      logger.error({ supportServerId }, 'Could not find configured support server.');
      return;
    }

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      logger.info({ discordId, supportServerId }, 'User is not a member of the support server. Skipping role assignment.');
      return;
    }

    const role = await guild.roles.fetch(supportRoleId);
    if (!role) {
      logger.error({ supportRoleId }, 'Could not find configured support role.');
      return;
    }

    if (member.roles.cache.has(role.id)) {
      logger.info({ discordId }, 'User already has the supporter role.');
      return;
    }

    await member.roles.add(role, 'User became a CereBro supporter');
    logger.info({ discordId }, 'Successfully assigned supporter role to user.');
  } catch (error) {
    logger.error({ error, discordId }, 'Failed to assign supporter role.');
    throw error;
  }
}

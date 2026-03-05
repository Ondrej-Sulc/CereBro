import { Client } from 'discord.js';
import logger from '../loggerService';
import { prisma } from '../prismaService';

export interface LeaveGuildPayload {
  guildId?: string;
}

export async function handleLeaveGuild(client: Client, payload: LeaveGuildPayload) {
  const guildId = payload?.guildId;
  if (!guildId) {
    throw new Error('Missing guildId in LEAVE_GUILD payload');
  }

  // Protection for GLOBAL alliance
  const alliance = await prisma.alliance.findFirst({
    where: { guildId, id: 'GLOBAL' },
    select: { id: true, name: true }
  });

  if (alliance) {
    logger.warn(`Aborting leave job: Guild ${guildId} is mapped to GLOBAL alliance.`);
    return;
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    logger.warn(`Could not find guild ${guildId} to leave.`);
    return;
  }

  logger.info(`Leaving guild ${guild.name} (${guild.id}) as requested via bot job.`);
  await guild.leave();
}

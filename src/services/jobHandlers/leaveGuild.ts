import { Client } from 'discord.js';
import logger from '../loggerService';

export async function handleLeaveGuild(client: Client, payload: any) {
  const { guildId } = payload;
  if (!guildId) {
    throw new Error('Missing guildId in LEAVE_GUILD payload');
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    logger.warn(`Could not find guild ${guildId} to leave.`);
    return;
  }

  logger.info(`Leaving guild ${guild.name} (${guild.id}) as requested via bot job.`);
  await guild.leave();
}

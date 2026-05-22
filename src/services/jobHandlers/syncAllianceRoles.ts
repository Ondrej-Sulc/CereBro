import { Client } from 'discord.js';
import logger from '../loggerService';
import { syncRolesForGuild } from '../../commands/alliance/sync-roles';

export type SyncAllianceRolesPayload = {
  allianceId: string;
  guildId: string;
  requestedByPlayerId: string;
};

export async function handleSyncAllianceRoles(client: Client, payload: unknown) {
  const { allianceId, guildId, requestedByPlayerId } = payload as SyncAllianceRolesPayload;

  if (!allianceId || !guildId || !requestedByPlayerId) {
    throw new Error('Invalid SYNC_ALLIANCE_ROLES payload');
  }

  logger.info({ allianceId, guildId, requestedByPlayerId }, 'Starting full alliance role sync job');

  const guild = await client.guilds.fetch(guildId);
  if (!guild) {
    throw new Error(`Guild ${guildId} not found`);
  }

  const result = await syncRolesForGuild(guild, allianceId, true);
  logger.info(
    { allianceId, guildId, created: result.created, updated: result.updated, removed: result.removed },
    'Full alliance role sync completed'
  );
}

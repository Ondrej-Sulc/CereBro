import { Client } from 'discord.js';
import logger from '../loggerService';
import { syncRolesForGuild } from '../../commands/alliance/sync-roles';

export type SyncAllianceRolesPayload = {
  allianceId: string;
  guildId: string;
  requestedByPlayerId: string;
};

export async function handleSyncAllianceRoles(client: Client, payload: unknown) {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid SYNC_ALLIANCE_ROLES payload: allianceId, guildId, and requestedByPlayerId must be non-empty strings');
  }

  const parsed = payload as Partial<SyncAllianceRolesPayload>;

  if (
    typeof parsed.allianceId !== 'string' || parsed.allianceId.trim().length === 0 ||
    typeof parsed.guildId !== 'string' || parsed.guildId.trim().length === 0 ||
    typeof parsed.requestedByPlayerId !== 'string' || parsed.requestedByPlayerId.trim().length === 0
  ) {
    throw new Error('Invalid SYNC_ALLIANCE_ROLES payload: allianceId, guildId, and requestedByPlayerId must be non-empty strings');
  }

  const allianceId = parsed.allianceId.trim();
  const guildId = parsed.guildId.trim();
  const requestedByPlayerId = parsed.requestedByPlayerId.trim();

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

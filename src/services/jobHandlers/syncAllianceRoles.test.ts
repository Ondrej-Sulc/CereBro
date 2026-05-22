import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSyncAllianceRoles } from './syncAllianceRoles';
import { syncRolesForGuild } from '../../commands/alliance/sync-roles';

vi.mock('../../commands/alliance/sync-roles', () => ({
  syncRolesForGuild: vi.fn(),
}));

describe('handleSyncAllianceRoles', () => {
  beforeEach(() => {
    vi.mocked(syncRolesForGuild).mockReset();
  });

  it('fetches the guild and runs a manual role sync for the target alliance', async () => {
    const guild = { id: 'guild-1' };
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue(guild),
      },
    };
    vi.mocked(syncRolesForGuild).mockResolvedValue({ created: 1, updated: 2, removed: 3 });

    await handleSyncAllianceRoles(client as never, {
      allianceId: 'alliance-1',
      guildId: 'guild-1',
      requestedByPlayerId: 'player-1',
    });

    expect(client.guilds.fetch).toHaveBeenCalledWith('guild-1');
    expect(syncRolesForGuild).toHaveBeenCalledWith(guild, 'alliance-1', true);
  });

  it('throws when the guild fetch fails', async () => {
    const client = {
      guilds: {
        fetch: vi.fn().mockRejectedValue(new Error('missing access')),
      },
    };

    await expect(handleSyncAllianceRoles(client as never, {
      allianceId: 'alliance-1',
      guildId: 'guild-1',
      requestedByPlayerId: 'player-1',
    })).rejects.toThrow('missing access');
  });
});

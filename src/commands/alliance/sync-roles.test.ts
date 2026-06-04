import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncRolesForGuild } from './sync-roles';
import { prisma } from '../../services/prismaService';
import { checkAndCleanupAlliance } from '../../services/allianceService.js';

vi.mock('../../services/prismaService', () => ({
  prisma: {
    alliance: {
      findMany: vi.fn(),
    },
    player: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    botUser: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../services/allianceService.js', () => ({
  checkAndCleanupAlliance: vi.fn(),
}));

vi.mock('../../services/loggerService', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const baseAlliance = {
  id: 'alliance-1',
  guildId: 'guild-1',
  name: 'Alliance One',
  officerRole: 'officer-role',
  plannerRole: null,
  battlegroup1Role: 'bg-1-role',
  battlegroup2Role: null,
  battlegroup3Role: null,
  removeMissingMembers: false,
  syncRolesFromDiscord: true,
};

const existingOfficer = {
  id: 'player-1',
  discordId: 'discord-1',
  allianceId: 'alliance-1',
  battlegroup: 1,
  isOfficer: true,
  isPlanner: false,
  botUser: { isBotAdmin: false },
};

function makeMember(roleIds: string[]) {
  const roles = new Set(roleIds);

  return {
    id: 'discord-1',
    displayName: 'Discord Player',
    user: {
      tag: 'Discord Player#0001',
      displayAvatarURL: vi.fn().mockReturnValue('https://cdn.example/avatar.png'),
    },
    roles: {
      cache: {
        has: (roleId: string) => roles.has(roleId),
      },
    },
  };
}

function makeGuild(members: unknown[]) {
  return {
    id: 'guild-1',
    members: {
      fetch: vi.fn().mockResolvedValue(new Map(members.map((member: any) => [member.id, member]))),
    },
  };
}

describe('syncRolesForGuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAndCleanupAlliance).mockResolvedValue(false);
    vi.mocked(prisma.player.findMany).mockResolvedValue([]);
  });

  it('does not demote an existing CereBro officer when inbound Discord role sync is disabled', async () => {
    vi.mocked(prisma.alliance.findMany).mockResolvedValue([
      { ...baseAlliance, syncRolesFromDiscord: false },
    ] as never);
    const guild = makeGuild([makeMember(['bg-1-role'])]);

    const result = await syncRolesForGuild(guild as never, 'alliance-1');

    expect(result).toEqual({ updated: 0, created: 0, removed: 0 });
    expect(guild.members.fetch).not.toHaveBeenCalled();
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it('keeps current behavior when inbound Discord role sync is enabled', async () => {
    vi.mocked(prisma.alliance.findMany).mockResolvedValue([baseAlliance] as never);
    vi.mocked(prisma.player.findMany).mockResolvedValue([existingOfficer] as never);
    const guild = makeGuild([makeMember(['bg-1-role'])]);

    const result = await syncRolesForGuild(guild as never, 'alliance-1');

    expect(result).toEqual({ updated: 1, created: 0, removed: 0 });
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'player-1' },
      data: { isOfficer: false },
    });
  });

  it('does not create role-matched members when inbound Discord role sync is disabled', async () => {
    vi.mocked(prisma.alliance.findMany).mockResolvedValue([
      { ...baseAlliance, syncRolesFromDiscord: false },
    ] as never);
    const guild = makeGuild([makeMember(['officer-role', 'bg-1-role'])]);

    const result = await syncRolesForGuild(guild as never, 'alliance-1');

    expect(result).toEqual({ updated: 0, created: 0, removed: 0 });
    expect(prisma.botUser.upsert).not.toHaveBeenCalled();
    expect(prisma.player.create).not.toHaveBeenCalled();
  });

  it('does not remove missing members when strict removal is enabled but inbound Discord role sync is disabled', async () => {
    vi.mocked(prisma.alliance.findMany).mockResolvedValue([
      {
        ...baseAlliance,
        removeMissingMembers: true,
        syncRolesFromDiscord: false,
      },
    ] as never);
    const guild = makeGuild([]);

    const result = await syncRolesForGuild(guild as never, 'alliance-1');

    expect(result).toEqual({ updated: 0, created: 0, removed: 0 });
    expect(guild.members.fetch).not.toHaveBeenCalled();
    expect(prisma.player.update).not.toHaveBeenCalled();
  });
});

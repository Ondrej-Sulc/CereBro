import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncAllAllianceRoles } from './schedulerService';
import { prisma } from './prismaService';
import { syncRolesForGuild } from '../commands/alliance/sync-roles';

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
    validate: vi.fn(),
  },
}));

vi.mock('./scheduleDbService', () => ({
  getSchedules: vi.fn(),
  updateSchedule: vi.fn(),
}));

vi.mock('../utils/commandHandler', () => ({
  commands: new Map(),
}));

vi.mock('./posthogService', () => ({
  getPosthogClient: vi.fn(),
}));

vi.mock('./prismaService', () => ({
  prisma: {
    alliance: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../commands/alliance/sync-roles', () => ({
  syncRolesForGuild: vi.fn(),
}));

vi.mock('./loggerService', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('syncAllAllianceRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries only inbound-sync-enabled alliances and includes planner-only role configs', async () => {
    vi.mocked(prisma.alliance.findMany).mockResolvedValue([]);
    const client = {
      guilds: {
        cache: {
          get: vi.fn(),
        },
        fetch: vi.fn(),
      },
    };

    await syncAllAllianceRoles(client as never);

    expect(prisma.alliance.findMany).toHaveBeenCalledWith({
      where: {
        syncRolesFromDiscord: true,
        OR: [
          { officerRole: { not: null } },
          { plannerRole: { not: null } },
          { battlegroup1Role: { not: null } },
          { battlegroup2Role: { not: null } },
          { battlegroup3Role: { not: null } },
        ],
      },
    });
    expect(syncRolesForGuild).not.toHaveBeenCalled();
  });
});

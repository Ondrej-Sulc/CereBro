import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentType, type Client, type ContainerBuilder } from 'discord.js';
import { WarMapType, type WarVideo } from '@prisma/client';
import { distributeWarPlan } from './warPlanDistributor';

const db = vi.hoisted(() => ({
    alliance: vi.fn(), war: vi.fn(), tactic: vi.fn(), bans: vi.fn(),
    players: vi.fn(), history: vi.fn(), roster: vi.fn(),
}));
vi.mock('../prismaService', () => ({ prisma: {
    alliance: { findUnique: db.alliance }, war: { findUnique: db.war },
    warTactic: { findFirst: db.tactic }, seasonBan: { findMany: db.bans },
    player: { findMany: db.players }, warFight: { findMany: db.history },
    roster: { findMany: db.roster },
} }));
vi.mock('../mapImageService', () => ({ MapImageService: {
    getPlayerPalette: () => ['#123456'],
    preloadImages: async () => new Map(),
    generateMapImage: async () => Buffer.from('test map'),
} }));
vi.mock('../championService', () => ({ getChampionByName: async () => null }));
vi.mock('../loggerService', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../config', () => ({ config: { botBaseUrl: 'https://cerebro.example' } }));

const player = { id: 'assigned-player', ingameName: 'Assigned Player', discordId: 'discord-player', battlegroup: 1 };
const alliance = { id: 'alliance-one', name: 'Test Alliance', battlegroup1ChannelId: null };
const fight = {
    id: 'planned-fight', nodeId: 7, attackerId: 101, defenderId: 102,
    battlegroup: 1, playerId: player.id, player, prefightChampions: [],
    node: { id: 7, nodeNumber: 7 },
    attacker: { id: 101, name: 'Gentle', class: 'MUTANT', images: null, tags: [] },
    defender: { id: 102, name: 'Baron Zemo', class: 'SKILL', images: null, tags: [] },
};
const war = {
    id: 'planned-war', allianceId: alliance.id, enemyAlliance: 'Opponent',
    season: 70, warNumber: 11, warTier: 1, mapType: WarMapType.BIG_THING,
    fights: [fight], extraChampions: [], bans: [],
};

function video(id: string, overrides: Partial<WarVideo> = {}): WarVideo {
    return { id, url: `https://video.example/${id}`, gcsUrl: null, description: null,
        visibility: 'public', status: 'PUBLISHED', submittedById: player.id,
        createdAt: new Date('2026-10-30T12:00:00Z'), updatedAt: new Date('2026-10-30T12:00:00Z'),
        ...overrides,
    };
}

function historicalFight(clips: WarVideo[], owner = player, allianceId = alliance.id, death = 0) {
    return { nodeId: fight.nodeId, attackerId: fight.attackerId, defenderId: fight.defenderId,
        death, player: owner, war: { allianceId }, video: clips[0] ?? null,
        recordings: clips.map((clip, position) => ({ position, video: clip })),
    };
}

type PlanMessage = { components: ContainerBuilder[] };
const dmSend = vi.fn<(message: PlanMessage) => Promise<void>>();
const threadSend = vi.fn<(message: PlanMessage) => Promise<void>>();
const thread = { name: player.ingameName, send: threadSend, members: { add: vi.fn() } };
const client = {
    users: { fetch: vi.fn() }, channels: { fetch: vi.fn() },
};

beforeEach(() => {
    vi.resetAllMocks();
    db.alliance.mockResolvedValue(alliance);
    db.war.mockResolvedValue(war);
    db.tactic.mockResolvedValue(null);
    db.bans.mockResolvedValue([]);
    db.players.mockResolvedValue([player]);
    db.roster.mockResolvedValue([]);
    dmSend.mockResolvedValue(undefined);
    threadSend.mockResolvedValue(undefined);
    thread.members.add.mockResolvedValue(undefined);
    client.users.fetch.mockResolvedValue({ send: dmSend });
    client.channels.fetch.mockResolvedValue({ isTextBased: () => true,
        threads: { fetch: async () => ({ threads: new Map([['player-thread', thread]]) }) },
    });
});

async function assignments(delivery: 'dm' | 'thread' = 'dm') {
    if (delivery === 'thread') db.alliance.mockResolvedValue({ ...alliance, battlegroup1ChannelId: 'bg-channel' });
    const result = await distributeWarPlan(client as unknown as Client, alliance.id, war.id, 1, player.id);
    expect(result.errors).toEqual([]);
    expect(result.sent).toEqual([player.ingameName]);
    const send = delivery === 'thread' ? threadSend : dmSend;
    expect(send).toHaveBeenCalledOnce();
    return send.mock.calls[0][0].components[0].toJSON().components
        .filter(component => component.type === ComponentType.TextDisplay)
        .map(component => component.content)
        .find(content => content.startsWith('**Assignments**'))!;
}

describe('historical recordings in distributed AW plans', () => {
    it.each(['dm', 'thread'] as const)("includes the assigned player's own published video in their %s plan", async delivery => {
        const own = video('own-recording');
        // Legacy primary-only recording; no collection link is required.
        db.history.mockResolvedValue([{ ...historicalFight([own]), recordings: [] }]);
        const text = await assignments(delivery);
        expect(text).toContain('[Assigned Player](https://cerebro.example/war-videos/own-recording)');
        expect(text).toContain('Node 7:');
        expect(text).toContain('**Gentle**');
        expect(text).toContain('**Baron Zemo**');
    });

    it.each([true, false])('includes both recordings of an own fight without duplicate links (legacy primary: %s)', async legacyPrimary => {
        const history = historicalFight([video('first-attempt'), video('finishing-attempt')]);
        db.history.mockResolvedValue([{ ...history, video: legacyPrimary ? history.video : null }]);
        const text = await assignments();
        expect(text.match(/\/war-videos\/first-attempt/g)).toHaveLength(1);
        expect(text.match(/\/war-videos\/finishing-attempt/g)).toHaveLength(1);
    });

    it('keeps the existing ranking and three-link limit when own and teammate recordings are mixed', async () => {
        const teammate = { ...player, id: 'teammate', ingameName: 'Teammate' };
        db.history.mockResolvedValue([
            historicalFight([video('own-solo')]),
            historicalFight([video('teammate-solo', { submittedById: teammate.id })], teammate),
            historicalFight([video('own-two-deaths')], player, alliance.id, 2),
            historicalFight([video('fourth-recording')], teammate, alliance.id, 3),
        ]);
        const text = await assignments();
        const ids = [...text.matchAll(/\/war-videos\/([\w-]+)/g)].map(match => match[1]);
        expect(ids).toEqual(['own-solo', 'teammate-solo', 'own-two-deaths']);
        expect(text).toContain('[Assigned Player (💀 2)]');
    });

    it('keeps inaccessible and unpublished clips out of the shared plan, including clips uploaded by the player', async () => {
        db.history.mockResolvedValue([
            historicalFight([
                video('own-alliance', { visibility: 'alliance' }),
                video('own-private', { visibility: 'private' }),
                video('own-planning', { status: 'PLANNING' }),
                video('own-pending', { status: 'UPLOADED' }),
                video('own-rejected', { status: 'REJECTED' }),
                video('missing-url', { url: null }),
            ]),
            historicalFight([video('other-alliance', { visibility: 'alliance' })], player, 'other-alliance'),
        ]);
        const text = await assignments('thread');
        expect([...text.matchAll(/\/war-videos\/([\w-]+)/g)].map(match => match[1])).toEqual(['own-alliance']);
    });

    it('continues to include a published teammate video when the player has none', async () => {
        const teammate = { ...player, id: 'teammate', ingameName: 'Teammate' };
        db.history.mockResolvedValue([historicalFight([video('teammate', { submittedById: teammate.id })], teammate)]);
        expect(await assignments()).toContain('[Teammate](https://cerebro.example/war-videos/teammate)');
    });
});

import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { generateAbilityDraft, saveAbilityDraft } from './ability-draft-service';
import type { OpenRouterService } from '../../../src/services/openRouterService';

function database() {
  const target = { id: 2, name: 'Ægon', gameId: 'aegon', class: 'SKILL', tags: [{ name: '#Hero' }], fullAbilities: { abilities_breakdown: [] } };
  const row = {
    id: 'stardust', name: 'Stardust', description: 'Ægon: SP1 inflicts Shock.', sourceHash: 'current',
    enabled: true, unique: true, requiredHeroGroups: false, targetTags: ['aegon'],
    members: [
      { role: 'OWNER', rarity: 7, champion: { id: 1, name: 'Carina', gameId: 'carina_white' } },
      { role: 'REQUIRED', rarity: 6, champion: { id: target.id, name: target.name, gameId: target.gameId } },
    ],
  };
  const boundary = {
    champion: { findUnique: vi.fn().mockResolvedValue(target) },
    gameSynergy: { findMany: vi.fn().mockResolvedValue([row]) },
    ability: { upsert: vi.fn().mockResolvedValue({ id: 5 }) },
    championAbilityLink: {
      findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 20 }),
    },
    championAbilitySynergy: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $executeRaw: vi.fn().mockResolvedValue(0),
  };
  const db = { ...boundary, $transaction: vi.fn(async (callback: (tx: typeof boundary) => Promise<void>) => callback(boundary)) };
  return { db: db as unknown as PrismaClient, boundary, transaction: db.$transaction };
}
const innate = { name: 'Shock', source: 'SP2' };
const synergy = { name: 'Shock', source: 'SP1', synergy: { key: 'stardust:REQUIRED', championIds: [1] } };
function router(draft: unknown, finishReason = 'stop') {
  const chat = vi.fn<OpenRouterService['chat']>().mockResolvedValue({
    id: 'test', model: 'test', object: 'chat.completion', created: 0,
    choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content: JSON.stringify(draft) } }],
  });
  return { chat };
}

describe('ability draft generation and confirmation', () => {
  it('reuses an older prefixed source when a new draft has clean text and tags', async () => {
    const { db, boundary } = database();
    boundary.championAbilityLink.findMany.mockResolvedValue([{ id: 99, source: 'Passive, SP1', effectForm: 'PASSIVE', effectDirection: 'UNKNOWN' }]);
    await saveAbilityDraft(db, 2, { abilities: [{ name: 'Shock', source: 'SP1', effectForm: 'PASSIVE' }] });
    expect(boundary.championAbilityLink.create).not.toHaveBeenCalled();
  });
  it('persists each application and includes both tags when checking source identity', async () => {
    const { db, boundary } = database();
    await saveAbilityDraft(db, 2, { abilities: [
      { name: 'Shock', source: 'SP1', effectForm: 'PASSIVE', effectDirection: 'GAIN' },
      { name: 'Shock', source: 'SP1', effectForm: 'DEBUFF', effectDirection: 'INFLICT' },
    ] });
    expect(boundary.championAbilityLink.findFirst.mock.calls.map(call => call[0].where)).toEqual([
      { championId: 2, abilityId: 5, type: 'ABILITY', source: 'SP1', effectForm: 'PASSIVE', effectDirection: 'GAIN' },
      { championId: 2, abilityId: 5, type: 'ABILITY', source: 'SP1', effectForm: 'DEBUFF', effectDirection: 'INFLICT' },
    ]);
    expect(boundary.championAbilityLink.create.mock.calls.map(call => call[0].data)).toMatchObject([
      { source: 'SP1', effectForm: 'PASSIVE', effectDirection: 'GAIN' },
      { source: 'SP1', effectForm: 'DEBUFF', effectDirection: 'INFLICT' },
    ]);
  });

  it('recognizes legacy blank sources when saving an unconditional effect', async () => {
    const { db, boundary } = database();
    boundary.championAbilityLink.findFirst.mockResolvedValue({ id: 99 });
    await saveAbilityDraft(db, 2, { immunities: [{ name: 'Bleed', source: '' }] });
    expect(boundary.championAbilityLink.findFirst).toHaveBeenCalledWith({ where: {
      championId: 2, abilityId: 5, type: 'IMMUNITY', effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', OR: [{ source: null }, { source: '' }],
    } });
    expect(boundary.championAbilityLink.create).not.toHaveBeenCalled();
  });
  it('sends current game synergy evidence on both generation and revisions', async () => {
    const { db } = database();
    const ai = router({ abilities: [innate, synergy], immunities: [] });
    const draft = await generateAbilityDraft(db, ai, 2, 'test');
    expect(ai.chat.mock.calls[0][0].messages[1].content).toContain('Ægon: SP1 inflicts Shock.');
    expect(ai.chat.mock.calls[0][0].messages[1].content).toContain('#Hero');
    expect(ai.chat.mock.calls[0][0].messages[1].content).toContain('SKILL');
    expect(draft.abilities[1].synergy?.requirement).toContain('with Carina (7★)');
    await generateAbilityDraft(db, ai, 2, 'test', { draft, suggestions: 'Include duration' });
    const messages = ai.chat.mock.calls[1][0].messages;
    expect(messages[1].content).toContain('stardust:REQUIRED');
    expect(messages.at(-1)?.content).toContain('Include duration');
    expect(messages[2].content).toContain('championIds');
  });

  it('rejects truncated responses and hallucinated synergy references before review', async () => {
    const { db } = database();
    await expect(generateAbilityDraft(db, router({ abilities: [] }, 'length'), 2, 'test')).rejects.toThrow('incomplete');
    await expect(generateAbilityDraft(db, router({ abilities: [{ ...synergy, synergy: { key: 'fake', championIds: [1] } }] }), 2, 'test')).rejects.toThrow('Unknown');
  });

  it('saves innate and synergy sources separately with teammate links inside one transaction', async () => {
    const { db, boundary, transaction } = database();
    await saveAbilityDraft(db, 2, { abilities: [innate, synergy], immunities: [{ ...synergy, name: 'Bleed', source: 'While above 50% Health' }] });
    expect(transaction).toHaveBeenCalledOnce();
    const sources = boundary.championAbilityLink.create.mock.calls.map(call => call[0].data);
    expect(sources).toEqual([
      { championId: 2, abilityId: 5, type: 'ABILITY', effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', source: 'SP2' },
      { championId: 2, abilityId: 5, type: 'ABILITY', effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', source: 'Synergy: Stardust (6★) with Carina (7★); does not stack — SP1' },
      { championId: 2, abilityId: 5, type: 'IMMUNITY', effectForm: 'UNKNOWN', effectDirection: 'UNKNOWN', source: 'Synergy: Stardust (6★) with Carina (7★); does not stack — While above 50% Health' },
    ]);
    expect(boundary.championAbilitySynergy.createMany).toHaveBeenCalledTimes(2);
    expect(boundary.championAbilitySynergy.createMany).toHaveBeenCalledWith({
      data: [{ championAbilityLinkId: 20, championId: 1 }], skipDuplicates: true,
    });
  });

  it('reuses an existing source on repeated confirmation and ensures its teammate links exist', async () => {
    const { db, boundary } = database();
    boundary.championAbilityLink.findFirst.mockResolvedValue({ id: 99 });
    await saveAbilityDraft(db, 2, { abilities: [synergy] });
    expect(boundary.championAbilityLink.create).not.toHaveBeenCalled();
    expect(boundary.championAbilitySynergy.createMany).toHaveBeenCalledWith({
      data: [{ championAbilityLinkId: 99, championId: 1 }], skipDuplicates: true,
    });
  });

  it('validates all entries against the current snapshot before any writes', async () => {
    const { db, boundary } = database();
    await expect(saveAbilityDraft(db, 2, { abilities: [innate, {
      ...synergy, synergy: { ...synergy.synergy, sourceHash: 'stale' },
    }] })).rejects.toThrow('Synergy data changed');
    expect(boundary.ability.upsert).not.toHaveBeenCalled();
    expect(boundary.championAbilityLink.create).not.toHaveBeenCalled();
    expect(boundary.championAbilitySynergy.createMany).not.toHaveBeenCalled();
  });
});

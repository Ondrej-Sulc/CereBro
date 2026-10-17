import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { importGlossaryIcons } from './glossaryIconsImportService';
import { parseMcocGameGlossaryJson, importMcocGameDescriptions } from './mcocGameDescriptionsImportService';

function fixture(terms: Array<{ id: string; name: string; description?: string }>, abilities: Array<{ id: number; name: string; gameGlossaryTermId: string | null; iconUrl?: string }> = []) {
  const matches = (value: string, query: { equals: string }) => value.toLowerCase() === query.equals.toLowerCase();
  const tx = {
    gameGlossaryTerm: {
      findUnique: vi.fn(async ({ where }: any) => terms.find(t => t.id === where.id)),
      findMany: vi.fn(async ({ where }: any) => terms.filter(t => matches(t.name, where.name))),
      update: vi.fn(async ({ where, data }: any) => Object.assign(terms.find(t => t.id === where.id)!, data)),
    },
    ability: {
      findUnique: vi.fn(async ({ where }: any) => abilities.find(a => a.gameGlossaryTermId === where.gameGlossaryTermId)),
      findFirst: vi.fn(async ({ where }: any) => abilities.find(a => matches(a.name, where.name))),
      update: vi.fn(async ({ where, data }: any) => Object.assign(abilities.find(a => a.id === where.id)!, data)),
      create: vi.fn(async ({ data }: any) => { const a = { id: abilities.length+1, ...data }; abilities.push(a); return a; }),
    },
  };
  return { prisma: { $transaction: (fn: any) => fn(tx) } as unknown as PrismaClient, tx, abilities };
}

describe('glossary icon identity', () => {
  it('does not let a misresolved key steal a canonical effect in either order', async () => {
    for (const keys of [['armor_break', 'severe'], ['severe', 'armor_break']]) {
      const f = fixture([{ id: 'armor_break', name: 'Armor Break' }, { id: 'severe', name: 'Armor Break' }],
        [{ id: 1, name: 'Armor Break', gameGlossaryTermId: 'armor_break' }]);
      await importGlossaryIcons(f.prisma, keys.map(glossaryKey => ({ glossaryKey, iconUrl: `${glossaryKey}.svg` })), { write: true });
      expect(f.abilities[0]).toMatchObject({ gameGlossaryTermId: 'armor_break', iconUrl: 'armor_break.svg' });
    }
  });
  it('imports an icon without creating a blank ability', async () => {
    const f = fixture([{ id: 'well_timed_special', name: '', description: '' }]);
    const report = await importGlossaryIcons(f.prisma, [{ glossaryKey: 'well_timed_special', iconUrl: 'special.svg' }], { write: true });
    expect(report.abilitiesCreated).toBe(0);
    expect(f.tx.gameGlossaryTerm.update).toHaveBeenCalledOnce();
    expect(f.tx.ability.create).not.toHaveBeenCalled();
  });
  it('retains explicit abbreviations and does not write curated descriptions', async () => {
    const f = fixture([{ id: 'degen', name: 'Degeneration', description: 'Game text' }],
      [{ id: 1, name: 'Degeneration', gameGlossaryTermId: null }]);
    await importGlossaryIcons(f.prisma, [{ glossaryKey: 'degen', iconUrl: 'degen.svg' }], { write: true });
    expect(f.abilities[0]).toMatchObject({ gameGlossaryTermId: 'degen', iconUrl: 'degen.svg' });
    expect(f.tx.ability.update.mock.calls[0][0].data).not.toHaveProperty('description');
  });
  it('reports a conflicting link instead of moving it', async () => {
    const f = fixture([{ id: 'armor_break', name: 'Armor Break' }],
      [{ id: 1, name: 'Armor Break', gameGlossaryTermId: 'severe' }]);
    const report = await importGlossaryIcons(f.prisma, [{ glossaryKey: 'armor_break', iconUrl: 'armor.svg' }], { write: true });
    expect(report.conflicts).toHaveLength(1);
    expect(f.tx.ability.update).not.toHaveBeenCalled();
  });
  it('does not mutate either table in a dry run', async () => {
    const f = fixture([{ id: 'bleed', name: 'Bleed' }]);
    await importGlossaryIcons(f.prisma, [{ glossaryKey: 'bleed', iconUrl: 'bleed.svg' }]);
    expect(f.tx.gameGlossaryTerm.update).not.toHaveBeenCalled();
    expect(f.tx.ability.create).not.toHaveBeenCalled();
  });
});

describe('game glossary input', () => {
  it('rejects champion payloads before they can populate the glossary table', () => {
    expect(() => parseMcocGameGlossaryJson(JSON.stringify({ aegon: { base_id: 'aegon', tiers: {} } })))
      .toThrow('expected an effect definition');
    expect(parseMcocGameGlossaryJson(JSON.stringify({ bleed: { name: 'Bleed', description: '' } }))).toHaveProperty('bleed');
  });
  it('preserves verified text when game references are unresolved', async () => {
    const upsert = vi.fn();
    const prisma = { champion: { findMany: vi.fn(async () => []) }, gameGlossaryTerm: { upsert } } as unknown as PrismaClient;
    await importMcocGameDescriptions(prisma, {}, { dodge: { name: '', description: '', hud_id: '' } }, { write: true });
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('name');
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('description');
  });
});

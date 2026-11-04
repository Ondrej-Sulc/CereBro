import { describe, expect, it, vi } from 'vitest';
import { getChampionSynergies } from './champion-synergies';
import manifest from '@cerebro/core/data/synergy-icons.json';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { gameSynergy: { findMany } } }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

describe('champion synergy icon read path', () => {
  it('projects current raw texture into an icon without sending the raw snapshot to the client', async () => {
    const glyph = manifest.glyphs[0];
    const row = { id: 'refreshed_id', name: 'Unrelated localized name', description: 'Exact game text.', unique: true, members: [] };
    const raw = { id: row.id, texture: glyph.texture, bonus_heroes: ['native_t7'] };
    findMany.mockResolvedValue([{ ...row, raw }]);
    expect(await getChampionSynergies(1)).toEqual([{ ...row, iconUrl: glyph.src }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ raw: true }) }));
    findMany.mockResolvedValue([{ ...row, raw: { ...raw, texture: 'unknown' } }]);
    expect(await getChampionSynergies(1)).toEqual([{ ...row, iconUrl: null }]);
    expect(raw).toEqual({ id: row.id, texture: glyph.texture, bonus_heroes: ['native_t7'] });
  });
});

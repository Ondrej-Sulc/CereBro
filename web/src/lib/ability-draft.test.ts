import { describe, expect, it } from 'vitest';
import {
  buildAbilityDraftSynergies, buildAbilityDraftUserPrompt, parseAbilityDraft, abilityDraftSource,
  type DraftSynergyRow,
} from './ability-draft';

const carina = { id: 1, name: 'Carina Tivan', gameId: 'carina_white' };
const aegon = { id: 2, name: 'Ægon', gameId: 'aegon' };
const row: DraftSynergyRow = {
  id: 'carina_1', name: '[64acff]STARDUST[-]', description: 'Carina: gain shards. Ægon: SP1 inflicts Shock.',
  sourceHash: 'snapshot-1', enabled: true, unique: true, requiredHeroGroups: false,
  targetTags: ['carina_white', 'aegon'],
  members: [
    { role: 'OWNER', rarity: 6, champion: carina },
    { role: 'OWNER', rarity: 7, champion: carina },
    { role: 'REQUIRED', rarity: 5, champion: aegon },
    { role: 'REQUIRED', rarity: 6, champion: aegon },
  ],
};

describe('ability draft synergy context and validation', () => {
  it('supplies owned and incoming descriptions, recipients, partners and obtainable rarities', () => {
    const owned = buildAbilityDraftSynergies([row], 1);
    const incoming = buildAbilityDraftSynergies([row], 2);
    expect(owned[0]).toMatchObject({ key: 'carina_1:OWNER', name: 'STARDUST', championRarities: [6, 7], partners: [{ ...aegon, rarities: [5, 6] }] });
    expect(incoming[0]).toMatchObject({ key: 'carina_1:REQUIRED', championRarities: [5, 6], partners: [{ ...carina, rarities: [6, 7] }], targetTags: row.targetTags });
    const prompt = buildAbilityDraftUserPrompt({ ...aegon, fullAbilities: { signature: {} } }, incoming);
    expect(prompt).toContain(row.description);
    expect(prompt).toContain('carina_1:REQUIRED');
    expect(prompt).toContain('full_abilities');
  });

  it('excludes disabled, grouped, unrelated, self-only and unavailable combinations', () => {
    for (const candidate of [
      { ...row, enabled: false }, { ...row, requiredHeroGroups: true },
      { ...row, members: row.members.filter(m => m.role === 'OWNER') },
      { ...row, members: row.members.map(m => ({ ...m, champion: carina })) },
    ]) expect(buildAbilityDraftSynergies([candidate], 1)).toEqual([]);
    expect(buildAbilityDraftSynergies([row], 99)).toEqual([]);
  });

  it('keeps innate effects separate and makes synergy conditions explicit for review and storage', () => {
    const contexts = buildAbilityDraftSynergies([row], 2);
    const draft = parseAbilityDraft({ abilities: [
      { name: 'Shock', source: 'SP2' },
      { name: 'Shock', source: 'SP1 hits after the first; 3s', synergy: { key: contexts[0].key, championIds: [1, 1] } },
    ], immunities: [] }, contexts);
    expect(draft.abilities[0].synergy).toBeUndefined();
    const effect = draft.abilities[1];
    expect(effect.synergy).toMatchObject({ championIds: [1], sourceHash: 'snapshot-1' });
    expect(abilityDraftSource(effect)).toBe('Synergy: STARDUST (5★/6★) with Carina Tivan (6★/7★); does not stack — SP1 hits after the first; 3s');
  });

  it('rejects unknown references, invalid teammates and changed game snapshots', () => {
    const contexts = buildAbilityDraftSynergies([row], 2);
    for (const synergy of [
      { key: 'invented', championIds: [1] },
      { key: contexts[0].key, championIds: [99] },
      { key: contexts[0].key, championIds: [2] },
      { key: contexts[0].key, championIds: [] },
      { key: contexts[0].key, championIds: [1], sourceHash: 'old-snapshot' },
    ]) expect(() => parseAbilityDraft({ abilities: [{ name: 'Shock', source: 'SP1', synergy }] }, contexts)).toThrow();
  });

  it('preserves rarity variants and alternative teammates without trusting supplied requirement text', () => {
    const otherPartner = { id: 3, name: 'Guillotine', gameId: 'guillotine' };
    const variant = {
      ...row, id: 'team_bonus_5', unique: false,
      members: [row.members[0], row.members[2], { role: 'REQUIRED' as const, rarity: 7, champion: otherPartner }],
    };
    const contexts = buildAbilityDraftSynergies([variant, { ...row, id: 'team_bonus_6' }], 1);
    const draft = parseAbilityDraft({ abilities: [{ name: 'Perfect Block', source: '+5% chance', synergy: {
      key: contexts[0].key, championIds: [2, 3], requirement: 'Always active; no teammates needed',
    } }] }, contexts);
    expect(contexts.map(c => c.championRarities)).toEqual([[6], [6, 7]]);
    expect(abilityDraftSource(draft.abilities[0])).toBe('Synergy: STARDUST (6★) with Ægon (5★) OR Guillotine (7★) — +5% chance');
  });

  it('validates AI JSON instead of silently discarding malformed entries or losing conditions', () => {
    for (const draft of [null, {}, { abilities: 'Shock' }, { abilities: [{ name: '', source: '' }] },
      { abilities: [{ name: 'Shock', source: 'Synergy: invented' }] },
      { abilities: [{ name: 'Shock', source: '', synergyChampions: [1] }] },
    ]) expect(() => parseAbilityDraft(draft, [])).toThrow();
    expect(parseAbilityDraft({ immunities: [{ name: 'Bleed', source: '' }] }, [])).toEqual({ abilities: [], immunities: [{ name: 'Bleed', source: '' }] });
  });
});

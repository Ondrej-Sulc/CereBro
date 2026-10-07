import { describe, expect, it } from 'vitest';
import { parseMcocSynergiesJson, prepareMcocSynergiesImport } from './mcocSynergiesImportService';

const synergy = {
  id: 'carina_1', name_key: 'NAME', description_key: 'DESC', name: 'STARDUST',
  description_template: '[64acff]Carina:[-] Gain {0} charges.',
  description_value: 0.015, description_argument: 1.5,
  description: '[64acff]Carina:[-] Gain 1.5 charges.', texture: '\ue913',
  enabled: true, unique: true, hero_rating_hp_modifier: 0, hero_rating_attack_modifier: 0,
  bonus_heroes: ['carina_white_t6', 'carina_white_t7'],
  required_heroes: ['aegon_t6', 'aegon_t7'], target_tags: ['carina_white', 'aegon'],
  hero_rating_stat_mod_modifiers: ['carina_effect'], required_hero_groups: false,
};
const file = (synergies = [synergy]) => JSON.stringify({
  metadata: { schemaVersion: 'synergies-investigation-v1', sourceSha256: 'a'.repeat(64) },
  validation: { records: synergies.length }, synergies,
});

describe('game synergy import', () => {
  it('preserves full source rules and fractional values in a validated snapshot', () => {
    const parsed = parseMcocSynergiesJson(file());
    expect(parsed.synergies[0]).toMatchObject(synergy);
    expect(() => parseMcocSynergiesJson('[]')).toThrow();
    expect(() => parseMcocSynergiesJson(file([]))).toThrow();
    expect(() => parseMcocSynergiesJson(file([synergy, synergy]))).toThrow(/duplicate/i);
    expect(() => parseMcocSynergiesJson(file([{ ...synergy, description: 'Gain {0} charges.' }]))).toThrow();
  });

  it('links only obtainable rarities while preserving all raw activation rules', () => {
    const result = prepareMcocSynergiesImport(parseMcocSynergiesJson(file()), [
      { id: 1, gameId: 'carina_white', obtainable: ['7'], isPlayable: true },
      { id: 2, gameId: 'aegon', obtainable: ['6'], isPlayable: true },
    ]);
    expect(result.members).toEqual([
      { synergyId: 'carina_1', championId: 1, tierId: 'carina_white_t7', rarity: 7, role: 'OWNER' },
      { synergyId: 'carina_1', championId: 2, tierId: 'aegon_t6', rarity: 6, role: 'REQUIRED' },
    ]);
    expect(result.synergies[0].raw).toMatchObject({ bonus_heroes: synergy.bonus_heroes, required_heroes: synergy.required_heroes });
    expect(result.report.filteredTemplateTiers).toEqual(['aegon_t7', 'carina_white_t6']);
    expect(result.report.canWrite).toBe(true);
  });

  it('retains unrecognized source records but blocks an import with no known owner', () => {
    const data = parseMcocSynergiesJson(file());
    const plan = prepareMcocSynergiesImport(data, []);
    expect(plan.synergies).toHaveLength(1);
    expect(plan.members).toEqual([]);
    expect(plan.report.canWrite).toBe(false);
    expect(plan.report.unmatchedTiers).toContain('carina_white_t7');
    expect(() => parseMcocSynergiesJson(file().replace('"records":1', '"records":2'))).toThrow(/count/);
  });

  it('refuses to flatten grouped requirements into misleading any-partner links', () => {
    const data = parseMcocSynergiesJson(file([{ ...synergy, required_hero_groups: true }]));
    const plan = prepareMcocSynergiesImport(data, [{ id: 1, gameId: 'carina_white', obtainable: ['7'], isPlayable: true }]);
    expect(plan.report.canWrite).toBe(false);
    expect(plan.report.unsupportedGroupedRequirements).toEqual(['carina_1']);
  });
});

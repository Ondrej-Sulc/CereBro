import { expect, it } from 'vitest';
import type { AbilityBindingEntry } from './championAbilityBindingService';
import type { AbilityDisplayEntry } from './championAbilityDisplayService';
import { projectNativeSpecialKits } from './nativeSpecialKitService';
import { prepareChampionAbilityText } from '../domain/champion-ability-text/renderer';

const raw = 'Inflict {1} damage for {2} seconds.';
const description = { base_id: 'npc', bio: 'A native biography.', base_abilities: [{ description: raw, group: 'special1', buff_name: '[ffffff]Native Attack[-]' }] };
const display: AbilityDisplayEntry = { gameId: 'npc', sourceId: 'special1:1', raw,
  display: { kind: 'ability', componentId: 'component', hudId: 'hud', section: { id: 'section', title: 'Special 1' } } };
const binding: AbilityBindingEntry = { gameId: 'npc', sourceId: 'special1:1', raw, componentId: 'component', hudId: 'hud', bindingComponentIds: ['component'], sources: {
  '1': { kind: 'abilityParam', rawValue: 0.5, gameBinding: { version: 1, slot: 1, value: 0.5, formula: { id: 'attack', type: 'mod_x_attk', a: 1, b: 0, c: 0 } } },
  '2': { kind: 'abilityParam', rawValue: 3, gameBinding: { version: 1, slot: 2, value: 3 } },
} };
const options = { newGameIds: ['npc', 'missing'], existingGameIds: ['curated'], displayMetadata: [display], abilityBindings: [binding] };

it('projects exact new IDs with unchanged raw, section and numeric bindings, and explicit absent sources', () => {
  const source = { npc: structuredClone(description), curated: { base_id: 'curated', bio: 'Keep existing curated kit.' } };
  const before = JSON.stringify(source);
  const result = projectNativeSpecialKits(source, options);
  expect(result.champions.map(row => row.gameId)).toEqual(['npc', 'missing']);
  expect(result.champions[0].abilityTexts).toMatchObject([
    { sourceId: 'bio', group: 'bio', sortOrder: 0, template: { raw: description.bio } },
    { sourceId: 'special1:1', title: 'Native Attack', sortOrder: 1, template: { raw, display: display.display } },
  ]);
  expect(result.statsDependentRows).toEqual([{ gameId: 'npc', sourceId: 'special1:1' }]);
  expect(result.missingDescriptions).toEqual(['missing']);
  expect(JSON.stringify(source)).toBe(before);
  expect(JSON.stringify(result)).not.toContain('championId');
});

it('holds an unbound numeric record while keeping known plain text and explicit omission details', () => {
  const result = projectNativeSpecialKits({ npc: { ...description,
    special_attacks: [{ name: 'NPC Special Attack 1', description: 'NPC unleashes a signature attack on their opponent.' }] } }, { ...options, abilityBindings: [] });
  expect(result.champions[0].abilityTexts.map(row => row.sourceId)).toEqual(['bio']);
  expect(result.held).toEqual([{ gameId: 'npc', sourceId: 'special1:1', reason: 'missing-verified-numeric-binding' }]);
  expect(result.omittedGenericSpecials).toEqual([{ gameId: 'npc', sourceId: 'special:1' }]);
});

it('refuses existing identities, duplicate targets, and source ID aliases', () => {
  expect(() => projectNativeSpecialKits({}, { ...options, newGameIds: ['curated'] })).toThrow('Existing champion');
  expect(() => projectNativeSpecialKits({}, { ...options, newGameIds: ['npc', 'npc'] })).toThrow('Duplicate');
  expect(() => projectNativeSpecialKits({ npc: { ...description, base_id: 'other' } }, options)).toThrow('Source game ID differs');
});

it('rejects raw, display identity and numeric slot drift rather than guessing', () => {
  expect(() => projectNativeSpecialKits({ npc: description }, { ...options, displayMetadata: [{ ...display, raw: 'Different text' }] })).toThrow('display metadata');
  expect(() => projectNativeSpecialKits({ npc: description }, { ...options, abilityBindings: [{ ...binding, hudId: 'other' }] })).toThrow('Binding display identity differs');
  const invalid = structuredClone(binding); invalid.sources['2'].gameBinding!.slot = 3;
  expect(() => projectNativeSpecialKits({ npc: description }, { ...options, abilityBindings: [invalid] })).toThrow('Numeric binding differs');
});

it('rejects non-JSON binding values and prototype objects', () => {
  const invalid = structuredClone(binding); Object.setPrototypeOf(invalid.sources['2'], { custom: true });
  expect(() => projectNativeSpecialKits({ npc: description }, { ...options, abilityBindings: [invalid] })).toThrow('plain JSON');
});

it('keeps missing combat stats unavailable while resolving independent native parameters', () => {
  const result = projectNativeSpecialKits({ npc: description }, options);
  const prepared = prepareChampionAbilityText({ template: result.champions[0].abilityTexts[1].template, curves: [], sigLevel: 200 });
  if (prepared.status !== 'ready') throw new Error(prepared.error.message);
  const values = prepared.blocks.flatMap(block => block.children).filter(node => node.type === 'value');
  expect(values[0].resolution).toMatchObject({ status: 'error', error: { code: 'UNRESOLVED_PLACEHOLDER' } });
  expect(values[1].resolution).toMatchObject({ status: 'resolved', value: 3 });
});

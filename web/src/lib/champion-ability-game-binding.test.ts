import { describe, expect, it } from 'vitest';
import { buildDescriptionTemplate } from '@cerebro/core/services/mcocGameDescriptionsImportService';
import { prepareChampionAbilityText, prepareChampionAbilityTextView } from './champion-ability-text';
import fixtures from '@cerebro/core/domain/champion-ability-text/fixtures/game-display-bindings.json';
import type { GameDescriptionValueSource } from '@cerebro/core/services/mcocGameDescriptionsImportService';

function render(raw: string, sources: Record<string, any>) {
  const template = buildDescriptionTemplate(raw, { placeholder_sources: sources });
  const prepared = prepareChampionAbilityText({ template, stat: { attack: 10_000, health: 100_000, challengeRating: 250, sigAbilityIds: [] } });
  if (prepared.status !== 'ready') throw Error(prepared.error.message);
  return prepared.blocks.flatMap(b => b.children).filter(n => n.type === 'value').map(n => n.resolution.status === 'resolved' ? n.resolution.displayValue : 'error');
}

const source = (slot: 0 | 1 | 2 | 3, value: number, formula?: any) => ({
  kind: 'abilityParam' as const, componentId: 'any_component', paramName: ['chance', 'modifier', 'duration', 'maxStacks'][slot],
  rawValue: value, field: ['base_val', 'chance', 'duration', 'f24'][slot],
  baseVal: 1, chance: .02, duration: .65, f24: 6,
  gameBinding: { version: 1 as const, slot, value, ...(formula ? { formula } : {}) },
  display: { multiplier: slot === 0 ? 100 : 1, precision: 2 },
});

describe('game formatter contract through import and Full Abilities rendering', () => {
  it.each(fixtures.cases)('renders raw game fields for $componentId without an ID override', fixture => {
    // Renaming every component proves these examples do not rely on an ID map.
    const sources = Object.fromEntries(Object.entries(fixture.sources).map(([key, value]) =>
      [key, { ...value, componentId: 'renamed_component' }])) as Record<string, GameDescriptionValueSource>;
    const template = buildDescriptionTemplate(fixture.raw, { placeholder_sources: sources });
    const prepared = prepareChampionAbilityText({ template, stat: { attack: 10_000, health: 100_000, challengeRating: 250, sigAbilityIds: [] } });
    if (prepared.status !== 'ready') throw Error(prepared.error.message);
    const values: number[] = [];
    function visit(nodes: any[]) {
      for (const node of nodes) {
        if (node.type === 'color') visit(node.children);
        if (node.type === 'value') {
          expect(node.resolution.status).toBe('resolved');
          values.push(node.resolution.value);
        }
      }
    }
    prepared.blocks.forEach(b => visit(b.children));
    expect(values).toHaveLength(fixture.expected.length);
    values.forEach((value, i) => expect(value).toBeCloseTo(fixture.expected[i], 2));
  });
  it('keeps a one-Buff modifier and duration independent of misleading nearby percentages', () => {
    expect(render('Gain {1} Buff every {2} seconds. Other effects are 50% stronger.', {
      '1': source(1, 1, { id: '', type: 'identity', a: 1, b: 0, c: 0 }), '2': source(2, .65),
    })).toEqual(['1', '0.65']);
  });
  it('uses display formula for Power rate and Stackable for the cap, independent of English', () => {
    expect(render('{1}% of a Bar of Power up to {3} Buffs.', {
      '1': source(1, .02, { id: 'var_x_a', type: 'mod_x_vara', a: 100, b: 0, c: 0 }), '3': source(3, 6),
    })).toEqual(['2', '6']);
  });
  it('keeps Chance and Modifier percentages distinct in the same sentence', () => {
    expect(render('{0}% chance to gain {1}% Power.', {
      '0': source(0, .3), '1': source(1, .01, { id: 'var_x_a', type: 'mod_x_vara', a: 100, b: 0, c: 0 }),
    })).toEqual(['30', '1']);
  });
  it('uses the same exact named growth and display formula for signature text and chart', () => {
    const binding = source(1, .1, { id: 'attack', type: 'mod_x_attk', a: 1, b: 0, c: 0 });
    const gameBinding = { ...binding.gameBinding, growth: { coefficient: 0, curve: { id: 'growth', a: .001, b: 0, c: 0, exponent: 1 } } };
    const view = prepareChampionAbilityTextView({
      records: [{ id: 1, group: 'signature', title: null, sourceId: 'signature', sortOrder: 0,
        template: buildDescriptionTemplate('Gain {1} Attack.', { placeholder_sources: { '1': { ...binding, gameBinding } } }) }],
      curves: [{ id: 1, curveId: 'curve', kind: 'signature', formula: 'old', minSig: 1, maxSig: 200,
        params: { sourceCurveId: 'growth', source: { componentId: 'any_component' }, f2: 999 } }],
      sigLevel: 100, stat: { attack: 10000, challengeRating: 250, sigAbilityIds: [] },
    });
    const prepared = view.signaturePanel.records[0].prepared;
    if (prepared.status !== 'ready') throw Error(prepared.error.message);
    const node = prepared.blocks[0].children.find(n => n.type === 'value')!;
    if (node.type !== 'value' || node.resolution.status !== 'resolved') throw Error('Expected resolved value');
    expect(node.resolution.value).toBeCloseTo(2000);
    expect(node.resolution.curve?.id).toBe(1);
    expect(view.curveView.data.find(p => p.sig === 100)?.curve0).toBeCloseTo(2000);
    expect(view.curveView.data.at(-1)?.curve0).toBeCloseTo(3000);
  });
});

import { expect, it } from 'vitest';
import { validateResistancePlanRow, type ResistancePlanRow } from './champion-resistance-plan';
import { resistanceEvidenceHash } from './champion-resistance-classification';

const template = { blocks: [{ children: [{ type: 'value', source: { gameBinding: {
  version: 1, slot: 1, value: -1.5, formula: { id: 'x100', type: 'mod_x_vara', a: 100, b: 0, c: 0 },
} } }] }] };
const link = { id: 1, championId: 2, type: 'ABILITY', effectDirection: 'GAIN', name: 'Damage Reduction', source: 'Incoming Bleed potency is reduced by 150%.', sourceHash: 'source', reviewHash: 'review' };
const effect = { id: 3, name: 'Bleed' };
const text = { id: 4, championId: 2, template };
const row: ResistancePlanRow = { championId: 2, championName: 'Example', championAbilityLinkId: 1, effectId: 3, effect: 'Bleed', mechanism: 'POTENCY', percent: 150,
  sourceHash: 'source', evidence: { version: 1, source: link.source, overviewReviewHash: 'review', records: [{ recordId: 4, templateHash: resistanceEvidenceHash(template) }] } };

it('allows additive metadata only with current source, review, catalog target and same-champion numeric evidence', () => {
  expect(() => validateResistancePlanRow(row, link, effect, [text])).not.toThrow();
  expect(() => validateResistancePlanRow(row, { ...link, sourceHash: 'changed' }, effect, [text])).toThrow();
  expect(() => validateResistancePlanRow(row, { ...link, reviewHash: 'changed' }, effect, [text])).toThrow();
  expect(() => validateResistancePlanRow(row, link, { ...effect, name: 'Shock' }, [text])).toThrow();
  expect(() => validateResistancePlanRow(row, link, effect, [{ ...text, championId: 99 }])).toThrow();
  expect(() => validateResistancePlanRow(row, link, effect, [{ ...text, template: { raw: 'changed' } }])).toThrow();
  expect(() => validateResistancePlanRow({ ...row, percent: 100 }, link, effect, [text])).toThrow();
  expect(() => validateResistancePlanRow({ ...row, mechanism: 'DURATION' }, link, effect, [text])).toThrow();
});

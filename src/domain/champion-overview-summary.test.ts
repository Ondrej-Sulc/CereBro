import { describe, expect, it } from 'vitest';
import { artifactHash } from './champion-effect-enrichment';
import { overviewSourceHash, validateOverviewSummaries, getCurrentOverviewSummary } from './champion-overview-summary';

const source = { id: 10, championId: 1, abilityId: 2, name: 'Fury', type: 'ABILITY' as const, source: 'Heavy Attacks grant Fury.',
  effectForm: 'BUFF' as const, effectDirection: 'GAIN' as const, synergyChampionIds: [] };
const documents = [{ id: 'text:1', text: 'Heavy Attacks grant Fury for 10 seconds.' }];
const snapshot = { sources: [source], documents };
function draft(summary = 'Heavy Attacks grant Fury.') {
  return { schemaVersion: 1, author: 'author', snapshotHash: artifactHash(snapshot), entries: [{ championId: 1, linkId: 10,
    sourceHash: overviewSourceHash(source), summary, evidence: [{ documentId: 'text:1', quote: documents[0].text }], retainedValues: [] }] };
}
describe('champion overview summaries', () => {
  it('requires complete source coverage and an independent review bound to the exact draft', () => {
    const proposal = draft();
    const review = { schemaVersion: 1, reviewer: 'reviewer', snapshotHash: artifactHash(snapshot), draftHash: artifactHash(proposal), decision: 'approve', findings: [] };
    expect(validateOverviewSummaries(snapshot, proposal, review).entries).toHaveLength(1);
    expect(() => validateOverviewSummaries(snapshot, { ...proposal, entries: [] })).toThrow(/coverage/i);
    expect(() => validateOverviewSummaries(snapshot, { ...proposal, entries: [...proposal.entries, ...proposal.entries] })).toThrow(/duplicate/i);
    expect(() => validateOverviewSummaries(snapshot, proposal, { ...review, reviewer: 'author' })).toThrow(/independent/i);
    expect(() => validateOverviewSummaries(snapshot, draft('Heavy Attacks grant a Fury Buff.'), review)).toThrow(/draft/i);
  });
  it('rejects placeholders, audit prose and retained numbers lacking explicit evidence', () => {
    for (const text of ['Gain {1}% Fury.', 'Gain Fury (text:123).', 'Gain Fury; value unresolved.', 'Gain Fury for 10 seconds.']) {
      expect(() => validateOverviewSummaries(snapshot, draft(text))).toThrow();
    }
    const proposal = draft('Heavy Attacks grant Fury for 10 seconds.');
    const value = { text: '10', reason: 'Fixed duration in the imported description.', evidence: [{ documentId: 'text:1', quote: documents[0].text }] };
    const entry = { ...proposal.entries[0], retainedValues: [value] };
    expect(validateOverviewSummaries(snapshot, { ...proposal, entries: [entry] }).entries).toHaveLength(1);
    expect(() => validateOverviewSummaries(snapshot, { ...proposal, entries: [{ ...entry, retainedValues: [{ ...value, text: '11' }] }] })).toThrow();
  });
  it('invalidates a summary when source mechanics or teammate requirements change', () => {
    const saved = { text: 'Heavy Attacks grant Fury.', sourceHash: overviewSourceHash(source) };
    expect(getCurrentOverviewSummary(source, saved)).toBe(saved.text);
    expect(getCurrentOverviewSummary({ ...source, source: 'Special 1 grants Fury.' }, saved)).toBeNull();
    expect(getCurrentOverviewSummary({ ...source, synergyChampionIds: [99] }, saved)).toBeNull();
    expect(getCurrentOverviewSummary({ ...source, effectDirection: 'INFLICT' }, saved)).toBeNull();
    // The displayed champion may be cached, so the live DB source must also still match.
    expect(getCurrentOverviewSummary(source, saved, { ...source, source: 'Special 1 grants Fury.' })).toBeNull();
    expect(getCurrentOverviewSummary(source, saved, { ...source, synergyChampionIds: [99] })).toBeNull();
  });
});

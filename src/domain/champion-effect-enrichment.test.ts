import { describe, expect, it } from 'vitest';
import {
  artifactHash, assertLocalDatabase, buildEnrichmentSynergyRequirement, hashChampionInput, validateEnrichment,
  unchangedCreatedAbilityIds, unresolvedRestoreChampionIds, databaseConnectionIdentity, matchesBackupDatabaseIdentity,
  type CatalogAbility, type ChampionEnrichmentInput, type EffectCandidate, type EnrichmentDraft, type EnrichmentReview,
  type EnrichmentRemovalPolicy,
} from './champion-effect-enrichment';

const catalog: CatalogAbility[] = [{ id: 1, name: 'Fury', description: null, gameGlossaryTermId: null }];
function input(): ChampionEnrichmentInput {
  const content = { schemaVersion: 1 as const, id: 10, name: 'Example', slug: 'example', gameId: 'EXAMPLE',
    documents: [{ id: 'text:1', kind: 'abilityText' as const, title: 'Special 1', origin: 'import',
      text: 'Gain a Fury Buff for 10 seconds. Inflict a Fury Passive on the Opponent.' },
    { id: 'synergy:1:OWNER', kind: 'synergy' as const, title: 'Friends', origin: 'import', text: 'Example: Gain a Fury Buff on Special 2.',
      synergy: { key: '1:OWNER', sourceHash: 'abc', championRole: 'OWNER' as const, championRarities: [6, 7],
        partners: [{ id: 20, name: 'Partner', rarities: [5, 6, 7] }], targetTags: [], unique: true } }],
    existingLinks: [{ id: 100, abilityId: 1, name: 'Fury', type: 'ABILITY' as const, source: 'SP1',
      effectForm: 'UNKNOWN' as const, effectDirection: 'UNKNOWN' as const, synergyChampionIds: [] }] };
  return { ...content, inputHash: hashChampionInput(content) };
}
const citation = { documentId: 'text:1', quote: 'Gain a Fury Buff for 10 seconds.' };
function draft(): EnrichmentDraft {
  const champion = input();
  return { schemaVersion: 1, championId: champion.id, inputHash: champion.inputHash, author: 'draft-agent',
    dispositions: [{ linkId: 100, action: 'update', reason: 'Explicit gain of Fury Buff.', evidence: [citation],
      source: 'SP1 → 10s', effectForm: 'BUFF', effectDirection: 'GAIN' }], additions: [] };
}
function review(proposal: EnrichmentDraft): EnrichmentReview {
  return { schemaVersion: 1, championId: 10, inputHash: proposal.inputHash, draftHash: artifactHash(proposal),
    reviewer: 'review-agent', decision: 'approve', findings: ['Read full descriptions and checked source classification.'] };
}
function candidate(): EffectCandidate {
  return { name: 'Fury', abilityId: 1, type: 'ABILITY', source: 'SP2', effectForm: 'PASSIVE', effectDirection: 'INFLICT',
    synergyChampionIds: [], reason: 'A separate opponent application.', evidence: [{ documentId: 'text:1', quote: 'Inflict a Fury Passive on the Opponent.' }] };
}

describe('champion effect enrichment integrity', () => {
  it('hashes objects independent of object key insertion order while preserving array order', () => {
    expect(artifactHash({ b: 2, a: { d: 4, c: 3 } })).toBe(artifactHash({ a: { c: 3, d: 4 }, b: 2 }));
    expect(artifactHash([1, 2])).not.toBe(artifactHash([2, 1]));
  });
  it('accepts evidenced metadata changes with independent approval', () => {
    const proposal = draft();
    const validated = validateEnrichment(input(), catalog, proposal, review(proposal));
    expect(validated.effects[0]).toMatchObject({ id: 100, source: 'SP1 → 10s', effectForm: 'BUFF', effectDirection: 'GAIN' });
  });
  it('rejects changed immutable input and stale draft hashes', () => {
    const changed = input(); changed.documents[0].text = 'Changed mechanics';
    expect(() => validateEnrichment(changed, catalog, draft())).toThrow('input hash');
    const proposal = draft(), approval = review(proposal); proposal.additions.push(candidate());
    expect(() => validateEnrichment(input(), catalog, proposal, approval)).toThrow('Review does not match');
  });
  it('requires an independent reviewer identity', () => {
    const proposal = draft(), approval = review(proposal); approval.reviewer = proposal.author;
    expect(() => validateEnrichment(input(), catalog, proposal, approval)).toThrow('independent');
  });
  it('retains rejected reviews as valid artifacts without treating them as approvals', () => {
    const proposal = draft(), rejection = review(proposal); rejection.decision = 'reject';
    expect(validateEnrichment(input(), catalog, proposal, rejection).review?.decision).toBe('reject');
  });
  it('requires exactly one disposition for every existing source', () => {
    const missing = draft(); missing.dispositions = [];
    expect(() => validateEnrichment(input(), catalog, missing)).toThrow('Every existing');
    const duplicate = draft(); duplicate.dispositions.push(duplicate.dispositions[0]);
    expect(() => validateEnrichment(input(), catalog, duplicate)).toThrow('duplicate');
  });
  it('preserves unresolved legacy links without invented evidence', () => {
    const proposal = draft(); proposal.dispositions = [{ linkId: 100, action: 'preserve',
      reason: 'Current documents do not establish the legacy source.', evidence: [] }];
    expect(validateEnrichment(input(), catalog, proposal).effects).toEqual(input().existingLinks);
  });
  it('rejects unsupported quotes and missing documents', () => {
    const proposal = draft(); proposal.dispositions[0].evidence = [{ documentId: 'text:1', quote: 'Invented a Fury Buff for 10 seconds.' }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('Invalid evidence');
    proposal.dispositions[0].evidence = [{ ...citation, documentId: 'nonexistent' }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('Invalid evidence');
  });
  it('keeps Buff and Passive applications separate and rejects duplicate identities', () => {
    const proposal = draft(); proposal.additions.push({ ...candidate(), source: 'SP1 → 10s' });
    expect(validateEnrichment(input(), catalog, proposal).effects).toHaveLength(2);
    proposal.additions[0].effectForm = 'BUFF'; proposal.additions[0].effectDirection = 'GAIN';
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('Duplicate effect source');
  });
  it('supports reviewed nonempty splits and forbids deletion-only replacements', () => {
    const proposal = draft(); proposal.dispositions = [{ linkId: 100, action: 'replace', reason: 'Split applications by form and recipient.',
      evidence: [citation], replacements: [candidate(), { ...candidate(), effectForm: 'BUFF', effectDirection: 'GAIN' }] }];
    expect(validateEnrichment(input(), catalog, proposal).effects).toHaveLength(2);
    if (proposal.dispositions[0].action === 'replace') proposal.dispositions[0].replacements = [];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow();
  });
  it('requires exact source authorization and positive separate policy evidence for removals', () => {
    const champion = input(), policy: EnrichmentRemovalPolicy = { schemaVersion: 1, scope: 'User-authorized positive-evidence correction',
      targets: [{ championId: 10, linkId: 100, abilityId: 1, type: 'ABILITY', source: 'SP1' }],
      documents: [{ id: 'policy:1', text: 'The old source does not provide this effect.', origin: 'https://example.com/primary' }] };
    const proposal = draft(); proposal.dispositions = [{ linkId: 100, action: 'remove', policyHash: artifactHash(policy),
      reason: 'Explicit primary rule contradicts this exact source.', evidence: [{ documentId: 'policy:1', quote: policy.documents[0].text }] }];
    expect(() => validateEnrichment(champion, catalog, proposal, review(proposal))).toThrow('removal policy');
    expect(validateEnrichment(champion, catalog, proposal, review(proposal), policy).effects).toEqual([]);
    expect(() => validateEnrichment(champion, catalog, proposal, review(proposal), { ...policy, scope: 'A changed policy authority' })).toThrow('policy hash');
    for (const target of [{ ...policy.targets[0], championId: 11 }, { ...policy.targets[0], source: null }, { ...policy.targets[0], abilityId: 2 }]) {
      const changed = { ...policy, targets: [target] }; const altered = structuredClone(proposal);
      if (altered.dispositions[0].action === 'remove') altered.dispositions[0].policyHash = artifactHash(changed);
      expect(() => validateEnrichment(champion, catalog, altered, review(altered), changed)).toThrow('exact authorized source');
    }
    const withoutPolicyEvidence = structuredClone(proposal); withoutPolicyEvidence.dispositions[0].evidence = [citation];
    expect(() => validateEnrichment(champion, catalog, withoutPolicyEvidence, review(withoutPolicyEvidence), policy)).toThrow('positive policy evidence');
    const invented = structuredClone(proposal); invented.dispositions[0].evidence[0].quote = 'Invented policy claim that is not in the authority.';
    expect(() => validateEnrichment(champion, catalog, invented, review(invented), policy)).toThrow('Invalid removal evidence');
  });
  it('uses canonical catalog names and validates ID/name agreement', () => {
    const proposal = draft(); proposal.additions = [{ ...candidate(), name: 'fury' }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('canonical catalog');
    proposal.additions = [{ ...candidate(), abilityId: 999 }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('ID/name mismatch');
  });
  it('allows new explicitly reviewed catalog candidates without invented catalog IDs', () => {
    const proposal = draft(); const addition = candidate(); delete addition.abilityId; addition.name = 'New Effect'; proposal.additions = [addition];
    expect(validateEnrichment(input(), catalog, proposal).effects).toHaveLength(2);
  });
  it('does not treat immunity itself as gaining an effect', () => {
    const proposal = draft(); proposal.additions = [{ ...candidate(), type: 'IMMUNITY', effectDirection: 'GAIN' }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('Immunity direction');
    proposal.additions[0].effectDirection = 'UNKNOWN';
    expect(validateEnrichment(input(), catalog, proposal).effects).toHaveLength(2);
  });
  it('requires complete canonical teammate, rarity and stacking conditions for synergy changes', () => {
    const champion = input(), document = champion.documents[1], proposal = draft();
    const source = buildEnrichmentSynergyRequirement(document, [20]);
    expect(source).toBe('Synergy: Friends (6★/7★) with Partner (5★/6★/7★); does not stack');
    const addition = { ...candidate(), source: `${source} — SP2`, synergyChampionIds: [20],
      evidence: [{ documentId: document.id, quote: document.text }] };
    proposal.additions = [addition];
    expect(validateEnrichment(champion, catalog, proposal).effects).toHaveLength(2);
    addition.source = 'Synergy: Friends with Partner — SP2';
    expect(() => validateEnrichment(champion, catalog, proposal)).toThrow('applicable context');
  });
  it('rejects unsupported teammates and synergy effects recast as innate sources', () => {
    const proposal = draft(), doc = input().documents[1];
    proposal.additions = [{ ...candidate(), source: 'Synergy: Friends', synergyChampionIds: [999], evidence: [{ documentId: doc.id, quote: doc.text }] }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('applicable context');
    proposal.additions[0].synergyChampionIds = [];
    proposal.additions[0].source = 'SP2';
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('cannot create an innate');
  });
  it('rejects synergy-labeled sources without teammates even when innate evidence is mixed in', () => {
    const proposal = draft(), doc = input().documents[1];
    proposal.additions = [{ ...candidate(), source: 'Synergy: Friends — SP2', synergyChampionIds: [],
      evidence: [{ documentId: doc.id, quote: doc.text }, citation] }];
    expect(() => validateEnrichment(input(), catalog, proposal)).toThrow('requires explicit teammate');
  });
  it('finds unused run-created abilities across separate restore selections', () => {
    const snapshot = { id: 99, name: 'New Effect', description: '', emoji: null, iconUrl: null,
      gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] };
    const receipts = [{ championId: 10, createdAbilityIds: [99], createdAbilitySnapshots: [{ id: 99, snapshot, snapshotHash: artifactHash(snapshot) }] },
      { championId: 20, createdAbilityIds: [] }];
    // After restoring A, B still uses the shared catalog effect.
    expect(unchangedCreatedAbilityIds(receipts, [{ id: 99, snapshot, inUse: true }])).toEqual([]);
    // Restoring B separately still consults A's provenance.
    expect(unchangedCreatedAbilityIds(receipts, [{ id: 99, snapshot, inUse: false }])).toEqual([99]);
  });
  it('retains edited catalog entries and entries from legacy receipts lacking snapshots', () => {
    const snapshot = { id: 99, name: 'New Effect', description: '', iconUrl: null, categories: [], gameGlossaryTerm: null };
    const receipt = { createdAbilityIds: [99], createdAbilitySnapshots: [{ id: 99, snapshot, snapshotHash: artifactHash(snapshot) }] };
    for (const edited of [{ ...snapshot, description: 'Manually improved.' }, { ...snapshot, iconUrl: '/new.png' },
      { ...snapshot, categories: [{ id: 1, name: 'Category', description: '' }] }, { ...snapshot, gameGlossaryTerm: { id: 'g', name: 'Glossary' } }]) {
      expect(unchangedCreatedAbilityIds([receipt], [{ id: 99, snapshot: edited, inUse: false }])).toEqual([]);
    }
    expect(unchangedCreatedAbilityIds([{ createdAbilityIds: [99] }], [{ id: 99, snapshot, inUse: false }])).toEqual([]);
    expect(unchangedCreatedAbilityIds([{ ...receipt, createdAbilitySnapshots: [{ ...receipt.createdAbilitySnapshots[0], snapshotHash: 'bad' }] }],
      [{ id: 99, snapshot, inUse: false }])).toEqual([]);
  });
  it('detects missing receipts from committed attempts before starting a selected restore', () => {
    expect(unresolvedRestoreChampionIds([10, 20], [10, 20], [10])).toEqual([20]);
    expect(unresolvedRestoreChampionIds([10], [10, 20], [10])).toEqual([20]);
    expect(unresolvedRestoreChampionIds([10, 20], [10, 20], [10], new Set([10]))).toEqual([]);
    expect(unresolvedRestoreChampionIds([10, 20], [10, 20], [10], new Set([20]))).toEqual([20]);
  });
  it('binds backup identity to schema and only permits legacy manifests for public', () => {
    const databaseUrl = 'postgresql://user:pass@localhost:5432/cerebro';
    const current = { databaseIdentity: databaseConnectionIdentity(databaseUrl), identityVersion: 2 };
    expect(matchesBackupDatabaseIdentity(`${databaseUrl}?schema=public`, current)).toBe(true);
    expect(matchesBackupDatabaseIdentity(`${databaseUrl}?schema=other`, current)).toBe(false);
    const legacy = { databaseIdentity: databaseConnectionIdentity(databaseUrl, 1) };
    expect(matchesBackupDatabaseIdentity(databaseUrl, legacy)).toBe(true);
    expect(matchesBackupDatabaseIdentity(`${databaseUrl}?schema=public`, legacy)).toBe(true);
    expect(matchesBackupDatabaseIdentity(`${databaseUrl}?schema=other`, legacy)).toBe(false);
    expect(() => databaseConnectionIdentity(`${databaseUrl}?schema=public&schema=other`)).toThrow('Ambiguous');
  });
  it('restricts writes to local databases and rejects deceptive hostnames', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(() => assertLocalDatabase(`postgresql://user:pass@${host}:5432/cerebro`)).not.toThrow();
    for (const host of ['remote.example', 'localhost.example', '127.0.0.1.example']) expect(() => assertLocalDatabase(`postgresql://user:pass@${host}/cerebro`)).toThrow('local database');
    expect(() => assertLocalDatabase(undefined)).toThrow('required');
  });
});

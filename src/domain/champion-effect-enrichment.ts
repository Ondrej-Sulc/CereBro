import { createHash } from 'node:crypto';
import { z } from 'zod';
import { EFFECT_DIRECTIONS, EFFECT_FORMS } from './ability-source';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
export const artifactHash = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');
export type CreatedAbilitySnapshot = { id: number; snapshot: unknown; snapshotHash: string };
/** Legacy receipts without snapshots never authorize catalog deletion. */
export function unchangedCreatedAbilityIds(
  receipts: Array<{ createdAbilityIds?: number[]; createdAbilitySnapshots?: CreatedAbilitySnapshot[] }>,
  current: Array<{ id: number; snapshot: unknown; inUse: boolean }>,
): number[] {
  return current.filter(ability => {
    if (ability.inUse) return false;
    const provenance = receipts.flatMap(receipt => receipt.createdAbilitySnapshots ?? []).filter(item => item.id === ability.id);
    return provenance.length > 0 && provenance.every(item => item.snapshotHash === artifactHash(item.snapshot) &&
      item.snapshotHash === artifactHash(ability.snapshot));
  }).map(ability => ability.id);
}
/** Pending work must be recovered before restore mutates any selected champion. */
export function unresolvedRestoreChampionIds(intentIds: number[], attemptIds: number[], receiptIds: number[], selected?: Set<number>): number[] {
  const complete = new Set(receiptIds);
  return [...new Set([...intentIds, ...attemptIds])].filter(id => (!selected || selected.has(id)) && !complete.has(id)).sort((a, b) => a - b);
}
export function databaseConnectionIdentity(databaseUrl: string, version: 1 | 2 = 2): string {
  const url = new URL(databaseUrl);
  if (url.searchParams.getAll('schema').length > 1) throw new Error('Ambiguous database schema parameters.');
  return artifactHash({ hostname: url.hostname, port: url.port || '5432', database: url.pathname,
    ...(version === 2 ? { schema: url.searchParams.get('schema') || 'public' } : {}) });
}
export function matchesBackupDatabaseIdentity(databaseUrl: string, manifest: { databaseIdentity: string; identityVersion?: number }): boolean {
  if (manifest.identityVersion === 2) return manifest.databaseIdentity === databaseConnectionIdentity(databaseUrl);
  // Old manifests were written for the default schema and cannot authorize restoring another schema.
  const url = new URL(databaseUrl);
  return manifest.identityVersion === undefined && (url.searchParams.get('schema') || 'public') === 'public' &&
    manifest.databaseIdentity === databaseConnectionIdentity(databaseUrl, 1);
}
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const idSchema = z.number().int().positive();
const metadata = { effectForm: z.enum(EFFECT_FORMS), effectDirection: z.enum(EFFECT_DIRECTIONS) };
const evidenceSchema = z.object({ documentId: z.string().min(1), quote: z.string().trim().min(12).max(10000) }).strict();
const reasonSchema = z.string().trim().min(5).max(10000);
const candidateFields = {
  name: z.string().trim().min(1).max(120), abilityId: idSchema.optional(), type: z.enum(['ABILITY', 'IMMUNITY']),
  source: z.string().trim().max(2000).nullable(), ...metadata,
  synergyChampionIds: z.array(idSchema).max(100), reason: reasonSchema, evidence: z.array(evidenceSchema).min(1),
};
export const effectCandidateSchema = z.object(candidateFields).strict();
export type EffectCandidate = z.infer<typeof effectCandidateSchema>;
export type CatalogAbility = { id: number; name: string; description: string | null; gameGlossaryTermId: string | null };
export type ExistingEffectLink = Omit<EffectCandidate, 'reason' | 'evidence' | 'abilityId'> & { id: number; abilityId: number };
export type EnrichmentDocument = {
  id: string; kind: 'abilityText' | 'legacyAbility' | 'synergy'; title: string | null; text: string; origin: string;
  synergy?: { key: string; sourceHash: string; championRole: 'OWNER' | 'REQUIRED'; championRarities: number[];
    partners: Array<{ id: number; name: string; rarities: number[] }>; targetTags: string[]; unique: boolean };
};
export type ChampionEnrichmentInput = { schemaVersion: 1; id: number; name: string; slug: string | null; gameId: string | null;
  documents: EnrichmentDocument[]; existingLinks: ExistingEffectLink[]; inputHash: string };
export type EnrichmentSnapshot = { schemaVersion: 1; createdAt: string; catalogHash: string;
  abilities: CatalogAbility[]; champions: ChampionEnrichmentInput[] };
const commonDisposition = { linkId: idSchema, reason: reasonSchema };
export const enrichmentDraftSchema = z.object({
  schemaVersion: z.literal(1), championId: idSchema, inputHash: hashSchema, author: z.string().trim().min(1),
  dispositions: z.array(z.discriminatedUnion('action', [
    z.object({ ...commonDisposition, action: z.literal('preserve'), evidence: z.array(evidenceSchema) }).strict(),
    z.object({ ...commonDisposition, action: z.literal('update'), evidence: z.array(evidenceSchema).min(1),
      source: candidateFields.source, ...metadata }).strict(),
    z.object({ ...commonDisposition, action: z.literal('replace'), evidence: z.array(evidenceSchema).min(1),
      replacements: z.array(effectCandidateSchema).min(1).max(100) }).strict(),
    z.object({ ...commonDisposition, action: z.literal('remove'), policyHash: hashSchema,
      evidence: z.array(evidenceSchema).min(1) }).strict(),
  ])),
  additions: z.array(effectCandidateSchema).max(1000),
}).strict();
export const enrichmentReviewSchema = z.object({ schemaVersion: z.literal(1), championId: idSchema,
  inputHash: hashSchema, draftHash: hashSchema, reviewer: z.string().trim().min(1),
  decision: z.enum(['approve', 'reject']), findings: z.array(z.string().trim().min(1)) }).strict();
export type EnrichmentDraft = z.infer<typeof enrichmentDraftSchema>;
export type EnrichmentReview = z.infer<typeof enrichmentReviewSchema>;
export const enrichmentRemovalPolicySchema = z.object({ schemaVersion: z.literal(1), scope: z.string().min(12),
  targets: z.array(z.object({ championId: idSchema, linkId: idSchema, abilityId: idSchema,
    type: z.enum(['ABILITY', 'IMMUNITY']), source: candidateFields.source }).strict()).min(1),
  documents: z.array(z.object({ id: z.string().min(1), text: z.string().min(12), origin: z.string().url() }).strict()).min(1),
}).strict();
export type EnrichmentRemovalPolicy = z.infer<typeof enrichmentRemovalPolicySchema>;
export const hashChampionInput = (input: Omit<ChampionEnrichmentInput, 'inputHash'> | ChampionEnrichmentInput): string => {
  const { inputHash: _, ...content } = input as ChampionEnrichmentInput;
  return artifactHash(content);
};

/** Keep the same explicit teammate/rarity requirements used by the interactive editor. */
export function buildEnrichmentSynergyRequirement(document: EnrichmentDocument, championIds: number[]): string {
  const synergy = document.synergy;
  if (document.kind !== 'synergy' || !synergy || !championIds.length) throw new Error('Applicable synergy context is required.');
  const stars = (rarities: number[]) => rarities.map(r => `${r}★`).join('/');
  const partners = [...championIds].sort((a, b) => a - b).map(id => {
    const partner = synergy.partners.find(p => p.id === id);
    if (!partner) throw new Error('Unsupported synergy teammate.');
    return `${partner.name} (${stars(partner.rarities)})`;
  });
  return `Synergy: ${document.title} (${stars(synergy.championRarities)}) with ${partners.join(' OR ')}${synergy.unique ? '; does not stack' : ''}`;
}

const identity = (item: Pick<EffectCandidate, 'name' | 'type' | 'source' | 'effectForm' | 'effectDirection'>) =>
  canonicalJson([item.name.toLocaleLowerCase('en-US'), item.type, item.source?.trim() || null, item.effectForm, item.effectDirection]);
export function validateEnrichment(
  input: ChampionEnrichmentInput, catalog: CatalogAbility[], rawDraft: unknown, rawReview?: unknown, rawRemovalPolicy?: unknown,
): { draft: EnrichmentDraft; review?: EnrichmentReview; effects: Array<ExistingEffectLink | EffectCandidate> } {
  if (hashChampionInput(input) !== input.inputHash) throw new Error('Champion input hash mismatch.');
  const draft = enrichmentDraftSchema.parse(rawDraft);
  if (draft.championId !== input.id || draft.inputHash !== input.inputHash) throw new Error('Draft does not match champion input.');
  const existingIds = new Set(input.existingLinks.map(link => link.id));
  const seen = new Set<number>();
  const documents = new Map(input.documents.map(document => [document.id, document]));
  function checkEvidence(evidence: Array<z.infer<typeof evidenceSchema>>) {
    for (const citation of evidence) {
      const doc = documents.get(citation.documentId);
      if (!doc || !doc.text.includes(citation.quote)) throw new Error(`Invalid evidence quote in ${citation.documentId}.`);
    }
  }
  function checkCandidate(item: EffectCandidate | ExistingEffectLink, evidence?: Array<z.infer<typeof evidenceSchema>>) {
    const known = catalog.find(ability => ability.name.toLocaleLowerCase('en-US') === item.name.toLocaleLowerCase('en-US'));
    if (known && known.name !== item.name) throw new Error(`Use canonical catalog name ${known.name}.`);
    if (item.abilityId !== undefined && (!known || known.id !== item.abilityId)) throw new Error(`Ability ID/name mismatch for ${item.name}.`);
    if (item.type === 'IMMUNITY' && item.effectDirection !== 'UNKNOWN') throw new Error('Immunity direction must be UNKNOWN.');
    if (new Set(item.synergyChampionIds).size !== item.synergyChampionIds.length || item.synergyChampionIds.includes(input.id)) throw new Error('Invalid synergy teammate IDs.');
    if (!item.synergyChampionIds.length && /\bsynerg(?:y|ies)\b/i.test(item.source ?? '')) throw new Error('Synergy source requires explicit teammate IDs.');
    if (evidence) {
      checkEvidence(evidence);
      const synergyDocs = evidence.map(c => documents.get(c.documentId)!).filter(doc => doc.kind === 'synergy');
      if (item.synergyChampionIds.length) {
        const context = synergyDocs.find(doc => item.synergyChampionIds.every(id => doc.synergy?.partners.some(partner => partner.id === id)) &&
          item.source?.startsWith(buildEnrichmentSynergyRequirement(doc, item.synergyChampionIds)));
        if (!context) {
          throw new Error(`Synergy teammates lack applicable context for ${item.name}.`);
        }
      } else if (synergyDocs.length && !evidence.some(c => documents.get(c.documentId)!.kind !== 'synergy')) {
        throw new Error(`Synergy-only evidence cannot create an innate source for ${item.name}.`);
      }
    }
  }
  const effects: Array<ExistingEffectLink | EffectCandidate> = [];
  for (const disposition of draft.dispositions) {
    if (!existingIds.has(disposition.linkId) || seen.has(disposition.linkId)) throw new Error('Unknown or duplicate existing-link disposition.');
    seen.add(disposition.linkId);
    const original = input.existingLinks.find(link => link.id === disposition.linkId)!;
    if (disposition.action !== 'remove') checkEvidence(disposition.evidence);
    if (disposition.action === 'preserve') effects.push(original);
    else if (disposition.action === 'update') {
      const effect = { ...original, source: disposition.source, effectForm: disposition.effectForm, effectDirection: disposition.effectDirection };
      checkCandidate(effect, disposition.evidence); effects.push(effect);
    } else if (disposition.action === 'remove') {
      if (rawRemovalPolicy === undefined) throw new Error('Explicit removal policy is required.');
      const policy = enrichmentRemovalPolicySchema.parse(rawRemovalPolicy);
      if (disposition.policyHash !== artifactHash(policy)) throw new Error('Removal policy hash mismatch.');
      for (const citation of disposition.evidence) {
        const doc = policy.documents.find(item => item.id === citation.documentId) ?? documents.get(citation.documentId);
        if (!doc || !doc.text.includes(citation.quote)) throw new Error(`Invalid removal evidence quote in ${citation.documentId}.`);
      }
      if (!policy.targets.some(target => target.championId === input.id && target.linkId === original.id &&
        target.abilityId === original.abilityId && target.type === original.type && target.source === original.source)) {
        throw new Error('Removal is outside the exact authorized source.');
      }
      if (!disposition.evidence.some(c => policy.documents.some(doc => doc.id === c.documentId && doc.text.includes(c.quote)))) {
        throw new Error('Removal requires positive policy evidence.');
      }
    } else for (const effect of disposition.replacements) { checkCandidate(effect, effect.evidence); effects.push(effect); }
  }
  if (seen.size !== existingIds.size) throw new Error('Every existing link needs exactly one disposition.');
  for (const addition of draft.additions) { checkCandidate(addition, addition.evidence); effects.push(addition); }
  const identities = new Set<string>();
  for (const effect of effects) {
    const key = identity(effect);
    // Existing duplicate NULL-source records are tolerated only when both are preserved unchanged.
    if (identities.has(key)) {
      const matches = effects.filter(e => identity(e) === key);
      if (!matches.every(e => 'id' in e && draft.dispositions.some(d => d.linkId === e.id && d.action === 'preserve'))) {
        throw new Error(`Duplicate effect source identity for ${effect.name}.`);
      }
    }
    identities.add(key);
  }
  const review = rawReview === undefined ? undefined : enrichmentReviewSchema.parse(rawReview);
  if (review && (review.championId !== input.id || review.inputHash !== input.inputHash || review.draftHash !== artifactHash(draft))) throw new Error('Review does not match this draft.');
  if (review && review.reviewer === draft.author) throw new Error('Draft author and reviewer must be independent.');
  return { draft, review, effects };
}

export function assertLocalDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) throw new Error('Effect enrichment writes are restricted to a local database.');
}

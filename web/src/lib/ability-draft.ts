import { z } from 'zod';
import { parseSynergyDescription } from './champion-synergies';
import { EFFECT_FORMS, EFFECT_DIRECTIONS, readAbilitySource } from '@cerebro/core/domain/ability-source';

type DraftChampion = { id: number; name: string; gameId: string | null };
type Partner = DraftChampion & { rarities: number[] };
export type DraftSynergyRow = {
  id: string; name: string; description: string; sourceHash: string;
  enabled: boolean; unique: boolean; requiredHeroGroups: boolean; targetTags: string[];
  members: Array<{ role: 'OWNER' | 'REQUIRED'; rarity: number; champion: DraftChampion }>;
};
export type AbilityDraftSynergy = {
  key: string; name: string; description: string; sourceHash: string; unique: boolean;
  targetTags: string[]; championRarities: number[]; partners: Partner[];
  championRole: 'OWNER' | 'REQUIRED'; owners: Partner[]; required: Partner[];
};

const plainText = (value: string) => parseSynergyDescription(value).map(s => s.text).join('');
function groupMembers(members: DraftSynergyRow['members']): Partner[] {
  const partners = new Map<number, Partner>();
  for (const { champion, rarity } of members) {
    const partner = partners.get(champion.id) ?? { ...champion, rarities: [] };
    if (!partner.rarities.includes(rarity)) partner.rarities.push(rarity);
    partners.set(champion.id, partner);
  }
  return [...partners.values()].map(p => ({ ...p, rarities: p.rarities.sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Each direction has its own rarity constraints. Membership alone does not imply receipt of every effect. */
export function buildAbilityDraftSynergies(rows: DraftSynergyRow[], championId: number): AbilityDraftSynergy[] {
  return rows.flatMap(row => {
    if (!row.enabled || row.requiredHeroGroups) return [];
    const owners = groupMembers(row.members.filter(m => m.role === 'OWNER'));
    const required = groupMembers(row.members.filter(m => m.role === 'REQUIRED'));
    return (['OWNER', 'REQUIRED'] as const).flatMap(role => {
      const champion = (role === 'OWNER' ? owners : required).find(c => c.id === championId);
      const partners = (role === 'OWNER' ? required : owners).filter(c => c.id !== championId);
      if (!champion || !partners.length) return [];
      return [{
        key: `${row.id}:${role}`, name: plainText(row.name), description: plainText(row.description),
        sourceHash: row.sourceHash, unique: row.unique, targetTags: row.targetTags,
        championRole: role, championRarities: champion.rarities, partners, owners, required,
      }];
    });
  });
}

const synergySchema = z.object({
  key: z.string().min(1), championIds: z.array(z.number().int().positive()).min(1).max(100),
  // Filled by the server for review. Recomputed rather than trusting client/model labels.
  sourceHash: z.string().optional(), requirement: z.string().optional(),
}).strict();
const itemSchema = z.object({
  name: z.string().trim().min(1).max(120), source: z.string().trim().max(2000),
  effectForm: z.enum(EFFECT_FORMS).optional(),
  effectDirection: z.enum(EFFECT_DIRECTIONS).optional(),
  synergy: synergySchema.optional(),
}).strict();
const draftSchema = z.object({
  abilities: z.array(itemSchema).max(500).optional(),
  immunities: z.array(itemSchema).max(500).optional(),
}).strict().refine(d => d.abilities !== undefined || d.immunities !== undefined, 'Expected abilities or immunities');

export type AbilityDraftItem = z.infer<typeof itemSchema>;
export type AbilityDraft = { abilities: AbilityDraftItem[]; immunities: AbilityDraftItem[] };
const stars = (rarities: number[]) => rarities.map(r => `${r}★`).join('/');

export function parseAbilityDraft(input: unknown, contexts: AbilityDraftSynergy[]): AbilityDraft {
  const draft = draftSchema.parse(input);
  const normalize = (item: AbilityDraftItem): AbilityDraftItem => {
    const metadata = readAbilitySource(item);
    item = { ...item, source: metadata.condition,
      ...(metadata.effectForm !== 'UNKNOWN' || item.effectForm ? { effectForm: metadata.effectForm } : {}),
      ...(metadata.effectDirection !== 'UNKNOWN' || item.effectDirection ? { effectDirection: metadata.effectDirection } : {}),
    };
    if (!item.synergy) {
      if (/\bsynerg(?:y|ies)\b/i.test(item.source)) throw new Error(`Missing synergy reference for ${item.name}.`);
      return item;
    }
    const context = contexts.find(s => s.key === item.synergy!.key);
    if (!context) throw new Error(`Unknown or unavailable synergy for ${item.name}. Regenerate the draft.`);
    if (item.synergy.sourceHash && item.synergy.sourceHash !== context.sourceHash) {
      throw new Error('Synergy data changed. Regenerate the draft before confirming.');
    }
    const championIds = [...new Set(item.synergy.championIds)].sort((a, b) => a - b);
    const partners = championIds.map(id => {
      const partner = context.partners.find(p => p.id === id);
      if (!partner) throw new Error(`Invalid synergy teammate for ${item.name}.`);
      return `${partner.name} (${stars(partner.rarities)})`;
    });
    const requirement = `Synergy: ${context.name} (${stars(context.championRarities)}) with ${partners.join(' OR ')}${context.unique ? '; does not stack' : ''}`;
    return { ...item, synergy: { key: context.key, championIds, sourceHash: context.sourceHash, requirement } };
  };
  return { abilities: (draft.abilities ?? []).map(normalize), immunities: (draft.immunities ?? []).map(item => {
    const normalized = normalize(item);
    return normalized.effectDirection ? { ...normalized, effectDirection: 'UNKNOWN' as const } : normalized;
  }) };
}

export function abilityDraftSource(item: AbilityDraftItem): string {
  if (!item.synergy) return item.source;
  if (!item.synergy.requirement) throw new Error('Synergy draft must be validated before saving.');
  return `${item.synergy.requirement}${item.source ? ` — ${item.source}` : ''}`;
}

export function buildAbilityDraftUserPrompt(
  champion: DraftChampion & { fullAbilities: unknown; class?: string; tags?: { name: string }[] }, synergies: AbilityDraftSynergy[],
): string {
  return `Champion: ${JSON.stringify({ id: champion.id, name: champion.name, gameId: champion.gameId, class: champion.class, tags: champion.tags?.map(t => t.name) ?? [] })}\n` +
    `"full_abilities" JSON:\n${JSON.stringify(champion.fullAbilities, null, 2)}\n\n` +
    `"game_synergies" JSON (owned and incoming, obtainable teammates only):\n${JSON.stringify(synergies, null, 2)}\n\n` +
    'Generate ONLY the JSON object for this champion, including innate effects and applicable synergy effects as separate entries.';
}

import { Prisma, PrismaClient } from '@prisma/client';
import type { OpenRouterService } from '../../../src/services/openRouterService';
import { abilityDraftPrompt } from '../../../src/prompts/abilityDraft';
import {
  abilityDraftSource, buildAbilityDraftSynergies, buildAbilityDraftUserPrompt, parseAbilityDraft,
  type AbilityDraft,
} from './ability-draft';

async function loadSynergies(db: Prisma.TransactionClient, championId: number) {
  const rows = await db.gameSynergy.findMany({
    where: { enabled: true, requiredHeroGroups: false, members: { some: { championId } } },
    select: {
      id: true, name: true, description: true, sourceHash: true, enabled: true, unique: true,
      requiredHeroGroups: true, targetTags: true,
      members: { select: { role: true, rarity: true, champion: { select: { id: true, name: true, gameId: true } } } },
    },
    orderBy: { id: 'asc' },
  });
  return buildAbilityDraftSynergies(rows, championId);
}

export async function generateAbilityDraft(
  db: PrismaClient, openRouter: Pick<OpenRouterService, 'chat'>, championId: number, model: string,
  revision?: { draft: AbilityDraft; suggestions: string },
): Promise<AbilityDraft> {
  const champion = await db.champion.findUnique({
    where: { id: championId },
    select: { id: true, name: true, gameId: true, class: true, tags: { select: { name: true } }, fullAbilities: true },
  });
  if (!champion || !champion.fullAbilities) throw new Error('Champion not found or has no Descriptions (fullAbilities) set.');
  const synergies = await loadSynergies(db, championId);
  const original = revision ? parseAbilityDraft(revision.draft, synergies) : undefined;
  const response = await openRouter.chat({
    model,
    messages: [
      { role: 'system', content: abilityDraftPrompt },
      { role: 'user', content: buildAbilityDraftUserPrompt(champion, synergies) },
      ...(revision ? [
        { role: 'assistant' as const, content: JSON.stringify(original) },
        { role: 'user' as const, content: `Apply these review suggestions: ${revision.suggestions}\nReturn the complete updated JSON, preserving applicable synergy references and innate entries.` },
      ] : []),
    ],
    response_format: { type: 'json_object' },
  });
  const choice = response.choices[0];
  if (!choice?.message.content || choice.finish_reason === 'length') {
    throw new Error('The AI draft was empty or incomplete. Please generate it again.');
  }
  return parseAbilityDraft(JSON.parse(choice.message.content), synergies);
}

/** Additive confirmation: preserve curated entries, but save each new link and its teammates atomically. */
export async function saveAbilityDraft(db: PrismaClient, championId: number, input: unknown): Promise<void> {
  await db.$transaction(async tx => {
    // Serialize repeated confirmations for this champion (including NULL innate sources).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718264, ${championId}::int)`;
    // Share the importer's lock so the snapshot cannot change between validation and save.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(718263, 1)`;
    const champion = await tx.champion.findUnique({ where: { id: championId }, select: { id: true } });
    if (!champion) throw new Error('Champion not found.');
    const draft = parseAbilityDraft(input, await loadSynergies(tx, championId));
    const entries = [
      ...draft.abilities.map(item => ({ ...item, type: 'ABILITY' as const })),
      ...draft.immunities.map(item => ({ ...item, type: 'IMMUNITY' as const })),
    ];
    for (const item of entries) {
      const ability = await tx.ability.upsert({
        where: { name: item.name }, update: {}, create: { name: item.name, description: '' },
      });
      const data = { championId, abilityId: ability.id, type: item.type, source: abilityDraftSource(item) || null };
      const existing = await tx.championAbilityLink.findFirst({ where: data });
      const link = existing ?? await tx.championAbilityLink.create({ data });
      if (item.synergy) {
        await tx.championAbilitySynergy.createMany({
          data: item.synergy.championIds.map(id => ({ championAbilityLinkId: link.id, championId: id })),
          skipDuplicates: true,
        });
      }
    }
  }, { maxWait: 15000, timeout: 60000 });
}

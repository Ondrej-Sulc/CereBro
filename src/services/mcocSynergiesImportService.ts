import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';

const strings = z.array(z.string().min(1));
const synergySchema = z.object({
  id: z.string().min(1), name_key: z.string(), description_key: z.string(),
  name: z.string().trim().min(1), description_template: z.string().min(1),
  description_value: z.number().finite(), description_argument: z.number().finite(),
  description: z.string().min(1).refine(value => !/\{\d+\}/.test(value), 'Unresolved synergy description'),
  texture: z.string(), enabled: z.boolean(), unique: z.boolean(),
  hero_rating_hp_modifier: z.number().finite(), hero_rating_attack_modifier: z.number().finite(),
  bonus_heroes: strings.min(1), required_heroes: strings.min(1), target_tags: strings,
  hero_rating_stat_mod_modifiers: strings, required_hero_groups: z.boolean(),
}).passthrough();

const snapshotSchema = z.object({
  metadata: z.object({ schemaVersion: z.string().min(1), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/i) }).passthrough(),
  validation: z.object({ records: z.number().int().positive() }).passthrough(),
  synergies: z.array(synergySchema).min(1),
}).superRefine((data, ctx) => {
  if (data.validation.records !== data.synergies.length) {
    ctx.addIssue({ code: 'custom', message: 'Snapshot record count does not match its manifest' });
  }
  const ids = new Set<string>();
  for (const synergy of data.synergies) {
    if (ids.has(synergy.id)) ctx.addIssue({ code: 'custom', message: `Duplicate synergy ID: ${synergy.id}` });
    ids.add(synergy.id);
  }
});

export type McocSynergiesFile = z.infer<typeof snapshotSchema>;

export function parseMcocSynergiesJson(text: string): McocSynergiesFile {
  return snapshotSchema.parse(JSON.parse(text));
}

type ImportChampion = { id: number; gameId: string | null; obtainable: string[]; isPlayable: boolean };
const rarityBySuffix: Record<string, number> = { mls: 1, un: 2, rar: 3, ep: 4, leg: 5, t6: 6, t7: 7 };

export function prepareMcocSynergiesImport(input: McocSynergiesFile, champions: ImportChampion[]) {
  const data = snapshotSchema.parse(input);
  const byGameId = new Map(champions.filter(c => c.gameId).map(c => [c.gameId!, c]));
  const members: Prisma.GameSynergyMemberCreateManyInput[] = [];
  const unknownTiers = new Set<string>();
  const filteredTiers = new Set<string>();
  const groupedIds: string[] = [];
  const owners = new Set<number>();
  const linkedIds = new Set<string>();
  const synergies: Prisma.GameSynergyCreateManyInput[] = [];

  for (const row of data.synergies) {
    synergies.push({
      id: row.id, name: row.name, description: row.description,
      descriptionTemplate: row.description_template, descriptionValue: row.description_value,
      descriptionArgument: row.description_argument, enabled: row.enabled, unique: row.unique,
      requiredHeroGroups: row.required_hero_groups, targetTags: row.target_tags,
      effectIds: row.hero_rating_stat_mod_modifiers, sourceHash: data.metadata.sourceSha256,
      raw: row as Prisma.InputJsonObject,
    });
    if (row.required_hero_groups) groupedIds.push(row.id);
    for (const [role, tiers] of [['OWNER', row.bonus_heroes], ['REQUIRED', row.required_heroes]] as const) {
      for (const tierId of new Set(tiers)) {
        const match = /^(.*)_(mls|un|rar|ep|leg|t6|t7)$/.exec(tierId);
        const champion = match ? byGameId.get(match[1]) : undefined;
        if (!match || !champion) { unknownTiers.add(tierId); continue; }
        const rarity = rarityBySuffix[match[2]];
        if (!champion.isPlayable || !champion.obtainable.includes(String(rarity))) {
          filteredTiers.add(tierId); continue;
        }
        members.push({ synergyId: row.id, championId: champion.id, role, tierId, rarity });
        if (role === 'OWNER') { owners.add(champion.id); linkedIds.add(row.id); }
      }
    }
  }
  return {
    synergies, members,
    report: {
      sourceHash: data.metadata.sourceSha256, records: synergies.length,
      linkedSynergies: linkedIds.size, ownerChampions: owners.size, memberLinks: members.length,
      unmatchedTiers: [...unknownTiers].sort(), filteredTemplateTiers: [...filteredTiers].sort(),
      unsupportedGroupedRequirements: groupedIds,
      canWrite: owners.size > 0 && groupedIds.length === 0,
    },
  };
}

export type McocSynergiesImportReport = ReturnType<typeof prepareMcocSynergiesImport>['report'] & {
  previousRecords: number;
  written?: { records: number; memberLinks: number };
};

/** Replace only the dedicated game snapshot. Curated ability links are untouched. */
export async function importMcocSynergies(
  prisma: PrismaClient, data: McocSynergiesFile, options: { write?: boolean } = {},
): Promise<McocSynergiesImportReport> {
  const champions = await prisma.champion.findMany({
    select: { id: true, gameId: true, obtainable: true, isPlayable: true },
  });
  const plan = prepareMcocSynergiesImport(data, champions);
  const report: McocSynergiesImportReport = { ...plan.report, previousRecords: await prisma.gameSynergy.count() };
  if (!options.write) return report;
  if (!report.canWrite) throw new Error('Cannot import synergies: no matched owners or unsupported grouped requirements.');
  await prisma.$transaction(async tx => {
    // Serialize snapshot replacements, including concurrent first imports.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 1)`;
    await tx.gameSynergy.deleteMany();
    for (let i = 0; i < plan.synergies.length; i += 250) {
      await tx.gameSynergy.createMany({ data: plan.synergies.slice(i, i + 250) });
    }
    for (let i = 0; i < plan.members.length; i += 1000) {
      await tx.gameSynergyMember.createMany({ data: plan.members.slice(i, i + 1000) });
    }
  }, { maxWait: 15000, timeout: 60000 });
  report.written = { records: plan.synergies.length, memberLinks: plan.members.length };
  return report;
}

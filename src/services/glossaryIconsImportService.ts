import { PrismaClient } from '@prisma/client';

export type GlossaryIconUpdate = { glossaryKey: string; iconUrl: string };
export type GlossaryIconsImportReport = {
  totalUpdates: number; termsFound: number; termsUpdated: number;
  abilitiesLinked: number; abilitiesCreated: number;
  unmatchedTerms: string[]; skippedAbilityTerms: string[]; conflicts: string[];
  canWrite: boolean;
  written?: { termsUpdated: number; abilitiesLinked: number; abilitiesCreated: number };
};

const nameAliases: Record<string, string[]> = {
  degen: ['Degeneration'], evade: ['Evasion'], glance: ['Glancing'],
  phys_res: ['Physical Resistance'], energy_res: ['Energy Resistance'],
  block_pen: ['Block Penetration'], physical_pen: ['Physical Penetration'],
  energy_pen: ['Energy Penetration'], power_timebomb: ['Power Detonation'],
  guaranteed_crit: ['Guaranteed Critical'], placebo: ['Placebo Buff'],
  austere: ['Austere Armor Up'], banished: ['Banished Effects:'],
};
function identity(value: string) {
  return value.replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function isGlossaryIdentityMatch(id: string, name: string) {
  return Boolean(name.trim()) && [id, ...(nameAliases[id] ?? [])]
    .some(candidate => identity(candidate) === identity(name));
}

export async function importGlossaryIcons(
  prisma: PrismaClient, updates: GlossaryIconUpdate[], options: { write?: boolean } = {}
): Promise<GlossaryIconsImportReport> {
  let termsFound = 0, termsUpdated = 0, abilitiesLinked = 0, abilitiesCreated = 0;
  const unmatchedTerms: string[] = [], skippedAbilityTerms: string[] = [], conflicts: string[] = [];
  for (const { glossaryKey, iconUrl } of updates) {
    await prisma.$transaction(async tx => {
      const term = await tx.gameGlossaryTerm.findUnique({ where: { id: glossaryKey } });
      if (!term) { unmatchedTerms.push(glossaryKey); return; }
      termsFound++;
      termsUpdated++;
      if (options.write) await tx.gameGlossaryTerm.update({ where: { id: glossaryKey }, data: { iconUrl } });
      // Unresolved names must not create blank abilities. A partial key such as
      // "severe" must not claim the canonical Armor Break ability either.
      if (!isGlossaryIdentityMatch(term.id, term.name)) {
        skippedAbilityTerms.push(glossaryKey);
        return;
      }
      const sameName = await tx.gameGlossaryTerm.findMany({
        where: { name: { equals: term.name, mode: 'insensitive' } }, select: { id: true, name: true },
      });
      const canonical = sameName.filter(candidate => isGlossaryIdentityMatch(candidate.id, candidate.name))
        .sort((a, b) => Number(identity(b.id) === identity(term.name)) - Number(identity(a.id) === identity(term.name))
          || a.id.localeCompare(b.id))[0];
      if (canonical?.id !== term.id) { skippedAbilityTerms.push(glossaryKey); return; }
      const linked = await tx.ability.findUnique({ where: { gameGlossaryTermId: term.id } });
      if (linked && identity(linked.name) !== identity(term.name)) {
        conflicts.push(`${term.id}: already linked to ${linked.name}`);
        return;
      }
      const ability = linked ?? await tx.ability.findFirst({
        where: { name: { equals: term.name, mode: 'insensitive' } },
      });
      if (ability?.gameGlossaryTermId && ability.gameGlossaryTermId !== term.id) {
        conflicts.push(`${ability.name}: already linked to ${ability.gameGlossaryTermId}`);
        return;
      }
      if (ability) {
        abilitiesLinked++;
        if (options.write) await tx.ability.update({
          where: { id: ability.id }, data: { gameGlossaryTermId: term.id, iconUrl },
        });
      } else {
        abilitiesCreated++;
        if (options.write) await tx.ability.create({ data: {
          name: term.name, description: term.description, gameGlossaryTermId: term.id, iconUrl,
        } });
      }
    });
  }
  return {
    totalUpdates: updates.length, termsFound, termsUpdated, abilitiesLinked, abilitiesCreated,
    unmatchedTerms, skippedAbilityTerms, conflicts, canWrite: true,
    ...(options.write ? { written: { termsUpdated, abilitiesLinked, abilitiesCreated } } : {}),
  };
}

import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import { overviewSourceHash } from '@cerebro/core/domain/champion-overview-summary';
import type { EffectSourceMetadata } from '@cerebro/core/domain/ability-source';
import type { KitResistance } from '@/lib/champion-kit';
import { resistanceEvidenceHash, resistanceEvidenceRecords } from '@cerebro/core/domain/champion-resistance-classification';

type SourceLink = Partial<EffectSourceMetadata> & {
  id: number; type: string; source: string | null; ability: { name: string };
  synergyChampions: Array<{ champion: { name: string } }>;
};
export const getResistanceIndex = cache(async (championId?: number) => {
  const rows = await prisma.championAbilityResistance.findMany({
    where: championId ? { championAbilityLink: { championId } } : {},
    include: {
      effect: { select: { name: true, description: true, iconUrl: true, gameGlossaryTermId: true,
        gameGlossaryTerm: { select: { raw: true } }, categories: { select: { name: true } } } },
      championAbilityLink: { include: { ability: { select: { name: true } },
        synergyChampions: { include: { champion: { select: { name: true } } } } } },
    },
  });
  const recordIds = [...new Set(rows.flatMap(row => resistanceEvidenceRecords(row.evidence)?.map(record => record.recordId) ?? []))];
  const records = championId || recordIds.length ? await prisma.championAbilityText.findMany({
    where: championId ? { championId } : { id: { in: recordIds } },
    select: { id: true, championId: true, group: true, title: true, sortOrder: true, template: true },
  }) : [];
  const recordHashes = new Map(records.map(record => [record.id, { championId: record.championId, hash: resistanceEvidenceHash(record.template) }]));
  return rows.filter(row => {
    const link = row.championAbilityLink;
    const evidence = resistanceEvidenceRecords(row.evidence);
    return evidence !== null && evidence.every(record => recordHashes.get(record.recordId)?.hash === record.templateHash && recordHashes.get(record.recordId)?.championId === link.championId)
      && (row.percent === null || evidence.length > 0) && link.type === 'ABILITY' && row.sourceHash === overviewSourceHash({ ...link, name: link.ability.name,
      synergyChampionIds: link.synergyChampions.map(partner => partner.championId) });
  }).map(row => ({ ...row, ...(championId && row.percent === null && !/^Synergy:/i.test(row.championAbilityLink.source ?? '')
    ? { valueRecords: records.filter(record => record.championId === championId && !/bio|synerg/i.test(record.group))
      .map(({ id, group, title, sortOrder, template }) => ({ id, group, title, sortOrder, template })) } : {}) }));
});

/** Fresh classifications must also agree with any cached source and partner bindings. */
export function attachResistances<T extends SourceLink>(links: T[], index: Awaited<ReturnType<typeof getResistanceIndex>>): Array<T & { resistances: KitResistance[] }> {
  const partnerKey = (link: SourceLink) => link.synergyChampions.map(p => p.champion.name).sort().join('\0');
  return links.map(link => ({ ...link, resistances: index.filter(row => {
    const current = row.championAbilityLink;
    return current.id === link.id && current.type === link.type && current.source === link.source
      && current.ability.name === link.ability.name && current.effectForm === (link.effectForm ?? 'UNKNOWN')
      && current.effectDirection === (link.effectDirection ?? 'UNKNOWN') && partnerKey(current) === partnerKey(link);
  }).map(({ effect, mechanism, percent, valueRecords }) => ({ effect, mechanism, percent, ...(valueRecords ? { valueRecords } : {}) })) }));
}

import { PrismaClient } from '@prisma/client';

export type GlossaryIconUpdate = {
  glossaryKey: string;
  iconUrl: string;
};

export type GlossaryIconsImportReport = {
  totalUpdates: number;
  termsFound: number;
  termsUpdated: number;
  abilitiesLinked: number;
  abilitiesCreated: number;
  unmatchedTerms: string[];
  canWrite: boolean;
  written?: {
    termsUpdated: number;
    abilitiesLinked: number;
    abilitiesCreated: number;
  };
};

export async function importGlossaryIcons(
  prisma: PrismaClient,
  updates: GlossaryIconUpdate[],
  options: { write?: boolean } = {}
): Promise<GlossaryIconsImportReport> {
  let termsFound = 0;
  let termsUpdated = 0;
  let abilitiesLinked = 0;
  let abilitiesCreated = 0;
  const unmatchedTerms: string[] = [];

  for (const update of updates) {
    const glossaryKey = update.glossaryKey;
    const iconUrl = update.iconUrl;

    await prisma.$transaction(async (tx) => {
      const term = await tx.gameGlossaryTerm.findUnique({
        where: { id: glossaryKey },
      });

      if (!term) {
        unmatchedTerms.push(glossaryKey);
        return;
      }

      termsFound++;

      const snakeCase = term.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const duplicates = await tx.gameGlossaryTerm.findMany({
        where: { name: { equals: term.name, mode: 'insensitive' }, iconUrl: { not: null } },
        select: { id: true },
      });

      let isCanonical = true;
      if (duplicates.length > 1) {
        isCanonical =
          glossaryKey === snakeCase ||
          glossaryKey.includes(snakeCase) ||
          glossaryKey === duplicates.map(d => d.id).sort()[0];
      }

      termsUpdated++;
      if (options.write) {
        await tx.gameGlossaryTerm.update({
          where: { id: glossaryKey },
          data: { iconUrl },
        });
      }

      if (!isCanonical) {
        return;
      }

      let ability = await tx.ability.findUnique({
        where: { gameGlossaryTermId: glossaryKey },
      });

      if (!ability) {
        const alreadyLinked = await tx.ability.findFirst({
          where: {
            name: { equals: term.name, mode: 'insensitive' },
            gameGlossaryTermId: { not: null },
          },
        });

        if (alreadyLinked) {
          abilitiesLinked++;
          // We determined this glossaryKey is the "canonical" term. If another term already
          // claimed this ability, we intentionally overwrite gameGlossaryTermId to re-point to us.
          if (options.write) {
            await tx.ability.update({
              where: { id: alreadyLinked.id },
              data: { gameGlossaryTermId: glossaryKey, iconUrl },
            });
          }
        } else {
          ability = await tx.ability.findFirst({
            where: { name: { equals: term.name, mode: 'insensitive' } },
          });

          if (ability) {
            abilitiesLinked++;
            if (options.write) {
              await tx.ability.update({
                where: { id: ability.id },
                data: { gameGlossaryTermId: glossaryKey, iconUrl },
              });
            }
          } else {
            if (term.description || term.name !== term.id) {
              abilitiesCreated++;
              if (options.write) {
                await tx.ability.create({
                  data: {
                    name: term.name,
                    description: term.description,
                    gameGlossaryTermId: glossaryKey,
                    iconUrl,
                  },
                });
              }
            }
          }
        }
      } else {
        abilitiesLinked++;
        if (options.write) {
          await tx.ability.update({
            where: { id: ability.id },
            data: { iconUrl },
          });
        }
      }
    });
  }

  const report: GlossaryIconsImportReport = {
    totalUpdates: updates.length,
    termsFound,
    termsUpdated,
    abilitiesLinked,
    abilitiesCreated,
    unmatchedTerms,
    canWrite: true,
  };

  if (options.write) {
    report.written = {
      termsUpdated,
      abilitiesLinked,
      abilitiesCreated,
    };
  }

  return report;
}

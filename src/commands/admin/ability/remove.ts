import { CommandInteraction, MessageFlags } from "discord.js";
import { AbilityLinkType, Champion, ChampionAbilitySynergy, ChampionAbilityLink } from "@prisma/client";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { championList } from "../../../services/championService";
import Fuse from "fuse.js";

type ChampionAbilityLinkWithSynergy = ChampionAbilityLink & {
  synergyChampions: (ChampionAbilitySynergy & {
      champion: Champion;
  })[];
};

export async function handleAbilityRemove(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability remove process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const championName = interaction.options.getString("champion", true);
      const type = interaction.options.getString(
        "type",
        true
      ) as AbilityLinkType;
      const abilityName = interaction.options.getString("ability", true);
      let sourceArg: string | null = interaction.options.getString("source");
      if (sourceArg === "<None>") {
        sourceArg = null;
      }
      const synergyChampionsStr = interaction.options.getString("synergy-champions");

      await interaction.editReply(
        `Removing ${type.toLowerCase()} '${abilityName}' from **${championName}** with source '${
          sourceArg || "Unknown"
        }'...`
      );

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion) {
        await interaction.editReply(`Champion **${championName}** not found.`);
        return;
      }

      const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
      });
      if (!ability) {
        await interaction.editReply(`Ability '${abilityName}' not found.`);
        return;
      }

      let sourceForQuery: (string | null) | (string | null)[] = sourceArg;
      let synergyNamesFromArg: string[] = [];

      if (sourceArg && sourceArg.startsWith('Synergy [')) {
          const synergyRegex = /Synergy \[(.*?)\](?: & (.*))?$/;
          const match = sourceArg.match(synergyRegex);
          if (match) {
              synergyNamesFromArg = match[1].split(' & ').map(s => s.trim());
              if (match[2]) {
                  sourceForQuery = match[2].trim();
              } else {
                  sourceForQuery = [null, 'Synergy'];
              }
          }
      }

      const whereClause: any = {
        championId: champion.id,
        abilityId: ability.id,
        type: type,
      };

      if (Array.isArray(sourceForQuery)) {
        const nonNullSources = sourceForQuery.filter(s => s !== null) as string[];
        whereClause.OR = [
          { source: { in: nonNullSources } },
          { source: null }
        ];
      } else {
        whereClause.source = sourceForQuery;
      }

      const links: ChampionAbilityLinkWithSynergy[] = await prisma.championAbilityLink.findMany({
        where: whereClause,
        include: {
          synergyChampions: {
            include: {
              champion: true,
            },
          },
        },
      });

      let link;
      if (sourceArg && sourceArg.startsWith('Synergy [')) {
        link = links.find(l => {
            const linkSynergyNames = l.synergyChampions.map(sc => sc.champion.shortName).sort();
            const argSynergyNames = synergyNamesFromArg.sort();
            return JSON.stringify(linkSynergyNames) === JSON.stringify(argSynergyNames);
        });
      } else {
        link = links.find(l => l.synergyChampions.length === 0);
      }

      if (!link) {
        await interaction.editReply(
          `Could not find ${type.toLowerCase()} '${abilityName}' with source '${
            sourceArg || "Unknown"
          }' for **${championName}**.`
        );
        return;
      }

      if (synergyChampionsStr) {
        const fuse = new Fuse(championList, { keys: ['name', 'shortName'], threshold: 0.4 });
        const synergyChampionNames = synergyChampionsStr.split(',').map(s => s.trim());
        const synergyChampionIds: number[] = [];
        for (const name of synergyChampionNames) {
            const result = fuse.search(name);
            if (result.length > 0) {
                synergyChampionIds.push(result[0].item.id);
            } else {
                await interaction.editReply(`Synergy champion **${name}** not found.`);
                return;
            }
        }

        await prisma.championAbilitySynergy.deleteMany({
            where: {
                championAbilityLinkId: link.id,
                championId: { in: synergyChampionIds },
            },
        });

        await interaction.editReply(
            `Successfully removed synergies from ${type.toLowerCase()} '${abilityName}' on **${championName}**.`
        );
        logger.info(
            `Successfully removed synergies from ability ${abilityName} on ${championName}`
        );

      } else {
        await prisma.championAbilityLink.delete({ where: { id: link.id } });

        await interaction.editReply(
          `Successfully removed ${type.toLowerCase()} '${abilityName}' from **${championName}**.`
        );
        logger.info(
          `Successfully removed ability ${abilityName} from ${championName}`
        );
      }
    } catch (error) {
      logger.error(error, "An error occurred during champion ability remove");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}

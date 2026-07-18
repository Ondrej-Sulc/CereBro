import { CommandInteraction, MessageFlags } from "discord.js";
import { AbilityLinkType } from "@prisma/client";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { championList } from "../../../services/championService";
import Fuse from "fuse.js";

export async function handleAbilityAdd(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability add process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const championName = interaction.options.getString("champion", true);
      const type = interaction.options.getString(
        "type",
        true
      ) as AbilityLinkType;
      const abilityName = interaction.options.getString("ability", true);
      let source = interaction.options.getString("source") ?? null;
      if (source === "<None>") {
        source = null;
      }
      const synergyChampionsStr = interaction.options.getString("synergy-champions");

      await interaction.editReply(
        `Adding ${type.toLowerCase()} '${abilityName}' to **${championName}** from source '${
          source || "Unknown" 
        }'...`
      );

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion) {
        await interaction.editReply(`Champion **${championName}** not found.`);
        return;
      }

      const ability = await prisma.ability.upsert({
        where: { name: abilityName },
        update: { name: abilityName },
        create: { name: abilityName, description: "" },
      });

      const synergyChampionIds: number[] = [];
      if (synergyChampionsStr) {
        const fuse = new Fuse(championList, { keys: ['name', 'shortName'], threshold: 0.4 });
        const synergyChampionNames = synergyChampionsStr.split(',').map(s => s.trim());
        for (const name of synergyChampionNames) {
            const result = fuse.search(name);
            if (result.length > 0) {
                synergyChampionIds.push(result[0].item.id);
            } else {
                await interaction.editReply(`Synergy champion **${name}** not found.`);
                return;
            }
        }
      }

      await prisma.championAbilityLink.create({
        data: {
          championId: champion.id,
          abilityId: ability.id,
          type,
          source,
          synergyChampions: {
            create: synergyChampionIds.map(id => ({
                championId: id,
            })),
          },
        },
      });

      await interaction.editReply(
        `Successfully added ${type.toLowerCase()} '${abilityName}' to **${championName}**.`
      );
      logger.info(
        `Successfully added ability ${abilityName} to ${championName}`
      );
    } catch (error) {
      logger.error(error, "An error occurred during champion ability add");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}

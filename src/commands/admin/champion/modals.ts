import { ModalSubmitInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { ChampionClass } from "@prisma/client";
import logger from "../../../services/loggerService";
import { addChampion } from "./addChampion";

const pendingChampions = new Map<string, any>();

export async function handleChampionModalPart1(interaction: ModalSubmitInteraction) {
  if (!interaction.isModalSubmit()) return;

  try {
    await interaction.deferUpdate();

    const name = interaction.fields.getTextInputValue("championName");
    const shortName =
      interaction.fields.getTextInputValue("championShortName");
    const champClass = interaction.fields
      .getTextInputValue("championClass")
      .toUpperCase() as ChampionClass;
    const primaryImageUrl = interaction.fields.getTextInputValue(
      "championPrimaryImage"
    );
    const secondaryImageUrl = interaction.fields.getTextInputValue(
      "championSecondaryImage"
    );

    const partialChampionData = {
      name,
      shortName,
      champClass,
      primaryImageUrl,
      secondaryImageUrl,
    };

    pendingChampions.set(interaction.user.id, partialChampionData);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("champion-add-part2")
        .setLabel("Continue")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.followUp({
      content:
        "Part 1 of champion creation complete. Click continue to proceed to Part 2.",
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    logger.error(error, "Error handling champion modal submission part 1");
    await interaction.followUp({
      content: `An error occurred: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      ephemeral: true,
    });
  }
}

export async function handleChampionModalPart2(interaction: ModalSubmitInteraction) {
    if (!interaction.isModalSubmit()) return;

    try {
      await interaction.reply({
        content: "Processing part 2...",
        ephemeral: true,
      });

      const partialChampionData = pendingChampions.get(interaction.user.id);
      if (!partialChampionData) {
        throw new Error(
          "Could not find partial champion data. Please start over."
        );
      }

      const tagsImageUrl =
        interaction.fields.getTextInputValue("championTagsImage");
      const heroImageUrl =
        interaction.fields.getTextInputValue("championHeroImage");
      const releaseDate = interaction.fields.getTextInputValue(
        "championReleaseDate"
      );
      const obtainableRange =
        interaction.fields.getTextInputValue("championObtainableRange") ||
        "2-7";

      if (
        !Object.values(ChampionClass).includes(
          partialChampionData.champClass as ChampionClass
        )
      ) {
        throw new Error(
          `Invalid champion class: ${
            partialChampionData.champClass
          }. Please use one of: ${Object.values(ChampionClass).join(", ")}`
        );
      }

      const championData = {
        ...partialChampionData,
        tagsImageUrl,
        heroImageUrl,
        obtainableRange,
        releaseDate: new Date(releaseDate),
      };

      await addChampion(interaction, championData);

      pendingChampions.delete(interaction.user.id);
    } catch (error) {
      logger.error(error, "Error handling champion modal submission part 2");
      await interaction.followUp({
        content: `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        flags: [MessageFlags.Ephemeral],
      });
    }
}

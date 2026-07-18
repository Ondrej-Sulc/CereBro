import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { DuelStatus, DuelSource } from "@prisma/client";
import logger from "../../services/loggerService";
import { getChampionDataById } from "../../services/championService";
import { sendDuelNotification } from "../../services/notificationService";

const DUEL_SUGGEST_MODAL_ID = "champion-duel-suggest-modal";
const DUEL_REPORT_SELECT_ID = "champion-duel-report-select";
const DUEL_PLAYER_NAME_ID = "player-name";

export async function handleDuelSuggestButton(interaction: ButtonInteraction) {
  const championId = interaction.customId.split("_")[1];

  const modal = new ModalBuilder()
    .setCustomId(`${DUEL_SUGGEST_MODAL_ID}_${championId}`)
    .setTitle("Suggest a New Duel Target");

  const playerNameInput = new TextInputBuilder()
    .setCustomId(DUEL_PLAYER_NAME_ID)
    .setLabel("Player's In-Game Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(50);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    playerNameInput
  );

  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleDuelReportButton(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const championId = parseInt(interaction.customId.split("_")[1], 10);

  const activeDuels = await prisma.duel.findMany({
    where: {
      championId,
      status: DuelStatus.ACTIVE,
    },
  });

  if (activeDuels.length === 0) {
    await interaction.editReply(
      "There are no active duel targets to report for this champion."
    );
    return;
  }

  const options = activeDuels.map((duel) => ({
    label: duel.playerName,
    value: duel.id.toString(),
    description: duel.rank ? `Rank: ${duel.rank}` : "No rank info",
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${DUEL_REPORT_SELECT_ID}_${championId}`)
    .setPlaceholder("Select the outdated duel target")
    .addOptions(options);

  const actionRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    content: "Please select the duel target you want to report as outdated.",
    components: [actionRow],
  });
}

export async function handleDuelSuggestModalSubmit(
  interaction: ModalSubmitInteraction
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const championId = parseInt(interaction.customId.split("_")[1], 10);
  const playerName = interaction.fields.getTextInputValue(DUEL_PLAYER_NAME_ID);

  try {
    const champion = await getChampionDataById(championId);
    if (!champion) {
      await interaction.editReply("Could not find the associated champion.");
      return;
    }

    await prisma.duel.create({
      data: {
        championId,
        playerName,
        source: DuelSource.USER_SUGGESTION,
        status: DuelStatus.SUGGESTED,
        submittedByDiscordId: interaction.user.id,
      },
    });

    await interaction.editReply(
      `Thank you! Your suggestion for "${playerName}" has been submitted for review.`
    );

    // Send notification
    const embed = new EmbedBuilder()
      .setTitle("New Duel Suggestion")
      .setColor("Green")
      .addFields(
        { name: "Champion", value: champion.name, inline: true },
        { name: "Suggested Target", value: playerName, inline: true },
        {
          name: "Submitted By",
          value: `${interaction.user.tag} (${interaction.user.id})`,
        }
      )
      .setTimestamp();
    await sendDuelNotification(interaction, embed);
  } catch (error: any) {
    if (error.code === "P2002") {
      // Unique constraint violation
      await interaction.editReply(
        `This player has already been suggested for this champion. It's pending review.`
      );
    } else {
      logger.error(error, "Failed to create duel suggestion");
      await interaction.editReply(
        "An error occurred while submitting your suggestion."
      );
    }
  }
}

export async function handleDuelReportSelect(
  interaction: StringSelectMenuInteraction
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const duelId = parseInt(interaction.values[0], 10);

  try {
    const updatedDuel = await prisma.duel.update({
      where: { id: duelId },
      data: {
        status: DuelStatus.OUTDATED,
        submittedByDiscordId: interaction.user.id,
      },
      include: {
        champion: true,
      },
    });

    await interaction.editReply(
      `Thank you for your feedback. "${updatedDuel.playerName}" has been reported as outdated and will be reviewed.`
    );

    // Send notification
    const embed = new EmbedBuilder()
      .setTitle("Outdated Duel Report")
      .setColor("Red")
      .addFields(
        { name: "Champion", value: updatedDuel.champion.name, inline: true },
        {
          name: "Reported Target",
          value: updatedDuel.playerName,
          inline: true,
        },
        {
          name: "Reported By",
          value: `${interaction.user.tag} (${interaction.user.id})`,
        }
      )
      .setTimestamp();
    await sendDuelNotification(interaction, embed);
  } catch (error) {
    logger.error(error, "Failed to report duel as outdated");
    await interaction.editReply(
      "An error occurred while reporting this duel target."
    );
  }
}

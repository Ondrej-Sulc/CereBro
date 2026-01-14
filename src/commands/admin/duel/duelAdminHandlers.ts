import {
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SeparatorBuilder,
  MessageFlags,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { DuelStatus } from "@prisma/client";
import logger from "../../../services/loggerService";

export const DUEL_REVIEW_APPROVE_ID = "duel-review-approve_";
export const DUEL_REVIEW_REJECT_ID = "duel-review-reject_";
export const DUEL_REVIEW_DELETE_ID = "duel-review-delete_";
export const DUEL_REVIEW_ACTIVATE_ID = "duel-review-activate_";

export async function getDuelReviewUI(
  status: DuelStatus,
  feedback?: string
): Promise<ContainerBuilder> {
  const duelsToReview = await prisma.duel.findMany({
    where: { status },
    include: { champion: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const container = new ContainerBuilder();

  if (feedback) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(feedback)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  if (duelsToReview.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `No more duels found with status \`${status}\`.`
      )
    );
    return container;
  }

  duelsToReview.forEach((duel, index) => {
    const submittedBy = duel.submittedByDiscordId
      ? `<@${duel.submittedByDiscordId}>`
      : "Unknown";

    const reviewText = `Player: \`${duel.playerName}\` (Top Champion: \`${duel.champion.name}\`)\nSubmitted By: ${submittedBy}`;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(reviewText)
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    if (status === DuelStatus.SUGGESTED) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${DUEL_REVIEW_APPROVE_ID}${duel.id}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${DUEL_REVIEW_REJECT_ID}${duel.id}`)
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
      );
    } else if (status === DuelStatus.OUTDATED) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${DUEL_REVIEW_DELETE_ID}${duel.id}`)
          .setLabel("Archive")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`${DUEL_REVIEW_ACTIVATE_ID}${duel.id}`)
          .setLabel("Mark as Active")
          .setStyle(ButtonStyle.Success)
      );
    }
    container.addActionRowComponents(actionRow);

    if (index < duelsToReview.length - 1) {
      container.addSeparatorComponents(new SeparatorBuilder());
    }
  });

  return container;
}

export async function handleDuelReviewApprove(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ACTIVE },
    });

    const feedback = `✅ Approved duel target \`${duel.playerName}\`. It is now active.`;
    const container = await getDuelReviewUI(DuelStatus.SUGGESTED, feedback);

    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to approve duel suggestion");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while approving this suggestion."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

export async function handleDuelReviewReject(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ARCHIVED },
    });

    const feedback = `🗑️ Rejected and archived duel suggestion \`${duel.playerName}\`.`;
    const container = await getDuelReviewUI(DuelStatus.SUGGESTED, feedback);

    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to reject duel suggestion");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while rejecting this suggestion."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

export async function handleDuelReviewDelete(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ARCHIVED },
    });

    const feedback = `🗑️ Archived outdated duel target \`${duel.playerName}\`.`;
    const container = await getDuelReviewUI(DuelStatus.OUTDATED, feedback);

    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to delete outdated duel");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while archiving this duel target."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

export async function handleDuelReviewActivate(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ACTIVE },
    });

    const feedback = `✅ Marked duel target \`${duel.playerName}\` as active again.`;
    const container = await getDuelReviewUI(DuelStatus.OUTDATED, feedback);

    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to activate outdated duel");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while activating this duel target."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

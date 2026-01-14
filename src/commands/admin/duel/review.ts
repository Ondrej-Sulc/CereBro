import {
  CommandInteraction,
  MessageFlags,
} from "discord.js";
import { DuelStatus } from "@prisma/client";
import logger from "../../../services/loggerService";
import { registerButtonHandler } from "../../../utils/buttonHandlerRegistry";
import {
  handleDuelReviewActivate,
  handleDuelReviewApprove,
  handleDuelReviewDelete,
  handleDuelReviewReject,
  getDuelReviewUI,
  DUEL_REVIEW_APPROVE_ID,
  DUEL_REVIEW_REJECT_ID,
  DUEL_REVIEW_DELETE_ID,
  DUEL_REVIEW_ACTIVATE_ID,
} from "./duelAdminHandlers";

// Register button handlers
registerButtonHandler(DUEL_REVIEW_APPROVE_ID, handleDuelReviewApprove);
registerButtonHandler(DUEL_REVIEW_REJECT_ID, handleDuelReviewReject);
registerButtonHandler(DUEL_REVIEW_DELETE_ID, handleDuelReviewDelete);
registerButtonHandler(DUEL_REVIEW_ACTIVATE_ID, handleDuelReviewActivate);

export async function handleDuelReview(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  const status = interaction.options.getString("status", true) as DuelStatus;

  await interaction.deferReply({ ephemeral: true });

  try {
    const container = await getDuelReviewUI(status);

    await interaction.editReply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (error) {
    logger.error(error, "Failed to fetch duels for review");
    await interaction.editReply(
      "An error occurred while fetching duels for review."
    );
  }
}


import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  MessageFlags,
} from "discord.js";
import {
  buildDraftContainerV2,
  buildDraftErrorContainerV2,
  buildDraftSuccessContainerV2,
} from "./draftUI";
import logger from "../../../services/loggerService";
import {
  OpenRouterMessage,
  OpenRouterService,
} from "../../../services/openRouterService";
import { abilityDraftPrompt } from "../../../prompts/abilityDraft";
import { registerButtonHandler } from "../../../utils/buttonHandlerRegistry";
import { registerModalHandler } from "../../../utils/modalHandlerRegistry";
import { pendingDrafts } from "./draftState";

export async function handleConfirmAbilityDraft(
  interaction: ButtonInteraction
) {
  const { prisma } = await import("../../../services/prismaService.js");
  try {
    await interaction.deferUpdate();
    const championId = parseInt(interaction.customId.split("_")[1]);
    const draftData = pendingDrafts.get(championId.toString());

    if (!draftData) {
      // This should be an ephemeral error container
      await interaction.reply({
        content: "Could not find the draft.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const draft = draftData.draft;

    const abilities = (draft.abilities || []).map((a: any) => ({
      ...a,
      type: "ABILITY",
    }));
    const immunities = (draft.immunities || []).map((i: any) => ({
      ...i,
      type: "IMMUNITY",
    }));

    const allLinks = [...abilities, ...immunities];

    for (const link of allLinks) {
      const ability = await prisma.ability.upsert({
        where: { name: link.name },
        update: { name: link.name },
        create: { name: link.name, description: "" },
      });

      await prisma.championAbilityLink.upsert({
        where: {
          championId_abilityId_type_source: {
            championId: championId,
            abilityId: ability.id,
            type: link.type as any,
            source: link.source,
          },
        },
        update: {},
        create: {
          championId: championId,
          abilityId: ability.id,
          type: link.type as any,
          source: link.source,
        },
      });
    }

    const champion = await prisma.champion.findUnique({
      where: { id: championId },
    });
    logger.info(
      `Added drafted abilities for champion ${champion?.name || championId}`
    );

    pendingDrafts.delete(championId.toString());

    const successContainer = buildDraftSuccessContainerV2(
      champion?.name || `ID: ${championId}`,

      "Drafted abilities have been successfully added to the champion."
    );

    await interaction.editReply(successContainer);
  } catch (error) {
    logger.error(error, "An error occurred while confirming ability draft");

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const errorContainer = buildDraftErrorContainerV2(errorMessage);

    await interaction.followUp({
      ...errorContainer,

      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleCancelAbilityDraft(interaction: ButtonInteraction) {
  const championId = interaction.customId.split("_")[1];

  if (championId) {
    pendingDrafts.delete(championId);
  }

  await interaction.message.delete();
}

export async function handleSuggestEdits(interaction: ButtonInteraction) {
  const championId = interaction.customId.split("_")[1];

  if (!championId) {
    await interaction.reply({
      content: "Invalid champion ID.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`suggest-ability-modal_${championId}`)
    .setTitle("Suggest Edits");

  const suggestionsInput = new TextInputBuilder()
    .setCustomId("suggestions")
    .setLabel("What would you like to change?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    suggestionsInput
  );

  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleSuggestEditsModal(
  interaction: ModalSubmitInteraction
) {
  const { prisma } = await import("../../../services/prismaService.js");
  const { config } = await import("../../../config.js");
  const openRouterService = new OpenRouterService(config.OPEN_ROUTER_API_KEY!);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const championId = parseInt(interaction.customId.split("_")[1]);
  logger.info(`Handling suggest edits modal for champion ${championId}`);

  const suggestions = interaction.fields.getTextInputValue("suggestions");
  logger.info({ suggestions }, "User suggestions");

  const draftData = pendingDrafts.get(championId.toString());

  if (!draftData) {
    await interaction.editReply("Could not find the original draft.");
    return;
  }

  const { draft: originalDraft, initialUserPrompt } = draftData;

  const champion = await prisma.champion.findUnique({
    where: { id: championId },
  });

  if (!champion) {
    await interaction.editReply("Champion not found.");
    return;
  }

  const messages: OpenRouterMessage[] = [
    { role: "system", content: abilityDraftPrompt },
    { role: "user", content: initialUserPrompt },
    { role: "assistant", content: JSON.stringify(originalDraft, null, 2) },
    {
      role: "user",
      content: `User Suggestions: "${suggestions}"\n\nPlease apply these suggestions and return the complete, updated JSON object. Remember to strictly follow all the rules. Generate ONLY the updated JSON object.`,
    },
  ];

  logger.info("Sending request to LLM for draft update.");
  const response = await openRouterService.chat({
    model: "google/gemini-2.5-pro",
    messages: messages,
    response_format: { type: "json_object" },
  });
  logger.info("Received response from LLM for draft update.");

  const newDraft = JSON.parse(response.choices[0].message.content);
  logger.info({ newDraft }, "Parsed new draft from LLM response");

  pendingDrafts.set(championId.toString(), {
    draft: newDraft,
    initialUserPrompt: initialUserPrompt,
  });

  const newContainer = buildDraftContainerV2(
    champion.name,
    champion.id,
    newDraft
  );

  await interaction.message?.edit(newContainer);

  await interaction.editReply({
    content: "Draft updated with your suggestions.",
  });
}
export function registerAbilityDraftHandlers() {
  registerButtonHandler("confirm-ability-draft_", handleConfirmAbilityDraft);
  registerButtonHandler("cancel-ability-draft", handleCancelAbilityDraft);
  registerButtonHandler("suggest-ability-draft_", handleSuggestEdits);
  registerModalHandler("suggest-ability-modal_", handleSuggestEditsModal);
}

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import {
  getChampionByName,
  getChampionById,
} from "../../../services/championService";
import { AttackType } from "@prisma/client";
import logger from "../../../services/loggerService";

import { registerModalHandler } from "../../../utils/modalHandlerRegistry";
import { registerButtonHandler } from "../../../utils/buttonHandlerRegistry";

export async function handleAttackAddModal(
  interaction: ModalSubmitInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const championName = interaction.customId.split("_")[3];
  const champion = await getChampionByName(championName);

  if (!champion) {
    await interaction.editReply(`Champion "${championName}" not found.`);
    return;
  }

  const attackTypesRaw = interaction.fields.getTextInputValue("attackType");
  const hitsRaw = interaction.fields.getTextInputValue("hits");

  // 1. Parse and validate attack types
  const attackTypeStrings = attackTypesRaw
    .split(",")
    .map((t: string) => t.trim().toUpperCase());
  const validTypes: AttackType[] = [];
  const invalidTypes: string[] = [];

  for (const typeStr of attackTypeStrings) {
    if (Object.values(AttackType).includes(typeStr as any)) {
      validTypes.push(typeStr as AttackType);
    } else {
      invalidTypes.push(typeStr);
    }
  }

  if (invalidTypes.length > 0) {
    await interaction.editReply(
      `Invalid Attack Type(s): ${invalidTypes.join(", ")}. Valid types are: ${Object.values(
        AttackType
      ).join(", ")}`
    );
    return;
  }

  if (validTypes.length === 0) {
    await interaction.editReply(`You must provide at least one valid attack type.`);
    return;
  }

  // 2. Parse hits
  const hitsProperties = hitsRaw
    .split("\n")
    .map((line: string) =>
      line
        .trim()
        .split(" ")
        .filter((p: string) => p)
    )
    .filter((arr: string[]) => arr.length > 0);

  if (hitsProperties.length === 0) {
    await interaction.editReply("You must provide at least one hit.");
    return;
  }

  try {
    // 3. Loop and process attacks
    const processedAttacks: string[] = [];

    for (const attackType of validTypes) {
      // Use a transaction to first delete all existing attacks of this type for the champion,
      // then create the new one. This ensures the operation is atomic and handles updates correctly.
      await prisma.$transaction([
        prisma.attack.deleteMany({
          where: {
            championId: champion.id,
            type: attackType,
          },
        }),
        prisma.attack.create({
          data: {
            championId: champion.id,
            type: attackType,
            hits: {
              create: hitsProperties.map((properties: string[]) => ({ properties })),
            },
          },
        }),
      ]);
      processedAttacks.push(attackType);
    }

    // 4. Formulate response
    let response = "";
    if (processedAttacks.length > 0) {
      response += `Successfully created/updated attacks: ${processedAttacks.join(
        ", "
      )}.`;
    } else {
      response = "No attacks were processed.";
    }

    logger.info(
      `User ${interaction.user.username} processed attacks for ${champion.name}. Processed: [${processedAttacks.join(", ")}]`
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin_attack_add-more_${champion.id}`)
        .setLabel("Add More")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ content: response.trim(), components: [row] });
  } catch (error) {
    logger.error({ error }, "Error processing attack(s)");
    await interaction.editReply(
      "An error occurred while processing the attack(s)."
    );
  }
}

export async function handleAttackAddMore(interaction: ButtonInteraction) {
  const championId = parseInt(interaction.customId.split("_")[3]);
  const champion = await getChampionById(championId);

  if (!champion) {
    await interaction.reply({ content: "Champion not found.", ephemeral: true });
    return;
  }

  const titlePrefix = "Add Attack for ";
  const maxNameLength = 45 - titlePrefix.length;
  const displayName =
    champion.name.length > maxNameLength
      ? `${champion.name.substring(0, maxNameLength - 3)}...`
      : champion.name;

  const modal = new ModalBuilder()
    .setCustomId(`admin_attack_add_${champion.name}`)
    .setTitle(`${titlePrefix}${displayName}`);

  const attackTypeInput = new TextInputBuilder()
    .setCustomId("attackType")
    .setLabel("Attack Type (e.g., M1, S1, S2)")
    .setPlaceholder("Comma-separated: M1, M2, S1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const hitsInput = new TextInputBuilder()
    .setCustomId("hits")
    .setLabel("Hit Properties (one per line)")
    .setPlaceholder("e.g., BEAM\n- NR\n- P")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    attackTypeInput
  );
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    hitsInput
  );

  modal.addComponents(firstActionRow, secondActionRow);

  await interaction.showModal(modal);
}

registerModalHandler("admin_attack_add_", handleAttackAddModal);
registerButtonHandler("admin_attack_add-more_", handleAttackAddMore);

import {
  CommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

export async function handleChampionAdd(interaction: CommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("addChampionModalPart1")
    .setTitle("Add New Champion (Part 1/2)");

  const nameInput = new TextInputBuilder()
    .setCustomId("championName")
    .setLabel("Full Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const shortNameInput = new TextInputBuilder()
    .setCustomId("championShortName")
    .setLabel("Short Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const classInput = new TextInputBuilder()
    .setCustomId("championClass")
    .setLabel("Class (Science, Skill, etc.)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const primaryImageInput = new TextInputBuilder()
    .setCustomId("championPrimaryImage")
    .setLabel("Primary Image URL (Portrait)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const secondaryImageInput = new TextInputBuilder()
    .setCustomId("championSecondaryImage")
    .setLabel("Secondary Image URL (Featured)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(shortNameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(classInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(primaryImageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      secondaryImageInput
    )
  );

  await interaction.showModal(modal);
}

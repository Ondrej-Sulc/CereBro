import {
    CommandInteraction,
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from "discord.js";

export async function showChampionModalPart2(
    interaction: CommandInteraction | ButtonInteraction
) {
    const modal = new ModalBuilder()
      .setCustomId("addChampionModalPart2")
      .setTitle("Add New Champion (Part 2/2)");

    const tagsImageInput = new TextInputBuilder()
      .setCustomId("championTagsImage")
      .setLabel("Tags Image URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const heroImageInput = new TextInputBuilder()
      .setCustomId("championHeroImage")
      .setLabel("Hero Image URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const releaseDateInput = new TextInputBuilder()
      .setCustomId("championReleaseDate")
      .setLabel("Release Date (YYYY-MM-DD)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const obtainableRangeInput = new TextInputBuilder()
      .setCustomId("championObtainableRange")
      .setLabel('Obtainable Range (e.g., "2-7")')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue("2-7");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(tagsImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(heroImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(releaseDateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        obtainableRangeInput
      )
    );

    await interaction.showModal(modal);
}

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  RoleSelectMenuBuilder,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";

export const command: Command = {
  access: CommandAccess.ALLIANCE_ADMIN, // Restricted to admins
  help: {
    group: "Alliance Tools",
    color: "blue",
  },
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Interactive setup wizard for CereBro configuration"),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle("🛠️ CereBro Setup Wizard")
      .setDescription(
        "Welcome to the CereBro setup! This wizard will guide you through the essential configuration steps.\n\n" +
        "**What we'll do:**\n" +
        "1. **Alliance Roles:** Map your Discord roles to Alliance Officers and Battlegroups.\n" +
        "2. **Sync:** Automatically apply these permissions to your members.\n" +
        "\n" +
        "Click **Start Setup** to begin."
      )
      .setColor(0x0ea5e9); // Sky 500

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("setup:step1_intro")
        .setLabel("Start Setup")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🚀")
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};

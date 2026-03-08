import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { prisma } from "../../services/prismaService.js";

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
    const guildId = interaction.guildId;
    if (!guildId) return;

    const alliances = await prisma.alliance.findMany({
      where: { guildId },
    });

    if (alliances.length === 0) {
      await interaction.reply({
        content: "No alliance record found for this server. Please re-invite the bot or run `/alliance create`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (alliances.length > 1) {
      const embed = new EmbedBuilder()
        .setTitle("🏢 Select Alliance to Configure")
        .setDescription(
          "This server has multiple alliances registered. Please select which one you would like to configure with this setup wizard."
        )
        .setColor(0x0ea5e9);

      const select = new StringSelectMenuBuilder()
        .setCustomId("setup:select_alliance")
        .setPlaceholder("Choose an alliance...")
        .addOptions(
          alliances.slice(0, 25).map((a) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(a.name)
              .setValue(a.id)
              .setDescription(`ID: ${a.id}`)
          )
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Only one alliance, proceed to intro
    const alliance = alliances[0];
    const embed = new EmbedBuilder()
      .setTitle("🛠️ CereBro Setup Wizard")
      .setDescription(
        `Welcome to the CereBro setup for **${alliance.name}**! This wizard will guide you through the essential configuration steps.\n\n` +
        "**What we'll do:**\n" +
        "1. **Alliance Roles:** Map your Discord roles to Alliance Officers and Battlegroups.\n" +
        "2. **Sync:** Automatically apply these permissions to your members.\n" +
        "\n" +
        "Click **Start Setup** to begin."
      )
      .setColor(0x0ea5e9); // Sky 500

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup:action:step1_intro:${alliance.id}`)
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

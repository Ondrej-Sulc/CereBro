import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { safeReply } from "../../utils/errorHandler";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your first in-game profile with the bot.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Your in-game name.")
        .setRequired(true)
    ),
  access: CommandAccess.PUBLIC,

  help: {
    group: "User Management",
    color: "pink",
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const { prisma } = await import("../../services/prismaService.js");
    await interaction.deferReply({ ephemeral: true });
    const ingameName = interaction.options.getString("name", true);
    const discordId = interaction.user.id;
    const avatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

    const botUser = await prisma.botUser.upsert({
      where: { discordId },
      update: {},
      create: { discordId }
    });

    const anyProfile = await prisma.player.findFirst({
      where: { botUserId: botUser.id },
    });

    if (anyProfile) {
      await safeReply(interaction, "You are already registered. Use `/profile add` to add another account, or `/profile rename` to change an existing profile's name.");
      return;
    }

    // This is the user's first registration.
    const guild = interaction.guild;
    let allianceId: string | null = null;

    if (guild) {
      const alliance = await prisma.alliance.findUnique({
          where: { guildId: guild.id },
      });
      if(alliance) {
          allianceId = alliance.id;
      }
    }

    const newPlayer = await prisma.player.create({
      data: {
        discordId,
        ingameName,
        avatar,
        allianceId,
        isActive: true, // First profile is active
        botUserId: botUser.id
      },
    });

    await prisma.botUser.update({
        where: { id: botUser.id },
        data: { activeProfileId: newPlayer.id }
    });

    await safeReply(interaction, `✅ Successfully registered **${ingameName}**. It has been set as your active profile.`);
  },
};

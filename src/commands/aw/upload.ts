import {
  CommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import loggerService from '../../services/loggerService';
import crypto from 'crypto';

export async function handleUploadSubcommand(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  const { prisma } = await import('../../services/prismaService.js');
  const { config } = await import('../../config.js');

  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;

  try {
    const player = await prisma.player.findFirst({
      where: { discordId: discordId },
    });

    if (!player) {
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xff0000)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('You need to register your in-game name first using the `/register` command.')
        );
      await interaction.editReply({
        components: [errorContainer],
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.uploadToken.create({
      data: {
        token: token,
        playerId: player.id,
        expiresAt: expiresAt,
      },
    });

    const uploadUrl = `${config.botBaseUrl}/war-videos/upload?token=${token}`;

    const container = new ContainerBuilder()
      .setAccentColor(0xFFD700)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'Click the button below to upload your Alliance War video. This link is valid for 15 minutes.'
        )
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setURL(uploadUrl)
        .setLabel('Upload Video')
        .setStyle(ButtonStyle.Link)
    );

    await interaction.editReply({
      components: [container, actionRow],
      flags: [MessageFlags.IsComponentsV2],
    });

    loggerService.info({ discordId, token, expiresAt }, 'Generated upload token for player.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    loggerService.error({ discordId, error: errorMessage, stack: errorStack }, 'Failed to generate upload link for player.');
    
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xff0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('An error occurred while generating your upload link. Please try again later.')
      );
    await interaction.editReply({
      components: [errorContainer],
      flags: [MessageFlags.IsComponentsV2],
    });
  }
}

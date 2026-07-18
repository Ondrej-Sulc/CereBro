import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import loggerService from '../../services/loggerService';
import { getYouTubeService } from '../../services/youtubeService';
import { WarVideo, Player, WarVideoStatus } from '@prisma/client';

export const data = new SlashCommandBuilder()
  .setName('admin-war-video')
  .setDescription('Administrative commands for managing war videos.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('approve')
      .setDescription('Approves a pending war video and trusts the uploader.')
      .addStringOption(option =>
        option.setName('video_id')
          .setDescription('The ID of the video to approve.')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reject')
      .setDescription('Rejects a pending war video.')
      .addStringOption(option =>
        option.setName('video_id')
          .setDescription('The ID of the video to reject.')
          .setRequired(true)
      )
  );

export async function execute(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  const { prisma } = await import('../../services/prismaService.js');
  const youTubeService = getYouTubeService();
  const subcommand = interaction.options.getSubcommand();
  const videoId = interaction.options.getString('video_id', true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const warVideo: (WarVideo & { submittedBy: Player }) | null = await prisma.warVideo.findUnique({
      where: { id: videoId },
      include: { submittedBy: true },
    });

    if (!warVideo) {
      await interaction.editReply(`Video with ID ${videoId} not found.`);
      return;
    }

    if (subcommand === 'approve') {
      if (warVideo.status !== WarVideoStatus.UPLOADED) {
        await interaction.editReply(`Video ${videoId} is not pending approval. Current status: ${warVideo.status}`);
        return;
      }

      if (!warVideo.url) {
        await interaction.editReply('Video has no URL.');
        return;
      }

      // 1. Update video on YouTube to 'unlisted'
      // Assuming the URL is a YouTube URL for now, as the service is YouTube specific.
      const youtubeId = youTubeService.getVideoId(warVideo.url);
      if (!youtubeId) {
        await interaction.editReply('Could not parse YouTube video ID from URL. Ensure it is a valid YouTube URL.');
        return;
      }
      await youTubeService.updateVideoPrivacy(youtubeId, 'unlisted');

      // 2. Update player to be a trusted uploader
      await prisma.player.update({
        where: { id: warVideo.submittedById },
        data: { isTrustedUploader: true },
      });

      // 3. Update video status in DB
      await prisma.warVideo.update({
        where: { id: videoId },
        data: { status: WarVideoStatus.PUBLISHED },
      });

      await interaction.editReply(`Video ${videoId} has been approved. The uploader ${warVideo.submittedBy.ingameName} is now a trusted uploader.`);
      loggerService.info({ videoId, admin: interaction.user.tag }, 'Admin approved war video.');

    } else if (subcommand === 'reject') {
      // 1. Delete video from YouTube
      // Assuming the URL is a YouTube URL for now, as the service is YouTube specific.
      if (warVideo.url) {
        const youtubeId = youTubeService.getVideoId(warVideo.url);
        if (youtubeId) {
          await youTubeService.deleteVideo(youtubeId);
        }
      }

      // 2. Delete video from DB
      await prisma.warVideo.delete({
        where: { id: videoId },
      });

      await interaction.editReply(`Video ${videoId} has been rejected and deleted.`);
      loggerService.info({ videoId, admin: interaction.user.tag }, 'Admin rejected war video.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage, videoId }, 'Error in admin-war-video command.');
    await interaction.editReply('An error occurred while processing your request.');
  }
}

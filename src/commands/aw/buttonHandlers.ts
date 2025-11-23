import { randomBytes } from "crypto";
import {
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { add } from "date-fns";

export async function handleGenerateUploadLink(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const [_, warId, playerId] = interaction.customId.split(":");

  if (!warId || !playerId) {
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xff0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Invalid button ID.')
      );
    await interaction.editReply({
      components: [errorContainer],
      flags: [MessageFlags.IsComponentsV2],
    });
    return;
  }

  const fights = await prisma.warFight.findMany({
    where: {
      warId: warId,
      playerId: playerId,
      videoId: null, // Only include fights that don't have a video yet
    },
    select: {
      id: true,
    },
  });

  if (fights.length === 0) {
    const infoContainer = new ContainerBuilder()
      .setAccentColor(0x87CEEB) // Using 'sky' to match the /aw command color
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('There are no fights in this plan that still need a video uploaded.')
      );
    await interaction.editReply({
      components: [infoContainer],
      flags: [MessageFlags.IsComponentsV2],
    });
    return;
  }

  const fightIds = fights.map((f) => f.id);
  const token = randomBytes(32).toString("hex");

  const session = await prisma.uploadSession.create({
    data: {
      token,
      fightIds: fightIds,
      expiresAt: add(new Date(), { hours: 24 }), // Session expires in 24 hours
    },
  });

  const uploadUrl = `${process.env.BOT_BASE_URL}/war-videos/upload?session_token=${session.token}`;

  const container = new ContainerBuilder()
    .setAccentColor(0x87CEEB) // Match /aw command color
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Click the button below to open your unique upload link. It will expire in 24 hours.'
      )
    );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setURL(uploadUrl)
      .setLabel("Upload Video(s)")
      .setStyle(ButtonStyle.Link)
  );

  await interaction.editReply({
    components: [container, actionRow],
    flags: [MessageFlags.IsComponentsV2],
  });
}
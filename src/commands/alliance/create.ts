import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { prisma } from '../../services/prismaService.js';
import logger from '../../services/loggerService.js';

export async function handleAllianceCreate(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply({ content: 'This command can only be used in a server.' });
    return;
  }

  try {
    const alliance = await prisma.alliance.create({
      data: {
        guildId,
        name,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Alliance Created')
      .setDescription(`Successfully created alliance **${name}** for this server.`)
      .addFields({ name: 'Alliance ID', value: `\`${alliance.id}\`` })
      .setColor(0x10b981) // Emerald 500
      .setFooter({ text: 'Use /setup to configure this alliance.' });

    await interaction.editReply({ embeds: [embed] });
    logger.info({ guildId, allianceId: alliance.id, allianceName: name }, `New alliance "${name}" created via /alliance create`);

  } catch (error) {
    logger.error({ error: String(error), guildId }, 'Error creating additional alliance');
    await interaction.editReply({ content: 'An error occurred while creating the alliance.' });
  }
}

import { ChatInputCommandInteraction, ContainerBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, SeparatorBuilder } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { getChampionData } from '../../services/championService';
import { createEmojiResolver } from '../../utils/emojiResolver';
import { CLASS_COLOR } from '../champion/view';

export async function handleAllianceFindChampion(interaction: ChatInputCommandInteraction) {
  const championName = interaction.options.getString('champion', true);
  const battlegroupFilter = interaction.options.getInteger('battlegroup');

  // Verify champion exists
  const championData = await getChampionData(championName);
  if (!championData) {
      await interaction.editReply({ content: `Champion "${championName}" not found.` });
      return;
  }

  // Get the player to find their alliance
  const player = await prisma.player.findFirst({
      where: { discordId: interaction.user.id },
      select: { allianceId: true }
  });

  if (!player || !player.allianceId) {
      await interaction.editReply({ content: 'You must be part of an alliance to use this command.' });
      return;
  }

  const whereClause: any = {
    champion: { name: championData.name },
    player: {
      allianceId: player.allianceId
    }
  };

  if (battlegroupFilter) {
    whereClause.player.battlegroup = battlegroupFilter;
  }

  const rosterEntries = await prisma.roster.findMany({
    where: whereClause,
    include: {
      player: true,
      champion: true
    },
    orderBy: [
        { stars: 'desc' },
        { rank: 'desc' },
        { isAscended: 'desc' },
        { isAwakened: 'desc' }
    ]
  });

  const resolveEmoji = createEmojiResolver(interaction.client);
  const championEmoji = championData.discordEmoji ? resolveEmoji(championData.discordEmoji) : '';

  const container = new ContainerBuilder();
  container.setAccentColor(CLASS_COLOR[championData.class]);

  if (rosterEntries.length === 0) {
      container.addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`${championEmoji} **${championData.name}**\n\nNo alliance members found with this champion${battlegroupFilter ? ` in Battlegroup ${battlegroupFilter}` : ''}.`)
      );
      
      await interaction.editReply({
          components: [container],
          flags: [MessageFlags.IsComponentsV2]
      });
      return;
  }

  // Group by Battlegroup
  const groupedByBg: Record<string, typeof rosterEntries> = {};
  
  rosterEntries.forEach(entry => {
      const bg = entry.player.battlegroup || 0;
      const key = bg.toString();
      if (!groupedByBg[key]) groupedByBg[key] = [];
      groupedByBg[key].push(entry);
  });

  // Helper to format a roster line
  const formatEntry = (entry: typeof rosterEntries[0]) => {
      const { stars, rank, isAwakened, isAscended, player } = entry;
      const starStr = `${stars}★`;
      const rankStr = `R${rank}`;
      const ascendedStr = isAscended ? ' 🏆' : '';
      const awakenedStr = isAwakened ? ' ★' : '☆';
      
      // Use monospaced block for stats to align nicely? Or just bold player name.
      return `- **${player.ingameName}**: ${awakenedStr}${starStr}* ${rankStr}${ascendedStr}`;
  };

  let headerContent = `## ${championEmoji} **${championData.name}** - Roster Search\n`;
  if (battlegroupFilter) {
      headerContent += `*Filtering by Battlegroup ${battlegroupFilter}*\n`;
  }
  
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent));

  const bgs = [1, 2, 3, 0];

  bgs.forEach(bg => {
      const entries = groupedByBg[bg.toString()];
      if (entries && entries.length > 0) {
          container.addSeparatorComponents(new SeparatorBuilder());

          const bgTitle = bg === 0 ? 'No Battlegroup' : `Battlegroup ${bg}`;
          let bgContent = `### ${bgTitle}\n`;
          entries.forEach(entry => {
              bgContent += `${formatEntry(entry)}\n`;
          });
          
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bgContent));
      }
  });

  await interaction.editReply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2]
  });
}

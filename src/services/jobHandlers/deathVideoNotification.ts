import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../../config';
import { getEmoji } from '../../commands/aw/utils';
import logger from '../../services/loggerService';

export async function handleDeathVideoNotification(client: Client, payload: any) {
    const { channelId, videoId, mediaUrl, title, description, uploaderName, season, warNumber, fights, totalDeaths } = payload;

    logger.info({ videoId, channelId, totalDeaths }, 'Handling Death Video Notification');

    try {
        if (!channelId || !videoId || !uploaderName) {
            throw new Error("Invalid payload: Missing required fields for death video notification");
        }

        const channel = await client.channels.fetch(channelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            throw new Error(`Channel ${channelId} not found or not text-based`);
        }
        logger.debug({ channelId, channelName: channel.name }, 'Channel fetched successfully');

        const videoPageUrl = `${config.botBaseUrl}/war-videos/${videoId}`;
        
        let warDisplay = `Season ${season}`;
        if (warNumber && warNumber !== 0) {
            warDisplay += ` War ${warNumber}`;
        } else {
            warDisplay += ` Offseason`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xef4444) // Red 500
            .setTitle(`💀 Death Reported: ${title || 'Untitled Video'}`)
            .setURL(mediaUrl || videoPageUrl);

        if (description) {
            embed.setDescription(description);
        }

        // Fights List (only showing fights with deaths)
        if (fights && Array.isArray(fights) && fights.length > 0) {
            const deathFights = fights.filter((f: any) => f.death > 0);
            
            if (deathFights.length > 0) {
                logger.debug({ videoId, deathFightsCount: deathFights.length }, 'Processing death fights for embed');
                
                const fightLines = await Promise.all(deathFights.map(async (f: any) => {
                    try {
                        const attackerEmoji = await getEmoji(f.attackerName, client);
                        const defenderEmoji = await getEmoji(f.defenderName, client);
                        const deathCount = f.death > 1 ? ` (${f.death} deaths)` : '';
                        
                        return `- ${attackerEmoji} **${f.attackerName}** vs ${defenderEmoji} **${f.defenderName}** (Node ${f.nodeNumber})${deathCount}` +
                        (f.playerInVideo !== uploaderName ? ` by *${f.playerInVideo}*` : '');
                    } catch (err) {
                        logger.error({ error: err, fight: f }, 'Error processing fight emoji for death notification');
                        return `- **${f.attackerName}** vs **${f.defenderName}** (Node ${f.nodeNumber})`;
                    }
                }));
                
                const fightsList = fightLines.join('\n');
                embed.addFields({ name: 'Fights with Deaths', value: fightsList });
            }
        }

        // Metadata
        embed.addFields(
            { name: '👤 Submitted by', value: uploaderName, inline: true },
            { name: '📅 War', value: warDisplay, inline: true },
            { name: '💀 Total Deaths', value: String(totalDeaths), inline: true }
        );

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('View in CereBro')
                .setStyle(ButtonStyle.Link)
                .setURL(videoPageUrl)
                .setEmoji('🔗')
        );
        
        logger.info({ videoId, channelId }, 'Sending Discord messages');

        if (mediaUrl) {
            await channel.send({ content: mediaUrl });
        }

        await channel.send({
            embeds: [embed],
            components: [actionRow]
        });

        logger.info({ videoId }, 'Death Video Notification sent successfully');
    } catch (error) {
        logger.error({ error, videoId, channelId }, 'Failed to handle Death Video Notification');
        throw error;
    }
}

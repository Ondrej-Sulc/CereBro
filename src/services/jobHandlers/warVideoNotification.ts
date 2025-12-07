import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../../config';
import { getEmoji } from '../../commands/aw/utils';

export async function handleWarVideoNotification(client: Client, payload: any) {
    const { channelId, videoId, mediaUrl, title, description, uploaderName, season, warNumber, fights } = payload;

    if (!channelId || !videoId || !uploaderName) {
        throw new Error("Invalid payload: Missing required fields for war video notification");
    }

    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not text-based`);
    }

    const videoPageUrl = `${config.botBaseUrl}/war-videos/${videoId}`;
    
    let warDisplay = `Season ${season}`;
    if (warNumber && warNumber !== 0) {
        warDisplay += ` War ${warNumber}`;
    } else {
        warDisplay += ` Offseason`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0ea5e9) // Sky 500
        .setTitle(`🎥 ${title || 'Untitled Video'}`)
        .setURL(mediaUrl || videoPageUrl);

    if (description) {
        embed.setDescription(description);
    }

    // Fights List
    if (fights && Array.isArray(fights) && fights.length > 0) {
        const fightLines = await Promise.all(fights.map(async (f: any) => {
            const attackerEmoji = await getEmoji(f.attackerName, client);
            const defenderEmoji = await getEmoji(f.defenderName, client);
            
            return `- ${attackerEmoji} **${f.attackerName}** vs ${defenderEmoji} **${f.defenderName}** (Node ${f.nodeNumber})` + 
            (f.playerInVideo !== uploaderName ? ` by *${f.playerInVideo}*` : '');
        }));
        
        const fightsList = fightLines.join('\n');
        embed.addFields({ name: 'Fights', value: fightsList });
    }

    // Metadata
    embed.addFields(
        { name: '👤 Submitted by', value: uploaderName, inline: true },
        { name: '📅 War', value: warDisplay, inline: true }
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel('View in CereBro')
            .setStyle(ButtonStyle.Link)
            .setURL(videoPageUrl)
            .setEmoji('🔗')
    );
    
    if (mediaUrl) {
        await channel.send({ content: mediaUrl });
    }

    await channel.send({ 
        embeds: [embed],
        components: [actionRow]
    });

}

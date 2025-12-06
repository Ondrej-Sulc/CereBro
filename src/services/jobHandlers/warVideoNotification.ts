import { Client, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../../config';

export async function handleWarVideoNotification(client: Client, payload: any) {
    const { channelId, videoId, title, description, uploaderName, season, warNumber, fights } = payload;

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
        warDisplay += ` • War ${warNumber}`;
    } else {
        warDisplay += ` • Offseason`;
    }

    const container = new ContainerBuilder()
        .setAccentColor(0x0ea5e9); // Sky 500

    // Header and Title
    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(`# 🎥 New War Video Uploaded\n### ${title || 'Untitled Video'}`)
    );

    // Description (if present)
    if (description) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`> ${description}`)
        );
    }

    // Fights List
    if (fights && Array.isArray(fights) && fights.length > 0) {
        const fightsList = fights.map((f: any) => 
            `- **${f.attackerName}** vs **${f.defenderName}** (Node ${f.nodeNumber})` + 
            (f.playerInVideo !== uploaderName ? ` by *${f.playerInVideo}*` : '')
        ).join('\n');
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Fights:**\n${fightsList}`)
        );
    }

    // Metadata
    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(`**👤 Uploader:** ${uploaderName}\n**📅 War:** ${warDisplay}`)
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel('Watch Video')
            .setStyle(ButtonStyle.Link)
            .setURL(videoPageUrl)
            .setEmoji('▶️')
    );

    await channel.send({
        components: [container, actionRow],
        flags: [MessageFlags.IsComponentsV2] 
    });
}

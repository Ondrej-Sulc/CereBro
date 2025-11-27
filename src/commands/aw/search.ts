import {
    ChatInputCommandInteraction,
    ContainerBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    AutocompleteInteraction,
} from 'discord.js';
import { prisma } from '../../services/prismaService';

export async function handleSearchAutocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    const value = focusedOption.value.toString();

    if (focusedOption.name === 'attacker' || focusedOption.name === 'defender') {
        const champions = await prisma.champion.findMany({
            where: {
                OR: [
                    { name: { contains: value, mode: 'insensitive' } },
                    { shortName: { contains: value, mode: 'insensitive' } }
                ]
            },
            take: 25,
            select: { name: true }
        });
        await interaction.respond(
            champions.map(c => ({ name: c.name, value: c.name }))
        );
    } else if (focusedOption.name === 'player') {
        const players = await prisma.player.findMany({
            where: {
                ingameName: { contains: value, mode: 'insensitive' }
            },
            take: 25,
            select: { ingameName: true }
        });
        await interaction.respond(
            players.map(p => ({ name: p.ingameName, value: p.ingameName }))
        );
    } else if (focusedOption.name === 'node') {
        const allNodes = await prisma.warNode.findMany({
            orderBy: { nodeNumber: 'asc' }
        });
        const filtered = allNodes
            .filter(n => n.nodeNumber.toString().includes(value))
            .slice(0, 25);
        
        await interaction.respond(
            filtered.map(n => ({ name: `Node ${n.nodeNumber}`, value: n.nodeNumber }))
        );
    } else if (focusedOption.name === 'tier') {
        const tiers = await prisma.war.groupBy({
            by: ['warTier'],
            orderBy: { warTier: 'asc' }
        });
        const filtered = tiers
            .filter(t => t.warTier.toString().includes(value))
            .slice(0, 25);
        await interaction.respond(
            filtered.map(t => ({ name: `Tier ${t.warTier}`, value: t.warTier }))
        );
    } else if (focusedOption.name === 'season') {
        const seasons = await prisma.war.groupBy({
            by: ['season'],
            orderBy: { season: 'desc' }
        });
        const filtered = seasons
            .filter(s => s.season.toString().includes(value))
            .slice(0, 25);
        await interaction.respond(
            filtered.map(s => ({ name: `Season ${s.season}`, value: s.season }))
        );
    } else {
        await interaction.respond([]);
    }
}

export async function handleSearchSubcommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;
    const player = await prisma.player.findFirst({
        where: { discordId },
        select: { allianceId: true }
    });

    const attackerName = interaction.options.getString('attacker');
    const defenderName = interaction.options.getString('defender');
    const playerName = interaction.options.getString('player');
    const nodeNumber = interaction.options.getInteger('node');
    const tier = interaction.options.getInteger('tier');
    const season = interaction.options.getInteger('season');
    const hasVideo = interaction.options.getBoolean('has_video');

    if (!attackerName && !defenderName && !playerName && !nodeNumber && !tier && !season && hasVideo === null) {
        await interaction.editReply('Please provide at least one search criteria.');
        return;
    }

    try {
        const fights = await prisma.warFight.findMany({
            where: {
                AND: [
                    season ? { war: { season } } : {},
                    tier ? { war: { warTier: tier } } : {},
                    nodeNumber ? { node: { nodeNumber } } : {},
                    playerName ? { player: { ingameName: { contains: playerName, mode: 'insensitive' } } } : {},
                    attackerName ? { attacker: { name: { contains: attackerName, mode: 'insensitive' } } } : {},
                    defenderName ? { defender: { name: { contains: defenderName, mode: 'insensitive' } } } : {},
                    hasVideo !== null ? (hasVideo ? { videoId: { not: null } } : { videoId: null }) : {},
                    // Visibility check:
                    // 1. Video is PUBLIC and PUBLISHED
                    // 2. OR User is in the alliance that fought this war (covers Alliance-Private videos and Log-Only fights)
                    {
                        OR: [
                            {
                                video: {
                                    status: 'PUBLISHED',
                                    visibility: 'public'
                                }
                            },
                            ...(player?.allianceId ? [{
                                war: { allianceId: player.allianceId }
                            }] : [])
                        ]
                    }
                ]
            },
            include: {
                attacker: true,
                defender: true,
                node: true,
                war: true,
                player: true,
                video: {
                    include: { submittedBy: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        if (fights.length === 0) {
            await interaction.editReply('No fights found matching your criteria.');
            return;
        }

        const { config } = await import('../../config.js');
        const container = new ContainerBuilder()
            .setAccentColor(0x0099FF) // Sky blue
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Found ${fights.length} fights** (showing top 10)`)
            );

        // Add a link button to the web search for full results
        const queryParams = new URLSearchParams();
        if (attackerName) queryParams.append('attacker', attackerName);
        if (defenderName) queryParams.append('defender', defenderName);
        if (playerName) queryParams.append('player', playerName);
        if (season) queryParams.append('season', season.toString());
        if (tier) queryParams.append('tier', tier.toString());
        if (nodeNumber) queryParams.append('node', nodeNumber.toString());
        if (hasVideo !== null) queryParams.append('hasVideo', hasVideo.toString());
        
        const webSearchUrl = `${config.botBaseUrl}/war-videos?${queryParams.toString()}`;

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('View All Results on Web')
                .setURL(webSearchUrl)
                .setStyle(ButtonStyle.Link)
        );
        
        const fightListText = fights.map(f => {
            const attackerName = f.attacker?.name || 'Unknown';
            const defenderName = f.defender?.name || 'Unknown';
            const playerName = f.player?.ingameName || 'Unknown';

            const title = `**${attackerName}** vs **${defenderName}** (Node ${f.node.nodeNumber})`;
            const meta = `S${f.war.season} T${f.war.warTier} • ${playerName}`;
            const videoIcon = f.video ? '🎥 ' : '';
            const link = f.video ? `[Watch](${config.botBaseUrl}/war-videos/${f.video.id})` : '';
            return `${videoIcon} ${title} - ${meta} ${link}`;
        }).join('\n');
        
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fightListText));

        await interaction.editReply({
            components: [container, actionRow],
            flags: [MessageFlags.IsComponentsV2],
        });

    } catch (error) {
        console.error('Search error:', error);
        await interaction.editReply('An error occurred while searching.');
    }
}

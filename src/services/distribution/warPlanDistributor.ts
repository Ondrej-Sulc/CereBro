import { Client, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadChannel, AttachmentBuilder, ChannelType, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder } from 'discord.js';
import { prisma } from '../prismaService';
import { getEmoji, capitalize } from '../../commands/aw/utils';
import { MapImageService, NodeAssignment } from '../mapImageService';
import { warNodesData, warNodesDataBig } from '../../data/war-planning/nodes-data';
import { WarMapType } from '@prisma/client';
import logger from '../loggerService';
import { getChampionImageUrl } from '../../utils/championHelper';

export interface DistributeResult {
    sent: string[];
    notFound: string[];
    noData: string[];
    errors: string[];
}

export async function distributeWarPlan(
    client: Client, 
    allianceId: string, 
    warId: string, 
    targetBattlegroup?: number,
    targetPlayerId?: string
): Promise<DistributeResult> {
    const result: DistributeResult = { sent: [], notFound: [], noData: [], errors: [] };

    const alliance = await prisma.alliance.findUnique({ where: { id: allianceId } });
    if (!alliance) {
        result.errors.push("Alliance not found");
        return result;
    }

    const war = await prisma.war.findUnique({
        where: { id: warId },
        include: {
            fights: {
                where: targetBattlegroup ? { battlegroup: targetBattlegroup } : undefined,
                include: {
                    attacker: true,
                    defender: true,
                    node: true,
                    player: true,
                    prefightChampions: { include: { champion: true } }
                }
            }
        }
    });

    if (!war) {
        result.errors.push("War not found");
        return result;
    }

    // 1. Prepare Global Node & Image Data
    const bgNodeMaps = new Map<number, Map<number, NodeAssignment>>();
    const uniqueImageUrls = new Set<string>();

    for (const fight of war.fights) {
        if (!bgNodeMaps.has(fight.battlegroup)) {
            bgNodeMaps.set(fight.battlegroup, new Map());
        }
        
        let defenderImage: string | undefined;
        if (fight.defender?.images) {
            defenderImage = getChampionImageUrl(fight.defender.images, '128', 'primary');
            uniqueImageUrls.add(defenderImage);
        }

        let attackerImage: string | undefined;
        if (fight.attacker?.images) {
            attackerImage = getChampionImageUrl(fight.attacker.images, '128', 'primary');
            uniqueImageUrls.add(attackerImage);
        }

        // Collect Prefight Images
        if (fight.prefightChampions?.length > 0) {
            for (const pf of fight.prefightChampions) {
                if (pf.champion?.images) {
                    const pfImg = getChampionImageUrl(pf.champion.images, '128', 'primary');
                    uniqueImageUrls.add(pfImg);
                }
            }
        }

        bgNodeMaps.get(fight.battlegroup)!.set(fight.node.nodeNumber, {
            defenderName: fight.defender?.name,
            defenderImage,
            attackerImage,
            isTarget: false // Default
        });
    }

    const globalImageCache = await MapImageService.preloadImages(Array.from(uniqueImageUrls));

    // Group fights by Player
    const playerFights = new Map<string, any[]>();
    for (const fight of war.fights) {
        if (!fight.playerId || !fight.player) continue;
        if (targetPlayerId && fight.playerId !== targetPlayerId) continue;

        const name = fight.player.ingameName.toLowerCase();
        if (!playerFights.has(name)) playerFights.set(name, []);
        playerFights.get(name)!.push(fight);
    }

    if (playerFights.size === 0) {
        result.noData.push("No fights found for this war/battlegroup");
        return result;
    }

    // Pre-process Prefights (Who places what)
    // Map<PlayerID, PrefightTask[]>
    const playerPrefightTasks = new Map<string, any[]>();
    for (const fight of war.fights) {
        if (fight.prefightChampions && fight.prefightChampions.length > 0) {
            for (const pf of fight.prefightChampions) {
                if (pf.playerId) {
                    const placerId = pf.playerId;
                    let championImage: string | undefined;
                    if (pf.champion?.images) {
                        championImage = getChampionImageUrl(pf.champion.images, '128', 'primary');
                    }

                    if (!playerPrefightTasks.has(placerId)) playerPrefightTasks.set(placerId, []);
                    playerPrefightTasks.get(placerId)!.push({
                        championName: pf.champion.name,
                        championImage,
                        targetNode: fight.node.nodeNumber,
                        targetDefender: fight.defender?.name || 'Unknown',
                        targetPlayer: fight.player?.ingameName || 'Unknown'
                    });
                }
            }
        }
    }

    // Prepare Channels and Threads
    const channelMap = {
        1: alliance.battlegroup1ChannelId,
        2: alliance.battlegroup2ChannelId,
        3: alliance.battlegroup3ChannelId
    };

    const threadCache = new Map<string, Map<string, ThreadChannel>>();
    const channelCache = new Map<string, TextChannel | null>();

    const getChannel = async (bg: number): Promise<TextChannel | null> => {
        const channelId = channelMap[bg as keyof typeof channelMap];
        if (!channelId) return null;
        
        if (channelCache.has(channelId)) return channelCache.get(channelId)!;
        
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                channelCache.set(channelId, channel as TextChannel);
                return channel as TextChannel;
            }
        } catch(e) {}
        
        channelCache.set(channelId, null);
        return null;
    }

    const getThread = async (bg: number, playerName: string): Promise<ThreadChannel | null> => {
        const channelId = channelMap[bg as keyof typeof channelMap];
        if (!channelId) return null;

        // Populate cache for this channel if needed
        if (!threadCache.has(channelId)) {
            try {
                const channel = await getChannel(bg);
                if (!channel) {
                    threadCache.set(channelId, new Map());
                    return null;
                }
                
                // Fetch active threads
                const active = await channel.threads.fetch();
                
                const map = new Map<string, ThreadChannel>();
                active.threads.forEach(t => map.set(t.name.toLowerCase(), t));
                threadCache.set(channelId, map);
            } catch (e) {
                threadCache.set(channelId, new Map());
                return null;
            }
        }
        
        const existing = threadCache.get(channelId)?.get(playerName.toLowerCase());
        if (existing) return existing;

        // Attempt to create new thread
        try {
            const channel = await getChannel(bg);
            if (channel) {
                // Determine user ID to mention if possible, otherwise just name
                // We have playerObj available in the loop, but here we just have name.
                // Just create with name for now.
                const newThread = await channel.threads.create({
                    name: capitalize(playerName), // Capitalize for nicer display
                    type: ChannelType.PrivateThread,
                    autoArchiveDuration: 10080, // 1 week
                });
                
                // Update cache
                threadCache.get(channelId)?.set(playerName.toLowerCase(), newThread);
                return newThread;
            }
        } catch (e) {
            logger.error({ err: e, playerName }, `Failed to create thread for ${playerName}`);
        }
        
        return null;
    };

    // Prepare Map Data
    const mapType = war.mapType || WarMapType.STANDARD;
    const nodesData = mapType === WarMapType.BIG_THING ? warNodesDataBig : warNodesData;

    // Process each player
    for (const [playerName, fights] of playerFights) {
        const bg = fights[0].battlegroup;
        const playerObj = fights[0].player; // For capitalization and ID
        
        const thread = await getThread(bg, playerName);
        if (!thread) {
            result.notFound.push(playerName); // Failed to find OR create
            continue;
        }

        const myPrefights = playerPrefightTasks.get(playerObj.id) || [];

        // --- Generate Map Image ---
        const bgMap = bgNodeMaps.get(bg);
        const assignments = new Map<number, NodeAssignment>();
        
        // Copy BG map base state
        if (bgMap) {
            bgMap.forEach((val, key) => assignments.set(key, { ...val }));
        }

        // Mark player targets (Attacks)
        fights.forEach((f: any) => {
            const existing = assignments.get(f.node.nodeNumber) || { isTarget: false };
            assignments.set(f.node.nodeNumber, { ...existing, isTarget: true, type: 'attack' });
        });

        // Mark player Prefights (only if not already an attack)
        myPrefights.forEach((pf: any) => {
            const existing = assignments.get(pf.targetNode);
            if (existing && !existing.isTarget) {
                // Modify to show Prefight placement
                assignments.set(pf.targetNode, {
                    ...existing,
                    isTarget: true,
                    type: 'prefight',
                    attackerImage: pf.championImage // Show prefight champ as "Attacker"
                });
            }
        });

        let mapAttachment: AttachmentBuilder | undefined;
        let mapMediaGallery: MediaGalleryBuilder | undefined;

        try {
            const mapBuffer = await MapImageService.generateMapImage(mapType, nodesData, assignments, globalImageCache);
            const mapFileName = `war-plan-${playerObj.id}.png`; // Unique file name
            mapAttachment = new AttachmentBuilder(mapBuffer, { name: mapFileName });
            
            mapMediaGallery = new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setDescription(`**${playerObj.ingameName}'s War Plan Map**`)
                    .setURL(`attachment://${mapFileName}`)
            );
        } catch (e) {
            logger.error({ err: e }, "Failed to generate map image");
        }

        // --- Build Message ---
        const container = new ContainerBuilder().setAccentColor(0x0ea5e9);
        
        // Add Media Gallery to the container if map was generated
        if (mapMediaGallery) {
            container.addMediaGalleryComponents(mapMediaGallery);
        }

        // 1. Header
        const mapName = war.mapType === WarMapType.BIG_THING ? "Big Thing" : "Standard";
        const seasonInfo = `📅 Season ${war.season} | War ${war.warNumber || '?'} | Tier ${war.warTier}`;
        const matchInfo = `⚔️ ${alliance.name} vs ${war.enemyAlliance || 'Unknown Opponent'}`;

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## AW Plan for ${playerObj.ingameName}\n` +
                `**${matchInfo}**\n` +
                `${seasonInfo} (🗺️ ${mapName})`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder());

        // 2. Team (Unique Attackers + Prefight Champs)
        const attackers = new Set<string>();
        fights.forEach((f: any) => {
            if (f.attacker?.name) attackers.add(f.attacker.name);
        });
        myPrefights.forEach((p: any) => attackers.add(p.championName));

        if (attackers.size > 0) {
            const attackerNames = Array.from(attackers);
            const emojis = await Promise.all(attackerNames.map(n => getEmoji(n, client)));
            const teamString = "**Your Team:**\n" + attackerNames.map((n, i) => `${emojis[i]} **${n}**`).join(" ");
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(teamString)
            );
        }

        // 3. Assignments
        const assignmentLines = await Promise.all(fights.sort((a: any, b: any) => a.node.nodeNumber - b.node.nodeNumber).map(async (f: any) => {
             const attackerEmoji = await getEmoji(f.attacker?.name || '', client);
             const defenderEmoji = await getEmoji(f.defender?.name || '', client);
             const node = f.node.nodeNumber;
             
             let line = `- Node ${node}: ${attackerEmoji} **${f.attacker?.name || 'Unknown'}** vs ${defenderEmoji} **${f.defender?.name || 'Unknown'}**`;
             
             if (f.prefightChampions.length > 0) {
                 const prefightEmojis = await Promise.all(f.prefightChampions.map((p: any) => getEmoji(p.champion.name, client)));
                 line += ` (Prefight: ${prefightEmojis.join(' ')})`;
             }
             
             if (f.notes) line += `\n  > *${f.notes}*`;
             
             return line;
        }));
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Assignments**\n" + assignmentLines.join("\n"))
        );

        // 4. Pre-fights to Place
        if (myPrefights.length > 0) {
            const pfLines = await Promise.all(myPrefights.map(async (p: any) => {
                const champEmoji = await getEmoji(p.championName, client);
                const defenderEmoji = await getEmoji(p.targetDefender, client);
                return `- ${champEmoji} **${p.championName}** for ${
                    p.targetPlayer.toLowerCase() === playerObj.ingameName.toLowerCase()
                        ? `my ${defenderEmoji} **${p.targetDefender}**`
                        : `${p.targetPlayer}'s ${defenderEmoji} **${p.targetDefender}**`
                } on Node ${p.targetNode}`;
            }));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent("**Pre-Fights to Place**\n" + pfLines.join("\n"))
            );
        }
        container.addSeparatorComponents(new SeparatorBuilder());
        // 5. Upload Button
        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`generate_upload_link:${war.id}:${playerObj.id}`)
            .setLabel("Add/Upload Video(s) to CereBro")
            .setStyle(ButtonStyle.Primary)
        );
        container.addActionRowComponents(actionRow);

        try {
            const files = mapAttachment ? [mapAttachment] : [];
            await thread.send({
                components: [container],
                flags: [MessageFlags.IsComponentsV2],
                files: files
            });
            
            // Add player to thread if they have a discord ID and are not already in it? 
            // Private threads need members added.
            if (playerObj.discordId) {
                try {
                    await thread.members.add(playerObj.discordId);
                } catch (e) {
                   // Ignore if already member or cant add
                }
            }

            result.sent.push(playerObj.ingameName);
        } catch (e) {
            result.errors.push(`Failed to send to ${playerName}`);
        }
    }

    return result;
}

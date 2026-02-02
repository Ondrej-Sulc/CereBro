import { Client, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, AttachmentBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, ChannelType, ThreadChannel } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { MapImageService, NodeAssignment, LegendItem } from '../mapImageService';
import { warNodesData, warNodesDataBig } from '../../data/war-planning/nodes-data';
import { WarMapType } from '@prisma/client';
import logger from '../loggerService';
import { getChampionImageUrl } from '../../utils/championHelper';
import { config } from '../../config';
import { capitalize, getEmoji } from '../../commands/aw/utils';

export interface DistributeResult {
    sent: string[];
    notFound: string[];
    noData: string[];
    errors: string[];
}

export async function distributeDefensePlan(
    client: Client, 
    allianceId: string, 
    targetBattlegroup?: number,
    planId?: string
): Promise<DistributeResult> {
    const result: DistributeResult = { sent: [], notFound: [], noData: [], errors: [] };

    const alliance = await prisma.alliance.findUnique({ where: { id: allianceId } });
    if (!alliance) {
        result.errors.push("Alliance not found");
        return result;
    }

    // Find the Defense Plan (Specific ID or Latest)
    let plan;
    const include = {
        placements: {
            where: targetBattlegroup ? { battlegroup: targetBattlegroup } : undefined,
            include: {
                defender: {
                    include: {
                        tags: true
                    }
                },
                player: true,
                node: true
            }
        },
        tactic: {
            include: {
                defenseTag: true
            }
        }
    };

    if (planId) {
        plan = await prisma.warDefensePlan.findUnique({
            where: { id: planId },
            include
        });
        
        // Security check: Ensure plan belongs to alliance
        if (plan && plan.allianceId !== allianceId) {
             result.errors.push("Plan does not belong to this alliance");
             return result;
        }
    } else {
        plan = await prisma.warDefensePlan.findFirst({
            where: { allianceId: alliance.id },
            orderBy: { createdAt: 'desc' },
            include
        });
    }

    if (!plan) {
        result.errors.push("No defense plan found");
        return result;
    }

    // --- Fetch Roster Data for Ranks ---
    const placementPlayerIds = Array.from(new Set(plan.placements.map(p => p.playerId).filter(Boolean))) as string[];
    const placementChampionIds = Array.from(new Set(plan.placements.map(p => p.defenderId).filter(Boolean))) as number[];

    const rosterEntries = await prisma.roster.findMany({
        where: {
            playerId: { in: placementPlayerIds },
            championId: { in: placementChampionIds }
        },
        select: {
            playerId: true,
            championId: true,
            stars: true,
            rank: true,
            sigLevel: true
        }
    });

    const rosterMap = new Map<string, { rank: number, sigLevel: number }>(); // "playerId-championId-stars" -> {rank, sigLevel}
    rosterEntries.forEach(r => {
        rosterMap.set(`${r.playerId}-${r.championId}-${r.stars}`, { rank: r.rank, sigLevel: r.sigLevel });
    });

    // 1. Prepare Global Node & Image Data
    const bgNodeMaps = new Map<number, Map<number, NodeAssignment>>();
    const uniqueImageUrls = new Set<string>();

    for (const placement of plan.placements) {
        if (!bgNodeMaps.has(placement.battlegroup)) {
            bgNodeMaps.set(placement.battlegroup, new Map());
        }
        
        let defenderImage: string | undefined;
        if (placement.defender?.images) {
            defenderImage = getChampionImageUrl(placement.defender.images, '128', 'primary');
            uniqueImageUrls.add(defenderImage);
        }

        // Check for Tactic
        const isDefenderTactic = !!(plan.tactic?.defenseTag && placement.defender?.tags?.some(t => t.name === plan.tactic!.defenseTag!.name));

        // We can also check if the placement itself has a custom highlight (if schema supported it, currently only plan has highlightTag)
        // But placements have `starLevel` maybe useful?

        bgNodeMaps.get(placement.battlegroup)!.set(placement.node.nodeNumber, {
            defenderName: placement.defender?.name,
            defenderImage,
            defenderClass: placement.defender?.class,
            isTarget: false, // Default
            isDefenderTactic
        });
    }

    if (plan.tactic) {
        logger.info({ tactic: plan.tactic.name, defenseTag: plan.tactic.defenseTag?.name }, "Applied tactic to defense plan distribution");
    } else {
        logger.warn("No tactic linked to defense plan, badges will not appear");
    }

    // Preload Images
    const globalImageCache = await MapImageService.preloadImages(Array.from(uniqueImageUrls));

    // Prepare Channels
    const channelMap = {
        1: alliance.battlegroup1ChannelId,
        2: alliance.battlegroup2ChannelId,
        3: alliance.battlegroup3ChannelId
    };

    const getChannel = async (bg: number): Promise<TextChannel | null> => {
        const channelId = channelMap[bg as keyof typeof channelMap];
        if (!channelId) return null;
        
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                return channel as TextChannel;
            }
        } catch(e) {}
        return null;
    }

    const mapType = plan.mapType || WarMapType.STANDARD;
    const nodesData = mapType === WarMapType.BIG_THING ? warNodesDataBig : warNodesData;

    const bgColors: Record<number, string> = {
        1: alliance.battlegroup1Color || "#ef4444",
        2: alliance.battlegroup2Color || "#22c55e",
        3: alliance.battlegroup3Color || "#3b82f6"
    };

    // --- Global Color Assignment (Mirrors Web UI/War Plan) ---
    // 1. Collect all unique players involved in the plan
    const allPlayers = new Map<string, { id: string, name: string, bg: number }>();
    plan.placements.forEach(p => {
        if (p.player) {
            allPlayers.set(p.player.id, { 
                id: p.player.id, 
                name: p.player.ingameName, 
                bg: p.battlegroup 
            });
        }
    });

    // 2. Sort them: BG (asc), then Name (asc)
    const sortedPlayers = Array.from(allPlayers.values()).sort((a, b) => {
        if (a.bg !== b.bg) return a.bg - b.bg;
        return a.name.localeCompare(b.name);
    });

    // 3. Assign Colors
    const globalColorMap = new Map<string, string>(); // PlayerID -> Color
    sortedPlayers.forEach((p, index) => {
        const color = MapImageService.PLAYER_COLORS[index % MapImageService.PLAYER_COLORS.length];
        globalColorMap.set(p.id, color);
    });

    // --- Overview Map Distribution ---
    const distinctBgs = new Set<number>();
    if (targetBattlegroup) distinctBgs.add(targetBattlegroup);
    else {
        plan.placements.forEach(p => distinctBgs.add(p.battlegroup));
    }

    for (const bg of distinctBgs) {
        try {
            // Check config first
            const channelId = channelMap[bg as keyof typeof channelMap];
            if (!channelId) {
                result.errors.push(`BG ${bg} channel not configured (use /alliance config-channels)`);
                continue;
            }

            const channel = await getChannel(bg);
            if (!channel) {
                result.errors.push(`BG ${bg} channel (ID: ${channelId}) not found or inaccessible`);
                continue;
            }

            // Gather placements for this BG
            const bgPlacements = plan.placements.filter(p => p.battlegroup === bg);
            if (bgPlacements.length === 0) {
                result.noData.push(`BG ${bg}`);
                continue;
            }

            // Build Legend
            const legend: LegendItem[] = [];
            const distinctPlayerNames = Array.from(new Set(bgPlacements.map(p => p.player?.ingameName))).filter(Boolean);
            
            distinctPlayerNames.sort().forEach((name) => {
                const pObj = bgPlacements.find(p => p.player?.ingameName === name)?.player;
                if (pObj && globalColorMap.has(pObj.id)) {
                    legend.push({
                        name: name!,
                        color: globalColorMap.get(pObj.id)!,
                        championImage: pObj.avatar || undefined
                    });
                }
            });

            // Build assignments with colors
            const bgMap = bgNodeMaps.get(bg);
            const assignments = new Map<number, NodeAssignment>();
            if (bgMap) bgMap.forEach((v, k) => assignments.set(k, { ...v }));

            bgPlacements.forEach(p => {
                if (p.player && globalColorMap.has(p.player.id)) {
                        const existing = assignments.get(p.node.nodeNumber) || { isTarget: false };
                        assignments.set(p.node.nodeNumber, {
                            ...existing,
                            assignedColor: globalColorMap.get(p.player.id)
                        });
                }
            });

            // Generate Image
            const accentColor = bgColors[bg];
            const mapBuffer = await MapImageService.generateMapImage(mapType, nodesData, assignments, globalImageCache, legend, accentColor);
            const mapFileName = `defense-overview-bg${bg}.png`;
            const mapAttachment = new AttachmentBuilder(mapBuffer, { name: mapFileName });

            // Send to Channel
            const mapName = plan.mapType === WarMapType.BIG_THING ? "Big Thing" : "Standard";
            const planLink = `${config.botBaseUrl}/planning/defense/${plan.id}`;
            
            const container = new ContainerBuilder().setAccentColor(parseInt(accentColor.replace('#', ''), 16));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 🛡️ Defense Plan: ${plan.name}\n` +
                    `**Battlegroup ${bg}**\n` +
                    `🗺️ ${mapName} | [View Full Plan on Web](${planLink})`
            ));
                container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setDescription(`**Battlegroup ${bg} Defense Overview**`)
                    .setURL(`attachment://${mapFileName}`)
            ));

                await channel.send({
                components: [container],
                flags: [MessageFlags.IsComponentsV2],
                files: [mapAttachment]
            });
            
            result.sent.push(`BG ${bg}`);
            logger.info(`Sent defense overview map to BG ${bg} channel`);

        } catch (e) {
            logger.error({ err: e, bg }, "Failed to distribute defense overview map");
            result.errors.push(`BG ${bg}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // --- Individual Player Distribution ---
    // 1. Group Placements by Player
    const playerPlacements = new Map<string, any[]>();
    plan.placements.forEach(p => {
        if (!p.player) return;
        const name = p.player.ingameName.toLowerCase();
        if (!playerPlacements.has(name)) playerPlacements.set(name, []);
        playerPlacements.get(name)!.push(p);
    });

    // 2. Thread Cache Helper
    const threadCache = new Map<string, Map<string, ThreadChannel>>();
    
    const getThread = async (bg: number, playerName: string): Promise<ThreadChannel | null> => {
        const channelId = channelMap[bg as keyof typeof channelMap];
        if (!channelId) return null;

        if (!threadCache.has(channelId)) {
            try {
                const channel = await getChannel(bg);
                if (!channel) {
                    threadCache.set(channelId, new Map());
                    return null;
                }
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

        try {
            const channel = await getChannel(bg);
            if (channel) {
                const newThread = await channel.threads.create({
                    name: capitalize(playerName),
                    type: ChannelType.PrivateThread,
                    autoArchiveDuration: 10080,
                });
                threadCache.get(channelId)?.set(playerName.toLowerCase(), newThread);
                return newThread;
            }
        } catch (e) {
            logger.error({ err: e, playerName }, `Failed to create thread for ${playerName}`);
        }
        return null;
    };

    // 3. Process Each Player
    for (const [playerName, placements] of playerPlacements) {
        // Skip if not in target BG
        if (targetBattlegroup && placements[0].battlegroup !== targetBattlegroup) continue;

        const bg = placements[0].battlegroup;
        const playerObj = placements[0].player;
        const thread = await getThread(bg, playerName);
        
        // --- Generate Personalized Map ---
        const bgMap = bgNodeMaps.get(bg);
        const assignments = new Map<number, NodeAssignment>();
        
        // Copy base state (everyone colored)
        if (bgMap) {
            bgMap.forEach((val, key) => assignments.set(key, { ...val }));
        }

        // Highlight Player's Nodes
        placements.forEach((p: any) => {
            const existing = assignments.get(p.node.nodeNumber) || { isTarget: false };
            assignments.set(p.node.nodeNumber, { ...existing, isTarget: true });
        });

        const accentColor = bgColors[bg];
        let mapAttachment: AttachmentBuilder | undefined;
        let mapMediaGallery: MediaGalleryBuilder | undefined;

        try {
            // Generate map with highlighting
            const mapBuffer = await MapImageService.generateMapImage(mapType, nodesData, assignments, globalImageCache, undefined, accentColor);
            const mapFileName = `defense-plan-${playerObj.id}.png`;
            mapAttachment = new AttachmentBuilder(mapBuffer, { name: mapFileName });
            
            mapMediaGallery = new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setDescription(`**${playerObj.ingameName}'s Defense Assignments**`)
                    .setURL(`attachment://${mapFileName}`)
            );
        } catch (e) {
            logger.error({ err: e }, "Failed to generate individual defense map");
        }

        // --- Build Message ---
        const container = new ContainerBuilder().setAccentColor(parseInt(accentColor.replace('#', ''), 16));
        
        if (mapMediaGallery) {
            container.addMediaGalleryComponents(mapMediaGallery);
        }

        const mapName = plan.mapType === WarMapType.BIG_THING ? "Big Thing" : "Standard";
        const planLink = `${config.botBaseUrl}/planning/defense/${plan.id}`;

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🛡️ Defense Plan for ${playerObj.ingameName}\n` +
                `**${plan.name}** (BG${bg})\n` +
                `🗺️ ${mapName} | [View Full Plan on Web](${planLink})`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder());

        // Assignments List
        // Sort by node number
        const sortedPlacements = [...placements].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);
        
        const lines = await Promise.all(sortedPlacements.map(async (p) => {
            const champName = p.defender?.name || "Unknown Champion";
            const starsNum = p.starLevel;
            
            let stars = "";
            let rank = "";
            if (p.playerId && p.defenderId && starsNum) {
                const r = rosterMap.get(`${p.playerId}-${p.defenderId}-${starsNum}`);
                const starSymbol = (r && r.sigLevel > 0) ? "★" : "☆";
                stars = starsNum ? `${starsNum}${starSymbol}` : "";
                if (r) rank = ` R${r.rank}`;
            } else if (starsNum) {
                stars = `${starsNum}☆`;
            }

            // Use champion emoji
            const emoji = await getEmoji(champName, client);
            
            return `- **Node ${p.node.nodeNumber}**: ${emoji} **${champName}** ${stars}${rank}`;
        }));

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                "**Your Assignments:**\n" + lines.join("\n")
            )
        );

        // Send Message
        try {
            const files = mapAttachment ? [mapAttachment] : [];
            let sent = false;

            if (thread) {
                await thread.send({
                    components: [container],
                    flags: [MessageFlags.IsComponentsV2],
                    files: files
                });
                
                // Add member to thread
                if (playerObj.discordId) {
                    try { await thread.members.add(playerObj.discordId); } catch {}
                }
                sent = true;
            } else if (playerObj.discordId) {
                // Fallback DM
                try {
                    const user = await client.users.fetch(playerObj.discordId);
                    if (user) {
                        await user.send({
                            components: [container],
                            flags: [MessageFlags.IsComponentsV2],
                            files: files
                        });
                        sent = true;
                    }
                } catch (dmErr) {
                    logger.error({ err: dmErr, playerName }, "Failed to send DM fallback for defense plan");
                }
            }

            if (sent) {
                result.sent.push(playerObj.ingameName);
            } else {
                result.notFound.push(playerObj.ingameName);
            }

        } catch (e) {
            result.errors.push(`Failed to send to ${playerName}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    return result;
}

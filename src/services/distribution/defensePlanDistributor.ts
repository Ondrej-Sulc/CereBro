import { Client, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, AttachmentBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { MapImageService, NodeAssignment, LegendItem } from '../mapImageService';
import { warNodesData, warNodesDataBig } from '../../data/war-planning/nodes-data';
import { WarMapType } from '@prisma/client';
import logger from '../loggerService';
import { getChampionImageUrl } from '../../utils/championHelper';
import { config } from '../../config';

export interface DistributeResult {
    sent: string[];
    notFound: string[];
    noData: string[];
    errors: string[];
}

export async function distributeDefensePlan(
    client: Client, 
    allianceId: string, 
    targetBattlegroup?: number
): Promise<DistributeResult> {
    const result: DistributeResult = { sent: [], notFound: [], noData: [], errors: [] };

    const alliance = await prisma.alliance.findUnique({ where: { id: allianceId } });
    if (!alliance) {
        result.errors.push("Alliance not found");
        return result;
    }

    // Find the latest Defense Plan
    const plan = await prisma.warDefensePlan.findFirst({
        where: { allianceId: alliance.id },
        orderBy: { createdAt: 'desc' },
        include: {
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
        }
    });

    if (!plan) {
        result.errors.push("No defense plan found");
        return result;
    }

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
            const channel = await getChannel(bg);
            if (!channel) {
                result.notFound.push(`Channel for BG ${bg}`);
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

    return result;
}

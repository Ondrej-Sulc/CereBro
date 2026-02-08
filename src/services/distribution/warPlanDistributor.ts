import { Client, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadChannel, AttachmentBuilder, ChannelType, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder } from 'discord.js';
import { prisma } from '../prismaService';
import { getEmoji, capitalize } from '../../commands/aw/utils';
import { MapImageService, NodeAssignment, LegendItem } from '../mapImageService';
import { warNodesData, warNodesDataBig } from '../../data/war-planning/nodes-data';
import { getPathInfo } from '../../data/war-planning/path-logic';
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

export async function distributeWarPlan(
    client: Client,
    allianceId: string,
    warId: string,
    targetBattlegroup?: number,
    targetPlayerId?: string,
    targetChannelId?: string
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
                    attacker: { include: { tags: true } },
                    defender: { include: { tags: true } },
                    node: true,
                    player: true,
                    prefightChampions: { include: { champion: true, player: true } }
                }
            },
            extraChampions: {
                where: targetBattlegroup ? { battlegroup: targetBattlegroup } : undefined,
                include: {
                    champion: true,
                    player: true
                }
            },
            bans: {
                include: {
                    champion: true
                }
            }
        }
    });

    if (!war) {
        result.errors.push("War not found");
        return result;
    }

    // --- Fetch Active Tactic ---
    const activeTactic = await prisma.warTactic.findFirst({
        where: {
            season: war.season,
            AND: [
                {
                    OR: [
                        { minTier: null },
                        { minTier: { lte: war.warTier } }
                    ]
                },
                {
                    OR: [
                        { maxTier: null },
                        { maxTier: { gte: war.warTier } }
                    ]
                }
            ]
        },
        include: {
            attackTag: true,
            defenseTag: true
        }
    });

    // --- Fetch Season Bans ---
    const seasonBans = await prisma.seasonBan.findMany({
        where: {
            season: war.season,
            OR: [
                { minTier: null, maxTier: null },
                { minTier: { lte: war.warTier }, maxTier: null },
                { minTier: null, maxTier: { gte: war.warTier } },
                { minTier: { lte: war.warTier }, maxTier: { gte: war.warTier } }
            ]
        },
        include: { champion: true }
    });

    // Combine Bans
    const bannedChampionsMap = new Map<number, { url: string, class: any }>();
    const uniqueImageUrls = new Set<string>(); // Initialized here

    // 1. Season Bans
    seasonBans.forEach(b => {
        if (b.champion && b.champion.images) {
            bannedChampionsMap.set(b.champion.id, {
                url: getChampionImageUrl(b.champion.images, '64', 'primary'),
                class: b.champion.class
            });
        }
    });

    // 2. War Bans
    war.bans.forEach(b => {
        if (b.champion && b.champion.images) {
            bannedChampionsMap.set(b.champion.id, {
                url: getChampionImageUrl(b.champion.images, '64', 'primary'),
                class: b.champion.class
            });
        }
    });

    const bannedChampions = Array.from(bannedChampionsMap.values());
    bannedChampions.forEach(b => uniqueImageUrls.add(b.url));

    // --- Global Color Assignment (Moved Up) ---
    // 1. Collect all unique players involved in the war
    const allPlayers = new Map<string, { id: string, name: string, bg: number }>();
    war.fights.forEach(f => {
        if (f.player) {
            allPlayers.set(f.player.id, {
                id: f.player.id,
                name: f.player.ingameName,
                bg: f.battlegroup
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

    // 1. Prepare Global Node & Image Data
    const bgNodeMaps = new Map<number, Map<number, NodeAssignment>>();

    for (const fight of war.fights) {
        if (!bgNodeMaps.has(fight.battlegroup)) {
            bgNodeMaps.set(fight.battlegroup, new Map());
        }

        let defenderImage: string | undefined;
        if (fight.defender?.images) {
            defenderImage = getChampionImageUrl(fight.defender.images, '64', 'primary');
            uniqueImageUrls.add(defenderImage);
        }

        let attackerImage: string | undefined;
        if (fight.attacker?.images) {
            attackerImage = getChampionImageUrl(fight.attacker.images, '64', 'primary');
            uniqueImageUrls.add(attackerImage);
        }

        // Collect Prefight Images with Border Colors
        const prefightImages: { url: string; borderColor: string }[] = [];
        if (fight.prefightChampions?.length > 0) {
            for (const pf of fight.prefightChampions) {
                if (pf.champion?.images) {
                    const pfImg = getChampionImageUrl(pf.champion.images, '64', 'primary');
                    uniqueImageUrls.add(pfImg);

                    const borderColor = (pf.player?.id && globalColorMap.get(pf.player.id)) || '#94a3b8';
                    prefightImages.push({ url: pfImg, borderColor });
                }
            }
        }

        // Tactic Logic
        const isAttackerTactic = !!(activeTactic?.attackTag && fight.attacker?.tags?.some(t => t.name === activeTactic.attackTag!.name));
        const isDefenderTactic = !!(activeTactic?.defenseTag && fight.defender?.tags?.some(t => t.name === activeTactic.defenseTag!.name));

        bgNodeMaps.get(fight.battlegroup)!.set(fight.node.nodeNumber, {
            defenderName: fight.defender?.name,
            defenderImage,
            defenderClass: fight.defender?.class,
            attackerImage,
            attackerClass: fight.attacker?.class,
            isTarget: false, // Default
            prefightImages, // Added
            isAttackerTactic,
            isDefenderTactic
        });
    }

    const globalImageCache = await MapImageService.preloadImages(Array.from(uniqueImageUrls));

    // --- Fetch Historical Videos ---
    // 1. Gather keys
    const fightKeys = new Set<string>();
    const keyMap = new Map<string, { nodeId: number, defenderId: number, attackerId: number }>();

    for (const fight of war.fights) {
        if (fight.attackerId && fight.defenderId) {
            const key = `${fight.nodeId}-${fight.defenderId}-${fight.attackerId}`;
            fightKeys.add(key);
            keyMap.set(key, {
                nodeId: fight.nodeId,
                defenderId: fight.defenderId,
                attackerId: fight.attackerId
            });
        }
    }

    // 2. Batch Query
    const videoMap = new Map<string, { url: string, videoId: string, death: number, playerId: string, playerName: string }[]>();

    if (fightKeys.size > 0) {
        const criterias = Array.from(keyMap.values());
        // Prisma doesn't support tuple IN natively in findMany without raw where, 
        // but given the size, we can construct an OR array.
        // To avoid massive OR clauses, we can fetch by Node+Defender and then filter in memory if needed, 
        // or just use OR if size is reasonable.
        // Let's assume < 200 items in OR is fine.

        // Chunking the query if necessary, but for now simple OR.
        const historicalFights = await prisma.warFight.findMany({
            where: {
                OR: criterias,
                videoId: { not: null },
                war: { status: 'FINISHED' }
            },
            select: {
                nodeId: true,
                defenderId: true,
                attackerId: true,
                death: true,
                video: { select: { id: true, url: true } },
                player: { select: { id: true, ingameName: true } }
            },
            orderBy: [
                { death: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        for (const hf of historicalFights) {
            if (!hf.video?.url || !hf.defenderId || !hf.attackerId || !hf.player) continue;
            const key = `${hf.nodeId}-${hf.defenderId}-${hf.attackerId}`;
            if (!videoMap.has(key)) videoMap.set(key, []);
            videoMap.get(key)!.push({
                url: hf.video.url,
                videoId: hf.video.id,
                death: hf.death,
                playerId: hf.player.id,
                playerName: hf.player.ingameName
            });
        }
    }

    // Group fights by Player
    const playerFights = new Map<string, any[]>();
    for (const fight of war.fights) {
        if (!fight.playerId || !fight.player) continue;
        if (targetPlayerId && fight.playerId !== targetPlayerId) continue;

        const name = fight.player.ingameName.toLowerCase();
        if (!playerFights.has(name)) playerFights.set(name, []);
        playerFights.get(name)!.push(fight);
    }

    // Group Extra Champions by Player
    const playerExtras = new Map<string, any[]>();
    for (const extra of war.extraChampions) {
        if (!extra.playerId || !extra.player) continue;
        if (targetPlayerId && extra.playerId !== targetPlayerId) continue;

        const name = extra.player.ingameName.toLowerCase();
        if (!playerExtras.has(name)) playerExtras.set(name, []);
        playerExtras.get(name)!.push(extra);
    }

    if (playerFights.size === 0) {
        result.noData.push("No fights found for this war/battlegroup");
        return result;
    }

    // --- Fetch Roster Data for Attackers ---
    const allAttackerPlayerIds = new Set<string>();
    const allAttackerChampionIds = new Set<number>();

    war.fights.forEach(f => {
        if (f.playerId) allAttackerPlayerIds.add(f.playerId);
        if (f.attackerId) allAttackerChampionIds.add(f.attackerId);
    });
    war.extraChampions.forEach(e => {
        if (e.playerId) allAttackerPlayerIds.add(e.playerId);
        if (e.championId) allAttackerChampionIds.add(e.championId);
    });
    // Prefights can also have different players
    war.fights.forEach(f => {
        f.prefightChampions.forEach(pf => {
            if (pf.playerId) allAttackerPlayerIds.add(pf.playerId);
            if (pf.championId) allAttackerChampionIds.add(pf.championId);
        });
    });

    const rosterEntries = await prisma.roster.findMany({
        where: {
            playerId: { in: Array.from(allAttackerPlayerIds) },
            championId: { in: Array.from(allAttackerChampionIds) }
        },
        select: {
            playerId: true,
            championId: true,
            stars: true,
            rank: true,
            sigLevel: true,
            isAwakened: true
        },
        orderBy: [
            { stars: 'desc' },
            { rank: 'desc' }
        ]
    });

    // Map: playerId -> Map: championId -> { stars, rank, sigLevel, isAwakened } (Best one)
    const bestRosterMap = new Map<string, Map<number, { stars: number, rank: number, sigLevel: number, isAwakened: boolean }>>();
    rosterEntries.forEach(r => {
        if (!bestRosterMap.has(r.playerId)) bestRosterMap.set(r.playerId, new Map());
        const playerMap = bestRosterMap.get(r.playerId)!;
        if (!playerMap.has(r.championId)) {
            // Since it's ordered by stars desc, rank desc, the first one we see is the best
            playerMap.set(r.championId, { stars: r.stars, rank: r.rank, sigLevel: r.sigLevel, isAwakened: r.isAwakened });
        }
    });

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
                        championImage = getChampionImageUrl(pf.champion.images, '64', 'primary');
                    }

                    if (!playerPrefightTasks.has(placerId)) playerPrefightTasks.set(placerId, []);
                    playerPrefightTasks.get(placerId)!.push({
                        championId: pf.champion.id,
                        championName: pf.champion.name,
                        championClass: pf.champion.class,
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
        } catch (e) { }

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

    const bgColors: Record<number, string> = {
        1: alliance.battlegroup1Color || "#ef4444",
        2: alliance.battlegroup2Color || "#22c55e",
        3: alliance.battlegroup3Color || "#3b82f6"
    };

    // --- Overview Map Distribution ---
    if (!targetPlayerId) {
        // Iterate over unique BGs in the current scope
        const distinctBgs = new Set<number>();
        if (targetBattlegroup) distinctBgs.add(targetBattlegroup);
        else {
            war.fights.forEach(f => distinctBgs.add(f.battlegroup));
        }

        for (const bg of distinctBgs) {
            try {
                let channel: TextChannel | null = null;

                if (targetChannelId) {
                    try {
                        const fetched = await client.channels.fetch(targetChannelId);
                        if (fetched && (fetched.type === ChannelType.GuildText || fetched.type === ChannelType.GuildAnnouncement)) {
                            channel = fetched as TextChannel;
                        }
                    } catch (e) {
                        result.errors.push(`Target channel ${targetChannelId} not found`);
                        continue;
                    }
                } else {
                    // Check config first
                    const channelId = channelMap[bg as keyof typeof channelMap];
                    if (!channelId) {
                        result.errors.push(`BG ${bg} channel not configured (use /alliance config-channels)`);
                        continue;
                    }

                    channel = await getChannel(bg);
                    if (!channel) {
                        result.errors.push(`BG ${bg} channel (ID: ${channelId}) not found or inaccessible`);
                        continue;
                    }
                }

                if (!channel) {
                    result.errors.push(`Could not determine channel for BG ${bg}`);
                    continue;
                }

                // Gather players and fights for this BG
                const bgFights = war.fights.filter(f => f.battlegroup === bg);
                if (bgFights.length === 0) continue;

                // Build Legend & Assignments using Global Colors
                const legend: LegendItem[] = [];
                const distinctPlayers = Array.from(new Set(bgFights.map(f => f.player?.ingameName))).filter(Boolean);

                // Sort for legend display (alphabetical is fine for legend, color is already fixed)
                distinctPlayers.sort().forEach((name) => {
                    const pObj = bgFights.find(f => f.player?.ingameName === name)?.player;
                    const pFights = bgFights.filter(f => f.player?.ingameName === name);

                    let pathLabel = "";
                    if (pFights.length > 0) {
                        if (mapType === WarMapType.BIG_THING) {
                            const nodes = pFights.map(f => f.node.nodeNumber).sort((a, b) => a - b);
                            pathLabel = `Node ${nodes.join(", ")}`;
                        } else {
                            const s1Paths = new Set<number>();
                            const s2Paths = new Set<number>();

                            pFights.forEach(f => {
                                const info = getPathInfo(f.node.nodeNumber);
                                if (info?.section === 1) s1Paths.add(info.path);
                                if (info?.section === 2) s2Paths.add(info.path);
                            });

                            const s1Str = s1Paths.size > 0 ? `P${Array.from(s1Paths).sort((a, b) => a - b).join(",")}` : "-";
                            const s2Str = s2Paths.size > 0 ? `P${Array.from(s2Paths).sort((a, b) => a - b).join(",")}` : "-";
                            pathLabel = `${s1Str} / ${s2Str}`;
                        }
                    }

                    // Collect assigned champions images (All types: Attacker, Prefight, Extra)
                    const assignedChampions: { url: string; class: any }[] = [];
                    const seenChampIds = new Set<number>();

                    // 1. Attackers from fights
                    pFights.forEach(f => {
                        if (f.attacker && f.attacker.images && !seenChampIds.has(f.attacker.id)) {
                            seenChampIds.add(f.attacker.id);
                            assignedChampions.push({
                                url: getChampionImageUrl(f.attacker.images, '64', 'primary'),
                                class: f.attacker.class
                            });
                        }
                    });

                    // 2. Prefights assigned to this player
                    // Need to check ALL fights in the war to see if this player placed a prefight
                    war.fights.forEach(f => {
                        if (f.prefightChampions) {
                            f.prefightChampions.forEach(pf => {
                                if (pf.playerId === pObj?.id && pf.champion && !seenChampIds.has(pf.champion.id)) {
                                    seenChampIds.add(pf.champion.id);
                                    if (pf.champion.images) {
                                        assignedChampions.push({
                                            url: getChampionImageUrl(pf.champion.images, '64', 'primary'),
                                            class: pf.champion.class
                                        });
                                    }
                                }
                            });
                        }
                    });

                    // 3. Extra Champions
                    war.extraChampions.forEach(e => {
                        if (e.playerId === pObj?.id && e.champion && !seenChampIds.has(e.champion.id)) {
                            seenChampIds.add(e.champion.id);
                            if (e.champion.images) {
                                assignedChampions.push({
                                    url: getChampionImageUrl(e.champion.images, '64', 'primary'),
                                    class: e.champion.class
                                });
                            }
                        }
                    });

                    if (pObj && globalColorMap.has(pObj.id)) {
                        legend.push({
                            name: name!,
                            color: globalColorMap.get(pObj.id)!,
                            championImage: pObj.avatar || undefined,
                            pathLabel,
                            assignedChampions
                        });
                    }
                });

                // Build assignments with colors
                const bgMap = bgNodeMaps.get(bg);
                const assignments = new Map<number, NodeAssignment>();
                if (bgMap) bgMap.forEach((v, k) => assignments.set(k, { ...v }));

                bgFights.forEach(f => {
                    if (f.player && globalColorMap.has(f.player.id)) {
                        const existing = assignments.get(f.node.nodeNumber) || { isTarget: false };
                        assignments.set(f.node.nodeNumber, {
                            ...existing,
                            assignedColor: globalColorMap.get(f.player.id)
                        });
                    }
                });

                // Generate Image with Accent Color
                const accentColor = bgColors[bg];
                const mapBuffer = await MapImageService.generateMapImage(mapType, nodesData, assignments, globalImageCache, legend, accentColor, bannedChampions);
                const mapFileName = `war-overview-bg${bg}.png`;
                const mapAttachment = new AttachmentBuilder(mapBuffer, { name: mapFileName });

                // Send to Channel
                const mapName = war.mapType === WarMapType.BIG_THING ? "Big Thing" : "Standard";
                const seasonInfo = `📅 Season ${war.season} | War ${war.warNumber || '?'} | Tier ${war.warTier}`;
                const matchInfo = `⚔️ ${alliance.name} vs ${war.enemyAlliance || 'Unknown Opponent'}`;
                const planLink = `${config.botBaseUrl}/planning/${war.id}`;

                const container = new ContainerBuilder().setAccentColor(parseInt(accentColor.replace('#', ''), 16));
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 🗺️ Battlegroup ${bg} War Plan\n` +
                    `**${matchInfo}**\n` +
                    `${seasonInfo} (🗺️ ${mapName}) | [View Full Plan on Web](${planLink})`
                ));
                container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder()
                        .setDescription(`**Battlegroup ${bg} Overview**`)
                        .setURL(`attachment://${mapFileName}`)
                ));

                await channel.send({
                    components: [container],
                    flags: [MessageFlags.IsComponentsV2],
                    files: [mapAttachment]
                });

                logger.info(`Sent overview map to BG ${bg} channel`);
                result.sent.push(`BG ${bg} Map`);

            } catch (e) {
                logger.error({ err: e, bg }, "Failed to distribute overview map");
            }
        }
    }

    // If we are sharing to a specific channel (e.g. general chat), we stop here.
    // We don't want to spam individual threads.
    if (targetChannelId) return result;

    // Process each player
    for (const [playerName, fights] of playerFights) {
        const bg = fights[0].battlegroup;
        const playerObj = fights[0].player; // For capitalization and ID

        const thread = await getThread(bg, playerName);

        const myPrefights = playerPrefightTasks.get(playerObj.id) || [];
        const myExtras = playerExtras.get(playerName) || [];

        // --- Generate Map Image ---
        const bgMap = bgNodeMaps.get(bg);
        const assignments = new Map<number, NodeAssignment>();

        // Copy BG map base state
        if (bgMap) {
            bgMap.forEach((val, key) => assignments.set(key, { ...val }));
        }

        // Mark player targets
        fights.forEach((f: any) => {
            const existing = assignments.get(f.node.nodeNumber) || { isTarget: false };
            assignments.set(f.node.nodeNumber, { ...existing, isTarget: true });
        });

        let mapAttachment: AttachmentBuilder | undefined;
        let mapMediaGallery: MediaGalleryBuilder | undefined;
        const accentColor = bgColors[bg];

        try {
            const mapBuffer = await MapImageService.generateMapImage(mapType, nodesData, assignments, globalImageCache, undefined, accentColor);
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
        const container = new ContainerBuilder().setAccentColor(parseInt(accentColor.replace('#', ''), 16));

        // Add Media Gallery to the container if map was generated
        if (mapMediaGallery) {
            container.addMediaGalleryComponents(mapMediaGallery);
        }

        // 1. Header
        const mapName = war.mapType === WarMapType.BIG_THING ? "Big Thing" : "Standard";
        const seasonInfo = `📅 Season ${war.season} | War ${war.warNumber || '?'} | Tier ${war.warTier}`;
        const matchInfo = `⚔️ ${alliance.name} vs ${war.enemyAlliance || 'Unknown Opponent'}`;
        const planLink = `${config.botBaseUrl}/planning/${war.id}`;

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## AW Plan for ${playerObj.ingameName}\n` +
                `**${matchInfo}**\n` +
                `${seasonInfo} (🗺️ ${mapName}) | [View Full Plan on Web](${planLink})`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder());

        // 2. Team (Unique Attackers + Prefight Champs + Extra Champs)
        const attackers = new Map<number, string>(); // championId -> name
        fights.forEach((f: any) => {
            if (f.attacker) attackers.set(f.attacker.id, f.attacker.name);
        });
        myPrefights.forEach((p: any) => attackers.set(p.championId, p.championName));
        myExtras.forEach((e: any) => {
            if (e.champion) attackers.set(e.champion.id, e.champion.name);
        });

        if (attackers.size > 0) {
            const attackerEntries = Array.from(attackers.entries());
            const teamLines = await Promise.all(attackerEntries.map(async ([id, name]) => {
                const emoji = await getEmoji(name, client);
                const roster = bestRosterMap.get(playerObj.id)?.get(id);
                let info = "";
                if (roster) {
                    const awakened = roster.isAwakened || roster.sigLevel > 0;
                    const starSymbol = awakened ? "★" : "☆";
                    info = ` ${roster.stars}${starSymbol} R${roster.rank}`;
                }
                return `${emoji} **${name}**${info}`;
            }));

            const teamString = "**Your Team:**\n" + teamLines.join(" ");
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

            // Video Link Logic
            if (f.attackerId && f.defenderId) {
                const key = `${f.nodeId}-${f.defenderId}-${f.attackerId}`;
                const videos = videoMap.get(key);
                if (videos) {
                    // Filter out this player's own videos, take top 3
                    const validVideos = videos
                        .filter(v => v.playerId !== playerObj.id)
                        .slice(0, 3);

                    if (validVideos.length > 0) {
                        const videoLinks = validVideos.map(v => {
                            const deathNote = v.death > 0 ? ` (💀 ${v.death})` : '';
                            const videoLink = `${config.botBaseUrl}/war-videos/${v.videoId}`;
                            return `🎥 [${v.playerName}${deathNote}](${videoLink})`;
                        });
                        line += ` | ${videoLinks.join(' ')}`;
                    }
                }
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
                return `- ${champEmoji} **${p.championName}** for ${p.targetPlayer.toLowerCase() === playerObj.ingameName.toLowerCase()
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

            if (thread) {
                await thread.send({
                    components: [container],
                    flags: [MessageFlags.IsComponentsV2],
                    files: files
                });

                // Add player to thread if they have a discord ID and are not already in it
                if (playerObj.discordId) {
                    try {
                        await thread.members.add(playerObj.discordId);
                    } catch (e) {
                        // Ignore if already member or cant add
                    }
                }
            } else if (playerObj.discordId) {
                // FALLBACK: Send via DM
                try {
                    const user = await client.users.fetch(playerObj.discordId);
                    if (user) {
                        await user.send({
                            components: [container],
                            flags: [MessageFlags.IsComponentsV2],
                            files: files
                        });
                        logger.info({ playerName }, "Sent war plan via DM (fallback)");
                    } else {
                        throw new Error("User not found for DM");
                    }
                } catch (dmErr) {
                    logger.error({ err: dmErr, playerName }, "Failed to send DM fallback");
                    throw new Error(`Thread unavailable and DM failed: ${dmErr instanceof Error ? dmErr.message : String(dmErr)}`);
                }
            } else {
                result.notFound.push(playerObj.ingameName);
                continue;
            }

            result.sent.push(playerObj.ingameName);
        } catch (e) {
            result.errors.push(`Failed to send to ${playerName}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    return result;
}

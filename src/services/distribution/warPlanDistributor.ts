import { Client, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadChannel } from 'discord.js';
import { prisma } from '../prismaService';
import { getEmoji, capitalize } from '../../commands/aw/utils';

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
                    if (!playerPrefightTasks.has(placerId)) playerPrefightTasks.set(placerId, []);
                    playerPrefightTasks.get(placerId)!.push({
                        championName: pf.champion.name,
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

    const getThread = async (bg: number, playerName: string): Promise<ThreadChannel | null> => {
        const channelId = channelMap[bg as keyof typeof channelMap];
        if (!channelId) return null;

        if (!threadCache.has(channelId)) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (!channel || !channel.isTextBased()) {
                    threadCache.set(channelId, new Map()); // Mark as failed/empty
                    return null;
                }
                
                const textChannel = channel as TextChannel;
                // Fetch active threads
                const active = await textChannel.threads.fetch();
                // We could fetch archived too if needed: await textChannel.threads.fetchArchived();
                
                const map = new Map<string, ThreadChannel>();
                active.threads.forEach(t => map.set(t.name.toLowerCase(), t));
                threadCache.set(channelId, map);
            } catch (e) {
                threadCache.set(channelId, new Map());
                return null;
            }
        }
        return threadCache.get(channelId)?.get(playerName.toLowerCase()) || null;
    };

    // Process each player
    for (const [playerName, fights] of playerFights) {
        const bg = fights[0].battlegroup;
        
        const thread = await getThread(bg, playerName);
        if (!thread) {
            result.notFound.push(playerName);
            continue;
        }

        const playerObj = fights[0].player; // For capitalization and ID
        const myPrefights = playerPrefightTasks.get(playerObj.id) || [];

        // --- Build Message ---
        const container = new ContainerBuilder().setAccentColor(0x0ea5e9);
        
        // 1. Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**AW Plan for ${playerObj.ingameName}**`)
        );

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

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`generate_upload_link:${war.id}:${playerObj.id}`)
            .setLabel("Upload Video(s)")
            .setStyle(ButtonStyle.Primary)
        );

        try {
            await thread.send({
                components: [container, actionRow],
                flags: [MessageFlags.IsComponentsV2],
            });
            result.sent.push(playerObj.ingameName);
        } catch (e) {
            result.errors.push(`Failed to send to ${playerName}`);
        }
    }

    return result;
}

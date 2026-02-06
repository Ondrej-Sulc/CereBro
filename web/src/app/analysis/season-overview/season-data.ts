import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getNodeCategory } from "@cerebro/core/data/war-planning/path-logic";
import { ChampionImages } from "@/types/champion";
import { PlayerStats, ChampionStat, NodeStat } from "./types";
import { DetailedPlacementStat } from "./deep-dive-types";

export async function getAvailableSeasons(allianceId: string) {
  return await getFromCache(`distinct-seasons-${allianceId}`, 3600, async () => {
    const distinctSeasons = await prisma.war.findMany({
        where: { allianceId },
        distinct: ['season'],
        select: { season: true },
        orderBy: { season: 'desc' }
    });
    return distinctSeasons.map(s => s.season).filter(s => s !== 0);
  });
}

export interface SeasonData {
    bgStats: Record<number, Record<string, PlayerStats>>;
    bgTotals: Record<number, { fights: number; deaths: number }>;
    deathDistribution: { path: number; miniBoss: number; boss: number };
    topDefenders: ChampionStat[];
    topAttackers: ChampionStat[];
    hardestNodes: NodeStat[];
    placementStats: DetailedPlacementStat[];
    totalWars: number;
    mapTypes: Set<string>;
    allPlayers: PlayerStats[];
    globalFights: number;
    globalDeaths: number;
    globalSoloRate: number;
}

export async function getSeasonData(allianceId: string, selectedSeason: number): Promise<SeasonData> {
    // Fetch War Data (Cached for 5 minutes per alliance/season)
    const [wars, allTactics] = await Promise.all([
        getFromCache(`season-wars-${selectedSeason}-${allianceId}`, 300, () => 
            prisma.war.findMany({
                where: { 
                    season: selectedSeason,
                    allianceId,
                    status: { not: 'PLANNING' },
                    warNumber: { not: null } // Exclude Offseason wars
                },
                include: {
                    fights: {
                        where: {
                            player: { isNot: null }
                        },
                        include: {
                            player: true,
                            attacker: { include: { tags: true } },
                            defender: { include: { tags: true } },
                            node: true,
                            video: true
                        }
                    }
                }
            })
        ),
        getFromCache(`season-tactics-${selectedSeason}`, 3600, () => 
            prisma.warTactic.findMany({
                where: { season: selectedSeason },
                include: { attackTag: true, defenseTag: true }
            })
        )
    ]);
  
    // Process Data
    const bgStats: Record<number, Record<string, PlayerStats>> = {
      1: {},
      2: {},
      3: {}
    };
    
    const bgTotals: Record<number, { fights: number; deaths: number }> = {
      1: { fights: 0, deaths: 0 },
      2: { fights: 0, deaths: 0 },
      3: { fights: 0, deaths: 0 }
    };

    const deathDistribution = {
        path: 0,
        miniBoss: 0,
        boss: 0
    };

    const defenderStats = new Map<number, ChampionStat>();
    const attackerStats = new Map<number, ChampionStat>();
    const nodeStats = new Map<number, NodeStat>();
    const placementStats: DetailedPlacementStat[] = [];
  
    const totalWars = wars.length;
    const mapTypes = new Set<string>();
  
    for (const war of wars) {
      mapTypes.add(war.mapType);

      // Determine active tactic for this war
      const activeTactic = allTactics.find(t => 
        (!t.minTier || t.minTier <= war.warTier) && 
        (!t.maxTier || t.maxTier >= war.warTier)
      );

      for (const fight of war.fights) {
        if (!fight.player) continue;
        
        const bg = fight.battlegroup;
        if (!bg || bg < 1 || bg > 3) continue;

        // Collect Deep Dive Stats
        if (fight.defender && fight.node && fight.attacker) {
            placementStats.push({
                nodeNumber: fight.node.nodeNumber,
                defenderId: fight.defender.id,
                defenderName: fight.defender.name,
                defenderClass: fight.defender.class,
                defenderImages: fight.defender.images as unknown as ChampionImages,
                attackerId: fight.attacker.id,
                attackerName: fight.attacker.name,
                attackerClass: fight.attacker.class,
                attackerImages: fight.attacker.images as unknown as ChampionImages,
                fights: 1,
                deaths: fight.death
            });
        }
  
        // Player Stats
        const pid = fight.player.id;
        if (!bgStats[bg][pid]) {
          bgStats[bg][pid] = {
            playerId: pid,
            playerName: fight.player.ingameName,
            avatar: fight.player.avatar,
            fights: 0,
            deaths: 0,
            pathFights: 0,
            pathDeaths: 0,
            miniBossFights: 0,
            miniBossDeaths: 0,
            bossFights: 0,
            bossDeaths: 0,
            battlegroup: bg,
            warStats: []
          };
        }
        bgStats[bg][pid].fights += 1;
        bgStats[bg][pid].deaths += fight.death;
        
        // Node Category Stats
        if (fight.node) {
            const category = getNodeCategory(fight.node.nodeNumber);
            
            // Player Counts & Deaths
            if (category === 'boss') {
                bgStats[bg][pid].bossFights++;
                bgStats[bg][pid].bossDeaths += fight.death;
                deathDistribution.boss += fight.death;
            } else if (category === 'mini-boss') {
                bgStats[bg][pid].miniBossFights++;
                bgStats[bg][pid].miniBossDeaths += fight.death;
                deathDistribution.miniBoss += fight.death;
            } else {
                bgStats[bg][pid].pathFights++;
                bgStats[bg][pid].pathDeaths += fight.death;
                deathDistribution.path += fight.death;
            }
        }

        // War Stats Aggregation
        let playerWarStat = bgStats[bg][pid].warStats.find(w => w.warId === war.id);
        if (!playerWarStat) {
            playerWarStat = {
                warId: war.id,
                warNumber: war.warNumber || 0,
                opponent: war.enemyAlliance || 'Unknown',
                fights: 0,
                deaths: 0,
                fightDetails: []
            };
            bgStats[bg][pid].warStats.push(playerWarStat);
        }

        const isAttackerTactic = !!(activeTactic?.attackTag && fight.attacker?.tags?.some(t => t.name === activeTactic.attackTag!.name));
        const isDefenderTactic = !!(activeTactic?.defenseTag && fight.defender?.tags?.some(t => t.name === activeTactic.defenseTag!.name));

        playerWarStat.fights += 1;
        playerWarStat.deaths += fight.death;
        playerWarStat.fightDetails.push({
            defenderName: fight.defender?.name || 'Unknown',
            defenderClass: fight.defender?.class || 'COSMIC',
            defenderImageUrl: getChampionImageUrl(fight.defender?.images as unknown as ChampionImages, '64'),
            attackerName: fight.attacker?.name || 'Unknown',
            attackerClass: fight.attacker?.class || 'COSMIC',
            attackerImageUrl: getChampionImageUrl(fight.attacker?.images as unknown as ChampionImages, '64'),
            nodeNumber: fight.node?.nodeNumber || 0,
            isSolo: fight.death === 0,
            deaths: fight.death,
            videoId: fight.video?.id || null,
            isAttackerTactic,
            isDefenderTactic
        });

        bgTotals[bg].fights += 1;
        bgTotals[bg].deaths += fight.death;

        // Defender Stats
        if (fight.defender) {
            const defId = fight.defender.id;
            const existing = defenderStats.get(defId) || {
                id: defId,
                name: fight.defender.name,
                class: fight.defender.class,
                images: fight.defender.images as unknown as ChampionImages,
                count: 0,
                deaths: 0,
                fights: 0
            };
            existing.count += 1;
            existing.fights += 1;
            existing.deaths += fight.death;
            defenderStats.set(defId, existing);
        }

        // Attacker Stats
        if (fight.attacker) {
            const attId = fight.attacker.id;
            const existing = attackerStats.get(attId) || {
                id: attId,
                name: fight.attacker.name,
                class: fight.attacker.class,
                images: fight.attacker.images as unknown as ChampionImages,
                count: 0,
                deaths: 0,
                fights: 0
            };
            existing.count += 1; // Used
            existing.fights += 1;
            existing.deaths += fight.death; // Died while attacking
            attackerStats.set(attId, existing);
        }

        // Node Stats
        if (fight.node) {
            const nNum = fight.node.nodeNumber;
            const existing = nodeStats.get(nNum) || {
                nodeNumber: nNum,
                deaths: 0,
                fights: 0
            };
            existing.fights += 1;
            existing.deaths += fight.death;
            nodeStats.set(nNum, existing);
        }
      }
    }
  
    // Flatten players for Unified Table
    const allPlayers: PlayerStats[] = [];
    [1, 2, 3].forEach(bg => {
      allPlayers.push(...Object.values(bgStats[bg]));
    });

    // Sort Insights
    const topDefenders = Array.from(defenderStats.values())
        .sort((a, b) => b.deaths - a.deaths || b.fights - a.fights);
    
    const topAttackers = Array.from(attackerStats.values())
        .sort((a, b) => b.count - a.count || a.deaths - b.deaths);

    const hardestNodes = Array.from(nodeStats.values())
        .sort((a, b) => b.deaths - a.deaths || b.fights - a.fights);

    // Global Stats Calculation
    const globalFights = bgTotals[1].fights + bgTotals[2].fights + bgTotals[3].fights;
    const globalDeaths = bgTotals[1].deaths + bgTotals[2].deaths + bgTotals[3].deaths;
    const globalSoloRate = globalFights > 0 ? ((globalFights - globalDeaths) / globalFights) * 100 : 0;

    return {
        bgStats,
        bgTotals,
        deathDistribution,
        topDefenders,
        topAttackers,
        hardestNodes,
        placementStats,
        totalWars,
        mapTypes,
        allPlayers,
        globalFights,
        globalDeaths,
        globalSoloRate
    };
}

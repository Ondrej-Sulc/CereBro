import { prisma } from '../services/prismaService';
import { MapImageService, NodeAssignment, LegendItem } from '../services/mapImageService';
import { warNodesData, warNodesDataBig } from '../data/war-planning/nodes-data';
import { getPathInfo } from '../data/war-planning/path-logic';
import { WarMapType } from '@prisma/client';
import { getChampionImageUrl } from '../utils/championHelper';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const warId = process.argv[2];
    if (!warId) {
        console.error("Please provide a War ID as the first argument.");
        process.exit(1);
    }

    console.log(`Generating images for War ID: ${warId}`);

    const war = await prisma.war.findUnique({
        where: { id: warId },
        include: {
            fights: {
                include: {
                    attacker: { include: { tags: true } },
                    defender: { include: { tags: true } },
                    node: true,
                    player: true,
                    prefightChampions: { include: { champion: true, player: true } }
                }
            },
            extraChampions: {
                include: {
                    champion: true,
                    player: true
                }
            }
        }
    });

    if (!war) {
        console.error("War not found!");
        process.exit(1);
    }

    // Output dir
    const outDir = path.resolve(process.cwd(), 'temp', 'war-test-images', warId);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    console.log(`Output directory: ${outDir}`);

    // Fetch Active Tactic (Simplified logic from distributor)
    const activeTactic = await prisma.warTactic.findFirst({
        where: {
            season: war.season,
            AND: [
                { OR: [{ minTier: null }, { minTier: { lte: war.warTier } }] },
                { OR: [{ maxTier: null }, { maxTier: { gte: war.warTier } }] }
            ]
        },
        include: { attackTag: true, defenseTag: true }
    });

    // --- Global Color Assignment ---
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

    const sortedPlayers = Array.from(allPlayers.values()).sort((a, b) => {
        if (a.bg !== b.bg) return a.bg - b.bg;
        return a.name.localeCompare(b.name);
    });

    const globalColorMap = new Map<string, string>();
    sortedPlayers.forEach((p, index) => {
        const color = MapImageService.PLAYER_COLORS[index % MapImageService.PLAYER_COLORS.length];
        globalColorMap.set(p.id, color);
    });

    // --- Prepare Data ---
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

        const prefightImages: { url: string; borderColor: string }[] = [];
        if (fight.prefightChampions?.length > 0) {
            for (const pf of fight.prefightChampions) {
                if (pf.champion?.images) {
                    const pfImg = getChampionImageUrl(pf.champion.images, '128', 'primary');
                    uniqueImageUrls.add(pfImg);
                    const borderColor = (pf.player?.id && globalColorMap.get(pf.player.id)) || '#94a3b8';
                    prefightImages.push({ url: pfImg, borderColor });
                }
            }
        }

        const isAttackerTactic = !!(activeTactic?.attackTag && fight.attacker?.tags?.some(t => t.name === activeTactic.attackTag!.name));
        const isDefenderTactic = !!(activeTactic?.defenseTag && fight.defender?.tags?.some(t => t.name === activeTactic.defenseTag!.name));

        bgNodeMaps.get(fight.battlegroup)!.set(fight.node.nodeNumber, {
            defenderName: fight.defender?.name,
            defenderImage,
            defenderClass: fight.defender?.class,
            attackerImage,
            attackerClass: fight.attacker?.class,
            isTarget: false,
            prefightImages,
            isAttackerTactic,
            isDefenderTactic
        });
    }

    console.log(`Preloading ${uniqueImageUrls.size} images...`);
    const globalImageCache = await MapImageService.preloadImages(Array.from(uniqueImageUrls));

    // --- Generate Overview Maps ---
    const mapType = war.mapType || WarMapType.STANDARD;
    const nodesData = mapType === WarMapType.BIG_THING ? warNodesDataBig : warNodesData;
    
    // Dummy BG Colors since we aren't fetching alliance config fully
    const bgColors: Record<number, string> = {
        1: "#ef4444",
        2: "#22c55e",
        3: "#3b82f6"
    };

    const distinctBgs = new Set<number>();
    war.fights.forEach(f => distinctBgs.add(f.battlegroup));

    for (const bg of distinctBgs) {
        console.log(`Processing BG ${bg}...`);
        const bgFights = war.fights.filter(f => f.battlegroup === bg);
        if (bgFights.length === 0) continue;

        const legend: LegendItem[] = [];
        const distinctPlayers = Array.from(new Set(bgFights.map(f => f.player?.ingameName))).filter(Boolean);
        
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

                    const s1Str = s1Paths.size > 0 ? `P${Array.from(s1Paths).sort((a,b)=>a-b).join(",")}` : "-";
                    const s2Str = s2Paths.size > 0 ? `P${Array.from(s2Paths).sort((a,b)=>a-b).join(",")}` : "-";
                    pathLabel = `${s1Str} / ${s2Str}`;
                }
            }

            // Collect assigned champions images (THIS IS THE NEW PART TO TEST)
            const assignedChampions: { url: string; class: any }[] = [];
            const seenChampIds = new Set<number>();
            
            // 1. Attackers
            pFights.forEach(f => {
                if (f.attacker && f.attacker.images && !seenChampIds.has(f.attacker.id)) {
                        seenChampIds.add(f.attacker.id);
                        assignedChampions.push({
                            url: getChampionImageUrl(f.attacker.images, '128', 'primary'),
                            class: f.attacker.class
                        });
                }
            });

            // 2. Prefights
            war.fights.forEach(f => {
                if (f.prefightChampions) {
                    f.prefightChampions.forEach(pf => {
                        if (pf.playerId === pObj?.id && pf.champion && !seenChampIds.has(pf.champion.id)) {
                            seenChampIds.add(pf.champion.id);
                            if (pf.champion.images) {
                                assignedChampions.push({
                                    url: getChampionImageUrl(pf.champion.images, '128', 'primary'),
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
                            url: getChampionImageUrl(e.champion.images, '128', 'primary'),
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

        const accentColor = bgColors[bg] || "#ffffff";
        const mapBuffer = await MapImageService.generateMapImage(mapType, nodesData, assignments, globalImageCache, legend, accentColor);
        
        const outFile = path.join(outDir, `war-overview-bg${bg}.png`);
        fs.writeFileSync(outFile, mapBuffer);
        console.log(`Saved ${outFile}`);
    }

    console.log("Done.");
}

main().catch(e => console.error(e));
import sharp from 'sharp';
import { ChampionClass } from '@prisma/client';
import { LegendItem, NodeAssignment } from '../../services/mapImageService';

// Synthetic portraits and names only: no network, player data, or database needed.
export async function createMapImageFixture(bannedCount = 0) {
    const imageCache = new Map<string, string>();
    const assignments = new Map<number, NodeAssignment>();
    const portraitColors: [number, number, number][] = [];
    const legend: LegendItem[] = [];
    const playerColors = [
        '#ff4d4d', '#ff9933', '#ffee00', '#66ff33', '#00ff88',
        '#00eedd', '#00aaff', '#7744ff', '#ff33ff', '#ff66aa',
    ];

    for (let index = 0; index < 10; index++) {
        const color: [number, number, number] = [40 + index * 17, 219 - index * 11, 83 + index * 9];
        const url = `fixture://defender-${index + 1}`;
        const portrait = await sharp({
            create: { width: 64, height: 64, channels: 3, background: { r: color[0], g: color[1], b: color[2] } },
        }).png().toBuffer();
        imageCache.set(url, `data:image/png;base64,${portrait.toString('base64')}`);
        portraitColors.push(color);
        assignments.set(index + 1, {
            defenderImage: url,
            defenderClass: ChampionClass.SCIENCE,
            assignedColor: playerColors[index],
            isTarget: false,
        });
        legend.push({
            name: `Sample Player ${String(index + 1).padStart(2, '0')}`,
            color: playerColors[index],
            variant: 'defense',
            assignedChampions: [{ url, class: ChampionClass.SCIENCE, nodeNumber: index + 1 }],
        });
    }

    const bannedChampions: { url: string; class: ChampionClass }[] = [];
    const bannedColors: [number, number, number][] = [];
    for (let index = 0; index < bannedCount; index++) {
        const color: [number, number, number] = [220 - index * 9, 20 + index * 13, 200 - index * 8];
        const url = `fixture://banned-${index + 1}`;
        const portrait = await sharp({
            create: { width: 64, height: 64, channels: 3, background: { r: color[0], g: color[1], b: color[2] } },
        }).png().toBuffer();
        imageCache.set(url, `data:image/png;base64,${portrait.toString('base64')}`);
        bannedChampions.push({ url, class: ChampionClass.MYSTIC });
        bannedColors.push(color);
    }

    return { assignments, imageCache, portraitColors, legend, bannedChampions, bannedColors };
}

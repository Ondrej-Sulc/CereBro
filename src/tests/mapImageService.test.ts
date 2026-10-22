import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { WarMapType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { warNodesData, warNodesDataBig } from '../data/war-planning/nodes-data';
import { MapImageService } from '../services/mapImageService';
import { createMapImageFixture } from './fixtures/mapImage';

const maps = [
    { name: 'Big Thing', type: WarMapType.BIG_THING, nodes: warNodesDataBig, width: 700, height: 740 },
    { name: 'standard', type: WarMapType.STANDARD, nodes: warNodesData, width: 1330, height: 1305 },
];

beforeEach(() => {
    // Entropy and network are boundaries; exercise the actual SVG and PNG renderer.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network access'); }));
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function saveArtifact(name: string, png: Buffer) {
    const directory = process.env.MAP_IMAGE_ARTIFACT_DIR;
    if (!directory) return;
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${name}.png`), png);
}

async function pixels(png: Buffer) {
    return sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

function colorBounds(
    image: Awaited<ReturnType<typeof pixels>>,
    color: readonly number[],
    fromX: number,
) {
    let count = 0, top = Infinity, bottom = -Infinity;
    for (let y = 0; y < image.info.height; y++) {
        for (let x = fromX; x < image.info.width; x++) {
            const offset = (y * image.info.width + x) * image.info.channels;
            if (image.data[offset] === color[0] && image.data[offset + 1] === color[1] && image.data[offset + 2] === color[2]) {
                count++;
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
            }
        }
    }
    return { count, top, bottom };
}

describe('war map PNG export', () => {
    it.each(maps)('shows all ten $name defense assignments with complete player rows and portraits', async map => {
        const fixture = await createMapImageFixture();
        const png = await MapImageService.generateMapImage(
            map.type, map.nodes, fixture.assignments, fixture.imageCache, fixture.legend,
        );
        await saveArtifact(`${map.type.toLowerCase().replace('_', '-')}-ten-defenders`, png);
        const image = await pixels(png);
        expect(image.info.width).toBe(map.width + 750);
        if (map.type === WarMapType.STANDARD) expect(image.info.height).toBe(map.height);

        let lastRowBottom = 0;
        for (const [index, color] of fixture.portraitColors.entries()) {
            const portrait = colorBounds(image, color, map.width);
            expect(portrait.count, `Player ${index + 1} defender portrait is visible`).toBeGreaterThan(1200);
            const playerColor = fixture.legend[index].color.match(/[0-9a-f]{2}/gi)!.map(hex => parseInt(hex, 16));
            const row = colorBounds(image, playerColor, map.width);
            expect(row.bottom - row.top, `Player ${index + 1} row is not clipped`).toBeGreaterThanOrEqual(70);
            lastRowBottom = Math.max(lastRowBottom, row.bottom);
        }
        expect(image.info.height - lastRowBottom, 'bottom padding below the last player row').toBeGreaterThan(20);
        expect(fetch).not.toHaveBeenCalled();
    }, 120_000);

    it.each([1, 10, 11])('keeps %i banned-champion portraits fully visible below the player rows', async bannedCount => {
        const fixture = await createMapImageFixture(bannedCount);
        const png = await MapImageService.generateMapImage(
            WarMapType.BIG_THING, warNodesDataBig, fixture.assignments, fixture.imageCache,
            fixture.legend, undefined, fixture.bannedChampions,
        );
        await saveArtifact(`big-thing-${bannedCount}-bans`, png);
        const image = await pixels(png);
        const lastPlayer = colorBounds(image, fixture.portraitColors[9], 0);
        let lastBannedBottom = 0;
        for (const [index, color] of fixture.bannedColors.entries()) {
            const banned = colorBounds(image, color, 0);
            expect(banned.count, `Banned champion ${index + 1} portrait is visible`).toBeGreaterThan(2000);
            expect(banned.bottom - banned.top, 'the full banned portrait height is visible').toBeGreaterThanOrEqual(50);
            expect(banned.top, 'bans appear below the last player').toBeGreaterThan(lastPlayer.bottom);
            lastBannedBottom = Math.max(lastBannedBottom, banned.bottom);
        }
        expect(image.info.height - lastBannedBottom, 'bottom padding below wrapped bans').toBeGreaterThan(20);
        expect(fetch).not.toHaveBeenCalled();
    }, 30_000);

    it.each(maps)('preserves $name map-only output for an absent or empty legend', async map => {
        const fixture = await createMapImageFixture();
        const mapOnly = await MapImageService.generateMapImage(
            map.type, map.nodes, fixture.assignments, fixture.imageCache,
        );
        const emptyLegend = await MapImageService.generateMapImage(
            map.type, map.nodes, fixture.assignments, fixture.imageCache, [], undefined, [],
        );
        await saveArtifact(`${map.type.toLowerCase().replace('_', '-')}-empty-legend`, emptyLegend);
        expect(emptyLegend).toEqual(mapOnly);
        expect(await sharp(emptyLegend).metadata()).toMatchObject({ width: map.width, height: map.height });
        expect(fetch).not.toHaveBeenCalled();
    }, 120_000);

    it.each(maps)('shows all ten players in the default $name attack legend with no bans', async map => {
        const fixture = await createMapImageFixture();
        const legend = fixture.legend.map(item => ({ ...item, variant: undefined, pathLabel: 'P1' }));
        const png = await MapImageService.generateMapImage(
            map.type, map.nodes, fixture.assignments, fixture.imageCache, legend, undefined, [],
        );
        await saveArtifact(`${map.type.toLowerCase().replace('_', '-')}-attack-legend`, png);
        const image = await pixels(png);
        for (const [index, color] of fixture.portraitColors.entries()) {
            expect(colorBounds(image, color, map.width).count, `Player ${index + 1} attacker portrait is visible`)
                .toBeGreaterThan(1200);
        }
        if (map.type === WarMapType.STANDARD) expect(image.info.height).toBe(map.height);
        expect(fetch).not.toHaveBeenCalled();
    }, 120_000);
});

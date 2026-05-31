import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CONFIG } from './rosterConfig.js';
import { RawImageOptions, RosterFeatureService } from './rosterFeatures.js';
import { GridCell } from './types.js';

const imageWidth = 260;
const imageHeight = 300;
const cellBounds = { x: 0, y: 0, width: 220, height: 270 };

async function buildRawImageWithAscensionDigit(digit?: string): Promise<{
  rawImage: Buffer;
  rawOpts: RawImageOptions;
  cell: GridCell;
}> {
  const left = Math.round(cellBounds.x + cellBounds.width * CONFIG.ASCENSION_ICON_RATIO.x);
  const top = Math.round(cellBounds.y + cellBounds.height * CONFIG.ASCENSION_ICON_RATIO.y);
  const width = Math.round(cellBounds.width * CONFIG.ASCENSION_ICON_RATIO.width);
  const height = Math.round(cellBounds.height * CONFIG.ASCENSION_ICON_RATIO.height);

  const overlays: sharp.OverlayOptions[] = [];
  if (digit) {
    const digitMarkup = digit === '1'
      ? '<rect x="14" y="5" width="3" height="16" rx="1" fill="#f4f3ee"/>'
      : `<text x="15" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="#f4f3ee">${digit}</text>`;

    overlays.push({
      left,
      top,
      input: Buffer.from(`
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#282828"/>
          <polygon points="0,8 9,5 15,13 9,22 0,19 5,14" fill="#d6a331"/>
          <polygon points="${width},8 ${width - 9},5 ${width - 15},13 ${width - 9},22 ${width},19 ${width - 5},14" fill="#d6a331"/>
          <circle cx="15" cy="14" r="11" fill="#5a240f" stroke="#d6a331" stroke-width="2"/>
          ${digitMarkup}
        </svg>
      `),
    });
  }

  const { data, info } = await sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 30, g: 30, b: 30, alpha: 1 },
    },
  })
    .composite(overlays)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    rawImage: data,
    rawOpts: { raw: { width: info.width, height: info.height, channels: 4 } },
    cell: { bounds: cellBounds, stars: 7 },
  };
}

describe('RosterFeatureService ascension detection', () => {
  it('returns no ascension when the badge is absent', async () => {
    const service = new RosterFeatureService();
    const { rawImage, rawOpts, cell } = await buildRawImageWithAscensionDigit();

    await expect(service.identifyAscension(rawImage, rawOpts, cell)).resolves.toEqual({
      isAscended: false,
      ascensionLevel: 0,
    });
  });

  it('keeps level 1 for a 7-star ascension badge with a 1 digit', async () => {
    const service = new RosterFeatureService();
    const { rawImage, rawOpts, cell } = await buildRawImageWithAscensionDigit('1');

    await expect(service.identifyAscension(rawImage, rawOpts, cell)).resolves.toEqual({
      isAscended: true,
      ascensionLevel: 1,
    });
  });

  it('detects level 2 for a 7-star ascension badge with a 2 digit', async () => {
    const service = new RosterFeatureService();
    const { rawImage, rawOpts, cell } = await buildRawImageWithAscensionDigit('2');

    await expect(service.identifyAscension(rawImage, rawOpts, cell)).resolves.toEqual({
      isAscended: true,
      ascensionLevel: 2,
    });
  });
});

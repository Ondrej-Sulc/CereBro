
import sharp from 'sharp';
import { CONFIG } from './rosterConfig.js';
import { GridCell } from './types.js';
import { RosterFeatureService } from './rosterFeatures.js';

export class RosterDebugService {
  constructor(private featureService: RosterFeatureService) {}

  public async drawDebugImage(imageBuffer: Buffer, grid: GridCell[], cellDims: {width: number, height: number}, headerMinY?: number): Promise<Buffer> {
    const overlayElements: sharp.OverlayOptions[] = [];

    // Draw Header Line (Red)
    if (headerMinY && headerMinY > 0) {
        const metadata = await sharp(imageBuffer).metadata();
        const width = metadata.width || 1000;
        const lineSvg = `<svg width="${width}" height="4"><line x1="0" y1="2" x2="${width}" y2="2" stroke="red" stroke-width="4" /></svg>`;
        overlayElements.push({
            input: Buffer.from(lineSvg),
            left: 0,
            top: Math.round(headerMinY)
        });
    }

    for (const cell of grid) {
      const { x, y, width, height } = cell.bounds;

      // 1. Cell Bounds (Lime)
      const cellRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="lime" stroke-width="4" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(cellRect),
        left: Math.round(x),
        top: Math.round(y),
      });

      // 2. Class Icon Crop (Blue)
      const cx = x + (width * CONFIG.CLASS_ICON_RATIO.x);
      const cy = y + (height * CONFIG.CLASS_ICON_RATIO.y);
      const cw = width * CONFIG.CLASS_ICON_RATIO.width;
      const ch = height * CONFIG.CLASS_ICON_RATIO.height;
      
      const classRect = `<svg width="${cw}" height="${ch}"><rect x="0" y="0" width="${cw}" height="${ch}" stroke="blue" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(classRect),
        left: Math.round(cx),
        top: Math.round(cy),
      });

      // 3. Portrait Crop (Yellow)
      const px = x + (width * CONFIG.PORTRAIT_RATIO.x);
      const py = y + (height * CONFIG.PORTRAIT_RATIO.y);
      const pw = width * CONFIG.PORTRAIT_RATIO.width;
      const ph = height * CONFIG.PORTRAIT_RATIO.height;

      const portRect = `<svg width="${pw}" height="${ph}"><rect x="0" y="0" width="${pw}" height="${ph}" stroke="yellow" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(portRect),
        left: Math.round(px),
        top: Math.round(py),
      });

      // 3b. Star Crop (Cyan)
      const sx = x + (width * CONFIG.STARS_CHECK_RATIO.x);
      const sy = y + (height * CONFIG.STARS_CHECK_RATIO.y);
      const sw = width * CONFIG.STARS_CHECK_RATIO.width;
      const sh = height * CONFIG.STARS_CHECK_RATIO.height;
      const starRect = `<svg width="${sw}" height="${sh}"><rect x="0" y="0" width="${sw}" height="${sh}" stroke="cyan" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(starRect),
        left: Math.round(sx),
        top: Math.round(sy),
      });

      // 3c. Ascension Crop (Orange)
      const ax = x + (width * CONFIG.ASCENSION_ICON_RATIO.x);
      const ay = y + (height * CONFIG.ASCENSION_ICON_RATIO.y);
      const aw = width * CONFIG.ASCENSION_ICON_RATIO.width;
      const ah = height * CONFIG.ASCENSION_ICON_RATIO.height;
      const ascRect = `<svg width="${aw}" height="${ah}"><rect x="0" y="0" width="${aw}" height="${ah}" stroke="orange" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(ascRect),
        left: Math.round(ax),
        top: Math.round(ay),
      });

      // 4. Text Label
      if (cell.championName || cell.class || cell.rank !== undefined) {
        const rankSig = cell.rank !== undefined ? `R${cell.rank} S${cell.sigLevel || 0}` : '';
        const starStr = cell.stars ? `${cell.stars}*` : '';
        const ascStr = cell.isAscended ? '(ASC)' : '';
        // @ts-ignore
        const starRatio = cell.debugInfo?.starWidthRatio || '';
        // @ts-ignore
        const ascHsl = cell.debugInfo?.ascensionHsl ? `H:${cell.debugInfo.ascensionHsl.h} S:${cell.debugInfo.ascensionHsl.s}` : '';
        // @ts-ignore
        const hue = cell.debugInfo?.classHue ? `${cell.debugInfo.classHue}°` : '';
        
        const line1 = `${cell.championName || '?'}`;
        const line2 = `${starStr} ${rankSig} ${ascStr} [${starRatio}] ${ascHsl}`;
        const line3 = `${hue}`;

        const svgText = `
          <svg width="${width}" height="70">
            <rect x="0" y="0" width="${width}" height="70" fill="black" fill-opacity="0.6" />
            <text x="5" y="20" font-family="Arial" font-size="16" fill="white" font-weight="bold">${line1}</text>
            <text x="5" y="40" font-family="Arial" font-size="14" fill="#dddddd">${line2}</text>
            <text x="5" y="60" font-family="Arial" font-size="14" fill="#aaaaff">${line3}</text>
          </svg>`;
        overlayElements.push({
          input: Buffer.from(svgText),
          left: Math.round(x),
          top: Math.round(y + height/4),
        });

        // Get class icon for overlay if it exists
        if (cell.class) {
            const iconBuffer = this.featureService.getClassIcon(cell.class);
            if (iconBuffer) {
                const classIconBuffer = await sharp(iconBuffer, {
                    raw: { width: 32, height: 32, channels: 4 }
                })
                    .resize(32, 32)
                    .png()
                    .toBuffer();
                
                overlayElements.push({
                    input: classIconBuffer,
                    left: Math.round(x + 5),
                    top: Math.round(y + 5)
                });
            }
        }
      }

      // 5. Best Match Reference Image (Top Right)
      if (cell.debugInfo?.bestMatchBuffer) {
          // Resize to small thumbnail (e.g. 40x40) to fit in corner
          const thumbnail = await sharp(cell.debugInfo.bestMatchBuffer)
            .resize(40, 40)
            .toBuffer();
            
          overlayElements.push({
              input: thumbnail,
              left: Math.round(x + width - 45), // Top right corner with 5px padding
              top: Math.round(y + 5)
          });
      }

      // 6. PI Bounds (Magenta)
      if (cell.piBounds) {
        const { x: px, y: py, width: pw, height: ph } = cell.piBounds;
        const piRect = `<svg width="${pw}" height="${ph}"><rect x="0" y="0" width="${pw}" height="${ph}" stroke="magenta" stroke-width="2" fill="none" /></svg>`;
        overlayElements.push({
            input: Buffer.from(piRect),
            left: Math.round(px),
            top: Math.round(py),
        });
      }
    }

    if (overlayElements.length === 0) return imageBuffer;
    return sharp(imageBuffer).composite(overlayElements).toBuffer();
  }
}

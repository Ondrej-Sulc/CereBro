import sharp from "sharp";
import { promises as fs } from "fs";
import * as path from "path";
import { tmpdir } from "os";
import { ChampionGridCell, Vertex } from "./types";
import logger from "../../../services/loggerService";

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image from ${url}: ${response.statusText}`
    );
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(
          `Expected an image but received content-type ${contentType} from ${url}`
      );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getAverageColor(
  imageBuffer: Buffer
): Promise<{ r: number; g: number; b: number }> {
  const stats = await sharp(imageBuffer).stats();
  // stats.channels is an array of { min, max, sum, squares, mean, stdev } for each channel
  return {
    r: stats.channels[0].mean,
    g: stats.channels[1].mean,
    b: stats.channels[2].mean,
  };
}

export function getColorDistance(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
}

/**
 * Safely extracts a region from an image, clamping coordinates and dimensions to stay within the image boundaries.
 */
export async function safeExtract(
  imageBuffer: Buffer,
  options: { left: number; top: number; width: number; height: number }
): Promise<sharp.Sharp> {
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  let { left, top, width, height } = options;

  // 1. Clamp negative values and adjust dimensions accordingly
  if (left < 0) {
    width += left;
    left = 0;
  }
  if (top < 0) {
    height += top;
    top = 0;
  }

  // 2. Clamp dimensions to image boundaries
  if (imgWidth > 0) {
    if (left >= imgWidth) {
        left = imgWidth - 1;
        width = 1;
    }
    if (left + width > imgWidth) {
        width = imgWidth - left;
    }
  }
  
  if (imgHeight > 0) {
    if (top >= imgHeight) {
        top = imgHeight - 1;
        height = 1;
    }
    if (top + height > imgHeight) {
        height = imgHeight - top;
    }
  }

  // 3. Ensure positive dimensions (sharp requires > 0)
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  left = Math.floor(left);
  top = Math.floor(top);

  return sharp(imageBuffer).extract({ left, top, width, height });
}

export async function getImageHash(imageBuffer: Buffer): Promise<string> {
  try {
    // 1. Resize to 8x8 and convert to grayscale
    const pixelBuffer = await sharp(imageBuffer)
      .grayscale()
      .resize(8, 8, { fit: "fill" }) // Use 'fill' to ignore aspect ratio
      .raw()
      .toBuffer();

    // 2. Compute the average color
    let totalValue = 0;
    for (let i = 0; i < pixelBuffer.length; i++) {
      totalValue += pixelBuffer[i];
    }
    const averageValue = totalValue / pixelBuffer.length;

    // 3. Compute the bits and construct the hash
    let hash = 0n; // Use BigInt for 64-bit integer
    for (let i = 0; i < pixelBuffer.length; i++) {
      if (pixelBuffer[i] >= averageValue) {
        hash |= 1n;
      }
      if (i < pixelBuffer.length - 1) {
        hash <<= 1n;
      }
    }

    // 4. Return as a hex string
    return hash.toString(16).padStart(16, "0");
  } catch (error) {
    logger.error({ err: error }, "Failed to generate average image hash");
    throw error;
  }
}

export function compareHashes(hash1: string, hash2: string): number {
  // Convert hex strings to BigInts
  const h1 = BigInt(`0x${hash1}`);
  const h2 = BigInt(`0x${hash2}`);

  // XOR the two hashes
  let xorResult = h1 ^ h2;

  // Count the number of set bits (1s) in the XOR result (Hamming distance)
  let distance = 0;
  while (xorResult > 0n) {
    // This checks if the last bit is 1
    if (xorResult & 1n) {
      distance++;
    }
    // Right shift to check the next bit
    xorResult >>= 1n;
  }

  return distance;
}

export async function drawDebugBoundsOnImage(
  imageBuffer: Buffer,
  grid: ChampionGridCell[][],
  topBoundary: number
): Promise<Buffer> {
  const overlayElements: sharp.OverlayOptions[] = [];
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width || 0;

  // Grid bounds (lime)
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.bounds || cell.bounds.length < 4) continue;
      const [topLeft, , bottomRight] = cell.bounds;
      const width = Math.abs(bottomRight.x - topLeft.x);
      const height = Math.abs(bottomRight.y - topLeft.y);

      if (width > 0 && height > 0) {
        const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="lime" stroke-width="4" fill="none" /></svg>`;
        overlayElements.push({
          input: Buffer.from(svgRect),
          left: Math.round(topLeft.x),
          top: Math.round(topLeft.y),
        });
      }
    }
  }

  // Awakened check bounds (blue)
  for (const row of grid) {
    for (const cell of row) {
      if (cell.awakenedCheckBounds) {
        const [topLeft, , bottomRight] = cell.awakenedCheckBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="blue" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  // Short name solve bounds (orange)
  for (const row of grid) {
    for (const cell of row) {
      if (cell.shortNameSolveBounds) {
        const [topLeft, , bottomRight] = cell.shortNameSolveBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="orange" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  // Top boundary line (red)
  if (topBoundary > 0 && imageWidth > 0) {
    const svgLine = `<svg width="${imageWidth}" height="${metadata.height}"><line x1="0" y1="${topBoundary}" x2="${imageWidth}" y2="${topBoundary}" stroke="red" stroke-width="3" /></svg>`;
    overlayElements.push({
      input: Buffer.from(svgLine),
      top: 0,
      left: 0,
    });
  }

  // Inner portrait crop bounds (yellow)
  for (const row of grid) {
    for (const cell of row) {
      if (cell.innerPortraitCropBounds) {
        const [topLeft, , bottomRight] = cell.innerPortraitCropBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="yellow" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  // Best match image previews
  for (const row of grid) {
    for (const cell of row) {
      if (cell.bestMatchImageBuffer) {
        const [topLeft, topRight, ,] = cell.bounds;

        const resizedThumbnail = await sharp(cell.bestMatchImageBuffer)
          .resize(50, 50)
          .toBuffer();

        overlayElements.push({
          input: resizedThumbnail,
          left: Math.round(topRight.x - 50),
          top: Math.round(topLeft.y),
        });
      }
    }
  }

  if (overlayElements.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(overlayElements).toBuffer();
}

import sharp from "sharp";
import * as opentype from "opentype.js";
import { promises as fs } from "fs";
import path from "path";
import { getAssetsPath } from "../../utils/assets.js";

export interface AQHeaderOptions {
  day: number;
  channelName: string;
  battlegroupName: string;
  width?: number;
  height?: number;
}

const DEFAULTS = {
  width: 700,
  height: 150,
  padding: 20,
};

// ---- utils ----

let cachedTitleFont: opentype.Font | null = null;

function nodeBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return Uint8Array.from(buf).buffer;
}

async function loadTitleFont(): Promise<opentype.Font | null> {
  try {
    if (cachedTitleFont) return cachedTitleFont;
    const localTtf = getAssetsPath("fonts/BebasNeue-Regular.ttf");
    const local = await fs.readFile(localTtf);
    const font = opentype.parse(nodeBufferToArrayBuffer(local));
    cachedTitleFont = font;
    return font;
  } catch {
    return null;
  }
}

const NEUTRAL_COLORS = {
  primary: "#4A5568",
  secondary: "#2D3748",
};

// ---- background ----

function createBackgroundSvg(width: number, height: number): Buffer {
  const { primary, secondary } = NEUTRAL_COLORS;
  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
        <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="vign" cx="50%" cy="50%" r="75%">
          <stop offset="70%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGrad)"/>
      <rect width="100%" height="100%" fill="url(#sheen)"/>
      <rect width="100%" height="100%" fill="url(#vign)"/>
    </svg>
  `;
  return Buffer.from(svg);
}

function createGlassPanelSvg(width: number, height: number): Buffer {
  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panelG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}"
        fill="url(#panelG)"
        stroke="#ffffff" stroke-opacity="0.18" stroke-width="1"/>
    </svg>
  `;
  return Buffer.from(svg);
}

// ---- text ----

function createPill(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font: opentype.Font,
  fontSize: number
): string {
  const textPathData = font.getPath(text, 0, 0, fontSize).toPathData(2);
  const textWidth = font.getAdvanceWidth(text, fontSize);

  const textX = x + (width - textWidth) / 2;
  const textY = y + height / 2 + fontSize * 0.35;

  return `
    <g>
      <rect x="${x}" y="${y}" rx="10" ry="10" width="${width}" height="${height}" fill="url(#pillGrad)" filter="url(#pillGlow)"/>
      <path d="${font
        .getPath(text, textX, textY, fontSize)
        .toPathData(2)}" fill="#ffffff"/>
    </g>
  `;
}

function createTextSvg(opts: {
  day: number;
  channelName: string;
  battlegroupName: string;
  width: number;
  height: number;
  padding: number;
  font: opentype.Font | null;
}): Buffer {
  const { day, channelName, battlegroupName, width, height, padding, font } = opts;

  const mainTitle = "Alliance Quest";
  const dayText = `Day ${day}`;
  const channelText = `#${channelName}`;
  const battlegroupText = battlegroupName;

  const titleSize = 54;
  const subTextSize = 24;

  const titleY = padding + titleSize;

  let mainTitlePath = "";
  let dayTextPath = "";
  let channelPill = "";
  let battlegroupPill = "";

  if (font) {
    const mainTitlePathData = font
      .getPath(mainTitle, padding, titleY, titleSize)
      .toPathData(2);
    mainTitlePath = `<g transform="skewX(-5)"><path d="${mainTitlePathData}" fill="#ffffff" filter="url(#titleShadow)"/></g>`;

    const dayTextWidth = font.getAdvanceWidth(dayText, titleSize);
    const dayTextPathData = font
      .getPath(dayText, width - padding - dayTextWidth, titleY, titleSize)
      .toPathData(2);
    dayTextPath = `<path d="${dayTextPathData}" fill="#ffffff" filter="url(#titleShadow)"/>`;

    const pillHeight = subTextSize + 10;
    const pillPadding = 10;

    const channelTextWidth = font.getAdvanceWidth(channelText, subTextSize);
    const channelPillWidth = channelTextWidth + pillPadding * 2;
    channelPill = createPill(
      channelText,
      padding,
      height - padding - pillHeight,
      channelPillWidth,
      pillHeight,
      font,
      subTextSize
    );

    const battlegroupTextWidth = font.getAdvanceWidth(battlegroupText, subTextSize);
    const battlegroupPillWidth = battlegroupTextWidth + pillPadding * 2;
    battlegroupPill = createPill(
      battlegroupText,
      width - padding - battlegroupPillWidth,
      height - padding - pillHeight,
      battlegroupPillWidth,
      pillHeight,
      font,
      subTextSize
    );
  }

  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="titleShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.5" />
        </filter>
        <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${NEUTRAL_COLORS.primary}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${NEUTRAL_COLORS.secondary}" stop-opacity="0.5"/>
        </linearGradient>
        <filter id="pillGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${NEUTRAL_COLORS.primary}" flood-opacity="0.7" />
        </filter>
      </defs>
      ${mainTitlePath}
      ${dayTextPath}
      ${channelPill}
      ${battlegroupPill}
    </svg>
  `;
  return Buffer.from(svg);
}

// ---- main ----

export async function generateAQHeader(
  options: AQHeaderOptions
): Promise<Buffer> {
  const {
    day,
    channelName,
    battlegroupName,
    width = DEFAULTS.width,
    height = DEFAULTS.height,
  } = options;

  const font = await loadTitleFont();

  const bg = createBackgroundSvg(width, height);
  const glassPanel = createGlassPanelSvg(width, height);

  const textSvg = createTextSvg({
    day,
    channelName,
    battlegroupName,
    width,
    height,
    padding: DEFAULTS.padding,
    font,
  });

  const finalImage = await sharp(bg)
    .composite([
      {
        input: glassPanel,
        left: 0,
        top: 0,
      },
      {
        input: textSvg,
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  return finalImage;
}

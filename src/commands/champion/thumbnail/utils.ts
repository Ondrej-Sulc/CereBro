import * as opentype from "opentype.js";
import { promises as fs } from "fs";
import path from "path";
import { getAssetsPath } from "../../../utils/assets.js";

// ---- utils ----

export const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function hexToRgba(hex: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const clean = hex.replace(/^#/, "");
  const hasAlpha = clean.length === 8;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const a = hasAlpha ? parseInt(clean.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

export function rgbaToHex(r: number, g: number, b: number, a: number = 255): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

export function adjustColorBrightness(hex: string, factor: number): string {
  const { r, g, b, a } = hexToRgba(hex);
  const adj = (v: number) =>
    v + (factor >= 0 ? (255 - v) * factor : v * factor);
  return rgbaToHex(adj(r), adj(g), adj(b), a);
}

export async function fetchArrayBufferWithTimeout(
  url: string,
  timeoutMs: number
): Promise<ArrayBuffer> {
  const { default: fetch } = await import("node-fetch");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "mcoc-bot-thumbnail/1.0" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

let cachedTitleFont: opentype.Font | null = null;

function nodeBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice().buffer;
}

export async function loadTitleFont(): Promise<opentype.Font | null> {
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

export function computeTitleLayout(
  title: string,
  padding: number,
  titleRightLimit: number,
  font: opentype.Font | null
): {
  lines: string[];
  fontSize: number;
  yTitle: number;
  maxTitleWidth: number;
} {
  const maxTitleWidth = titleRightLimit - padding;
  const baseSize = 72;
  const minSize = 26;

  const measure = (text: string, size: number) => {
    if (!font) return text.length * (size * 0.6); // Fallback
    return font.getAdvanceWidth(text, size);
  };

  // Find optimal font size for a single line
  let fontSize = baseSize;
  for (let s = baseSize; s >= minSize; s--) {
    if (measure(title, s) <= maxTitleWidth) {
      fontSize = s;
      break;
    }
    if (s === minSize) {
      fontSize = minSize;
    }
  }

  let lines: string[] = [title];
  // if it still doesn't fit at minSize, we must wrap
  if (measure(title, fontSize) > maxTitleWidth) {
    const words = title.split(/\s+/);
    let line1 = "";
    let line2 = "";

    // Greedy word wrap
    for (const w of words) {
      const testLine = line1 ? `${line1} ${w}` : w;
      if (measure(testLine, minSize) <= maxTitleWidth) {
        // use minSize for wrapping decision
        line1 = testLine;
      } else {
        line2 = line2 ? `${line2} ${w}` : w;
      }
    }

    // Handle cases where a single word is too long
    if (!line1) {
      line1 = words[0];
      line2 = words.slice(1).join(" ");
    }

    lines = [line1, line2.trim()].filter(Boolean);
    if (lines.length > 1) {
      const longerLine =
        measure(lines[0], 100) > measure(lines[1], 100) ? lines[0] : lines[1];
      // Recalculate font size for the wrapped lines
      for (let s = baseSize; s >= minSize; s--) {
        if (measure(longerLine, s) <= maxTitleWidth) {
          fontSize = s;
          break;
        }
        if (s === minSize) {
          fontSize = minSize;
        }
      }
    }
  }

  const yTitle = padding + fontSize;
  return { lines, fontSize, yTitle, maxTitleWidth };
}

export function buildTitlePathsMarkup(
  font: opentype.Font,
  lines: string[],
  fontSize: number,
  padding: number,
  yTitle: number,
  maxTitleWidth: number
): string {
  const makePath = (text: string) => {
    const advance = font.getAdvanceWidth(text, fontSize, { kerning: true });
    const scale = advance > 0 ? Math.min(1, maxTitleWidth / advance) : 1;
    const yBaseline = yTitle; // baseline already computed upstream
    const path = font.getPath(text, 0, 0, fontSize);
    const d = path.toPathData(2);
    return `<g transform="translate(${padding}, ${yBaseline}) scale(${scale}) skewX(-5)">
      <path d="${d}" fill="url(#titleGrad)" filter="url(#titleShadow)"/>
    </g>`;
  };

  if (lines.length === 1) {
    return makePath(lines[0]);
  }
  const gap = 12; // increase line gap for better readability with outline
  const topY = yTitle - (fontSize + gap) / 2;
  const botY = yTitle + (fontSize + gap) / 2;
  // For two-line, rebuild with specific y baselines
  const makePathAtY = (text: string, y: number) => {
    const advance = font.getAdvanceWidth(text, fontSize, { kerning: true });
    const scale = advance > 0 ? Math.min(1, maxTitleWidth / advance) : 1;
    const path = font.getPath(text, 0, 0, fontSize);
    const d = path.toPathData(2);
    return `<g transform="translate(${padding}, ${y}) scale(${scale}) skewX(-5)">
      <path d="${d}" fill="url(#titleGrad)" filter="url(#titleShadow)"/>
    </g>`;
  };
  return `${makePathAtY(lines[0], topY)}${makePathAtY(lines[1], botY)}`;
}

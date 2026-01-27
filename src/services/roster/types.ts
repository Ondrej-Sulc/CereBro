
import { ChampionClass } from '@prisma/client';

export interface GridCell {
  bounds: { x: number; y: number; width: number; height: number };
  piBounds?: { x: number; y: number; width: number; height: number };
  rank?: number;
  sigLevel?: number;
  stars?: number;
  isAscended?: boolean;
  powerRating?: number;
  class?: ChampionClass;
  championName?: string;
  debugInfo?: {
    classMatch?: { bestMatch?: string; minRMSE?: number; minHueDiff?: string };
    classHue?: string;
    championMatch?: { bestMatch?: string; minDistance?: number };
    starColor?: { r: number; g: number; b: number };
    hsl?: { h: number; s: number; l: number };
    starWidthRatio?: string;
    starContentWidth?: number;
    ascensionColor?: any;
    ascensionHsl?: any;
    brightness?: number;
    bestMatchBuffer?: Buffer;
  };
}

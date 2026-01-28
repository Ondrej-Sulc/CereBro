import { Champion, Roster } from "@prisma/client";

// --- Interfaces for data structures ---
export type Vertex = { x: number; y: number };

export interface OcrResult {
  text: string;
  bounds: Vertex[];
}

export interface ChampionGridCell {
  bounds: Vertex[];
  championName?: string;
  champion?: ChampionData;
  powerRating?: string;
  isAwakened?: boolean;
  awakenedCheckBounds?: Vertex[];
  shortNameSolveBounds?: Vertex[];
  innerPortraitCropBounds?: Vertex[];
  bestMatchImageBuffer?: Buffer | null;
}

export interface ChampionData {
  id: number;
  name: string;
  shortName: string;
  discordEmoji: string | null;
}

export interface RosterUpdateResult {
  champions: RosterWithChampion[][];
  count: number;
  errors?: string[];
}

export interface RosterDebugResult {
  message: string;
  imageBuffer?: Buffer;
  debugImageBuffer?: Buffer;
}

export type RosterWithChampion = Roster & { champion: Champion };

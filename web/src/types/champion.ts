import { Champion as PrismaChampion } from '@prisma/client';

export interface ChampionImages {
  hero: string;
  full_primary: string;
  full_secondary: string;
  p_32: string;
  s_32: string;
  p_64: string;
  s_64: string;
  p_128: string;
  s_128: string;
}

export interface Champion extends PrismaChampion {
  abilities?: { ability: { name: string } }[];
}
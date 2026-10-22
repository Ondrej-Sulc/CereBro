import type { Champion as PrismaChampion, Tag } from '@prisma/client';
import type { KitResistance } from '@/lib/champion-kit';

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

export interface Champion extends Omit<PrismaChampion, 'images'> {
  images: ChampionImages;
  abilities?: { 
    type: 'ABILITY' | 'IMMUNITY';
    resistances?: KitResistance[];
    ability: { 
      id: number;
      name: string;
      categories: { name: string }[];
    } 
  }[];
  tags?: Tag[];
}

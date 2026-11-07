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
  /** Stars with an explicit collectible, non-event blueprint ascension path. Not owned status or affordability. */
  ascendableRarities?: number[];
  /** Missing rarity keys mean no rule is recorded, rather than a known zero cap. */
  ascensionMaxLevels?: Record<string, number>;
  abilities?: { 
    type: 'ABILITY' | 'IMMUNITY';
    resistances?: KitResistance[];
    ability: { 
      id: number;
      name: string;
      iconUrl?: string | null;
      gameGlossaryTerm?: { raw: unknown } | null;
      categories: { name: string }[];
    } 
  }[];
  tags?: Tag[];
}

import { ChampionClass } from '@prisma/client';

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

export interface Champion {
  id: number;
  name: string;
  class: ChampionClass;
  images: any; // Allow any type from Prisma JsonValue
  abilities?: { ability: { name: string } }[];
}
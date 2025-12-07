import { Player, WarFight, WarNode, WarNodeAllocation, NodeModifier, ChampionClass, SeasonBan, WarBan } from "@prisma/client";

export type PlayerWithRoster = Player & {
  roster: {
    championId: number;
    stars: number;
    rank: number;
    isAscended: boolean;
    isAwakened: boolean;
  }[];
};

export type SeasonBanWithChampion = SeasonBan & {
  champion: { id: number; name: string; images: any };
};

export type WarBanWithChampion = WarBan & {
  champion: { id: number; name: string; images: any };
};

export interface FightWithNode extends WarFight {
  node: WarNode & {
      allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
  };
  attacker: { id: number; name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  defender: { id: number; name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  player: { id: string; ingameName: string; avatar: string | null } | null;
  prefightChampions?: { 
      id: number; // Champion ID
      name: string; 
      images: any;
      fightPrefightId?: string;
      player?: { id: string; ingameName: string; avatar: string | null } | null;
  }[];
}

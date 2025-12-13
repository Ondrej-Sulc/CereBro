import { Player, WarFight, WarNode, WarNodeAllocation, NodeModifier, ChampionClass, SeasonBan, WarBan, WarDefensePlacement } from "@prisma/client";

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
  type: "attack"; // Discriminator
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

export interface PlacementWithNode extends WarDefensePlacement {
  type: "defense"; // Discriminator
  node: WarNode & {
      allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
  };
  defender: { id: number; name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  player: { id: string; ingameName: string; avatar: string | null } | null;
  // Attack-specific fields are missing or null
  attacker?: null;
  attackerId?: null;
  prefightChampions?: never[];
  death?: 0;
  notes?: null;
}

export type WarPlacement = FightWithNode | PlacementWithNode;


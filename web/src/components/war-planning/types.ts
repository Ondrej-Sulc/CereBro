import { Player, WarFight, WarNode, WarNodeAllocation, NodeModifier, ChampionClass } from "@prisma/client";

export type PlayerWithRoster = Player & {
  roster: {
    championId: number;
    stars: number;
    rank: number;
    isAscended: boolean;
    isAwakened: boolean;
  }[];
};

export interface FightWithNode extends WarFight {
  node: WarNode & {
      allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
  };
  attacker: { name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  defender: { name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  player: { ingameName: string } | null;
  prefightChampions?: { id: number; name: string; images: any }[];
}

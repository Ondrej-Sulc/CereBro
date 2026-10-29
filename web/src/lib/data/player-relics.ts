import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getPlayerRelicState } from "@cerebro/core/services/playerRelicService";
import type { RelicInventorySnapshot } from "@cerebro/core/domain/player-relics";

// Never put profile ownership into the shared catalog cache.
export async function getPlayerRelicInventory(): Promise<RelicInventorySnapshot> {
  const player = await getUserPlayerWithAlliance();
  return player
    ? {
        profile: { id: player.id, name: player.ingameName },
        ...await getPlayerRelicState(prisma, player.id),
      }
    : { profile: null, entries: [], prestige: null };
}

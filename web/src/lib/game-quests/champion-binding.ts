import type { GameIdentity } from "@cerebro/core/domain/game-quests";
import type { QuestPortrait } from "./presentation";

type Identity = Pick<GameIdentity, "gameId" | "champion">;

export function isExactQuestChampionBinding(identity: Identity, portrait?: QuestPortrait) {
  const binding = portrait?.championBinding;
  return !!binding && Number.isSafeInteger(binding.id) && binding.id > 0 && binding.gameId === identity.gameId
    && (!identity.champion || identity.champion.id === binding.id);
}

/** Frozen playable links remain valid; NPC navigation requires an exact database binding. */
export function questChampionPortrait(identity: Identity, portraits: Record<string, QuestPortrait>) {
  const portrait = portraits[identity.gameId];
  if (!portrait) return undefined;
  return portrait.championBinding ? isExactQuestChampionBinding(identity, portrait) ? portrait : undefined : identity.champion ? portrait : undefined;
}

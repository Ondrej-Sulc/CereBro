import Image from "next/image";
import { UserRound } from "lucide-react";
import type { QuestPortrait as Portrait } from "@/lib/game-quests/presentation";
import { questChampionPortrait } from "@/lib/game-quests/champion-binding";
import type { GameIdentity } from "@cerebro/core/domain/game-quests";

/** Exact database bindings add navigation without changing the recorded NPC classification. */
export function questEncounterPortrait(identity:GameIdentity, portraits:Record<string,Portrait>) {
  const champion = questChampionPortrait(identity, portraits);
  if (champion) return champion;
  const portrait=portraits[identity.gameId];
  return !portrait?.championBinding && portrait?.nativeGameId===identity.gameId && portrait.href===null && ["/game-quests/permanent-art/", "/game-quests/progressed-art/"].some(prefix=>portrait.imageUrl?.startsWith(prefix)) ? portrait : undefined;
}
export function QuestPortrait({ portrait, large = false }: { portrait?: Portrait; large?: boolean }) {
  return <span data-quest-portrait={portrait?.imageUrl ? "resolved" : "fallback"} style={{ borderColor: portrait?.color ?? "#475569", width: large ? 72 : 48, height: large ? 72 : 48 }} className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-800">
    {portrait?.imageUrl ? <Image src={portrait.imageUrl} alt="" width={large ? 72 : 48} height={large ? 72 : 48} sizes={large ? "72px" : "48px"} /> : <UserRound aria-hidden="true" className="h-6 w-6 text-slate-500" />}
  </span>;
}

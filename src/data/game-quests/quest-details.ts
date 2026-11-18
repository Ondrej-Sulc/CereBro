import { z } from "zod";
import raw from "./quest-details.json";
import manifest from "./manifest.json";
import { permanentData } from "./permanent";
import { applyQuestDetails, questDetailsLayerSchema } from "../../domain/game-quests/quest-details";
import type { QuestMap } from "../../domain/game-quests";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const data = z.object({ version: z.literal(1), maps: z.record(z.string(), questDetailsLayerSchema), sourceAuditSha256: hash,
  sourceHashes: z.record(z.string(), hash), nativeSemanticsSources: z.record(z.string(), hash), publicManifestHashes: z.record(z.string(), hash),
  counts: z.object({ maps: z.number().int().nonnegative(), chests: z.number().int().nonnegative(), unresolvedChestAssets: z.number().int().nonnegative(),
    mapsWithoutChestCapture: z.number().int().nonnegative(), championRequirements: z.number().int().nonnegative(), unresolvedChampionRequirements: z.number().int().nonnegative() }).strict(),
}).strict().parse(raw);

/** Bind the overlay to the independently published map hash, then check its placements. */
export function withQuestDetails(map: QuestMap): QuestMap {
  const layer = data.maps[map.questId];
  if (!layer) return map;
  const publishedHash = permanentData.maps[map.questId]?.publicMapSha256
    ?? (manifest.outputs as Record<string, string>)[`maps/${map.questId}.json`];
  if (!publishedHash || layer.publicMapSha256 !== publishedHash) throw new Error("Quest details public map hash mismatch");
  return applyQuestDetails(map, layer);
}

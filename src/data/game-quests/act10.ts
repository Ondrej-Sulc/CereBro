import raw from "./act10.json";
import type { EncounterOccurrence } from "../../domain/game-quests";
import type { QuestRewardRecord } from "./rewards";

type MapSource = { mapId: string; catalogSourceHash: string; sourceHash: string; publicMapSha256: string; walkableNodes: number; authoredPaths: number; placedEncounters: number };
export const act10Data = raw as unknown as {
  id: string; bcgSha256: string; maps: Record<string, MapSource>; encounters: EncounterOccurrence[];
  rewards: Record<string, QuestRewardRecord>; sources: Record<string, { capturedAt: string }>;
  coverage: { maps: number; tiles: number; paths: number; placements: number; portals: number; applications: number };
  modifierCoverage: { applications: number; distinctIds: number; resolvedDefinitions: number; verifiedIcons: number };
};

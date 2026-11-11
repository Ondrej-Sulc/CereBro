import raw from "./permanent.json";
import progressed from "./progressed.json";
import { act10Data } from "./act10";
import type { GameIdentity, EncounterOccurrence, QuestSummary } from "../../domain/game-quests";

type Image = { url: string; sha256: string; width?: number; height?: number };
type PermanentData = {
  bcgSha256: string;
  id: string; publicQuestIds: string[]; publicSections: Record<string,"Story"|"Special">; specialCollections: Record<string,string>;
  maps: Record<string,{ publicMapSha256: string; mapId: string; catalogSourceHash: string; sourceHash: string; walkableNodes: number; authoredPaths: number; placedEncounters: number }>;
  bossPreviews: Record<string,{ catalogSourceHash: string; mapId:string; containerSetId:string; sourceHash: string; sourcePointer: string; bosses: GameIdentity[] }>;
  nativePortraits: Record<string,Image & {character:string;sourceBcgSha256:string}>;
  encounters: EncounterOccurrence[];
  towers: { id: string; name: string; category: string; artwork: Image | null }[];
  unavailableCollections: string[];
};
const previous = raw as unknown as PermanentData;
const supplement = progressed as unknown as Pick<PermanentData, "id" | "publicQuestIds" | "publicSections" | "specialCollections" | "maps" | "bossPreviews" | "nativePortraits" | "encounters" | "bcgSha256">;
if (supplement.bcgSha256 !== previous.bcgSha256) throw new Error("Quest identity source mismatch");
if (act10Data.bcgSha256 !== previous.bcgSha256) throw new Error("Act 10 identity source mismatch");
export const permanentData: PermanentData = {
  ...previous, ...supplement,
  specialCollections: { ...previous.specialCollections, ...supplement.specialCollections },
  maps: { ...previous.maps, ...supplement.maps, ...act10Data.maps },
  bossPreviews: { ...previous.bossPreviews, ...supplement.bossPreviews },
  nativePortraits: { ...previous.nativePortraits, ...supplement.nativePortraits },
  encounters: [...previous.encounters, ...supplement.encounters, ...act10Data.encounters],
  unavailableCollections: [],
};
export function getBossPreview(q:QuestSummary) {
  const p=permanentData.bossPreviews[q.id];
  return p?.catalogSourceHash===q.sourceHash && p.mapId===q.mapId && p.containerSetId===q.containerSetId ? p : undefined;
}

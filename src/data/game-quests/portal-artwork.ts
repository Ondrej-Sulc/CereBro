import artwork from "./portal-artwork.json";

export type QuestPortalArtworkKey = "entranceHalf" | "summoningQuarter" | "exitQuarter" | "small";

export interface QuestPortalArtwork {
  url: string;
  width: number;
  height: number;
  sha256: string;
}

/** Decorative original art selection; these keys do not assert native portal roles. */
export function getQuestPortalArtwork(key: QuestPortalArtworkKey): QuestPortalArtwork | undefined {
  if (!Object.hasOwn(artwork, key)) return undefined;
  return { ...artwork[key] };
}

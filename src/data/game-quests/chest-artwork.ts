import manifest from "./chest-artwork.json";

export interface QuestChestArtwork {
  asset: string;
  imageUrl: string;
  sha256: string;
  width: number;
  height: number;
}

const assets: Readonly<Record<string, Omit<QuestChestArtwork, "asset">>> = manifest.assets;

/** Exact native chest asset lookup; unsupported identities retain the caller's neutral icon. */
export function getQuestChestArtwork(asset: string | null): QuestChestArtwork | undefined {
  if (asset === null || !Object.hasOwn(assets, asset)) return undefined;
  const artwork = assets[asset];
  return { asset, imageUrl: artwork.imageUrl, sha256: artwork.sha256, width: artwork.width, height: artwork.height };
}

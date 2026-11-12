import snapshot from "./v2/index.json";

const index = snapshot as unknown as {
  profile: { bcgSha256: string };
  records: { id: string; versionHashes: string[] }[];
};
const versions = new Map(index.records.map(row => [row.id, new Set(row.versionHashes)]));

/** Server-side projection: link only when the native page includes the observed version. */
export function nativeModifierHref(effectId: string, versionHash: string | undefined, bcgSha256: string | undefined): string | null {
  return bcgSha256 === index.profile.bcgSha256 && versionHash && versions.get(effectId)?.has(versionHash)
    ? `/nodes/${encodeURIComponent(effectId)}` : null;
}

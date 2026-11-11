import type { QuestSummary } from "./index";

export type MenuArtManifest = {
  version: number; captureSha256: string; catalogSha256: string;
  assets: Record<string, { url: string; sha256: string; sourceSha256: string; width: number; height: number }>;
  references: Record<string, { ownerKind: string; ownerId: string; containerSetId: string; field: string; sourcePointer: string; state: string; asset: string | null }>;
  owners: Record<string, { kind: string; id: string; containerSetId: string; name: string; actId?: string; images: Record<string, string> }>;
  quests: Record<string, { catalogSourceHash: string; mapId: string; containerSetId: string; actImage: string; parents: { act: string; chapter: string }[] }>;
};
export type MenuArtwork = { url: string; width: number; height: number; role: "act" | "chapter"; label: string; ownerId: string; sourcePointer: string; captureSha256: string };

function ownerArtwork(key: string, manifest: MenuArtManifest): MenuArtwork | null {
  const owner = manifest.owners[key];
  if (!owner || (owner.kind !== "act" && owner.kind !== "chapter")) return null;
  const ref = manifest.references[owner.images.image];
  if (!ref || ref.field !== "image" || ref.state !== "authored" || !ref.asset || ref.ownerKind !== owner.kind || ref.ownerId !== owner.id || ref.containerSetId !== owner.containerSetId) return null;
  const asset = manifest.assets[ref.asset];
  return asset ? { url: asset.url, width: asset.width, height: asset.height, role: owner.kind,
    label: owner.kind === "chapter" ? "Chapter artwork" : "Act artwork", ownerId: owner.id,
    sourcePointer: ref.sourcePointer, captureSha256: manifest.captureSha256 } : null;
}

/** Native art is a separate source; it must still bind this exact frozen quest identity. */
function verifiedParents(q: QuestSummary, manifest: MenuArtManifest) {
  const bound = manifest.quests[q.id];
  if (!bound || bound.catalogSourceHash !== q.sourceHash || bound.mapId !== q.mapId || bound.containerSetId !== q.containerSetId) return null;
  const expected = q.hierarchy.map(h => ({ act: JSON.stringify(["act", q.containerSetId, h.actId]), chapter: JSON.stringify(["chapter", q.containerSetId, h.chapterId]) }));
  if (expected.length !== bound.parents.length || expected.some(e => !bound.parents.some(p => p.act === e.act && p.chapter === e.chapter))) return null;
  return bound.parents;
}

function uniqueArtwork(art: (MenuArtwork | null)[]) {
  const supported = art.filter((a): a is MenuArtwork => a !== null);
  return supported.length && new Set(supported.map(a => a.url)).size === 1 ? supported[0] : null;
}

export function questMenuArtwork(q: QuestSummary, manifest: MenuArtManifest): MenuArtwork | null {
  const parents = verifiedParents(q, manifest);
  if (!parents) return null;
  const bound = manifest.quests[q.id];
  const direct = manifest.references[bound.actImage];
  const asset = direct?.asset ? manifest.assets[direct.asset] : null;
  const directAct: MenuArtwork | null = direct?.state === "authored" && direct.ownerKind === "quest" && direct.ownerId === q.id && direct.containerSetId === q.containerSetId && direct.field === "actImage" && asset
    ? { url: asset.url, width: asset.width, height: asset.height, role: "act", label: "Act artwork", ownerId: q.id, sourcePointer: direct.sourcePointer, captureSha256: manifest.captureSha256 } : null;
  // Special headers use the collection's Act poster. Chapter selection keeps its own explicit art.
  const act = uniqueArtwork(parents.map(p => ownerArtwork(p.act, manifest)));
  const chapter = uniqueArtwork(parents.map(p => ownerArtwork(p.chapter, manifest)));
  return (q.section === "Special" ? act ?? chapter : chapter ?? act)
    ?? directAct; // Exact artwork field on this quest; does not invent a parent relationship.
}

export function groupMenuArtwork(quests: QuestSummary[], manifest: MenuArtManifest, scope?: { kind: "act" | "chapter"; id: string }): MenuArtwork | null {
  if (!scope) {
    // A collection's editorial representative retains its actual parent role and source identity.
    for (const q of quests) {
      const parents = verifiedParents(q, manifest);
      const art = parents ? uniqueArtwork(parents.map(p => ownerArtwork(p.act, manifest))) : null;
      if (art) return art;
    }
    for (const q of quests) { const art = questMenuArtwork(q, manifest); if (art) return art; }
    return null;
  }
  const keys = new Set(quests.flatMap(q => (verifiedParents(q, manifest) ?? []).flatMap(p => {
    const key = p[scope.kind], owner = manifest.owners[key];
    return owner?.id === scope.id ? [key] : [];
  })));
  return uniqueArtwork([...keys].map(key => ownerArtwork(key, manifest)));
}

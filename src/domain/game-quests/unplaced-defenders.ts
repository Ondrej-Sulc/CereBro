/** Native preview definitions. These types intentionally have no placement seam. */
export type UnplacedDefenderIdentity = {
  tierId: string;
  gameId: string;
  rarity: number;
  name: string;
  portraitUrl: string | null;
};

export type UnplacedDefenderRow = {
  sourceIndex: number;
  bossId: string;
  tierId: string;
  candidateTierIds: string[];
  rank: number;
  level: number;
  signature: number;
  ascension: number;
  nativeType: { value: number; name: string };
};

export type UnplacedQuestBinding = {
  questId: string;
  mapId: string;
  containerSetId: string;
  summarySetId: string;
  catalogSourceHash: string;
  definitionSourceHash: string;
};

export type UnplacedQuestRecord = UnplacedQuestBinding & {
  version: 1;
  sourceFile: string;
  sourcePointer: string;
  rows: UnplacedDefenderRow[];
};

export type UnplacedDefenderPreview = {
  key: string;
  identity: UnplacedDefenderIdentity;
  candidates: UnplacedDefenderIdentity[];
  rank: number;
  level: number;
  signature: number;
  ascension: number;
  sourceEntryCount: number;
};

export type UnplacedQuestDefenders = {
  questId: string;
  coverage: "placement-unknown";
  rowCount: number;
  previews: UnplacedDefenderPreview[];
  checkedPreview?: { observedAt: string; notice: string };
};

export type UnplacedDefenderIndex = {
  version: 1;
  coverage: "unplaced-definitions";
  quests: Record<string, UnplacedQuestBinding & { rowCount: number; shardSha256: string }>;
  byGameId: Record<string, { questId: string; sourceIndices: number[] }[]>;
};

/** Group equal definitions for display without changing order or source rows. */
export function projectUnplacedDefenders(
  record: UnplacedQuestRecord,
  identities: Readonly<Record<string, UnplacedDefenderIdentity>>,
): UnplacedQuestDefenders {
  const groups = new Map<string, UnplacedDefenderPreview>();
  for (const row of record.rows) {
    const identity = identities[row.tierId];
    const candidates = row.candidateTierIds.map(tierId => identities[tierId]);
    if (!identity || candidates.some(candidate => !candidate)) throw new Error("Unresolved native preview identity");
    const groupKey = JSON.stringify([row.tierId, row.candidateTierIds, row.rank, row.level, row.signature, row.ascension, row.nativeType]);
    const group = groups.get(groupKey);
    if (group) group.sourceEntryCount += 1;
    else groups.set(groupKey, {
      key: `${record.questId}:preview:${row.sourceIndex}`,
      identity, candidates, rank: row.rank, level: row.level, signature: row.signature,
      ascension: row.ascension, sourceEntryCount: 1,
    });
  }
  return { questId: record.questId, coverage: "placement-unknown", rowCount: record.rows.length, previews: [...groups.values()] };
}

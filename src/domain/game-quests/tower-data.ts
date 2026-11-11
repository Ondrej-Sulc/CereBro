export interface CapturedTowerDefender {
  blueprint: string;
  gameId: string | null;
  rarity: number | null;
  classId: string | null;
  rank: number | null;
  level: number | null;
  signature: number | null;
  ascensionTier: number | null;
  health: number | null;
  maxHealth: number | null;
  attack: number | null;
  challengeRating: number | null;
}

export interface CapturedTowerBlock {
  version: number;
  id: string;
  towerId: string;
  blockNumber: number;
  declaredFloorCount: number;
  source: { captureSha256: string; responseSha256: string; capturedAt: string; readerSha256: string };
  blockData: Readonly<Record<string, unknown>>;
  floors: readonly { floorNumber: number; defender: CapturedTowerDefender | null; sourceData: Readonly<Record<string, unknown>> }[];
  coverage: { allDeclaredFloorsCaptured: boolean; currentAccessOrEligibilityEstablished: boolean };
}

export interface CapturedTowerIndex {
  version: number;
  id: string;
  exporterSha256: string;
  sourceReceiptsSha256: string;
  sourceHarvestSha256: string;
  blueprintsSha256: string;
  blocks: Readonly<Record<string, { towerId: string; blockNumber: number; floors: number; path: string;
    sha256: string; bytes: number; captureSha256: string }>>;
  coverage: { towers: number; blocks: number; floors: number; perTowerFloors: Readonly<Record<string, number>>;
    configuredClassDefinitionsComplete: boolean; currentPlayerAccessEstablished: boolean;
    missingDefenderDefinitions: number; unresolvedBlueprints: readonly string[] };
  notes: readonly string[];
}

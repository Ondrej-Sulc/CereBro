import type { CapturedTowerBlock, CapturedTowerIndex } from "../../../domain/game-quests/tower-data";
export interface ChallengeTowerArtwork {
  url: string; width: number; height: number; sourceUrl: string; sha256: string; bytes: number;
}
export interface ChallengeTowerCatalogEntry {
  id: string; name: string; section: 'challenge'; archiveStatus: 'active' | 'archived' | 'unknown';
  blockNumbers: readonly number[]; artwork: ChallengeTowerArtwork | null;
  source: { captureSha256: string; capturedAt: string; readerSha256: string; layoutSha256: string;
    currentAccessEstablished: boolean; nativeData: { Id: string; FriendlyName: string; Category: number;
      NumBlocks: number; NumFloors: number; EndTime: number; TowerPanelTexture: string;
      TowerVisualDataId: string; LocalizedLockedDescription: string } };
}
export interface CapturedChallengeTowerIndex extends CapturedTowerIndex {
  sourceCatalogSha256: string; towers: readonly ChallengeTowerCatalogEntry[];
  archive: { artwork: ChallengeTowerArtwork | null; additionalObservedTowerIds: readonly string[];
    membership: string; sourceEvidenceSha256: string; historicalCatalogComplete: boolean };
}
export declare const towerChallengeIndex: CapturedChallengeTowerIndex;
export declare const towerBlockLoaders: Readonly<Record<string, () => Promise<{ default: CapturedTowerBlock }>>>;
export declare function loadTowerBlock(towerId: string, blockNumber: number): Promise<CapturedTowerBlock | undefined>;

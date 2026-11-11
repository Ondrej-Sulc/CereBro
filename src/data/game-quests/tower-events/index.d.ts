import type { CapturedTowerBlock, CapturedTowerIndex } from "../../../domain/game-quests/tower-data";
export interface EventTowerArtwork {
  url: string; width: number; height: number; sourceUrl: string; sha256: string; bytes: number;
}
export interface EventTowerDateCondition {
  ConditionType: string | null; DateTime: string | null; TimeZone: string | null; Or: boolean;
  GUID: string | null; _duration: number; _interval: number;
}
export interface EventTowerCatalogEntry {
  id: string; name: string; section: 'event'; archiveStatus: 'unknown'; availabilityStatus: 'unknown';
  startsAt: string | null; endsAt: string | null; observedAt: string;
  blockNumbers: readonly number[]; capturedBlockNumbers: readonly number[]; artwork: EventTowerArtwork | null;
  dates: { start: null; startStatus: 'not-established'; endTime: number;
    nativeDateConditions: readonly EventTowerDateCondition[] };
  source: { captureSha256: string; capturedAt: string; readerSha256: string; layoutSha256: string;
    currentAccessEstablished: boolean; nativeData: { Id: string; FriendlyName: string; Category: number;
      NumBlocks: number; NumFloors: number; EndTime: number; TowerPanelTexture: string;
      TowerVisualDataId: string; LocalizedLockedDescription: string;
      DateConditions: readonly EventTowerDateCondition[] } };
}
export interface CapturedEventTowerIndex extends CapturedTowerIndex {
  sourceCatalogSha256: string; observedAt: string; towers: readonly EventTowerCatalogEntry[];
  acquisition: { status: 'complete' | 'session-unavailable'; stopReason: string | null; networkRequests: number };
  coverage: CapturedTowerIndex['coverage'] & { configuredBlocks: number; configuredFloors: number;
    observedEventDefinitionsComplete: boolean;
    missingBlocks: readonly { towerId: string; blockNumber: number }[] };
}
export declare const towerEventIndex: CapturedEventTowerIndex;
export declare const towerBlockLoaders: Readonly<Record<string, () => Promise<{ default: CapturedTowerBlock }>>>;
export declare function loadTowerBlock(towerId: string, blockNumber: number): Promise<CapturedTowerBlock | undefined>;

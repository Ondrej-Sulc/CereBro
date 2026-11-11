import type { CapturedTowerBlock, CapturedTowerIndex } from "../../../domain/game-quests/tower-data";
export declare const towerBackendIndex: CapturedTowerIndex;
export declare const towerBlockLoaders: Readonly<Record<string, () => Promise<{ default: CapturedTowerBlock }>>>;
export declare function loadTowerBlock(towerId: string, blockNumber: number): Promise<CapturedTowerBlock | undefined>;

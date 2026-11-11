import type { QuestMap } from "../../domain/game-quests";
export declare const progressedMapLoaders: Readonly<Record<string, () => Promise<{ default: QuestMap }>>>;

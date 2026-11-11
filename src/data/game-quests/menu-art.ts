import rawManifest from "./menu-art.json";
import progressedManifest from "./progressed-menu-art.json";
import { groupMenuArtwork, questMenuArtwork, type MenuArtManifest } from "../../domain/game-quests/menu-art";
import type { QuestSummary } from "../../domain/game-quests";

const original = rawManifest as unknown as MenuArtManifest;
const manifest = progressedManifest as unknown as MenuArtManifest;
const forQuest = (q: QuestSummary) => manifest.quests[q.id] ? manifest : original;
export const getQuestMenuArtwork = (q: QuestSummary) => questMenuArtwork(q, forQuest(q));
export const getGroupMenuArtwork = (quests: QuestSummary[], scope?: { kind: "act" | "chapter"; id: string }) => groupMenuArtwork(quests, manifest, scope);

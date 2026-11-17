import observations from './boss-display.json';
import {applyQuestBossDisplay,type QuestBossDisplayObservation} from '../../domain/game-quests/boss-display';
import type {QuestMap} from '../../domain/game-quests';

/** Exact frozen-source metadata only; placements and their builds are unchanged. */
export function withQuestBossDisplay(map:QuestMap):QuestMap {
  return applyQuestBossDisplay(map,observations.maps as unknown as QuestBossDisplayObservation[]);
}

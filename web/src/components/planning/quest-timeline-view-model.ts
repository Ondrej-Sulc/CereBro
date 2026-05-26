import type { ChampionCounterData, PickCounterWithChampion } from "../../app/actions/quest-catalog";
import {
  projectQuestPlanningState,
  type QuestPlanningReviveMap,
  type QuestPlanningSelectionMap,
} from "../../lib/quest-planning-projection";
import { isChampionValidForEncounterOrQuest } from "../../lib/player-quest-selection";
import type {
  EncounterWithRelations,
  QuestTimelineProps,
  RosterWithChampion,
  SynergyWithChampion,
} from "./types";

type QuestRouteSectionWithRelations = NonNullable<QuestTimelineProps["quest"]["routeSections"]>[number];

export type PlayerPickSummary = { encounterId: string; champion: ChampionCounterData };
export type PlayerPicksMap = Record<string, {
  name: string;
  avatar: string | null;
  picks: PlayerPickSummary[];
}>;

export function isReadOnlyRosterEntry(value: unknown): value is RosterWithChampion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string") return false;
  if (typeof candidate.championId !== "number") return false;

  const champion = candidate.champion;
  if (!champion || typeof champion !== "object") return false;
  const champCandidate = champion as Record<string, unknown>;
  return (
    typeof champCandidate.id === "number" &&
    typeof champCandidate.name === "string"
  );
}

export function createInitialQuestTimelineSelections({
  quest,
  roster,
  savedEncounters,
  readOnly,
  rosterMap,
  initialSelections,
}: {
  quest: QuestTimelineProps["quest"];
  roster: RosterWithChampion[];
  savedEncounters: NonNullable<QuestTimelineProps["savedEncounters"]>;
  readOnly: boolean;
  rosterMap: NonNullable<QuestTimelineProps["rosterMap"]>;
  initialSelections?: QuestTimelineProps["initialSelections"];
}): QuestPlanningSelectionMap {
  const initial: QuestPlanningSelectionMap = {};

  if (readOnly) {
    Object.keys(initialSelections || {}).forEach(encounterId => {
      const rosterEntry = rosterMap[encounterId];
      initial[encounterId] = isReadOnlyRosterEntry(rosterEntry) ? rosterEntry.id : null;
    });
    return initial;
  }

  const availableRoster = [...roster];
  savedEncounters.forEach(savedEncounter => {
    if (savedEncounter.selectedChampionId) {
      const encounter = quest.encounters.find(item => item.id === savedEncounter.questEncounterId);
      const rosterIndex = availableRoster.findIndex(entry =>
        entry.championId === savedEncounter.selectedChampionId &&
        (savedEncounter.selectedChampionStars == null || entry.stars === savedEncounter.selectedChampionStars) &&
        isChampionValidForEncounterOrQuest(entry, quest, encounter)
      );

      if (rosterIndex !== -1) {
        initial[savedEncounter.questEncounterId] = availableRoster[rosterIndex].id;
        if (quest.teamLimit === null) {
          availableRoster.splice(rosterIndex, 1);
        }
      } else {
        initial[savedEncounter.questEncounterId] = null;
      }
    } else {
      initial[savedEncounter.questEncounterId] = null;
    }
  });

  return initial;
}

export function createInitialQuestTimelinePrefightSelections({
  quest,
  roster,
  savedEncounters,
  readOnly,
  rosterMap,
  initialPrefightSelections,
}: {
  quest: QuestTimelineProps["quest"];
  roster: RosterWithChampion[];
  savedEncounters: NonNullable<QuestTimelineProps["savedEncounters"]>;
  readOnly: boolean;
  rosterMap: NonNullable<QuestTimelineProps["rosterMap"]>;
  initialPrefightSelections?: QuestTimelineProps["initialPrefightSelections"];
}): QuestPlanningSelectionMap {
  const initial: QuestPlanningSelectionMap = {};

  if (readOnly) {
    Object.keys(initialPrefightSelections || {}).forEach(encounterId => {
      const rosterEntry = rosterMap[`prefight:${encounterId}`];
      initial[encounterId] = isReadOnlyRosterEntry(rosterEntry) ? rosterEntry.id : null;
    });
    return initial;
  }

  savedEncounters.forEach(savedEncounter => {
    if (savedEncounter.prefightChampionId) {
      const encounter = quest.encounters.find(item => item.id === savedEncounter.questEncounterId);
      const rosterEntry = roster.find(entry =>
        entry.championId === savedEncounter.prefightChampionId &&
        (savedEncounter.prefightChampionStars == null || entry.stars === savedEncounter.prefightChampionStars) &&
        isChampionValidForEncounterOrQuest(entry, quest, encounter)
      );
      initial[savedEncounter.questEncounterId] = rosterEntry?.id ?? null;
    } else {
      initial[savedEncounter.questEncounterId] = null;
    }
  });

  return initial;
}

export function createInitialQuestTimelineRevives(
  savedEncounters: NonNullable<QuestTimelineProps["savedEncounters"]>
): QuestPlanningReviveMap {
  const initial: QuestPlanningReviveMap = {};
  savedEncounters.forEach(encounter => {
    const count = Math.max(0, Math.min(99, Number((encounter as { revivesUsed?: number }).revivesUsed || 0)));
    if (count > 0) {
      initial[encounter.questEncounterId] = count;
    }
  });
  return initial;
}

export function groupQuestPlayerPicks({
  featuredPicks,
  alliancePicks,
}: {
  featuredPicks: Record<string, PickCounterWithChampion[]>;
  alliancePicks: Record<string, PickCounterWithChampion[]>;
}): PlayerPicksMap {
  const map: PlayerPicksMap = {};

  const addPicks = (picksMap: Record<string, PickCounterWithChampion[]>) => {
    Object.entries(picksMap).forEach(([encounterId, counters]) => {
      counters.forEach(counter => {
        counter.pickedBy?.forEach(user => {
          if (!map[user.id]) {
            map[user.id] = { name: user.name, avatar: user.avatar, picks: [] };
          }
          if (!map[user.id].picks.some(pick => pick.encounterId === encounterId)) {
            map[user.id].picks.push({ encounterId, champion: counter.champion });
          }
        });
      });
    });
  };

  addPicks(featuredPicks);
  addPicks(alliancePicks);
  return map;
}

export function filterPlayerPicksByActiveEncounters({
  playerPicksMap,
  activeEncounterIds,
}: {
  playerPicksMap: PlayerPicksMap;
  activeEncounterIds: Set<string>;
}): PlayerPicksMap {
  const next: PlayerPicksMap = {};
  Object.entries(playerPicksMap).forEach(([userId, userPlan]) => {
    const picks = userPlan.picks.filter(pick => activeEncounterIds.has(pick.encounterId));
    if (picks.length > 0) {
      next[userId] = { ...userPlan, picks };
    }
  });
  return next;
}

export function projectQuestTimelineViewModel({
  quest,
  routeChoices,
  selections,
  prefightSelections,
  synergyIds,
  revivesByEncounterId,
  roster,
  savedSynergies,
  difficultyFilter,
  readOnly,
  rosterMap,
  featuredPicks,
  alliancePicks,
  activeObjective,
  showObjectiveContinuation,
}: {
  quest: QuestTimelineProps["quest"];
  routeChoices: Record<string, string>;
  selections: QuestPlanningSelectionMap;
  prefightSelections: QuestPlanningSelectionMap;
  synergyIds: number[];
  revivesByEncounterId: QuestPlanningReviveMap;
  roster: RosterWithChampion[];
  savedSynergies: SynergyWithChampion[];
  difficultyFilter: string[];
  readOnly: boolean;
  rosterMap: NonNullable<QuestTimelineProps["rosterMap"]>;
  featuredPicks: NonNullable<QuestTimelineProps["featuredPicks"]>;
  alliancePicks: NonNullable<QuestTimelineProps["alliancePicks"]>;
  activeObjective?: QuestTimelineProps["activeObjective"];
  showObjectiveContinuation?: boolean;
}) {
  const questWithObjective = { ...quest, objective: activeObjective ?? null };
  const projection = projectQuestPlanningState<
    typeof questWithObjective,
    EncounterWithRelations,
    QuestRouteSectionWithRelations,
    RosterWithChampion,
    SynergyWithChampion
  >({
    quest: questWithObjective,
    routeChoices,
    selections,
    prefightSelections,
    synergyIds,
    revivesByEncounterId,
    roster,
    savedSynergies,
    difficultyFilter,
    resolveRosterEntry: ({ rosterId, encounterId, field }) => {
      if (field === "prefightChampionId" && readOnly) {
        const rosterEntry = rosterMap[`prefight:${encounterId}`];
        return isReadOnlyRosterEntry(rosterEntry) ? rosterEntry : undefined;
      }
      if (readOnly) {
        const rosterEntry = rosterMap[encounterId];
        return isReadOnlyRosterEntry(rosterEntry) ? rosterEntry : undefined;
      }
      return roster.find(entry => entry.id === rosterId);
    },
    createSynergyRosterEntry: savedSynergy => ({
      id: `synergy-${savedSynergy.championId}`,
      playerId: "",
      championId: savedSynergy.championId,
      stars: 0,
      rank: 0,
      sigLevel: 0,
      isAwakened: false,
      isAscended: false,
      ascensionLevel: 0,
      powerRating: 0,
      champion: savedSynergy.champion,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    showObjectiveContinuation,
  });

  const playerPicksMap = groupQuestPlayerPicks({ featuredPicks, alliancePicks });

  return {
    ...projection,
    playerPicksMap,
    activePlayerPicksMap: filterPlayerPicksByActiveEncounters({
      playerPicksMap,
      activeEncounterIds: projection.activeEncounterIds,
    }),
  };
}

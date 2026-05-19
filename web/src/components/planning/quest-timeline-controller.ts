import {
  questEncounterSelectionConflictReason,
  unlimitedSwapsSelectionConflictReason,
  wouldExceedQuestTeamLimit,
  type QuestSelectionAssignment,
  type QuestSelectionSynergy,
} from "../../lib/player-quest-selection";
import type { QuestTimelineProps, RosterWithChampion } from "./types";

type SelectionMap = Record<string, string | null>;
type ReviveMap = Record<string, number>;

export type QuestTimelineSelectionDecision =
  | {
      kind: "ignored";
    }
  | {
      kind: "rejected";
      title: string;
      description: string;
    }
  | {
      kind: "accepted";
      previousRosterId: string | null;
      previousPrefightRosterId?: string | null;
      nextRosterId: string | null;
      nextChampionId: number | null;
      nextChampionStars: number | null;
      shouldClearPrefight?: boolean;
    };

export type QuestTimelineRevivesDecision =
  | { kind: "ignored" }
  | {
      kind: "accepted";
      previousRevives: number;
      nextRevives: number;
      nextRevivesByEncounterId: ReviveMap;
      rollbackRevivesByEncounterId: ReviveMap;
    };

export type QuestTimelineSynergyDecision =
  | { kind: "ignored" }
  | {
      kind: "rejected";
      title: string;
      description: string;
    }
  | {
      kind: "accepted";
      isRemoving: boolean;
      nextSynergyIds: number[];
      rollbackSynergyIds: number[];
    };

export function decideQuestTimelineCounterSelection({
  quest,
  encounterId,
  rosterId,
  roster,
  selections,
  prefightSelections,
  activeQuestAssignments,
  activeSynergyChampions,
}: {
  quest: Pick<QuestTimelineProps["quest"], "teamLimit">;
  encounterId: string;
  rosterId: string;
  roster: RosterWithChampion[];
  selections: SelectionMap;
  prefightSelections: SelectionMap;
  activeQuestAssignments: QuestSelectionAssignment[];
  activeSynergyChampions: QuestSelectionSynergy[];
}): QuestTimelineSelectionDecision {
  const previousRosterId = selections[encounterId] ?? null;
  const rosterEntry = roster.find(entry => entry.id === rosterId);
  if (!rosterEntry) return { kind: "ignored" };

  const championId = rosterEntry.championId;
  const championStars = rosterEntry.stars;
  const previousPrefightRosterId = prefightSelections[encounterId] ?? null;
  const prefightChampionId = previousPrefightRosterId
    ? roster.find(entry => entry.id === previousPrefightRosterId)?.championId
    : null;

  const conflictReason = quest.teamLimit === null
    ? unlimitedSwapsSelectionConflictReason({
        encounters: activeQuestAssignments,
        replacement: {
          field: "selectedChampionId",
          questEncounterId: encounterId,
          championId,
          championStars,
        },
      })
    : questEncounterSelectionConflictReason({
        field: "selectedChampionId",
        candidateChampionId: championId,
        prefightChampionId,
      });
  if (conflictReason && previousRosterId !== rosterId) {
    return { kind: "rejected", title: "Invalid Counter", description: conflictReason };
  }

  if (previousRosterId !== rosterId) {
    if (quest.teamLimit !== null) {
      if (wouldExceedQuestTeamLimit({
        teamLimit: quest.teamLimit,
        encounters: activeQuestAssignments,
        synergyChampions: activeSynergyChampions,
        replacement: {
          field: "selectedChampionId",
          questEncounterId: encounterId,
          championId,
        },
      })) {
        return {
          kind: "rejected",
          title: "Team Limit Reached",
          description: `You can only select up to ${quest.teamLimit} champions for this quest.`,
        };
      }
    } else {
      const unlimitedSwapsReason = unlimitedSwapsSelectionConflictReason({
        encounters: activeQuestAssignments,
        replacement: {
          field: "selectedChampionId",
          questEncounterId: encounterId,
          championId,
          championStars,
        },
      });
      if (unlimitedSwapsReason) {
        return { kind: "rejected", title: "Rarity Already Used", description: unlimitedSwapsReason };
      }
    }
  }

  const nextRosterId = previousRosterId === rosterId ? null : rosterId;
  const nextRosterEntry = nextRosterId ? roster.find(entry => entry.id === nextRosterId) : undefined;

  return {
    kind: "accepted",
    previousRosterId,
    previousPrefightRosterId,
    nextRosterId,
    nextChampionId: nextRosterEntry?.championId ?? null,
    nextChampionStars: nextRosterEntry?.stars ?? null,
    shouldClearPrefight: quest.teamLimit === null &&
      previousPrefightRosterId !== null &&
      previousPrefightRosterId !== nextRosterId,
  };
}

export function decideQuestTimelinePrefightSelection({
  quest,
  encounterId,
  rosterId,
  roster,
  selections,
  prefightSelections,
  activeQuestAssignments,
  activeSynergyChampions,
}: {
  quest: Pick<QuestTimelineProps["quest"], "teamLimit">;
  encounterId: string;
  rosterId: string;
  roster: RosterWithChampion[];
  selections: SelectionMap;
  prefightSelections: SelectionMap;
  activeQuestAssignments: QuestSelectionAssignment[];
  activeSynergyChampions: QuestSelectionSynergy[];
}): QuestTimelineSelectionDecision {
  const previousRosterId = prefightSelections[encounterId] ?? null;
  const rosterEntry = roster.find(entry => entry.id === rosterId);
  if (!rosterEntry) return { kind: "ignored" };

  const championId = rosterEntry.championId;
  const championStars = rosterEntry.stars;
  const counterRosterId = selections[encounterId];
  const counterChampionId = counterRosterId
    ? roster.find(entry => entry.id === counterRosterId)?.championId
    : null;

  const conflictReason = quest.teamLimit === null
    ? unlimitedSwapsSelectionConflictReason({
        encounters: activeQuestAssignments,
        replacement: {
          field: "prefightChampionId",
          questEncounterId: encounterId,
          championId,
          championStars,
        },
      })
    : questEncounterSelectionConflictReason({
        field: "prefightChampionId",
        candidateChampionId: championId,
        selectedChampionId: counterChampionId,
      });
  if (conflictReason && previousRosterId !== rosterId) {
    return { kind: "rejected", title: "Invalid Prefight", description: conflictReason };
  }

  if (
    previousRosterId !== rosterId &&
    quest.teamLimit !== null &&
    wouldExceedQuestTeamLimit({
      teamLimit: quest.teamLimit,
      encounters: activeQuestAssignments,
      synergyChampions: activeSynergyChampions,
      replacement: {
        field: "prefightChampionId",
        questEncounterId: encounterId,
        championId,
      },
    })
  ) {
    return {
      kind: "rejected",
      title: "Team Limit Reached",
      description: `You can only select up to ${quest.teamLimit} champions for this quest.`,
    };
  }

  const nextRosterId = previousRosterId === rosterId ? null : rosterId;
  const nextRosterEntry = nextRosterId ? roster.find(entry => entry.id === nextRosterId) : undefined;

  return {
    kind: "accepted",
    previousRosterId,
    nextRosterId,
    nextChampionId: nextRosterEntry?.championId ?? null,
    nextChampionStars: nextRosterEntry?.stars ?? null,
  };
}

export function decideQuestTimelineRevives({
  readOnly,
  encounterId,
  revivesUsed,
  revivesByEncounterId,
}: {
  readOnly: boolean;
  encounterId: string;
  revivesUsed: number;
  revivesByEncounterId: ReviveMap;
}): QuestTimelineRevivesDecision {
  if (readOnly) return { kind: "ignored" };

  const nextRevives = Math.max(0, Math.min(99, revivesUsed));
  const previousRevives = revivesByEncounterId[encounterId] || 0;
  if (nextRevives === previousRevives) return { kind: "ignored" };

  return {
    kind: "accepted",
    previousRevives,
    nextRevives,
    nextRevivesByEncounterId: setEncounterRevives(revivesByEncounterId, encounterId, nextRevives),
    rollbackRevivesByEncounterId: setEncounterRevives(revivesByEncounterId, encounterId, previousRevives),
  };
}

export function decideQuestTimelineSynergy({
  quest,
  championId,
  synergyIds,
  activeQuestAssignments,
  activeSynergyChampions,
}: {
  quest: Pick<QuestTimelineProps["quest"], "teamLimit">;
  championId: number;
  synergyIds: number[];
  activeQuestAssignments: QuestSelectionAssignment[];
  activeSynergyChampions: QuestSelectionSynergy[];
}): QuestTimelineSynergyDecision {
  const isRemoving = synergyIds.includes(championId);

  if (
    !isRemoving &&
    quest.teamLimit !== null &&
    wouldExceedQuestTeamLimit({
      teamLimit: quest.teamLimit,
      encounters: activeQuestAssignments,
      synergyChampions: activeSynergyChampions,
      replacement: {
        field: "synergyChampionId",
        championId,
      },
    })
  ) {
    return {
      kind: "rejected",
      title: "Team Limit Reached",
      description: `You can only select up to ${quest.teamLimit} champions for this quest.`,
    };
  }

  return {
    kind: "accepted",
    isRemoving,
    nextSynergyIds: isRemoving
      ? synergyIds.filter(id => id !== championId)
      : [...synergyIds, championId],
    rollbackSynergyIds: synergyIds,
  };
}

function setEncounterRevives(
  revivesByEncounterId: ReviveMap,
  encounterId: string,
  revivesUsed: number
) {
  const next = { ...revivesByEncounterId };
  if (revivesUsed > 0) {
    next[encounterId] = revivesUsed;
  } else {
    delete next[encounterId];
  }
  return next;
}

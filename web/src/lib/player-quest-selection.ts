import type { ChampionClass } from "@prisma/client";
import { hasObtainableStarInRange } from "./champion-obtainable";

export type QuestSelectionTag = {
  id: number | string;
  name: string;
};

export type QuestSelectionChampion = {
  id: number;
  class: ChampionClass;
  tags?: QuestSelectionTag[];
  obtainable?: string[];
};

export type QuestSelectionRosterEntry = {
  id?: string;
  championId: number;
  stars: number;
  rank?: number | null;
  isUnowned?: boolean | null;
  champion: QuestSelectionChampion;
};

export type QuestSelectionRestrictions = {
  minStarLevel?: number | null;
  maxStarLevel?: number | null;
  requiredClasses?: ChampionClass[];
  requiredTags?: QuestSelectionTag[];
};

export type QuestSelectionQuest = QuestSelectionRestrictions & {
  teamLimit?: number | null;
};

export type QuestSelectionEncounter = QuestSelectionRestrictions & {
  id?: string;
  questPlanId?: string;
};

export type QuestSelectionAssignment = {
  questEncounterId: string;
  selectedChampionId?: number | null;
  prefightChampionId?: number | null;
};

export type QuestSelectionSynergy = {
  championId: number;
};

export type QuestSelectionField =
  | "selectedChampionId"
  | "prefightChampionId"
  | "synergyChampionId";

export type QuestTeamReplacement = {
  field: QuestSelectionField;
  questEncounterId?: string;
  championId: number | null;
};

export type QuestSelectionValidation<T extends object = object> =
  | ({ valid: true } & T)
  | { valid: false; reason: string };

type OwnedRosterEntry = {
  id?: string;
  championId: number;
  stars: number;
  rank?: number | null;
};

export function validateRosterEntryForQuestSelection(
  entry: QuestSelectionRosterEntry,
  quest: QuestSelectionQuest,
  encounter?: QuestSelectionEncounter
): QuestSelectionValidation {
  const questResult = validateRestrictionScope("Quest", quest, entry);
  if (!questResult.valid) return questResult;
  return validateRestrictionScope("Fight", encounter, entry);
}

export function isChampionValidForEncounterOrQuest(
  entry: QuestSelectionRosterEntry,
  quest: QuestSelectionQuest,
  encounter?: QuestSelectionEncounter
) {
  return validateRosterEntryForQuestSelection(entry, quest, encounter).valid;
}

export function getValidRosterCountForChampion(
  championId: number,
  roster: QuestSelectionRosterEntry[],
  quest: QuestSelectionQuest,
  encounter?: QuestSelectionEncounter
) {
  return roster.filter(entry =>
    entry.championId === championId &&
    !entry.isUnowned &&
    isChampionValidForEncounterOrQuest(entry, quest, encounter)
  ).length;
}

export function validateOwnedChampionForQuestSelection({
  rosterEntries,
  champion,
  quest,
  encounter,
}: {
  rosterEntries: OwnedRosterEntry[];
  champion: QuestSelectionChampion;
  quest: QuestSelectionQuest;
  encounter?: QuestSelectionEncounter;
}): QuestSelectionValidation<{ rosterEntry: QuestSelectionRosterEntry }> {
  if (rosterEntries.length === 0) {
    return invalid("Champion not found in your roster.");
  }

  const candidates = rosterEntries.map(entry => ({
    ...entry,
    champion,
    isUnowned: false,
  }));

  for (const candidate of candidates) {
    if (isChampionValidForEncounterOrQuest(candidate, quest, encounter)) {
      return { valid: true, rosterEntry: candidate };
    }
  }

  const firstFailure = validateRosterEntryForQuestSelection(candidates[0], quest, encounter);
  return firstFailure.valid ? invalid("Champion is not valid for this quest.") : firstFailure;
}

export function questEncounterSelectionConflictReason({
  field,
  candidateChampionId,
  selectedChampionId,
  prefightChampionId,
}: {
  field: Extract<QuestSelectionField, "selectedChampionId" | "prefightChampionId">;
  candidateChampionId: number | null;
  selectedChampionId?: number | null;
  prefightChampionId?: number | null;
}) {
  if (candidateChampionId == null) return null;
  if (field === "selectedChampionId" && prefightChampionId === candidateChampionId) {
    return "Counter and prefight champion must be different for the same fight.";
  }
  if (field === "prefightChampionId" && selectedChampionId === candidateChampionId) {
    return "Counter and prefight champion must be different for the same fight.";
  }
  return null;
}

export function collectQuestTeamChampionIds({
  encounters,
  synergyChampions = [],
  replacement,
}: {
  encounters: QuestSelectionAssignment[];
  synergyChampions?: QuestSelectionSynergy[];
  replacement?: QuestTeamReplacement;
}) {
  const ids = new Set<number>();

  for (const encounter of encounters) {
    const selectedChampionId =
      replacement?.field === "selectedChampionId" &&
      replacement.questEncounterId === encounter.questEncounterId
        ? replacement.championId
        : encounter.selectedChampionId;
    const prefightChampionId =
      replacement?.field === "prefightChampionId" &&
      replacement.questEncounterId === encounter.questEncounterId
        ? replacement.championId
        : encounter.prefightChampionId;

    if (selectedChampionId != null) ids.add(selectedChampionId);
    if (prefightChampionId != null) ids.add(prefightChampionId);
  }

  for (const synergy of synergyChampions) {
    ids.add(synergy.championId);
  }

  if (replacement?.field === "synergyChampionId" && replacement.championId != null) {
    ids.add(replacement.championId);
  }

  if (
    replacement &&
    replacement.field !== "synergyChampionId" &&
    replacement.championId != null &&
    !encounters.some(encounter => encounter.questEncounterId === replacement.questEncounterId)
  ) {
    ids.add(replacement.championId);
  }

  return ids;
}

export function wouldExceedQuestTeamLimit({
  teamLimit,
  encounters,
  synergyChampions = [],
  replacement,
}: {
  teamLimit: number | null | undefined;
  encounters: QuestSelectionAssignment[];
  synergyChampions?: QuestSelectionSynergy[];
  replacement: QuestTeamReplacement;
}) {
  if (teamLimit == null || replacement.championId == null) return false;
  return collectQuestTeamChampionIds({ encounters, synergyChampions, replacement }).size > teamLimit;
}

function validateRestrictionScope(
  scope: "Quest" | "Fight",
  restrictions: QuestSelectionRestrictions | undefined,
  entry: QuestSelectionRosterEntry
): QuestSelectionValidation {
  if (!restrictions) return { valid: true };

  const starResult = validateStarRestrictions(scope, restrictions, entry);
  if (!starResult.valid) return starResult;

  if (
    restrictions.requiredClasses?.length &&
    !restrictions.requiredClasses.includes(entry.champion.class)
  ) {
    return invalid(`${scope} requires class: ${restrictions.requiredClasses.join(", ")}`);
  }

  if (restrictions.requiredTags?.length) {
    const championTagIds = new Set((entry.champion.tags ?? []).map(tag => String(tag.id)));
    const missingTags = restrictions.requiredTags.filter(tag => !championTagIds.has(String(tag.id)));
    if (missingTags.length > 0) {
      return invalid(`${scope} requires champions with all of: ${restrictions.requiredTags.map(tag => tag.name).join(", ")}`);
    }
  }

  return { valid: true };
}

function validateStarRestrictions(
  scope: "Quest" | "Fight",
  restrictions: QuestSelectionRestrictions,
  entry: QuestSelectionRosterEntry
): QuestSelectionValidation {
  const min = restrictions.minStarLevel;
  const max = restrictions.maxStarLevel;
  if (!min && !max) return { valid: true };

  if (entry.isUnowned && entry.stars <= 0) {
    const obtainable = entry.champion.obtainable ?? [];
    if (!hasObtainableStarInRange({ obtainable }, min, max)) {
      return invalid(starRangeMessage(scope, min, max));
    }
    return { valid: true };
  }

  if (min && entry.stars < min) return invalid(`${scope} requires minimum ${min} stars.`);
  if (max && entry.stars > max) return invalid(`${scope} requires maximum ${max} stars.`);
  return { valid: true };
}

function starRangeMessage(scope: "Quest" | "Fight", min?: number | null, max?: number | null) {
  if (min && max) return `${scope} requires ${min}-${max} star champions.`;
  if (min) return `${scope} requires minimum ${min} stars.`;
  if (max) return `${scope} requires maximum ${max} stars.`;
  return `${scope} star requirements are not met.`;
}

function invalid<T extends object = object>(reason: string): QuestSelectionValidation<T> {
  return { valid: false, reason };
}

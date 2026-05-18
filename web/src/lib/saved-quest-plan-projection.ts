type SavedQuestPlanChampion = {
  id: number;
};

type SavedQuestPlanRosterEntry = {
  championId: number;
  stars: number;
};

type SavedQuestPlanEncounter<TChampion extends SavedQuestPlanChampion> = {
  id: string;
  questEncounterId: string;
  selectedChampionId: number | null;
  selectedChampionStars?: number | null;
  selectedChampion?: TChampion | null;
  prefightChampionId: number | null;
  prefightChampionStars?: number | null;
  prefightChampion?: TChampion | null;
};

export type SavedQuestPlanFallbackRosterEntry<TChampion extends SavedQuestPlanChampion> = {
  id: string;
  playerId: string;
  championId: number;
  stars: number;
  rank: number;
  level: number;
  sigLevel: number | null;
  isAwakened: boolean;
  isAscended: boolean;
  ascensionLevel: number;
  powerRating: number;
  champion: TChampion;
  createdAt: Date;
  updatedAt: Date;
};

export type SavedQuestPlanRosterMapEntry<
  TRosterEntry extends SavedQuestPlanRosterEntry,
  TChampion extends SavedQuestPlanChampion
> = TRosterEntry | SavedQuestPlanFallbackRosterEntry<TChampion>;

export function projectSavedQuestPlanRosterMap<
  TRosterEntry extends SavedQuestPlanRosterEntry,
  TChampion extends SavedQuestPlanChampion
>({
  playerId,
  encounters,
  rosterEntries,
}: {
  playerId: string;
  encounters: SavedQuestPlanEncounter<TChampion>[];
  rosterEntries: TRosterEntry[];
}): Record<string, SavedQuestPlanRosterMapEntry<TRosterEntry, TChampion>> {
  const rosterMap = new Map<string, SavedQuestPlanRosterMapEntry<TRosterEntry, TChampion>>();

  for (const encounter of encounters) {
    if (encounter.selectedChampionId) {
      const entry = findSavedRosterEntry(
        rosterEntries,
        encounter.selectedChampionId,
        encounter.selectedChampionStars
      );
      if (entry) {
        rosterMap.set(encounter.questEncounterId, entry);
      } else if (encounter.selectedChampion) {
        rosterMap.set(encounter.questEncounterId, createFallbackRosterEntry({
          id: `fallback-${encounter.id}`,
          playerId,
          championId: encounter.selectedChampionId,
          stars: encounter.selectedChampionStars ?? 0,
          champion: encounter.selectedChampion,
        }));
      }
    }

    if (encounter.prefightChampionId) {
      const entry = findSavedRosterEntry(
        rosterEntries,
        encounter.prefightChampionId,
        encounter.prefightChampionStars
      );
      const key = `prefight:${encounter.questEncounterId}`;
      if (entry) {
        rosterMap.set(key, entry);
      } else if (encounter.prefightChampion) {
        rosterMap.set(key, createFallbackRosterEntry({
          id: `fallback-prefight-${encounter.id}`,
          playerId,
          championId: encounter.prefightChampionId,
          stars: encounter.prefightChampionStars ?? 0,
          champion: encounter.prefightChampion,
        }));
      }
    }
  }

  return Object.fromEntries(rosterMap.entries());
}

function findSavedRosterEntry<TRosterEntry extends SavedQuestPlanRosterEntry>(
  rosterEntries: TRosterEntry[],
  championId: number,
  stars?: number | null
) {
  return rosterEntries.find(entry =>
    entry.championId === championId &&
    (stars == null || entry.stars === stars)
  );
}

function createFallbackRosterEntry<TChampion extends SavedQuestPlanChampion>({
  id,
  playerId,
  championId,
  stars,
  champion,
}: {
  id: string;
  playerId: string;
  championId: number;
  stars: number;
  champion: TChampion;
}): SavedQuestPlanFallbackRosterEntry<TChampion> {
  return {
    id,
    playerId,
    championId,
    stars,
    rank: 0,
    level: 0,
    sigLevel: null,
    isAwakened: false,
    isAscended: false,
    ascensionLevel: 0,
    powerRating: 0,
    champion,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

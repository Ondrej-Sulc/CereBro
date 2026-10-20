export interface RosterAscensionState {
  isAscended: boolean;
  ascensionLevel: number;
}

export function getRosterAscensionLevel(champion: RosterAscensionState): number {
  if (champion.ascensionLevel > 0) return champion.ascensionLevel;
  return champion.isAscended ? 1 : 0;
}

export function matchesRosterAscensionFilter(
  champion: RosterAscensionState,
  selectedLevels: number[]
): boolean {
  return selectedLevels.length === 0 || selectedLevels.includes(getRosterAscensionLevel(champion));
}

import { getRosterAscensionLevel as canonicalAscensionLevel } from "@cerebro/core/domain/roster-ascension-state"

/** Canonical discovery/share URL; old all-star/Dust scopes migrate to seven stars. */
export function ascensionEligibilityHref(href: string, enabled: boolean): string {
  const url = new URL(href);
  if (enabled) {
    url.searchParams.set("ascensionEligible", "true");
    url.searchParams.set("ascensionScope", "seven-star");
  } else {
    url.searchParams.delete("ascensionEligible");
    url.searchParams.delete("ascensionScope");
  }
  return url.toString();
}

export interface RosterAscensionState {
  isAscended: boolean;
  ascensionLevel: number;
}

export function getRosterAscensionLevel(champion: RosterAscensionState): number {
  return canonicalAscensionLevel(champion);
}

export function matchesRosterAscensionFilter(
  champion: RosterAscensionState,
  selectedLevels: number[]
): boolean {
  return selectedLevels.length === 0 || selectedLevels.includes(getRosterAscensionLevel(champion));
}

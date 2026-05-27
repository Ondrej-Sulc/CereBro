export interface AttackReservationRosterEntry {
  championId: number;
  stars: number;
  rank: number;
  sigLevel?: number | null;
  isAwakened?: boolean | null;
  ascensionLevel?: number | null;
  reservedForAttack?: boolean | null;
}

export function findReservedAttackRosterEntries(
  roster: readonly AttackReservationRosterEntry[] | null | undefined,
  championId: number | null | undefined,
  starLevel?: number | null
) {
  if (!roster || !championId) return [];

  return roster.filter((entry) => {
    if (!entry.reservedForAttack) return false;
    if (entry.championId !== championId) return false;
    return starLevel == null || entry.stars === starLevel;
  });
}

export function isReservedForAttack(
  roster: readonly AttackReservationRosterEntry[] | null | undefined,
  championId: number | null | undefined,
  starLevel?: number | null
) {
  return findReservedAttackRosterEntries(roster, championId, starLevel).length > 0;
}

export function formatReservedAttackRosterEntries(entries: readonly AttackReservationRosterEntry[]) {
  return entries
    .map((entry) => {
      const parts = [`${entry.stars}*`, `R${entry.rank}`];
      if ((entry.sigLevel ?? 0) > 0 || entry.isAwakened) {
        parts.push(`S${entry.sigLevel ?? 0}`);
      }
      if ((entry.ascensionLevel ?? 0) > 0) {
        parts.push(`A${entry.ascensionLevel}`);
      }
      return parts.join(" ");
    })
    .join(", ");
}

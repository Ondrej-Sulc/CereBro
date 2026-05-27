import { describe, expect, it } from "vitest";
import {
  findReservedAttackRosterEntries,
  formatReservedAttackRosterEntries,
  isReservedForAttack,
  type AttackReservationRosterEntry,
} from "./attack-reservations";

const roster: AttackReservationRosterEntry[] = [
  { championId: 1, stars: 7, rank: 3, sigLevel: 100, isAwakened: true, ascensionLevel: 1, reservedForAttack: true },
  { championId: 1, stars: 6, rank: 5, sigLevel: 200, isAwakened: true, ascensionLevel: 0, reservedForAttack: false },
  { championId: 2, stars: 7, rank: 2, sigLevel: 0, isAwakened: false, ascensionLevel: 0, reservedForAttack: true },
  { championId: 3, stars: 6, rank: 4, sigLevel: 0, isAwakened: false, ascensionLevel: 0 },
];

describe("attack reservations", () => {
  it("matches a reserved roster entry by champion and exact star level", () => {
    expect(isReservedForAttack(roster, 1, 7)).toBe(true);
    expect(isReservedForAttack(roster, 1, 6)).toBe(false);
  });

  it("falls back to champion-only matching when star level is unknown", () => {
    expect(findReservedAttackRosterEntries(roster, 1)).toHaveLength(1);
  });

  it("returns false when the player roster has no reserved match", () => {
    expect(isReservedForAttack(roster, 99, 7)).toBe(false);
  });

  it("keeps multiple rarities distinct when star level is known", () => {
    const multiRarityRoster = [
      ...roster,
      { championId: 1, stars: 5, rank: 5, sigLevel: 200, isAwakened: true, ascensionLevel: 0, reservedForAttack: true },
    ];

    expect(findReservedAttackRosterEntries(multiRarityRoster, 1, 7)).toHaveLength(1);
    expect(findReservedAttackRosterEntries(multiRarityRoster, 1)).toHaveLength(2);
  });

  it("ignores falsy and missing reservation flags", () => {
    expect(isReservedForAttack(roster, 3, 6)).toBe(false);
  });

  it("formats reserved roster summaries for warnings", () => {
    expect(formatReservedAttackRosterEntries([roster[0]])).toBe("7* R3 S100 A1");
  });
});

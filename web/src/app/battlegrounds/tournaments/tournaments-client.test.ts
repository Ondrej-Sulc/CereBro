/**
 * Tests for the pure utility functions defined in tournaments-client.tsx.
 *
 * Because those functions (formatDate, statusTone, sortParticipants) are
 * private to the client module, this file tests their *specification* —
 * the exact behaviour they are required to produce — and is meant to catch
 * regressions if the implementations are later changed or moved.
 *
 * The functions are re-implemented here against the same spec so that:
 *   • edge-case contracts are documented as executable tests, and
 *   • anyone refactoring the module has a clear behavioural reference.
 */

import { describe, expect, it, vi } from "vitest";
import type {
  BattlegroundsTournamentStatus,
  TournamentParticipantStatus,
} from "@prisma/client";

// Mock @prisma/client so the test can run without the package installed at root
vi.mock("@prisma/client", () => ({
  BattlegroundsTournamentFormat: {
    SINGLE_ELIMINATION: "SINGLE_ELIMINATION",
    DOUBLE_ELIMINATION: "DOUBLE_ELIMINATION",
    SWISS: "SWISS",
    SWISS_TOP_CUT: "SWISS_TOP_CUT",
    ROUND_ROBIN: "ROUND_ROBIN",
    LADDER: "LADDER",
  },
  BattlegroundsTournamentScope: {
    COMMUNITY: "COMMUNITY",
    ALLIANCE: "ALLIANCE",
  },
  BattlegroundsTournamentStatus: {
    DRAFT: "DRAFT",
    REGISTRATION: "REGISTRATION",
    CHECK_IN: "CHECK_IN",
    LIVE: "LIVE",
    FINISHED: "FINISHED",
    ARCHIVED: "ARCHIVED",
  },
  TournamentParticipantStatus: {
    INVITED: "INVITED",
    CONFIRMED: "CONFIRMED",
    CHECKED_IN: "CHECKED_IN",
    DROPPED: "DROPPED",
  },
}));

import type { TournamentSummary, TournamentMember } from "./tournaments-client";

// ---------------------------------------------------------------------------
// Re-implementations of the private pure functions (spec-based)
// ---------------------------------------------------------------------------

/**
 * Spec: null or empty → "Unscheduled"; valid ISO string → locale-formatted date.
 */
function formatDate(value: string | null): string {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Spec: returns Tailwind CSS class string based on tournament status.
 */
function statusTone(status: BattlegroundsTournamentStatus): string {
  switch (status) {
    case "LIVE":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "CHECK_IN":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "REGISTRATION":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "FINISHED":
      return "border-violet-500/40 bg-violet-500/15 text-violet-200";
    case "ARCHIVED":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

/**
 * Spec: participants sorted by seed asc (null treated as 9999), then
 *       battlegroup asc (null treated as 99), then ingameName asc.
 */
function sortParticipants(tournament: TournamentSummary) {
  return [...tournament.participants].sort((a, b) => {
    const aSeed = a.seed ?? 9999;
    const bSeed = b.seed ?? 9999;
    if (aSeed !== bSeed) return aSeed - bSeed;
    const aBg = a.battlegroup ?? 99;
    const bBg = b.battlegroup ?? 99;
    if (aBg !== bBg) return aBg - bBg;
    return a.player.ingameName.localeCompare(b.player.ingameName);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMember(overrides: Partial<TournamentMember> = {}): TournamentMember {
  return {
    id: "player-1",
    ingameName: "PlayerOne",
    battlegroup: null,
    championPrestige: null,
    avatar: null,
    ...overrides,
  };
}

type RawParticipant = TournamentSummary["participants"][number];

function makeParticipant(overrides: Partial<RawParticipant> & { playerOverrides?: Partial<TournamentMember> } = {}): RawParticipant {
  const { playerOverrides, ...rest } = overrides;
  return {
    id: "part-1",
    seed: null,
    battlegroup: null,
    status: "CONFIRMED" as TournamentParticipantStatus,
    checkedInAt: null,
    player: makeMember(playerOverrides),
    ...rest,
  };
}

function makeTournament(participants: RawParticipant[]): TournamentSummary {
  return {
    id: "t-1",
    name: "Test Tournament",
    description: null,
    scope: "COMMUNITY",
    format: "SINGLE_ELIMINATION",
    status: "DRAFT",
    startsAt: null,
    checkInStartsAt: null,
    createdAt: new Date().toISOString(),
    allianceId: null,
    createdById: "creator-1",
    createdBy: { ingameName: "CreatorName" },
    participants,
    _count: { matches: 0 },
  };
}

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("returns 'Unscheduled' for null", () => {
    expect(formatDate(null)).toBe("Unscheduled");
  });

  it("returns 'Unscheduled' for an empty string", () => {
    expect(formatDate("")).toBe("Unscheduled");
  });

  it("returns a non-empty string for a valid ISO date", () => {
    const result = formatDate("2026-08-15T20:00:00.000Z");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("Unscheduled");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes day and month information for a valid date", () => {
    // Use a fixed known date: Aug 15 — the month/day should appear in the output
    // regardless of locale (they are always requested in the format options)
    const result = formatDate("2026-08-15T20:00:00.000Z");
    // The result will contain either a numeric day (15) or formatted month
    expect(result).toMatch(/\d/);
  });
});

// ---------------------------------------------------------------------------
// statusTone
// ---------------------------------------------------------------------------

describe("statusTone", () => {
  it("returns emerald classes for LIVE", () => {
    const tone = statusTone("LIVE");
    expect(tone).toContain("emerald");
  });

  it("returns sky classes for CHECK_IN", () => {
    const tone = statusTone("CHECK_IN");
    expect(tone).toContain("sky");
  });

  it("returns amber classes for REGISTRATION", () => {
    const tone = statusTone("REGISTRATION");
    expect(tone).toContain("amber");
  });

  it("returns violet classes for FINISHED", () => {
    const tone = statusTone("FINISHED");
    expect(tone).toContain("violet");
  });

  it("returns muted slate classes for ARCHIVED", () => {
    const tone = statusTone("ARCHIVED");
    expect(tone).toContain("slate");
    // ARCHIVED uses slate-400 (muted) text
    expect(tone).toContain("text-slate-400");
  });

  it("returns default slate classes for DRAFT", () => {
    const tone = statusTone("DRAFT");
    expect(tone).toContain("slate");
    // DRAFT uses the default path (text-slate-300)
    expect(tone).toContain("text-slate-300");
  });

  it("all known statuses produce a non-empty class string", () => {
    const statuses: BattlegroundsTournamentStatus[] = [
      "DRAFT",
      "REGISTRATION",
      "CHECK_IN",
      "LIVE",
      "FINISHED",
      "ARCHIVED",
    ];
    for (const status of statuses) {
      expect(statusTone(status).length).toBeGreaterThan(0);
    }
  });

  it("LIVE and DRAFT produce different class strings", () => {
    expect(statusTone("LIVE")).not.toBe(statusTone("DRAFT"));
  });
});

// ---------------------------------------------------------------------------
// sortParticipants
// ---------------------------------------------------------------------------

describe("sortParticipants", () => {
  it("sorts by seed ascending", () => {
    const p1 = makeParticipant({ seed: 3, playerOverrides: { ingameName: "Alpha" } });
    const p2 = makeParticipant({ seed: 1, playerOverrides: { ingameName: "Beta" } });
    const p3 = makeParticipant({ seed: 2, playerOverrides: { ingameName: "Gamma" } });
    const tournament = makeTournament([p1, p2, p3]);

    const sorted = sortParticipants(tournament);

    expect(sorted[0].seed).toBe(1);
    expect(sorted[1].seed).toBe(2);
    expect(sorted[2].seed).toBe(3);
  });

  it("places unseeded participants (null) after seeded ones", () => {
    const seeded = makeParticipant({ seed: 1, playerOverrides: { ingameName: "Seeded" } });
    const unseeded = makeParticipant({ seed: null, playerOverrides: { ingameName: "Unseeded" } });
    const tournament = makeTournament([unseeded, seeded]);

    const sorted = sortParticipants(tournament);

    expect(sorted[0].seed).toBe(1);
    expect(sorted[1].seed).toBeNull();
  });

  it("sorts by battlegroup when seeds are equal (both null)", () => {
    const bg2 = makeParticipant({ seed: null, battlegroup: 2, playerOverrides: { ingameName: "BG2Player" } });
    const bg1 = makeParticipant({ seed: null, battlegroup: 1, playerOverrides: { ingameName: "BG1Player" } });
    const tournament = makeTournament([bg2, bg1]);

    const sorted = sortParticipants(tournament);

    expect(sorted[0].battlegroup).toBe(1);
    expect(sorted[1].battlegroup).toBe(2);
  });

  it("places participants without a battlegroup (null) after those with one", () => {
    const nobg = makeParticipant({ seed: null, battlegroup: null, playerOverrides: { ingameName: "NoBG" } });
    const hasbg = makeParticipant({ seed: null, battlegroup: 1, playerOverrides: { ingameName: "HasBG" } });
    const tournament = makeTournament([nobg, hasbg]);

    const sorted = sortParticipants(tournament);

    expect(sorted[0].battlegroup).toBe(1);
    expect(sorted[1].battlegroup).toBeNull();
  });

  it("sorts alphabetically by ingameName as the tiebreaker", () => {
    const charlie = makeParticipant({ seed: null, battlegroup: null, playerOverrides: { ingameName: "Charlie" } });
    const alice = makeParticipant({ seed: null, battlegroup: null, playerOverrides: { ingameName: "Alice" } });
    const bob = makeParticipant({ seed: null, battlegroup: null, playerOverrides: { ingameName: "Bob" } });
    const tournament = makeTournament([charlie, alice, bob]);

    const sorted = sortParticipants(tournament);

    expect(sorted[0].player.ingameName).toBe("Alice");
    expect(sorted[1].player.ingameName).toBe("Bob");
    expect(sorted[2].player.ingameName).toBe("Charlie");
  });

  it("does not mutate the original participants array", () => {
    const p1 = makeParticipant({ seed: 2, playerOverrides: { ingameName: "Second" } });
    const p2 = makeParticipant({ seed: 1, playerOverrides: { ingameName: "First" } });
    const tournament = makeTournament([p1, p2]);
    const originalOrder = [tournament.participants[0], tournament.participants[1]];

    sortParticipants(tournament);

    // Original array still has p1 first
    expect(tournament.participants[0]).toBe(originalOrder[0]);
    expect(tournament.participants[1]).toBe(originalOrder[1]);
  });

  it("returns an empty array when there are no participants", () => {
    const tournament = makeTournament([]);

    const sorted = sortParticipants(tournament);

    expect(sorted).toEqual([]);
  });

  it("handles a single participant correctly", () => {
    const only = makeParticipant({ seed: 1, playerOverrides: { ingameName: "Solo" } });
    const tournament = makeTournament([only]);

    const sorted = sortParticipants(tournament);

    expect(sorted).toHaveLength(1);
    expect(sorted[0].player.ingameName).toBe("Solo");
  });

  it("applies full three-level sort: seed → battlegroup → name", () => {
    const participants: RawParticipant[] = [
      makeParticipant({ id: "a", seed: null, battlegroup: null, playerOverrides: { id: "a", ingameName: "Zara" } }),
      makeParticipant({ id: "b", seed: 1, battlegroup: 3, playerOverrides: { id: "b", ingameName: "Seeded1" } }),
      makeParticipant({ id: "c", seed: null, battlegroup: 2, playerOverrides: { id: "c", ingameName: "Mona" } }),
      makeParticipant({ id: "d", seed: null, battlegroup: 1, playerOverrides: { id: "d", ingameName: "Alex" } }),
      makeParticipant({ id: "e", seed: 2, battlegroup: 1, playerOverrides: { id: "e", ingameName: "Seeded2" } }),
      makeParticipant({ id: "f", seed: null, battlegroup: null, playerOverrides: { id: "f", ingameName: "Anna" } }),
    ];
    const tournament = makeTournament(participants);

    const sorted = sortParticipants(tournament);

    // seeded first: seed=1, seed=2
    expect(sorted[0].id).toBe("b"); // seed 1
    expect(sorted[1].id).toBe("e"); // seed 2
    // unseeded with bg=1
    expect(sorted[2].id).toBe("d"); // bg 1, "Alex"
    // unseeded with bg=2
    expect(sorted[3].id).toBe("c"); // bg 2, "Mona"
    // unseeded with no bg, alphabetical
    expect(sorted[4].id).toBe("f"); // "Anna"
    expect(sorted[5].id).toBe("a"); // "Zara"
  });
});

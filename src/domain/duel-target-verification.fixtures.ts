/** Reconstructed static-contract fixture; NO captured player or server response.
 * Blueprint join is a sanitized saved public PvE catalog fact, not a duel capture.
 * See docs/duel-target-discovery-investigation.md for hashes and exact code identities.
 */
export const blueprintFixture = new Map([
  ["storm_rar", { championGameId: "storm", stars: 3 }],
]);

export const receiptFixture = {
  kind: "static-contract-fixture" as const,
  source: "game-59.1.0-client-contract",
  capturedAt: null,
  importedAt: "2026-11-09T00:00:00.000Z",
  sourceSha256: "d1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5",
};

export function profileFixture() {
  return {
    uid: "9007199254740993", name: "Fixture Player",
    current_avatar: { foreground: "unrelated-avatar" },
    gamestats: {
      ush: "unrelated-fallback",
      top: { h: [
        { b: "storm_rar", r: 4, l: 32, sl: 50 as number | undefined, a: 777, at: 0 as number | undefined },
        { b: "unrelated-second", r: 1, l: 1, sl: 0, a: 1, at: 0 },
      ] },
    },
  };
}

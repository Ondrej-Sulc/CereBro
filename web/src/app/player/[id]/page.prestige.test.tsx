import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import fixture from "../../../../../src/tests/fixtures/champion-prestige-ascension.json";
import { projectMcocPrestige } from "@/lib/mcoc-prestige";
import PlayerProfilePage from "./page";

const mocks = vi.hoisted(() => ({ roster: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  player: { findUnique: async () => ({ id: "player", ingameName: "Prestige fixture", alliance: null }) },
  roster: { findMany: mocks.roster, count: async () => 1, groupBy: async () => [] },
  warVideo: { findMany: async () => [], count: async () => 0 },
  warFight: { findMany: async () => [], aggregate: async () => ({ _count: { id: 0 }, _sum: { death: 0 } }), groupBy: async () => [] },
} }));
vi.mock("@/lib/auth-helpers", () => ({ getUserPlayerWithAlliance: async () => null }));
vi.mock("@/app/actions/quest-plan-sharing", () => ({ getPlayerQuestPlansForProfile: async () => [] }));
vi.mock("@/lib/support-status", () => ({ isPlayerSupporter: async () => false }));
vi.mock("@/lib/player-war-insights", () => ({ canViewPlayerWarInsights: () => false }));
vi.mock("./invite-player-button", () => ({ InvitePlayerButton: () => null }));
vi.mock("./player-war-insights-section", () => ({ PlayerWarInsightsSection: () => null }));
vi.mock("next/image", () => ({ default: () => null }));

const entry = {
  id: "owned", championId: 1, stars: 7, rank: 4, sigLevel: 200, isAwakened: true, isAscended: false, ascensionLevel: 0,
  champion: { name: "Infamous Iron Man", class: "TECH", images: {}, prestigeData: fixture.baseEndpoints },
};
beforeEach(() => mocks.roster.mockReset());

it.each([[0, false, "34,060"], [1, true, "36,780"], [2, true, "39,730"], [0, true, "36,780"]])(
  "projects player Top Champions from base endpoints and owned A%s/legacy %s", async (ascensionLevel, isAscended, expected) => {
    mocks.roster.mockResolvedValue([{ ...entry, ascensionLevel, isAscended }]);
    const html = renderToStaticMarkup(await PlayerProfilePage({ params: Promise.resolve({ id: "player" }), searchParams: Promise.resolve({}) }));
    expect(html.replace(/[,\u00a0\u202f]/g, "")).toContain(expected.replaceAll(",", ""));
    expect(fixture.baseEndpoints[2].prestige).toBe(34060);
  },
);

it("uses signature interpolation and leaves lower-star prestige unchanged", async () => {
  mocks.roster.mockResolvedValue([
    { ...entry, sigLevel: 100, ascensionLevel: 2 },
    { ...entry, id: "six", stars: 6, ascensionLevel: 1, champion: { ...entry.champion, prestigeData: [{ rarity: 6, rank: 4, sig: 0, prestige: 10000 }] } },
  ]);
  const html = renderToStaticMarkup(await PlayerProfilePage({ params: Promise.resolve({ id: "player" }), searchParams: Promise.resolve({}) }));
  const expected = projectMcocPrestige({ prestigeData: fixture.baseEndpoints, stat: { rarity: 7, rank: 4, prestige: null }, sigLevel: 100, ascensionLevel: 2 });
  expect(html.replace(/[,\u00a0\u202f]/g, "")).toContain(String(expected));
  expect(html.replace(/[,\u00a0\u202f]/g, "")).toContain("10000");
});

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import fixture from "../../../../../src/tests/fixtures/champion-prestige-ascension.json";
import { projectMcocPrestige } from "@/lib/mcoc-prestige";
import PlayerProfilePage from "./page";

const mocks = vi.hoisted(() => ({ roster: vi.fn(), fights: vi.fn(), videos: vi.fn(), questPlans: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  player: { findUnique: async () => ({ id: "player", ingameName: "Prestige fixture", alliance: null }) },
  roster: { findMany: mocks.roster, count: async () => 1, groupBy: async () => [] },
  warVideo: { findMany: mocks.videos, count: async () => 0 },
  warFight: { findMany: mocks.fights, aggregate: async () => ({ _count: { id: 0 }, _sum: { death: 0 } }), groupBy: async () => [] },
} }));
vi.mock("@/lib/auth-helpers", () => ({ getUserPlayerWithAlliance: async () => null }));
vi.mock("@/app/actions/quest-plan-sharing", () => ({ getPlayerQuestPlansForProfile: mocks.questPlans }));
vi.mock("@/lib/support-status", () => ({ isPlayerSupporter: async () => false }));
vi.mock("@/lib/player-war-insights", () => ({ canViewPlayerWarInsights: () => false }));
vi.mock("./invite-player-button", () => ({ InvitePlayerButton: () => null }));
vi.mock("./player-war-insights-section", () => ({ PlayerWarInsightsSection: () => null }));
vi.mock("next/image", () => ({ default: () => null }));

const entry = {
  id: "owned", championId: 1, stars: 7, rank: 4, sigLevel: 200, isAwakened: true, isAscended: false, ascensionLevel: 0,
  champion: { name: "Infamous Iron Man", class: "TECH", images: {}, prestigeData: fixture.baseEndpoints },
};
beforeEach(() => {
  mocks.roster.mockReset();
  mocks.fights.mockReset().mockResolvedValue([]);
  mocks.videos.mockReset().mockResolvedValue([]);
  mocks.questPlans.mockReset().mockResolvedValue([]);
});

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
  expect(html).not.toContain("Show all");
});

it("renders the mobile gallery disclosure and keeps both sides and the visible recording in compact fight rows", async () => {
  mocks.roster.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({ ...entry, id: "owned-" + index })));
  mocks.fights.mockResolvedValue([{
    id: "fight",
    createdAt: new Date(),
    death: 1,
    war: { id: "war", allianceId: "alliance", alliance: { name: "Test alliance" }, season: 65, warNumber: 3, warTier: 1 },
    node: { nodeNumber: 7 },
    attacker: { name: "Hulkling", images: {} },
    defender: { name: "Chee'ilth", images: {} },
    recordings: [
      { position: 0, video: { id: "private", status: "PUBLISHED", visibility: "alliance" } },
      { position: 1, video: { id: "public", status: "PUBLISHED", visibility: "public" } },
    ],
  }]);

  const html = renderToStaticMarkup(await PlayerProfilePage({ params: Promise.resolve({ id: "player" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Show all 10 champions");
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("Attacker: </span>Hulkling");
  expect(html).toContain("Defender: </span>Chee&#x27;ilth");
  expect(html).toContain("Season 65 · War 3 · Tier 1");
  expect(html).toContain("1 death");
  expect(html).toContain('href="/war-videos/public"');
  expect(html).not.toContain('href="/war-videos/private"');
});

it("keeps matchups, links, and quest progress in the compact profile rows", async () => {
  const war = { alliance: { name: "Mercenaries (Global)" }, season: 65, warNumber: 4, warTier: 1 };
  const fight = { id: "one", war, attacker: { id: 1, name: "Nick Fury" }, defender: { id: 2, name: "Scorpion" } };
  mocks.roster.mockResolvedValue([]);
  mocks.videos.mockResolvedValue([{
    id: "recording", url: "https://youtu.be/dQw4w9WgXcQ", createdAt: new Date("2026-11-24T12:00:00Z"),
    fights: [fight],
    fightLinks: [{ fight }, { fight: { ...fight, id: "two", attacker: { id: 3, name: "Photon" } } }],
  }]);
  const quest = {
    title: "Horned Destroyer", category: { name: "Act 9" }, encounters: [{}, {}],
    teamLimit: 5, minStarLevel: 6, maxStarLevel: 7, requiredClasses: ["TECH"], bannerUrl: null,
  };
  mocks.questPlans.mockResolvedValue([
    { id: "partial", encounters: [{}], questPlan: { ...quest, id: "horned" } },
    { id: "finished", encounters: [{}, {}], questPlan: { ...quest, id: "nomad", title: "Nomad and Curse", teamLimit: null } },
  ]);

  const html = renderToStaticMarkup(await PlayerProfilePage({ params: Promise.resolve({ id: "player" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain('href="/war-videos/recording"');
  expect(html).toContain("Nick Fury +1 → Scorpion");
  expect(html).toContain("Attackers: Nick Fury, Photon. Defenders: Scorpion");
  expect(html).toContain("S65 · W4 · T1 · 2 fights");
  expect(html).toContain('href="/player/player/quests/horned"');
  expect(html).toContain("2 fights · Team of 5 · 6–7★");
  expect(html).toContain("2 fights · Swap · 6–7★");
  expect(html).toContain("1 / 2 picked");
  expect(html.match(/Completed/g)).toHaveLength(1);
});

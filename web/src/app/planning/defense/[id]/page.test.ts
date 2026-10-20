import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const boundary = vi.hoisted(() => ({
  player: { findMany: vi.fn() },
  war: { findMany: vi.fn() },
  warDefensePlan: { findFirst: vi.fn() },
  tag: { findMany: vi.fn() },
  getUserPlayerWithAlliance: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: boundary }));
vi.mock("@/lib/auth-helpers", () => boundary);
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/alliance-permissions", () => import("../../../../lib/alliance-permissions"));
vi.mock("@/lib/cache", () => import("../../../../lib/cache"));
vi.mock("@/lib/data/champions", () => ({ getCachedChampions: async () => [] }));
vi.mock("../../defense-actions", () => ({ updateDefensePlacement: vi.fn() }));
vi.mock("@/components/FormPageBackground", () => ({ default: () => null }));
vi.mock("@/components/war-planning/defense-details-client", () => ({
  default: ({ players }: { players: Array<{ ingameName: string }> }) => players.map((player) => player.ingameName).join(", "),
}));

import DefenseDetailsPage from "./page";
import { clearCache } from "../../../../lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
  clearCache("alliance-members-", true);
  clearCache("distinct-seasons-", true);
  boundary.war.findMany.mockResolvedValue([]);
  boundary.getUserPlayerWithAlliance.mockResolvedValue({ allianceId: "alliance-1", battlegroup: 1, isOfficer: true, isBotAdmin: false });
  boundary.warDefensePlan.findFirst.mockResolvedValue({ id: "plan", allianceId: "alliance-1", alliance: {} });
  boundary.tag.findMany.mockResolvedValue([]);
});

it("loads current members on reopening defense after a bot-side removal and replacement", async () => {
  boundary.player.findMany.mockResolvedValue([{ ingameName: "Departing" }]);
  const page = () => DefenseDetailsPage({ params: Promise.resolve({ id: "plan" }) });
  expect(renderToStaticMarkup(await page())).toContain("Departing");

  // A separate bot process changes the shared database without web cache access.
  boundary.player.findMany.mockResolvedValue([{ ingameName: "Replacement" }]);
  const reopened = renderToStaticMarkup(await page());
  expect(reopened).toContain("Replacement");
  expect(reopened).not.toContain("Departing");
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  battlegroundsTournament: {
    create: vi.fn(),
  },
}));

const authHelpersFake = vi.hoisted(() => ({
  getUserPlayerWithAlliance: vi.fn(),
}));

const permissionsFake = vi.hoisted(() => ({
  canPlanAllianceWar: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authHelpersFake);
vi.mock("@/lib/alliance-permissions", () => permissionsFake);
vi.mock("@/lib/logger", () => ({ default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import { createTournament } from "./actions";

function buildCreateTournamentForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("name", overrides.name ?? "Friday BG Gauntlet");
  formData.set("description", overrides.description ?? "Friendly bracket");
  formData.set("scope", overrides.scope ?? "COMMUNITY");
  formData.set("format", overrides.format ?? "SINGLE_ELIMINATION");
  formData.set("startsAt", overrides.startsAt ?? "2026-06-04T20:00");
  formData.set("startsAtTimezoneOffsetMinutes", overrides.startsAtTimezoneOffsetMinutes ?? "240");
  formData.set("checkInStartsAt", overrides.checkInStartsAt ?? "2026-06-04T19:30");
  formData.set("checkInStartsAtTimezoneOffsetMinutes", overrides.checkInStartsAtTimezoneOffsetMinutes ?? "240");
  return formData;
}

describe("battlegrounds tournament actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHelpersFake.getUserPlayerWithAlliance.mockResolvedValue({
      id: "player_1",
      allianceId: "alliance_1",
      isBotAdmin: false,
      isOfficer: true,
      isPlanner: false,
    });
    permissionsFake.canPlanAllianceWar.mockReturnValue(true);
    prismaFake.battlegroundsTournament.create.mockResolvedValue({ id: "tournament_1" });
  });

  it("stores datetime-local values using the browser timezone offset", async () => {
    await expect(createTournament(buildCreateTournamentForm())).resolves.toEqual({ success: true });

    expect(prismaFake.battlegroundsTournament.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startsAt: new Date("2026-06-05T00:00:00.000Z"),
        checkInStartsAt: new Date("2026-06-04T23:30:00.000Z"),
      }),
    });
  });
});

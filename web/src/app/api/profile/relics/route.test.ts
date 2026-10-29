import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, PATCH, DELETE, PUT } from "./route";
const mocks = vi.hoisted(() => ({
  player: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  state: vi.fn(),
  preference: vi.fn(),
  options: vi.fn(),
}));
vi.mock("@/lib/auth-helpers", () => ({
  getUserPlayerWithAlliance: mocks.player,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/with-request-context", () => ({
  withRouteContext: (fn: unknown) => fn,
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock(
  "@cerebro/core/services/playerRelicService",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    addPlayerRelic: mocks.add,
    updatePlayerRelic: mocks.update,
    removePlayerRelic: mocks.remove,
    getPlayerRelicState: mocks.state,
    setPlayerRelicPrestigeSource: mocks.preference,
    playerRelicBuildOptions: mocks.options,
  }),
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.player.mockResolvedValue({ id: "profile-a", ingameName: "Alpha" });
  mocks.state.mockResolvedValue({ entries: [], prestige: null });
  mocks.preference.mockResolvedValue({ entries: [], prestige: null });
  mocks.add.mockResolvedValue({ id: "new" });
});
const request = (method: string, body: unknown, origin = "http://localhost") =>
  new NextRequest("http://localhost/api/profile/relics", {
    method,
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
describe("private relic routes", () => {
  it.each([false, true])(
    "accepts same-origin requests behind the deployment proxy (forwarded host: %s)",
    async (forwardedHost) => {
      const response = await POST(
        new NextRequest("http://0.0.0.0:8080/api/profile/relics", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            host: "cerebro-bot.com",
            origin: "https://cerebro-bot.com",
            "x-forwarded-proto": "https",
            ...(forwardedHost ? { "x-forwarded-host": "cerebro-bot.com" } : {}),
          },
          body: JSON.stringify({
            profileId: "profile-a",
            relicId: "test",
            stars: 6,
            rank: 2,
            sigLevel: 40,
          }),
        }),
      );
      expect(response.status).toBe(201);
      expect(mocks.add).toHaveBeenCalledOnce();
    },
  );
  it("requires a signed-in game profile", async () => {
    mocks.player.mockResolvedValue(null);
    expect(
      (await GET(new NextRequest("http://localhost/api/profile/relics")))
        .status,
    ).toBe(401);
    expect((await POST(request("POST", {}))).status).toBe(401);
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it.each([
    [POST, "POST"],
    [PATCH, "PATCH"],
    [DELETE, "DELETE"],
    [PUT, "PUT"],
  ] as const)(
    "rejects a stale or different active profile",
    async (handler, method) => {
      expect(
        (await handler(request(method, { profileId: "profile-b" }))).status,
      ).toBe(409);
      expect(mocks.add).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.preference).not.toHaveBeenCalled();
    },
  );
  it("passes only the authenticated owner into the service", async () => {
    const data = { relicId: "test", stars: 6, rank: 2, sigLevel: 40 };
    const response = await POST(
      request("POST", { profileId: "profile-a", ...data }),
    );
    expect(response.status).toBe(201);
    expect(mocks.add).toHaveBeenCalledWith({}, "profile-a", data);
  });
  it.each(["https://other.example", "null", "invalid"])(
    "rejects untrusted origin %s",
    async (origin) => {
      expect(
        (await POST(request("POST", { profileId: "profile-a" }, origin)))
          .status,
      ).toBe(403);
      expect(mocks.add).not.toHaveBeenCalled();
    },
  );
  it("changes prestige source only for the active owner and returns current totals", async () => {
    const data = { enabled: true, confirmedTop30: true, revision: "a".repeat(64) };
    const response = await PUT(request("PUT", { profileId: "profile-a", ...data }));
    expect(response.status).toBe(200);
    expect(mocks.preference).toHaveBeenCalledWith({}, "profile-a", data);
    expect((await response.json()).inventory.profile.id).toBe("profile-a");
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("does not cache private inventory", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/profile/relics"),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      profile: { id: "profile-a", name: "Alpha" },
      entries: [],
      prestige: null,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { NextAuthConfig } from "next-auth";
import { NextRequest } from "next/server";

// Exercise the real Auth.js request pipeline with this app's configuration.
// Bypass only Next.js's framework bridge (its extensionless ESM imports require
// the Next.js bundler), resolving the exact core version used by next-auth.
vi.mock("next-auth", async () => {
  const require = createRequire(import.meta.url);
  const authRequire = createRequire(require.resolve("next-auth"));
  const { Auth } = await import(pathToFileURL(authRequire.resolve("@auth/core")).href);
  return {
    default: (config: NextAuthConfig) => {
      const handler = (request: Request) => Auth(request, {
        ...config,
        basePath: "/api/auth",
        secret: "discord-oauth-regression-test-secret",
        providers: config.providers.map((provider) => ({
          ...provider,
          options: { ...("options" in provider ? provider.options : {}), clientId: "test-client", clientSecret: "test-secret" },
        })),
      });
      return { handlers: { GET: handler, POST: handler } };
    },
  };
});

const mocks = vi.hoisted(() => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  prisma: {
    account: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    session: { create: vi.fn() },
    botUser: { upsert: vi.fn(), update: vi.fn() },
    player: { updateMany: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/logger", () => ({ default: mocks.logger }));
vi.mock("@/lib/cache", () => ({ getFromCache: vi.fn() }));
vi.mock("@/lib/discord-profile-sync", () => import("./lib/discord-profile-sync"));

import { handlers } from "./auth";

const origin = "https://cerebro.example";
const discordId = "123456789012345678";

describe("Discord OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.account.findUnique.mockResolvedValue(null);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockImplementation(async ({ data }) => ({ id: "user-1", ...data }));
    mocks.prisma.session.create.mockImplementation(async ({ data }) => data);
    mocks.prisma.botUser.upsert.mockResolvedValue({ id: "bot-user-1", activeProfileId: "player-1" });
    mocks.prisma.player.findMany.mockResolvedValue([{ id: "player-1", botUserId: "bot-user-1", isActive: true }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://discord.com/api/oauth2/token") {
        return Response.json({ access_token: "test-access-token", token_type: "Bearer", expires_in: 3600 });
      }
      if (url === "https://discord.com/api/users/@me") {
        return Response.json({ id: discordId, username: "Test Player", avatar: null, discriminator: "0", email: "player@example.com" });
      }
      throw new Error(`Unexpected OAuth request: ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startSignIn() {
    const csrf = await handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const { csrfToken } = await csrf.json();
    const cookie = csrf.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const response = await handlers.POST(new NextRequest(`${origin}/api/auth/signin/discord`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, callbackUrl: origin }),
    }));
    const authorization = new URL(response.headers.get("location")!);
    expect(authorization.origin).toBe("https://discord.com");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    const cookies = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const params = new URLSearchParams({ code: "test-authorization-code" });
    const state = authorization.searchParams.get("state");
    if (state) params.set("state", state);
    return { cookies, params };
  }

  it.each(["https://discord.com", undefined])("completes sign-in with issuer %s", async (issuer) => {
    const { cookies, params } = await startSignIn();
    if (issuer) params.set("iss", issuer);
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, {
      headers: { cookie: cookies },
    }));

    expect(mocks.logger.error).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(origin);
    expect(mocks.prisma.account.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ provider: "discord", providerAccountId: discordId }),
    }));
    expect(response.headers.getSetCookie().some((value) => value.startsWith("__Secure-authjs.session-token="))).toBe(true);
  });

  it("rejects an unexpected issuer before exchanging the authorization code", async () => {
    const { cookies, params } = await startSignIn();
    params.set("iss", "https://untrusted.example");
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, {
      headers: { cookie: cookies },
    }));

    expect(response.headers.get("location")).toBe(`${origin}/auth/error?error=Configuration`);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.prisma.session.create).not.toHaveBeenCalled();
  });

  it("still rejects a callback with a missing PKCE cookie", async () => {
    const { params } = await startSignIn();
    params.set("iss", "https://discord.com");
    await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`));

    expect(mocks.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ errorType: "InvalidCheck" }), expect.any(String));
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.prisma.session.create).not.toHaveBeenCalled();
  });
});

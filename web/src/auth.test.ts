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
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    botUser: { upsert: vi.fn(), update: vi.fn() },
    player: { updateMany: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/logger", () => ({ default: mocks.logger }));
vi.mock("@/lib/cache", () => ({ getFromCache: vi.fn() }));
vi.mock("@/lib/discord-profile-sync", () => import("./lib/discord-profile-sync"));
vi.mock("@/lib/observability/auth-errors", () => import("./lib/observability/auth-errors"));

import { handlers } from "./auth";

const origin = "https://cerebro.example";
const discordId = "123456789012345678";

describe("Discord OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.account.findUnique.mockResolvedValue(null);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockResolvedValue(null);
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

  async function startSignIn(callbackUrl = origin) {
    const csrf = await handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const { csrfToken } = await csrf.json();
    const cookie = csrf.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const response = await handlers.POST(new NextRequest(`${origin}/api/auth/signin/discord`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
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
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`));

    expect(response.headers.get("location")).toBe(`${origin}/auth/error?error=Configuration`);
    expect(mocks.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ errorType: "InvalidCheck" }), expect.any(String));
    expect(mocks.logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      errorReason: "pkce_cookie_invalid",
      causeReason: "pkce_cookie_missing",
    }), expect.any(String));
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.prisma.session.create).not.toHaveBeenCalled();
  });

  it("routes repeated email collisions to account recovery without linking or creating a session", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "original-user", email: "player@example.com" });

    for (let attempt = 0; attempt < 2; attempt++) {
      const { cookies, params } = await startSignIn();
      const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, {
        headers: { cookie: cookies },
      }));

      expect(response.headers.get("location")).toBe(`${origin}/auth/signin?error=OAuthAccountNotLinked`);
      expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith("__Secure-authjs.session-token="))).toBe(false);
    }

    expect(mocks.prisma.account.create).not.toHaveBeenCalled();
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
    expect(mocks.prisma.session.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
      errorType: "OAuthAccountNotLinked",
      errorReason: "email_collision",
      errorMessage: expect.any(String),
    }), expect.any(String));
  });

  it("rejects an already-linked Discord account when another CereBro user is signed in", async () => {
    const linkedUser = { id: "linked-user", email: "linked@example.com", emailVerified: null };
    mocks.prisma.account.findUnique.mockImplementation(async ({ select }: { select?: unknown }) =>
      select ? { userId: linkedUser.id } : { user: linkedUser });
    mocks.prisma.session.findUnique.mockResolvedValue({
      sessionToken: "existing-session-token",
      userId: "other-user",
      expires: new Date(Date.now() + 3600_000),
      user: { id: "other-user", email: "other@example.com", emailVerified: null },
    });
    const { cookies, params } = await startSignIn();
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, {
      headers: { cookie: `${cookies}; __Secure-authjs.session-token=existing-session-token` },
    }));

    expect(response.headers.get("location")).toBe(`${origin}/auth/signin?error=OAuthAccountNotLinked`);
    expect(mocks.prisma.account.create).not.toHaveBeenCalled();
    expect(mocks.prisma.session.create).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
      errorType: "OAuthAccountNotLinked",
      errorReason: "session_user_conflict",
    }), expect.any(String));

    // A GET renders confirmation; it must never sign the user out implicitly.
    const signOutPage = await handlers.GET(new NextRequest(`${origin}/api/auth/signout`, {
      headers: { cookie: "__Secure-authjs.session-token=existing-session-token" },
    }));
    expect(signOutPage.status).toBe(200);
    expect(mocks.prisma.session.delete).not.toHaveBeenCalled();

    const csrf = await handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const { csrfToken } = await csrf.json();
    const csrfCookies = csrf.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const signOut = await handlers.POST(new NextRequest(`${origin}/api/auth/signout`, {
      method: "POST",
      headers: {
        cookie: `${csrfCookies}; __Secure-authjs.session-token=existing-session-token`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrfToken, callbackUrl: "/" }),
    }));
    expect(signOut.headers.get("location")).toBe(`${origin}/`);
    expect(mocks.prisma.session.delete).toHaveBeenCalledWith({ where: { sessionToken: "existing-session-token" } });
    expect(signOut.headers.getSetCookie().some((cookie) => cookie.startsWith("__Secure-authjs.session-token=;") && cookie.includes("Max-Age=0"))).toBe(true);

    const retry = await startSignIn();
    const recovered = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${retry.params}`, {
      headers: { cookie: retry.cookies },
    }));
    expect(recovered.headers.get("location")).toBe(origin);
    expect(mocks.prisma.session.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: linkedUser.id }) }));
    expect(mocks.prisma.account.create).not.toHaveBeenCalled();
  });

  it("never logs raw adapter errors, credentials, emails, tokens, or nested causes", async () => {
    const sensitive = ["private@example.com", "leaked-access-token", "leaked-refresh-token", "leaked-code", "leaked-client-secret"];
    const databaseError = new Error(sensitive.join(" "), {
      cause: { access_token: sensitive[1], refresh_token: sensitive[2], code: sensitive[3], client_secret: sensitive[4] },
    });
    mocks.prisma.user.findUnique.mockRejectedValue(databaseError);
    const { cookies, params } = await startSignIn();
    await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, { headers: { cookie: cookies } }));

    // Inspect Error contents too: privacy must not depend on non-enumerable fields.
    const logs = JSON.stringify([...mocks.logger.error.mock.calls, ...mocks.logger.warn.mock.calls], (_key, value: unknown) =>
      value instanceof Error ? { message: value.message, cause: value.cause } : value);
    for (const secret of [...sensitive, "player@example.com", "test-access-token", "test-authorization-code"]) expect(logs).not.toContain(secret);
    expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({ errorType: "AdapterError", causeType: "Error" }), expect.any(String));
  });

  it.each(["/profile?tab=roster", `${origin}/planning?quest=1`])("preserves a safe callback URL: %s", async (callbackUrl) => {
    const { cookies, params } = await startSignIn(callbackUrl);
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, { headers: { cookie: cookies } }));
    expect(response.headers.get("location")).toBe(new URL(callbackUrl, origin).href);
  });

  it.each(["https://attacker.example/steal", "//attacker.example/steal", "/\\attacker.example/steal", "javascript:alert(1)"])("does not redirect to an attacker callback: %s", async (callbackUrl) => {
    const { cookies, params } = await startSignIn(callbackUrl);
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/callback/discord?${params}`, { headers: { cookie: cookies } }));
    expect(new URL(response.headers.get("location")!).origin).toBe(origin);
  });

  it("keeps the default sign-in entry and its callback available through the custom page", async () => {
    const response = await handlers.GET(new NextRequest(`${origin}/api/auth/signin?callbackUrl=${encodeURIComponent(`${origin}/profile`)}`));
    const location = new URL(response.headers.get("location")!, origin);
    expect(location.pathname).toBe("/auth/signin");
    expect(location.searchParams.get("callbackUrl")).toBe(`${origin}/profile`);
    expect(location.searchParams.has("error")).toBe(false);
  });
});

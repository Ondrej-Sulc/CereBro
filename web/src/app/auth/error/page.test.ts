import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AuthErrorPage from "./page";
import { DISCORD_INVITE } from "../../../lib/links";

vi.mock("@/app/actions/auth", () => ({ switchDiscordAccountAction: vi.fn() }));
vi.mock("@/lib/links", () => import("../../../lib/links"));

describe("authentication recovery page", () => {
  it("offers an explicit account switch and explains profile ownership", async () => {
    const html = renderToStaticMarkup(await AuthErrorPage({ searchParams: Promise.resolve({ error: "OAuthAccountNotLinked" }) }));

    expect(html).toContain("Switch Discord account");
    expect(html).toContain("different Discord account");
    expect(html).toContain("profiles");
    expect(html).not.toContain("original Discord account");
    expect(html).not.toContain("Try signing in again");
    expect(html).toContain("<form");
    expect(html).toContain(`href="${DISCORD_INVITE}"`);
    expect(html).toContain("Contact support");
  });

  it.each(["Configuration", "InvalidCheck"])("offers cookie troubleshooting without asserting a single cause for %s", async (error) => {
    const html = renderToStaticMarkup(await AuthErrorPage({ searchParams: Promise.resolve({ error }) }));
    expect(html).toMatch(/cookies/i);
    expect(html).toMatch(/same browser/i);
    expect(html).not.toContain("Login session expired");
    expect(html).toContain("Contact support");
    if (error === "Configuration") expect(html).toMatch(/server/i);
  });

  it("does not reflect untrusted error text or redirect query parameters", async () => {
    const html = renderToStaticMarkup(await AuthErrorPage({
      searchParams: Promise.resolve({ error: "<script>private-token</script>", callbackUrl: "https://attacker.example" }),
    }));
    expect(html).not.toContain("private-token");
    expect(html).not.toContain("attacker.example");
    expect(html).toContain("Sign-in failed");
  });
});

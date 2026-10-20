import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SignInPage from "./page";

const actions = vi.hoisted(() => ({ signInFromAuthPageAction: vi.fn(), signOutAction: vi.fn() }));
vi.mock("@/app/actions/auth", () => actions);
vi.mock("@/lib/links", () => import("../../../lib/links"));

beforeEach(() => vi.clearAllMocks());

describe("custom Auth.js sign-in page", () => {
  it("renders a normal Discord sign-in form carrying the original callback", async () => {
    const html = renderToStaticMarkup(await SignInPage({
      searchParams: Promise.resolve({ callbackUrl: "https://cerebro.example/profile?tab=roster" }),
    }));
    expect(html).toContain("Sign in with Discord");
    expect(html).toContain('name="callbackUrl" value="https://cerebro.example/profile?tab=roster"');
    expect(html).not.toContain("Account conflict");
    expect(actions.signInFromAuthPageAction).not.toHaveBeenCalled();
  });

  it("shows conflict recovery at the real SignInError destination without signing anyone out on GET", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ error: "OAuthAccountNotLinked" }) }));
    expect(html).toContain("Account conflict");
    expect(html).toContain("Sign out of CereBro");
    expect(html).toContain("Contact support");
    expect(actions.signOutAction).not.toHaveBeenCalled();
    expect(actions.signInFromAuthPageAction).not.toHaveBeenCalled();
  });
});

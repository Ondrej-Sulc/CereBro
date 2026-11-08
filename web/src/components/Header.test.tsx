// @vitest-environment jsdom

import { act, forwardRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Header from "./Header";
import { UserMenu } from "./UserMenu";
import { UserButton } from "./UserButton";
import type { Session } from "next-auth";

const { push, signInAction, signOutAction, auth } = vi.hoisted(() => ({
  push: vi.fn(),
  signInAction: vi.fn(),
  signOutAction: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/app/actions/auth", () => ({ signInAction, signOutAction }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: forwardRef<
    HTMLAnchorElement,
    ComponentProps<"a"> & { prefetch?: boolean }
  >(function Link({ prefetch: _prefetch, onClick, ...props }, ref) {
    void _prefetch;
    return (
      <a
        {...props}
        ref={ref}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
        }}
      />
    );
  }),
}));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    usePathname: () =>
      useSyncExternalStore(
        (listener) => {
          window.addEventListener("popstate", listener);
          return () => window.removeEventListener("popstate", listener);
        },
        () => window.location.pathname,
        () => "/",
      ),
    useRouter: () => ({ push }),
  };
});

let root: Root;
let media: EventTarget;
const member: Session["user"] = {
  id: "discord-user",
  name: "Summoner",
  image: null,
  isBotAdmin: false,
  permissions: [],
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  media = new EventTarget();
  vi.stubGlobal("matchMedia", () => Object.assign(media, { matches: false }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  document.body.innerHTML = '<div id="root"></div>';
  document.body.style.cssText = "";
  document.cookie = "cerebro-champions-view=; Max-Age=0; Path=/";
  document.cookie = "cerebro-relics-view=; Max-Age=0; Path=/";
  window.history.replaceState(null, "", "/champions");
  root = createRoot(document.getElementById("root")!);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render({
  user,
  alliance = false,
  profile = false,
}: { user?: Session["user"]; alliance?: boolean; profile?: boolean } = {}) {
  await act(async () =>
    root.render(
      <Header
        userButton={<UserMenu user={user} />}
        isInAlliance={alliance}
        hasPlayerProfile={profile}
      />,
    ),
  );
}
function button(label: string) {
  const found = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (el) => (el.getAttribute("aria-label") || el.textContent?.trim()) === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}
async function open(label: string) {
  const trigger = button(label);
  await act(async () => trigger.focus());
  await act(async () => {
    trigger.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        ctrlKey: false,
      }),
    );
    trigger.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, button: 0 }),
    );
    trigger.click();
  });
  // Radix outside-pointer handling arms after mount.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
  });
  return trigger;
}
async function key(
  key: string,
  target: Element = document.activeElement!,
  shiftKey = false,
) {
  await act(async () =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }),
    ),
  );
}
async function route(path: string) {
  await act(async () => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
const hrefs = (parent: ParentNode = document) =>
  [...parent.querySelectorAll<HTMLAnchorElement>("a")].map((el) =>
    el.getAttribute("href"),
  );
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;

it("retains every public destination with catalogs first in the real side panel", async () => {
  await render();
  await open("Menu");
  const links = hrefs(dialog());
  expect(links).toEqual([
    "/champions",
    "/relics",
    "/crystals",
    "/planning/quests",
    "/alliance/onboarding",
    "/war-videos",
    "https://discord.gg/eRv7fkMHmU",
    "/support",
    "/about",
    "/search",
  ]);
  const discord = dialog().querySelector('[href^="https://"]')!;
  expect(discord.getAttribute("target")).toBe("_blank");
  expect(discord.getAttribute("rel")).toContain("noopener");
  expect(hrefs(dialog())).not.toContain("/admin");
});

it.each([false, true])(
  "retains desktop planning routes for alliance=%s",
  async (alliance) => {
    await render({ user: member, alliance, profile: true });
    await open("Plan");
    expect(button("Plan").id).toBe("site-header-plan-trigger");
    expect(document.querySelector('[role="menu"]')?.getAttribute("aria-labelledby")).toBe(button("Plan").id);
    const links = hrefs(document.querySelector('[role="menu"]')!);
    expect(links).toEqual(
      alliance
        ? [
            "/planning/quests",
            "/alliance",
            "/alliance/roster",
            "/planning",
            "/planning/defense",
            "/analysis/season-overview",
          ]
        : ["/planning/quests", "/alliance/onboarding"],
    );
    await key("Escape");
    await open("More");
    expect(document.querySelector('[role="menu"]')?.getAttribute("aria-labelledby")).toBe(button("More").id);
    expect(hrefs(document.querySelector('[role="menu"]')!)).toEqual([
      "/war-videos",
      "https://discord.gg/eRv7fkMHmU",
      "/support",
      "/about",
    ]);
  },
);

it("retains all alliance destinations in the panel using the real membership prop", async () => {
  await render({ user: member, alliance: true, profile: true });
  await open("Menu");
  for (const path of [
    "/alliance",
    "/alliance/roster",
    "/planning",
    "/planning/defense",
    "/analysis/season-overview",
  ])
    expect(hrefs(dialog())).toContain(path);
  expect(hrefs(dialog())).not.toContain("/alliance/onboarding");
});

describe("remembered collection intent", () => {
  it.each([
    ["champions", "personal", true, "personal"],
    ["champions", "catalog", true, "catalog"],
    ["relics", "personal", true, "personal"],
    ["relics", "catalog", true, "catalog"],
    ["champions", "personal", false, "catalog"],
    ["relics", "personal", false, "catalog"],
    ["champions", "", true, "personal"],
  ] as const)(
    "%s remembers %s with profile=%s",
    async (section, remembered, profile, expected) => {
      if (remembered)
        document.cookie = `cerebro-${section}-view=${remembered}; Path=/`;
      await render({ profile });
      const link = document.querySelector<HTMLAnchorElement>(
        `nav[aria-label="Primary"] a[href="/${section}"]`,
      )!;
      await act(async () => link.click());
      expect(push).toHaveBeenLastCalledWith(`/${section}?view=${expected}`);
      await open("Menu");
      await act(async () =>
        dialog()
          .querySelector<HTMLAnchorElement>(`a[href="/${section}"]`)!
          .click(),
      );
      expect(push).toHaveBeenLastCalledWith(`/${section}?view=${expected}`);
      expect(dialog()).toBeNull();
      expect(document.body.style.overflow).not.toBe("hidden");
    },
  );
  it("keeps modified collection links native", async () => {
    await render({ profile: true });
    await act(async () =>
      document
        .querySelector('a[href="/champions"]')!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, ctrlKey: true }),
        ),
    );
    expect(push).not.toHaveBeenCalled();
  });
});

it.each([
  ["/champions/abomination", "/champions"],
  ["/profile/roster", "/champions"],
  ["/profile/relics", "/relics"],
  ["/crystals/exact-opening", "/crystals"],
  ["/planning/quests/shared/plan-id", "/planning/quests"],
  ["/planning/defense/plan-id", "/planning/defense"],
  ["/planning/cuid-war-id", "/planning"],
  ["/alliance/roster", "/alliance/roster"],
  ["/analysis/season-overview", "/analysis/season-overview"],
] as const)(
  "marks only the current panel destination at %s",
  async (path, current) => {
    await route(path);
    await render({ user: member, alliance: true, profile: true });
    await open("Menu");
    expect(
      [...dialog().querySelectorAll('a[aria-current="page"]')].map((el) =>
        el.getAttribute("href"),
      ),
    ).toEqual([current]);
  },
);

it("labels Account and Menu in one top row, with no mobile catalog strip or prototype controls", async () => {
  await render();
  expect(button("Account").closest("header")).not.toBeNull();
  expect(button("Menu").closest("header")).not.toBeNull();
  expect(document.querySelectorAll("header nav")).toHaveLength(1); // desktop only, hidden by CSS below 1024
  expect(document.body.textContent).not.toMatch(
    /Prototype|variant|preview player/i,
  );
  for (const file of ["Header.tsx", "UserMenu.tsx", "header-overlay.tsx"]) {
    expect(
      readFileSync(resolve("web/src/components", file), "utf8"),
    ).not.toMatch(
      /header-prototype|useSearchParams|variant=|AccountPreview|HeaderPrototype/,
    );
  }
  const css = readFileSync(
    resolve("web/src/components/header.module.css"),
    "utf8",
  );
  expect(css).toMatch(/@media \(max-width: 1023px\)/);
  expect(css).toContain(".desktopNav, .search { display: none; }");
});

it("locks body scroll, traps keyboard focus, dismisses with Escape and restores Menu focus", async () => {
  await render();
  const trigger = await open("Menu");
  expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
  expect(dialog().contains(document.activeElement)).toBe(true);
  const focusable = [...dialog().querySelectorAll<HTMLElement>("a,button")];
  await act(async () => focusable.at(-1)!.focus());
  await key("Tab");
  expect(document.activeElement).toBe(focusable[0]);
  await key("Tab", focusable[0], true);
  expect(document.activeElement).toBe(focusable.at(-1));
  await key("Escape");
  expect(dialog()).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(document.activeElement).toBe(trigger);
});

it("dismisses on outside pointer and restores focus", async () => {
  await render();
  const trigger = await open("Menu");
  const overlay = document.querySelector<HTMLElement>(
    '[data-state="open"][aria-hidden="true"]',
  )!;
  expect(overlay).not.toBeNull();
  await act(async () =>
    overlay.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
    ),
  );
  expect(dialog()).toBeNull();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(document.activeElement).toBe(trigger);
});

it("closes on route changes, same-route selections and breakpoint changes", async () => {
  await render();
  await open("Menu");
  await route("/relics");
  expect(dialog()).toBeNull();
  await open("Account");
  await route("/relics?view=catalog");
  expect(document.querySelector('[role="menu"]')).toBeNull();
  await open("Menu");
  await act(async () => media.dispatchEvent(new Event("change")));
  expect(dialog()).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("switches from account to navigation without competing surfaces or stale scroll locks", async () => {
  await render({ user: member });
  await open("Account");
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  await open("Menu");
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(dialog()).not.toBeNull();
  await key("Escape");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(document.body.style.overflow).not.toBe("hidden");
  await open("Account");
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  await key("Escape");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(document.activeElement).toBe(button("Account"));
});

it.each([
  [undefined, false],
  [member, false],
  [{ ...member, isBotAdmin: true }, true],
  [{ ...member, permissions: ["MANAGE_CHAMPIONS"] }, true],
] as const)(
  "uses actual account props and preserves conditional administration",
  async (user, admin) => {
    await render({ user: user as Session["user"] | undefined });
    await open("Account");
    const menu = document.querySelector('[role="menu"]')!;
    expect(hrefs(menu).includes("/admin")).toBe(admin);
    expect(hrefs(menu).includes("/profile")).toBe(!!user);
    expect(menu.textContent?.includes("Sign in with Discord")).toBe(!user);
    expect(menu.textContent?.includes("Sign Out")).toBe(!!user);
    if (user) {
      const signOut = [
        ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find((el) => el.textContent === "Sign Out")!;
      await act(async () => signOut.click());
      expect(signOutAction).toHaveBeenCalledOnce();
    } else {
      await act(async () =>
        menu.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
      );
      expect(signInAction).toHaveBeenCalledOnce();
    }
  },
);

it("derives the server account slot from auth, including the guest case", async () => {
  auth.mockResolvedValueOnce(null);
  expect((await UserButton()).props.user).toBeUndefined();
  auth.mockResolvedValueOnce({ user: member });
  expect((await UserButton()).props.user).toBe(member);
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CollectionView } from "@/lib/collection-view";
import { ChampionCollectionHeader, CollectionHeading, CollectionMemoryProvider, CollectionScreen } from "./collection-navigation";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(window.location.search) }));

let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  router.push.mockClear();
  document.cookie = "cerebro-champions-view=; Path=/; Max-Age=0";
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderChampions(view: CollectionView, signedIn = true, canUsePersonal = true) {
  await act(async () => root.render(
    <CollectionMemoryProvider>
      <CollectionScreen key={view} section="champions" view={view} profileId="one" signedIn={signedIn} canUsePersonal={canUsePersonal}>
        <ChampionCollectionHeader />
      </CollectionScreen>
    </CollectionMemoryProvider>,
  ));
}

const destination = () => document.querySelector<HTMLAnchorElement>('nav[aria-label="Champion pages"] a')!;

it("renders one page title and one link to the other champion page, with separate saved URLs", async () => {
  window.history.replaceState(null, "", "/champions?view=catalog&ascensionEligible=true");
  await renderChampions("catalog");
  expect(document.querySelector("h1")?.textContent).toBe("All Champions");
  expect(document.querySelectorAll("nav a")).toHaveLength(1);
  expect(destination().textContent).toBe("My Roster");
  expect(destination().getAttribute("href")).toBe("/champions?view=personal");
  await act(async () => destination().click());
  expect(router.push).toHaveBeenLastCalledWith("/champions?view=personal", { scroll: false });
  expect(document.cookie).toContain("cerebro-champions-view=personal");

  window.history.replaceState(null, "", "/champions?view=personal&insights=true");
  await renderChampions("personal");
  expect(document.querySelector("h1")?.textContent).toBe("My Roster");
  expect(document.querySelectorAll("nav a")).toHaveLength(1);
  expect(destination().textContent).toBe("All Champions");
  expect(destination().getAttribute("href")).toBe("/champions?view=catalog");
  await act(async () => destination().click());
  expect(router.push).toHaveBeenLastCalledWith("/champions?view=catalog&ascensionEligible=true", { scroll: false });

  window.history.replaceState(null, "", "/champions?view=catalog&ascensionEligible=true");
  await renderChampions("catalog");
  await act(async () => destination().click());
  expect(router.push).toHaveBeenLastCalledWith("/champions?view=personal&insights=true", { scroll: false });
});

it.each([
  { signedIn: false, label: "Sign in", href: "/auth/signin?callbackUrl=%2Fchampions%3Fview%3Dpersonal" },
  { signedIn: true, label: "Choose profile", href: "/profile" },
])("guides users to the correct prerequisite when they lack a roster (signed in: $signedIn)", async ({ signedIn, label, href }) => {
  await renderChampions("catalog", signedIn, false);
  await act(async () => destination().click());
  const prompt = document.querySelector('[role="status"] a');
  expect(prompt?.textContent).toBe(label);
  expect(prompt?.getAttribute("href")).toBe(href);
  expect(router.push).not.toHaveBeenCalled();
});

it("carries the quest filter across champion pages", async () => {
  window.history.replaceState(null, "", "/champions?view=catalog&questGate=1&questId=example");
  await renderChampions("catalog");
  const next = new URL(destination().href);
  expect(next.searchParams.get("view")).toBe("personal");
  expect(next.searchParams.get("questGate")).toBe("1");
  expect(next.searchParams.get("questId")).toBe("example");
  await act(async () => destination().click());
  expect(router.push).toHaveBeenLastCalledWith(next.pathname + next.search, { scroll: true });
});

it("keeps both collection links and the active title for relics", async () => {
  await act(async () => root.render(
    <CollectionScreen section="relics" view="catalog" profileId="one" signedIn canUsePersonal>
      <CollectionHeading />
    </CollectionScreen>,
  ));
  expect(document.querySelector('a[aria-current="page"] h1')?.textContent).toBe("All Relics");
  expect([...document.querySelectorAll("nav a")].map(link => link.textContent)).toEqual(["All Relics", "My Relics"]);
});

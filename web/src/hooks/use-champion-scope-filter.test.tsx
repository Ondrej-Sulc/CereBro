// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionMemoryProvider, CollectionScreen } from "@/components/collections/collection-navigation";
import { useChampionScopeFilter } from "./use-champion-scope-filter";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search) }));
let root: Root;
function Harness() {
  const [scope, setScope] = useChampionScopeFilter();
  return <><output>{scope}</output><button onClick={() => setScope("nonPlayable")}>NPC</button><button onClick={() => setScope("all")}>All</button><button onClick={() => setScope("playable")}>Reset</button></>;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.history.replaceState(null, "", "/champions?view=catalog&other=kept#results");
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
const scope = () => document.querySelector("output")?.textContent;
async function click(text: string) { await act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === text)!.click()); }
const render = async () => { await act(async () => root.render(<Harness />)); };

it("reads shared URLs, updates scope and resets while preserving unrelated state", async () => {
  window.history.replaceState(null, "", "/champions?view=catalog&championScope=nonPlayable&other=kept#results");
  await render(); expect(scope()).toBe("nonPlayable");
  await click("All"); expect(scope()).toBe("all"); expect(window.location.search).toContain("championScope=all");
  await click("Reset"); expect(scope()).toBe("playable");
  expect(window.location.search).toBe("?view=catalog&other=kept"); expect(window.location.hash).toBe("#results");
  window.history.replaceState(null, "", "/champions?championScope=nonPlayable"); await render(); expect(scope()).toBe("nonPlayable");
  window.history.replaceState(null, "", "/champions"); await render(); expect(scope()).toBe("playable");
});

it("restores each view and profile independently and normalizes invalid links", async () => {
  const show = async (view: "catalog" | "personal", profileId = "one", query = "") => {
    window.history.replaceState(null, "", `/champions?view=${view}${query}`);
    await act(async () => root.render(<CollectionMemoryProvider><CollectionScreen key={profileId + view} section="champions" view={view} profileId={profileId} signedIn canUsePersonal><Harness /></CollectionScreen></CollectionMemoryProvider>));
  };
  await show("catalog"); await click("NPC"); await show("personal"); expect(scope()).toBe("playable");
  await show("catalog", "two"); expect(scope()).toBe("playable"); await show("catalog"); expect(scope()).toBe("nonPlayable");
  expect(window.location.search).toContain("championScope=nonPlayable");
  await show("personal", "one", "&championScope=invalid"); expect(scope()).toBe("playable"); expect(window.location.search).not.toContain("championScope");
});

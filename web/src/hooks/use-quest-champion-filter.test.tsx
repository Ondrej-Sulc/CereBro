// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionMemoryProvider, CollectionScreen } from "@/components/collections/collection-navigation";
import { useQuestChampionFilter } from "./use-quest-champion-filter";
import { describeQuestGateChampionFilter, questGateChampionLinks } from "@/lib/game-quests/gate-champion-filter";

let laggedSearch: string | null = null;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(laggedSearch ?? window.location.search) }));
let root: Root;
const reset = vi.fn();
function Harness() {
  const filter = useQuestChampionFilter([{ name: "#Hero" }, { name: "Gamma" }, { name: "Metal" }], reset);
  return <><output>{JSON.stringify({ tags: filter.tags, logic: filter.tagLogic, gate: filter.questGate })}</output><p>{filter.questGate ? describeQuestGateChampionFilter(filter.questGate) : ""}</p><button onClick={() => filter.setTags(["Gamma"])}>Gamma</button><button onClick={filter.clearQuestGate}>Remove gate</button><button onClick={() => { filter.setTags([]); filter.setTagLogic("AND"); }}>Remove tags</button><button onClick={filter.clear}>Clear</button></>;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.history.replaceState(null, "", "/champions?view=catalog&other=kept#results");
  document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById("root")!);
  reset.mockClear(); laggedSearch = null;
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
const state = () => JSON.parse(document.querySelector("output")!.textContent!);
async function click(label: string) { await act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === label)!.click()); }
async function show(view: "catalog" | "personal" = "catalog", query = "", profileId = "one") {
  window.history.replaceState(null, "", `/champions?view=${view}${query}`);
  await act(async () => root.render(<CollectionMemoryProvider><CollectionScreen key={view + profileId} section="champions" view={view} profileId={profileId} signedIn canUsePersonal><Harness /></CollectionScreen></CollectionMemoryProvider>));
}

it("explicit links override saved tags, resolve exact optional # names, and include unowned champions", async () => {
  await show(); await click("Gamma");
  await show("personal"); await show(); expect(state().tags).toEqual(["Gamma"]);
  const link = questGateChampionLinks({ kind: "tags", images: [], filterGroups: [[{ kind: "tag", value: "Hero", negated: false }]] })!.roster;
  const query = new URL(link, "https://cerebro.test").search;
  await show("personal", `&${query.slice(1)}`);
  expect(state()).toEqual({ tags: ["#Hero"], logic: "AND", gate: null });
  expect(reset).toHaveBeenCalledWith(true);
});

it("keeps invalid constraints visible and removable, including while Next's query snapshot lags", async () => {
  await show("catalog", "&questTags=malformed&questGate=1&unowned=true&other=kept#results");
  expect(state().gate).toBe("invalid"); expect(document.querySelector("p")!.textContent).toBe("Invalid quest gate filter");
  laggedSearch = window.location.search;
  await click("Remove gate"); expect(state().gate).toBeNull(); expect(window.location.search).not.toContain("questTags");
  expect(window.location.search).not.toContain("questGate"); expect(window.location.search).toContain("other=kept"); expect(window.location.hash).toBe("#results");
  laggedSearch = null; await act(async () => root.render(<Harness />)); expect(state().gate).toBeNull();
});

it("removes every gate term on clear and clears explicit filters when browser navigation removes them", async () => {
  const groups = [[{ kind: "tag", value: "Metal", negated: true }]];
  await show("catalog", `&questTags=${encodeURIComponent(JSON.stringify(groups))}`);
  expect(state().gate).toEqual(groups); await click("Clear"); expect(state()).toEqual({ tags: [], logic: "AND", gate: null });
  await show("catalog", `&tags=${encodeURIComponent('["Hero"]')}`); expect(state().tags).toEqual(["#Hero"]);
  await show(); expect(state().tags).toEqual([]);
});

it("fails closed when a structured exclusion cannot resolve to a canonical tag", async () => {
  const groups = [[{ kind: "tag", value: "Not a known tag", negated: true }]];
  await show("catalog", `&questTags=${encodeURIComponent(JSON.stringify(groups))}`);
  expect(state().gate).toBe("invalid");
});

it("supports the existing tag rule's batched selection and logic removal", async () => {
  await show("catalog", `&tags=${encodeURIComponent('["Hero","Gamma"]')}&tagLogic=OR`);
  await click("Remove tags");
  expect(state()).toEqual({ tags: [], logic: "AND", gate: null });
  expect(window.location.search).not.toContain("tags=");
});

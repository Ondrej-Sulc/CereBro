import { act, createElement, useLayoutEffect } from "react";
import { KonvaRenderer } from "react-konva/lib/ReactKonvaCore";
import { WarMapType, WarResult, WarStatus, type War } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FightWithNode } from "@cerebro/core/data/war-planning/types";
import { getExtraChampions, getWarProgress, type ExtraChampion, type WarProgress } from "@/app/planning/actions";
import { reportClientError } from "@/lib/observability/client";
import { useWarPlanning } from "./use-war-planning";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/planning/actions", () => ({
  getActiveTactic: vi.fn().mockResolvedValue(null),
  getExtraChampions: vi.fn(),
  getWarProgress: vi.fn(),
}));
vi.mock("@/lib/observability/client", () => ({ reportClientError: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const node = { id: 4, nodeNumber: 4, allocations: [] } as unknown as FightWithNode["node"];
function fight(id: string, battlegroup: number): FightWithNode {
  return { id, warId: "war-1", battlegroup, nodeId: node.id, node, death: 3, player: null, attacker: null, defender: null } as FightWithNode;
}
function extras(battlegroup: number): ExtraChampion[] {
  return [{ id: `extra-${battlegroup}`, battlegroup }] as ExtraChampion[];
}
function progress(marker: number): WarProgress {
  return { marker } as unknown as WarProgress;
}
const response = (fights: FightWithNode[]) => new Response(JSON.stringify(fights));
type PendingRequest = {
  battlegroup: number;
  warId: string;
  result: ReturnType<typeof deferred<Response>>;
};

let requests: PendingRequest[];
let current: ReturnType<typeof useWarPlanning>;
let root: ReturnType<typeof KonvaRenderer.createContainer>;
let props: Parameters<typeof useWarPlanning>[0];

// The app's installed renderer runs real React hooks/effects without a DOM or
// additional test dependencies. This probe creates no canvas/host elements.
function Probe() {
  const state = useWarPlanning(props);
  useLayoutEffect(() => { current = state; });
  return null;
}
async function render() {
  await act(async () => { KonvaRenderer.updateContainer(createElement(Probe), root, null); });
}
async function switchBg(battlegroup: number) {
  await act(async () => { current.setActiveTab(`bg${battlegroup}`); });
}
async function settle(request: PendingRequest, fights: FightWithNode[] = []) {
  await act(async () => { request.result.resolve(response(fights)); });
}
async function fail(request: PendingRequest, message = "Load failed") {
  await act(async () => { request.result.reject(new Error(message)); });
}
async function poll() {
  await act(async () => { vi.advanceTimersByTime(5000); });
  return requests.at(-1)!;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", new EventTarget());
  requests = [];
  vi.mocked(getExtraChampions).mockImplementation(async (_warId, bg) => extras(bg));
  vi.mocked(getWarProgress).mockResolvedValue(progress(1));
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/api/war-planning/nodes?")) return Promise.resolve(new Response(JSON.stringify([node])));
    const query = new URL(url, "http://localhost").searchParams;
    const request = { battlegroup: Number(query.get("battlegroup")), warId: query.get("warId")!, result: deferred<Response>() };
    requests.push(request);
    return request.result.promise;
  }));
  props = {
    war: { id: "war-1", mapType: WarMapType.STANDARD, status: WarStatus.PLANNING, result: WarResult.WIN, enemyDeaths: 5 } as War,
    warId: "war-1", champions: [], players: [], seasonBans: [], warBans: [], latestHistorySeason: 60,
    updateWarFight: vi.fn().mockResolvedValue({ success: true }),
    updateWarStatus: vi.fn().mockResolvedValue({ success: true }),
  };
  const onError = (error: unknown) => { throw error; };
  root = KonvaRenderer.createContainer({}, 1, null, false, null, "", onError, onError, onError, () => {}, null);
});

afterEach(async () => {
  await act(async () => { KonvaRenderer.updateContainer(null, root, null); });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("war planning fight availability", () => {
  it("distinguishes an initial empty BG from an uncompleted load", async () => {
    await render();
    expect(current.loadingFights).toBe(true);
    expect(current.deathSummaryLoading).toBe(true);
    expect(current.deathSummaryError).toBeNull();
    expect(current.loadedFightsContext).toBeNull();
    await settle(requests[0]);
    expect(current.loadingFights).toBe(false);
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.deathSummaryError).toBeNull();
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 1 });
    expect(current.currentFights).toEqual([]);
    expect(current.fightsError).toBeNull();
  });

  it.each(["initial", "poll"])("ignores a late %s success after switching to an empty BG", async source => {
    if (source === "initial") vi.mocked(getWarProgress).mockResolvedValueOnce(progress(99));
    await render();
    let obsolete = requests[0];
    if (source === "poll") {
      await settle(obsolete, [fight("bg1", 1)]);
      vi.mocked(getWarProgress).mockResolvedValueOnce(progress(99));
      obsolete = await poll();
    }
    await switchBg(2);
    expect(current.deathSummaryLoading).toBe(true);
    await settle(requests.at(-1)!);
    const acceptedProgress = current.warProgress;
    await settle(obsolete, [fight("obsolete-bg1", 1)]);
    expect(current.currentFights).toEqual([]);
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 2 });
    expect(current.extraChampions).toEqual(extras(2));
    expect(current.warProgress).toEqual(acceptedProgress);
    expect(current.loadingFights).toBe(false);
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.deathSummaryError).toBeNull();
    expect(current.fightsError).toBeNull();
  });

  it("ignores an obsolete initial error and finally while the new BG is loading", async () => {
    await render();
    const obsolete = requests[0];
    await switchBg(2);
    await fail(obsolete, "Obsolete BG1 error");
    expect(current.loadingFights).toBe(true);
    expect(current.deathSummaryLoading).toBe(true);
    expect(current.deathSummaryError).toBeNull();
    expect(current.fightsError).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
    await settle(requests.at(-1)!);
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 2 });
  });

  it("ignores an obsolete initial error after the new BG succeeds", async () => {
    await render();
    const obsolete = requests[0];
    await switchBg(2);
    await settle(requests.at(-1)!, [fight("bg2", 2)]);
    await fail(obsolete);
    expect(current.fightsError).toBeNull();
    expect(current.deathSummaryError).toBeNull();
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.currentFights.map(f => f.id)).toEqual(["bg2"]);
    expect(current.loadingFights).toBe(false);
  });

  it("recovers a failed initial load when an accepted poll succeeds with an empty BG", async () => {
    await render();
    await fail(requests[0]);
    expect(current.fightsError).toBe("Load failed");
    expect(current.deathSummaryError).toBe("Load failed");
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.loadedFightsContext).toBeNull();
    await settle(await poll());
    expect(current.fightsError).toBeNull();
    expect(current.deathSummaryError).toBeNull();
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.loadingFights).toBe(false);
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 1 });
    expect(current.currentFights).toEqual([]);
  });

  it.each(["initial", "poll"])("invalidates the old BG1 %s even after BG1 -> BG2 -> BG1", async source => {
    await render();
    let obsolete = requests[0];
    if (source === "poll") {
      await settle(obsolete, [fight("first-bg1", 1)]);
      obsolete = await poll();
    }
    await switchBg(2);
    await settle(requests.at(-1)!);
    await switchBg(1);
    expect(current.loadingFights).toBe(true);
    expect(current.deathSummaryLoading).toBe(true);
    await settle(requests.at(-1)!, [fight("new-bg1", 1)]);
    await settle(obsolete, [fight("obsolete-bg1", 1)]);
    expect(current.currentFights.map(f => f.id)).toEqual(["new-bg1"]);
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.deathSummaryError).toBeNull();
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 1 });
  });

  it.each(["save", "status"])("preserves a %s mutation error across a successful poll", async mutation => {
    await render();
    await settle(requests[0], [fight("bg1", 1)]);
    await act(async () => {
      if (mutation === "save") {
        vi.mocked(props.updateWarFight).mockResolvedValueOnce({ success: false, error: "Mutation failed" });
        await current.handleSaveFight({ id: "bg1", death: 4 });
      } else {
        vi.mocked(props.updateWarStatus).mockResolvedValueOnce({ success: false, error: "Mutation failed" });
        await current.handleToggleStatus();
      }
    });
    expect(current.fightsError).toBe("Mutation failed");
    expect(current.deathSummaryError).toBeNull();
    expect(current.deathSummaryLoading).toBe(false);
    await settle(await poll(), [fight("bg1-refreshed", 1)]);
    expect(current.fightsError).toBe("Mutation failed");
    expect(current.deathSummaryError).toBeNull();
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.currentFights.map(f => f.id)).toEqual(["bg1-refreshed"]);
  });

  it.each(["initial", "poll"])("invalidates a %s response while its JSON body is still pending", async source => {
    await render();
    let obsolete = requests[0];
    if (source === "poll") {
      await settle(obsolete, [fight("bg1", 1)]);
      obsolete = await poll();
    }
    const body = deferred<FightWithNode[]>();
    const json = vi.fn(() => body.promise);
    await act(async () => { obsolete.result.resolve({ ok: true, json } as unknown as Response); });
    expect(json).toHaveBeenCalledOnce();
    await switchBg(2);
    await settle(requests.at(-1)!);
    await act(async () => { body.resolve([fight("obsolete-bg1", 1)]); });
    expect(current.currentFights).toEqual([]);
    expect(current.extraChampions).toEqual(extras(2));
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.deathSummaryError).toBeNull();
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 2 });
  });

  it("ignores an obsolete poll rejection without reporting an active BG failure", async () => {
    await render();
    await settle(requests[0]);
    const obsolete = await poll();
    await switchBg(2);
    await settle(requests.at(-1)!);
    await fail(obsolete);
    expect(reportClientError).not.toHaveBeenCalled();
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.deathSummaryError).toBeNull();
    expect(current.loadedFightsContext).toEqual({ warId: "war-1", battlegroup: 2 });
  });

  it.each(["success", "error"])("keeps an accepted poll when the initial request finishes later with %s", async outcome => {
    await render();
    const initial = requests[0];
    await settle(await poll(), [fight("accepted-poll", 1)]);
    expect(current.loadingFights).toBe(false);
    expect(current.deathSummaryLoading).toBe(false);
    if (outcome === "success") await settle(initial, [fight("old-initial", 1)]);
    else await fail(initial);
    expect(current.currentFights.map(f => f.id)).toEqual(["accepted-poll"]);
    expect(current.fightsError).toBeNull();
    expect(current.deathSummaryError).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("keeps the newer accepted poll when polls resolve out of order", async () => {
    await render();
    await settle(requests[0]);
    const older = await poll();
    const newer = await poll();
    await settle(newer, [fight("newer", 1)]);
    await settle(older, [fight("older", 1)]);
    expect(current.currentFights.map(f => f.id)).toEqual(["newer"]);
    expect(current.deathSummaryLoading).toBe(false);
  });

  it("keeps a load failure through failed polling, then clears it for the next BG", async () => {
    await render();
    await fail(requests[0]);
    const failedPoll = await poll();
    await act(async () => { failedPoll.result.resolve(new Response(null, { status: 503 })); });
    expect(current.deathSummaryError).toBe("Load failed");
    expect(current.deathSummaryLoading).toBe(false);
    await switchBg(2);
    expect(current.deathSummaryError).toBeNull();
    expect(current.deathSummaryLoading).toBe(true);
    await settle(requests.at(-1)!);
    expect(current.deathSummaryLoading).toBe(false);
    expect(current.deathSummaryError).toBeNull();
  });

  it("recovers the load error without clearing a subsequent mutation failure", async () => {
    await render();
    await fail(requests[0]);
    await act(async () => {
      vi.mocked(props.updateWarStatus).mockResolvedValueOnce({ success: false, error: "Status failed" });
      await current.handleToggleStatus();
    });
    expect(current.fightsError).toBe("Status failed");
    expect(current.deathSummaryError).toBe("Load failed");
    await settle(await poll());
    expect(current.fightsError).toBe("Status failed");
    expect(current.deathSummaryError).toBeNull();
    expect(current.deathSummaryLoading).toBe(false);
  });

  it("keeps optimistic fight changes while a save is pending during a poll", async () => {
    await render();
    await settle(requests[0], [fight("bg1", 1)]);
    const save = deferred<{ success: boolean }>();
    vi.mocked(props.updateWarFight).mockReturnValueOnce(save.promise);
    let saving!: Promise<void>;
    await act(async () => { saving = current.handleSaveFight({ id: "bg1", death: 8 }); });
    await settle(await poll(), [fight("bg1", 1)]);
    expect(current.currentFights[0].death).toBe(8);
    await act(async () => { save.resolve({ success: true }); await saving; });
    await settle(await poll(), [{ ...fight("bg1", 1), death: 8 }]);
    expect(current.currentFights[0].death).toBe(8);
    expect(current.fightsError).toBeNull();
  });
});

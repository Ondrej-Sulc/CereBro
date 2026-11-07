// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChampionClass } from "@prisma/client";
import fixture from "../../../../../../../src/tests/fixtures/champion-prestige-ascension.json";
import { GET } from "@/app/api/profile/champion-prestige/route";
import { PrestigeChartModal } from "./prestige-chart-modal";
import type { PrestigePoint, SigRecommendation } from "../../types";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { championPrestige: { findMany: mocks.findMany } } }));
vi.mock("@/lib/with-request-context", () => ({ withRouteContext: (handler: unknown) => handler }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));
vi.mock("next/image", () => ({ default: () => null }));
// Observe data delivered to the external chart library; keep the application chart/modal real.
vi.mock("recharts", async importOriginal => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ data }: { data: PrestigePoint[] }) => <output>{JSON.stringify(data)}</output>,
}));

const recommendation: SigRecommendation = {
  championId: 1, championName: "Infamous Iron Man", championClass: ChampionClass.TECH,
  championImage: { hero: "", full_primary: "", full_secondary: "", p_32: "", s_32: "", p_64: "", s_64: "", p_128: "", s_128: "" },
  stars: 7, ascensionLevel: 2, rank: 4, fromSig: 199, toSig: 200,
  prestigeGain: 0, accountGain: 0, prestigePerSig: 0, reason: "already_top30", globalPrestigeRank: null, globalPrestigeRankTotal: null,
};
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  mocks.findMany.mockResolvedValue(fixture.baseEndpoints);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it.each([[0, 34060], [1, 36780], [2, 39730]])("projects the A0 curve API response once for an A%s insight chart", async (ascensionLevel, expected) => {
  const response = await GET(new Request("https://example.test/api/profile/champion-prestige?championId=1&rarity=7&rank=4&ascensionLevel=2"));
  expect(response.status).toBe(200);
  const data: PrestigePoint[] = await response.json();
  expect(data).toHaveLength(201);
  expect(data[200]).toEqual({ sig: 200, prestige: 34060 });
  const render = () => root.render(<PrestigeChartModal chartData={{ data, rec: { ...recommendation, ascensionLevel } }} loading={false} onClose={() => {}} />);
  await act(async () => render());
  const plotted = (): PrestigePoint[] => JSON.parse(document.querySelector("output")!.textContent!);
  expect(plotted()[200]).toEqual({ sig: 200, prestige: expected });
  await act(async () => render());
  expect(plotted()[200].prestige).toBe(expected);
  expect(data[200].prestige).toBe(34060);
});

it("keeps lower-star chart prestige at base", async () => {
  await act(async () => root.render(<PrestigeChartModal chartData={{ data: [{ sig: 200, prestige: 10000 }], rec: { ...recommendation, stars: 6, ascensionLevel: 1 } }} loading={false} onClose={() => {}} />));
  expect(JSON.parse(document.querySelector("output")!.textContent!)).toEqual([{ sig: 200, prestige: 10000 }]);
});

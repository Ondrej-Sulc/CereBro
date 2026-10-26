import { describe, expect, it } from "vitest";
import { RelicPrestigeCapture, type RelicPrestigePlan } from "./relic-prestige-capture";

const plan: RelicPrestigePlan = [{ relicId: "relic_test", rarityId: "t6", maxSignature: 1,
  ranks: [{ rank: 1, socketRanks: { "0": 10, "2": 10 } }] }];
const request = (sig: number) => ({ Id: "relic_test", RarityId: "t6", Rank: 1,
  InnateAbilityLevel: sig, SocketRanks: { "0": 10, "2": 10 } });
const response = (sig: number, pi: number) => ({ Id: "relic_test", RarityId: "t6", Rank: 1,
  InnateAbilityLevel: sig, Pi: pi, Sockets: { "2": { Rank: 10 }, "0": { Rank: 10 } } });
const event = () => ({ event: "response", error: "", request: [request(0), request(1)],
  result: [response(1, 912), response(0, 831)] });

describe("exact relic prestige capture", () => {
  it("matches reordered responses by every build field and retains signature zero", () => {
    const capture = new RelicPrestigeCapture(plan);
    capture.addResponse(event());
    expect(capture.finish()).toEqual([{ relicId: "relic_test", rarityId: "t6",
      ranks: [{ rank: 1, socketRanks: { "0": 10, "2": 10 }, prestigeBySignature: [831, 912] }] }]);
  });
  it("rejects incomplete coverage rather than interpolating", () => {
    const capture = new RelicPrestigeCapture(plan);
    capture.addResponse({ event: "response", error: "", request: [request(0)], result: [response(0, 831)] });
    expect(() => capture.finish()).toThrow(/Incomplete/);
  });
  it("rejects duplicate builds even when their ratings agree", () => {
    const capture = new RelicPrestigeCapture(plan);
    capture.addResponse(event());
    expect(() => capture.addResponse(event())).toThrow(/Duplicate/);
  });
  it.each(["identity", "signature", "runes", "count", "error", "zero", "fractional"])("refuses %s mismatches", kind => {
    const value = event();
    if (kind === "identity") value.result[0].Id = "relic_other";
    if (kind === "signature") value.result[0].InnateAbilityLevel = 2;
    if (kind === "runes") value.result[0].Sockets["0"].Rank = 1;
    if (kind === "count") value.result.pop();
    if (kind === "error") value.error = "unavailable";
    if (kind === "zero") value.result[0].Pi = 0;
    if (kind === "fractional") value.result[0].Pi = 1.5;
    expect(() => new RelicPrestigeCapture(plan).addResponse(value)).toThrow();
  });
  it("refuses a different requested rune policy", () => {
    const value = event();
    value.request[0].SocketRanks["0"] = 1;
    value.result[1].Sockets["0"].Rank = 1;
    expect(() => new RelicPrestigeCapture(plan).addResponse(value)).toThrow(/plan/);
  });
});

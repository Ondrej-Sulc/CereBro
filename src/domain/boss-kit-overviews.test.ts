import { describe, expect, it } from "vitest";
import { planBossKitOverviews, type BossOverviewSnapshot } from "./boss-kit-overviews";

const snapshot: BossOverviewSnapshot = {
  champions: [{ id: 1, gameId: "boss", isPlayable: false }], abilities: [{ id: 10, name: "Fury" }],
  texts: [{ id: 20, championId: 1, sourceId: "base:1", rawText: "After SP1, the boss gains a Fury Buff.", combat: true }], links: [], overviews: [],
};
const effect = { abilityId: 10, name: "Fury", type: "ABILITY", effectForm: "BUFF", effectDirection: "GAIN",
  source: "SP1 grants a Fury Buff.", summary: "After SP1, the boss gains a Fury Buff.",
  evidence: [{ textId: 20, quote: snapshot.texts[0].rawText }], reason: "Explicit native effect application." };
const draft = { author: "curator", champions: [{ gameId: "boss", effects: [effect] }], held: [] };

describe("reviewed boss overview planning", () => {
  it("binds exact native applications and summaries without mutating the source snapshot", () => {
    const before = structuredClone(snapshot);
    const plan = planBossKitOverviews(snapshot, [draft], ["boss"]);
    expect(plan.rows[0]).toMatchObject({ championId: 1, name: "Fury", before: null, summary: effect.summary });
    expect(plan.rows[0].citations[0]).toMatchObject({ sourceId: "base:1", combat: true });
    expect(snapshot).toEqual(before);
  });
  it("rejects playable, excluded and unreviewed identities", () => {
    expect(() => planBossKitOverviews(snapshot, [draft], [])).toThrow(/scope/);
    expect(() => planBossKitOverviews({ ...snapshot, champions: [{ ...snapshot.champions[0], isPlayable: true }] }, [draft], ["boss"])).toThrow(/scope/);
    const excluded = { ...draft, champions: [{ ...draft.champions[0], gameId: "ex_boss" }] };
    expect(() => planBossKitOverviews({ ...snapshot, champions: [{ ...snapshot.champions[0], gameId: "ex_boss" }] }, [excluded], ["ex_boss"])).toThrow(/scope/);
  });
  it("rejects foreign quotes, glossary-only applications and incorrect canonical labels", () => {
    expect(() => planBossKitOverviews({ ...snapshot, texts: [{ ...snapshot.texts[0], championId: 2 }] }, [draft], ["boss"])).toThrow(/quote/);
    expect(() => planBossKitOverviews({ ...snapshot, texts: [{ ...snapshot.texts[0], combat: false }] }, [draft], ["boss"])).toThrow(/glossary/);
    expect(() => planBossKitOverviews({ ...snapshot, abilities: [{ id: 10, name: "Armor Up" }] }, [draft], ["boss"])).toThrow(/Canonical/);
  });
  it("rejects invented values and duplicate source applications", () => {
    const numeric = { ...draft, champions: [{ gameId: "boss", effects: [{ ...effect, summary: "Gain 80% Fury." }] }] };
    expect(() => planBossKitOverviews(snapshot, [numeric], ["boss"])).toThrow(/number/);
    expect(() => planBossKitOverviews(snapshot, [draft, draft], ["boss"])).toThrow(/Duplicate/);
  });
  it("preserves existing sources and refuses overwriting reviewed summaries", () => {
    const before = { id: 30, championId: 1, abilityId: 10, type: "ABILITY" as const, source: effect.source, effectForm: "BUFF" as const, effectDirection: "GAIN" as const };
    const existing = { ...draft, champions: [{ gameId: "boss", effects: [{ ...effect, existingLinkId: 30 }] }] };
    expect(planBossKitOverviews({ ...snapshot, links: [before] }, [existing], ["boss"]).rows[0].before).toEqual(before);
    expect(() => planBossKitOverviews({ ...snapshot, links: [before], overviews: [{ championAbilityLinkId: 30 }] }, [existing], ["boss"])).toThrow(/binding/);
    expect(() => planBossKitOverviews({ ...snapshot, links: [{ ...before, source: "Changed condition" }] }, [existing], ["boss"])).toThrow(/preserved/);
  });
  it("allows only the explicitly reviewed Ares block-breaking correction", () => {
    const before = { id: 20647, championId: 1, abilityId: 10, type: "ABILITY" as const, source: effect.source, effectForm: "BUFF" as const, effectDirection: "GAIN" as const };
    const model = { ...snapshot, champions: [{ ...snapshot.champions[0], gameId: "ares" }],
      abilities: [{ id: 10, name: "Unblockable" }, { id: 11, name: "Can't Be Blocked" }], links: [before] };
    const corrected = { ...draft, champions: [{ gameId: "ares", effects: [{ ...effect, existingLinkId: 20647, abilityId: 11, name: "Can't Be Blocked" }] }] };
    expect(planBossKitOverviews(model, [corrected], ["ares"]).rows[0]).toMatchObject({ abilityId: 11, before });
    expect(() => planBossKitOverviews({ ...model, links: [{ ...before, id: 40 }] },
      [{ ...draft, champions: [{ gameId: "ares", effects: [{ ...corrected.champions[0].effects[0], existingLinkId: 40 }] }] }], ["ares"])).toThrow(/Unreviewed/);
  });
  it("rejects unknown form metadata and immunity direction guesses", () => {
    const entry = (changes: Record<string, unknown>) => ({ ...draft, champions: [{ gameId: "boss", effects: [{ ...effect, ...changes }] }] });
    expect(() => planBossKitOverviews(snapshot, [entry({ effectForm: "INFERRED" })], ["boss"])).toThrow();
    expect(() => planBossKitOverviews(snapshot, [entry({ type: "IMMUNITY" })], ["boss"])).toThrow(/Immunity direction/);
  });
});

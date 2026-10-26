import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/lib/cache";
import { getRelicDetails, getRelicFamilyDetails } from "./relics";

const db = vi.hoisted(() => ({
  gameRelic: { findUnique: vi.fn(), findMany: vi.fn() },
  gameRelicSocketItem: { findMany: vi.fn() },
  champion: { findMany: vi.fn() },
  gameGlossaryTerm: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const makeRow = (suffix: string, amount: string) => ({
  id: `relic_${suffix}`, slug: `statcast-example-${suffix}`, isCurrent: true,
  familyKey: "example-family", importId: "source-one",
  name: `Example ${suffix}`, secondaryAttribute: suffix,
  portraitPath: "/example.png", importedFrom: { generatedAt: new Date("2026-10-18") },
  definition: {
    id: `relic_${suffix}`, name: `Example ${suffix}`, shortName: "Example",
    type: "statcast", classId: "mystic", className: "Mystic", descriptionTemplate: "",
    rarities: [{ id: "t7", stars: 7, sourceOrderIndex: 4, maxRank: 5, maxSignature: 200 }],
    restrictionSelectors: [], recommendedChampions: [], innateSocketItemIds: [],
    slots: [{ index: 0, sourceSelector: "", type: "attribute", classId: "mystic", socketItemIds: [`item_${suffix}`] }],
    unlockConfigurationId: "config", portraitAsset: "portrait", smallPortraitAsset: "small",
    modelAsset: "Example", baseModelAsset: "", statcastPrimaryAttribute: "Energy Resistance",
    statcastSecondaryAttribute: suffix, supportCombatRateMultipliers: [], availability: "cached",
  },
  scalingContexts: [{ rarityId: "t7", socketItemId: `item_${suffix}`, parameters: { value: { a: { minAtRarity: amount, maxAtRarity: amount } } } }],
});
const rows = [makeRow("armor", "11"), makeRow("critical", "22")];
const socket = (suffix: string) => ({ definition: {
  id: `item_${suffix}`, name: suffix, type: "attribute", classId: "mystic", innateOnly: false,
  descriptionTemplate: "Gain {value.a}.", unequippedDescriptionTemplate: "",
  commonStatModIds: [], tieredStatModIds: ["value"], placeholders: [{ token: "value.a", tieredId: "value", parameter: "a" }],
} });

beforeEach(() => {
  vi.resetAllMocks();
  clearCache("", true);
  db.gameRelic.findUnique.mockResolvedValue(rows[1]);
  db.gameRelic.findMany.mockResolvedValue(rows);
  db.gameRelicSocketItem.findMany.mockResolvedValue([socket("armor"), socket("critical")]);
  db.champion.findMany.mockResolvedValue([]);
  db.gameGlossaryTerm.findMany.mockResolvedValue([]);
  db.$queryRaw.mockResolvedValue([]);
});

describe("relic variant family loading", () => {
  it("loads the current family together while keeping each variant's identity and values", async () => {
    const family = await getRelicFamilyDetails(rows[1].slug);
    expect(family?.initialId).toBe(rows[1].id);
    expect(family?.members.map(member => member.slug)).toEqual(rows.map(row => row.slug));
    expect(family?.members.map(member => member.contexts.t7[`item_${member.relic.statcastSecondaryAttribute}`].parameters?.value.a.minAtRarity)).toEqual(["11", "22"]);
    expect(db.gameRelic.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { familyKey: "example-family", isCurrent: true } }));
    expect(db.gameRelicSocketItem.findMany).toHaveBeenCalledTimes(1);
    expect(db.champion.findMany).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect((await getRelicDetails(rows[1].slug))?.relic.id).toBe(rows[1].id);
    expect(db.gameRelic.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps formatter evidence scoped to each variant's import", async () => {
    db.gameRelic.findMany.mockResolvedValue([rows[0], { ...rows[1], importId: "source-two" }]);
    await getRelicFamilyDetails(rows[1].slug);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    const imports = db.$queryRaw.mock.calls.map(([sql]) => sql.values);
    expect(imports[0]).toContain("source-one");
    expect(imports[1]).toContain("source-two");
  });

  it("does not expose a missing or retired variant through its siblings", async () => {
    db.gameRelic.findUnique.mockResolvedValue(null);
    expect(await getRelicFamilyDetails("missing")).toBeNull();
    db.gameRelic.findUnique.mockResolvedValue({ ...rows[0], isCurrent: false });
    expect(await getRelicFamilyDetails(rows[0].slug)).toBeNull();
    expect(db.gameRelic.findMany).not.toHaveBeenCalled();
  });

  it("reloads the family when the selected variant moves to a new source import", async () => {
    await getRelicFamilyDetails(rows[1].slug);
    const updated = { ...rows[1], importId: "new-source", name: "Updated", definition: { ...rows[1].definition, name: "Updated" } };
    db.gameRelic.findUnique.mockResolvedValue(updated);
    db.gameRelic.findMany.mockResolvedValue([rows[0], updated]);
    const family = await getRelicFamilyDetails(rows[1].slug);
    expect(family?.members[1].relic.name).toBe("Updated");
    expect(db.gameRelic.findMany).toHaveBeenCalledTimes(2);
  });

  it("rejects mismatched source identities and missing socket references", async () => {
    db.gameRelic.findMany.mockResolvedValue([{ ...rows[0], id: "wrong_id" }]);
    await expect(getRelicFamilyDetails(rows[0].slug)).rejects.toThrow("Relic definition identity mismatch");
    db.gameRelic.findMany.mockResolvedValue(rows);
    db.gameRelicSocketItem.findMany.mockResolvedValue([socket("armor")]);
    await expect(getRelicFamilyDetails(rows[1].slug)).rejects.toThrow("Missing current relic socket item_critical");
  });
});

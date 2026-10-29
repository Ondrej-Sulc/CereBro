import { describe, expect, it } from "vitest";
import {
  collectionHref,
  collectionPreferenceCookie,
  collectionStateKey,
  resolveCollectionView,
  createCollectionMemory,
} from "./collection-view";

describe("catalog and personal navigation", () => {
  it("defaults to personal for a signed-in profile, including invalid preferences", () => {
    expect(resolveCollectionView(undefined, undefined, true)).toBe("personal");
    expect(resolveCollectionView("invalid", "invalid", true)).toBe("personal");
  });
  it("honors saved choices and explicit links before the signed-in default", () => {
    expect(resolveCollectionView(undefined, "catalog", true)).toBe("catalog");
    expect(resolveCollectionView(undefined, "personal", true)).toBe("personal");
    expect(resolveCollectionView("catalog", "personal", true)).toBe("catalog");
    expect(resolveCollectionView("personal", "catalog", true)).toBe("personal");
    expect(resolveCollectionView("catalog", undefined, true)).toBe("catalog");
    expect(resolveCollectionView("invalid", "catalog", true)).toBe("catalog");
  });
  it("never opens personal data for a guest, even with a saved choice or explicit URL", () => {
    expect(resolveCollectionView(undefined, undefined, false)).toBe("catalog");
    expect(resolveCollectionView("personal", "personal", false)).toBe(
      "catalog",
    );
    expect(resolveCollectionView(undefined, "personal", false)).toBe("catalog");
  });
  it("uses separate preferences and canonical URLs, preserving explicit roster insight parameters", () => {
    expect(collectionPreferenceCookie("champions")).not.toBe(
      collectionPreferenceCookie("relics"),
    );
    expect(collectionHref("champions", "catalog")).toBe(
      "/champions?view=catalog",
    );
    expect(collectionHref("relics", "personal")).toBe("/relics?view=personal");
    expect(
      collectionHref("champions", "personal", "insights=true&view=catalog"),
    ).toBe("/champions?insights=true&view=personal");
  });
});

describe("collection browsing memory", () => {
  it("shares search/classes between views while keeping progression filters separate", () => {
    const memory = createCollectionMemory();
    memory.set(
      collectionStateKey("champions", "p1", "catalog", "search", true),
      "Kushala",
    );
    memory.set(
      collectionStateKey("champions", "p1", "catalog", "classes", true),
      ["MYSTIC"],
    );
    memory.set(collectionStateKey("champions", "p1", "personal", "ranks"), [4]);
    expect(
      memory.get(
        collectionStateKey("champions", "p1", "personal", "search", true),
        "",
      ),
    ).toBe("Kushala");
    expect(
      memory.get(
        collectionStateKey("champions", "p1", "personal", "classes", true),
        [],
      ),
    ).toEqual(["MYSTIC"]);
    expect(
      memory.get(collectionStateKey("champions", "p1", "catalog", "ranks"), []),
    ).toEqual([]);
    expect(
      memory.get(
        collectionStateKey("champions", "p1", "personal", "ranks"),
        [],
      ),
    ).toEqual([4]);
  });
  it("isolates profiles, sections and browser instances; remembers zero/false/empty values", () => {
    const memory = createCollectionMemory();
    memory.set("relics:p1:personal:scroll", 0);
    memory.set("relics:p1:personal:owned", false);
    memory.set("relics:p1:shared:search", "");
    expect(memory.get("relics:p1:personal:scroll", 400)).toBe(0);
    expect(memory.get("relics:p1:personal:owned", true)).toBe(false);
    expect(memory.get("relics:p1:shared:search", "Kushala")).toBe("");
    expect(collectionStateKey("relics", "p1", "catalog", "search", true)).not.toBe(
      collectionStateKey("relics", "p2", "catalog", "search", true),
    );
    expect(collectionStateKey("relics", "p1", "catalog", "search", true)).not.toBe(
      collectionStateKey("champions", "p1", "catalog", "search", true),
    );
    expect(memory.get("relics:p2:shared:search", "default")).toBe("default");
    expect(memory.get("champions:p1:shared:search", "default")).toBe("default");
    expect(
      createCollectionMemory().get("relics:p1:shared:search", "default"),
    ).toBe("default");
  });
});

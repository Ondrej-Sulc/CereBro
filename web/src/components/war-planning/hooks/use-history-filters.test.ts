import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHistoryFilters } from "./use-history-filters";

afterEach(() => vi.unstubAllGlobals());

describe("planner history preference hydration", () => {
  it("renders deterministic defaults on the server without reading browser storage", () => {
    const getStorage = vi.fn(() => { throw new Error("Browser storage is unavailable during SSR"); });
    vi.stubGlobal("window", Object.defineProperty({}, "localStorage", { get: getStorage }));
    function Preferences() {
      const [filters] = useHistoryFilters("attack", 60);
      return createElement("output", null, JSON.stringify(filters));
    }
    expect(renderToStaticMarkup(createElement(Preferences))).toContain('&quot;onlyCurrentTier&quot;:true,&quot;onlyAlliance&quot;:true');
    expect(getStorage).not.toHaveBeenCalled();
  });
});

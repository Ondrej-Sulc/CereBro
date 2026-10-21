import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { summarizeWarDeaths } from "../../lib/war-death-summary";
import { WarDeathSummaryDialog } from "./war-death-summary-dialog";

const [summary] = summarizeWarDeaths([{ id: "war", season: 60, warNumber: 1, enemyAlliance: "Opponent", fights: [
  { id: "fight", death: 9, battlegroup: 1, player: null, node: { nodeNumber: 4 } },
] }]);

describe("planner death summary availability", () => {
  it.each([
    { battlegroup: 1, loading: false, error: null, text: "BG1 deaths: 9" },
    { battlegroup: 2, loading: false, error: null, text: "BG2 deaths: 0" },
    { battlegroup: 1, loading: true, error: null, text: "BG1 deaths: Loading" },
    { battlegroup: 1, loading: false, error: "Request failed", text: "BG1 deaths: Unavailable" },
  ])("shows only the loaded BG or an explicit unavailable state ($text)", ({ text, ...state }) => {
    const html = renderToStaticMarkup(createElement(WarDeathSummaryDialog, { summary, ...state, onSelectNode: () => {} }));
    expect(html).toContain(text);
    expect(html).not.toContain("Unassigned / deleted player");
    if (state.loading || state.error) expect(html).not.toContain("deaths: 9");
  });
});

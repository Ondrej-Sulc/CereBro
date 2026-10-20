import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { summarizeWarDeaths } from "../../lib/war-death-summary";
import { WarDeathSummaryPanel } from "./war-death-summary";

describe("war death drilldown", () => {
  it("renders the selected war/BG with player, node, fight notes, video and planner navigation", () => {
    const summaries = summarizeWarDeaths([1, 2].map(warNumber => ({
      id: `war-${warNumber}`, season: 60, warNumber, enemyAlliance: `Opponent ${warNumber}`,
      fights: [
        { id: "fight", death: 3, battlegroup: 2, player: null, node: { nodeNumber: 4 }, attacker: { name: "Hulk" }, defender: { name: "Thing" }, videoId: "video", notes: "Retry after disconnect" },
        { id: "other-bg", death: 8, battlegroup: 1, player: { id: "other", ingameName: "Other BG" }, node: { nodeNumber: 1 } },
      ],
    })));
    const html = renderToStaticMarkup(createElement(WarDeathSummaryPanel, { summaries, initialWarId: "war-1", initialBattlegroup: 2 }));
    expect(html).toContain("Unassigned / deleted player");
    expect(html).toContain("Node 4");
    expect(html).toContain("Hulk");
    expect(html).toContain("Thing");
    expect(html).toContain("Retry after disconnect");
    expect(html).toContain('/war-videos/video');
    expect(html).toContain('/planning/war-1?bg=2&amp;node=4');
    expect(html).not.toContain("Other BG</");
    expect(html).not.toContain('/planning/war-2');
    expect(html).not.toMatch(/solo|success rate|completed fights/i);
  });

  it("falls back from stale war/BG links and handles no recorded season data", () => {
    const html = renderToStaticMarkup(createElement(WarDeathSummaryPanel, { summaries: [], initialWarId: "foreign-or-deleted-war", initialBattlegroup: 4 }));
    expect(html).toContain("No wars recorded for this season.");
    expect(html).toContain('value="all" selected=""');
    expect(html).not.toContain("foreign-or-deleted-war");
    expect(html).not.toContain("NaN");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { summarizeWarDeaths } from "../../lib/war-death-summary";
import { BattlegroupDeathBreakdown, WarDeathSummaryPanel } from "./war-death-summary";

describe("war death drilldown", () => {
  it('shows both recordings while counting the fight deaths once', () => {
    const [war] = summarizeWarDeaths([{ id: 'war', season: 60, warNumber: 1, enemyAlliance: null, fights: [
      { id: 'fight', death: 1, battlegroup: 1, player: null, node: { nodeNumber: 4 }, videoIds: ['failed-attempt', 'finish'] },
    ] }]);
    expect(war.deaths).toBe(1);
    const html = renderToStaticMarkup(createElement(BattlegroupDeathBreakdown, { warId: war.warId, summary: war.battlegroups[0] }));
    expect(html).toContain('/war-videos/failed-attempt');
    expect(html).toContain('/war-videos/finish');
    expect(html).toContain('Watch video 1');
    expect(html).toContain('Watch video 2');
  });
  it("renders readable attacker/defender roles and visible portrait fallbacks when metadata is absent", () => {
    const [war] = summarizeWarDeaths([{ id: "war", season: 60, warNumber: 1, enemyAlliance: null, fights: [
      { id: "fight", death: 2, battlegroup: 1, player: null, node: { nodeNumber: 4 }, attacker: { name: "Hulk" }, defender: { name: "Thing", images: { broken: true } } },
    ] }]);
    const html = renderToStaticMarkup(createElement(BattlegroupDeathBreakdown, { warId: war.warId, summary: war.battlegroups[0] }));
    expect(html).toContain("Attacker");
    expect(html).toContain("Defender");
    expect(html).toContain("Hulk");
    expect(html).toContain("Thing");
    expect(html).toContain(">HU</span>");
    expect(html).toContain(">TH</span>");
    expect(html).not.toContain("data:image/gif");
    expect(html).not.toContain("[object Object]");
  });

  it("compares every war and all three BGs without opening a breakdown by default", () => {
    const summaries = summarizeWarDeaths([1, 2].map(warNumber => ({
      id: `war-${warNumber}`, season: 60, warNumber, enemyAlliance: `Opponent ${warNumber}`,
      fights: [{ id: `fight-${warNumber}`, death: warNumber, battlegroup: 2, player: null, node: { nodeNumber: 4 } }],
    })));
    const html = renderToStaticMarkup(createElement(WarDeathSummaryPanel, { summaries }));
    expect(html).toContain("<table");
    expect(html).toContain("Opponent 1");
    expect(html).toContain("Opponent 2");
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(6);
    expect(html).toContain('aria-label="War 1 vs Opponent 1, BG2: 1 recorded death"');
    expect(html).not.toContain("Unassigned / deleted player");
    expect(html).not.toContain("<select");
  });
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
    expect(html).not.toContain('aria-expanded="true"');
    expect(html).not.toContain("foreign-or-deleted-war");
    expect(html).not.toContain("NaN");
  });

  it.each([
    { initialWarId: "deleted-war", initialBattlegroup: 2 },
    { initialWarId: "war", initialBattlegroup: 4 },
    { initialWarId: "war", initialBattlegroup: undefined },
  ])("keeps the season comparison available for a stale or partial selection (%j)", selection => {
    const summaries = summarizeWarDeaths([{ id: "war", season: 60, warNumber: 1, enemyAlliance: "Opponent", fights: [] }]);
    const html = renderToStaticMarkup(createElement(WarDeathSummaryPanel, { summaries, ...selection }));
    expect(html).toContain("Opponent");
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    expect(html).not.toContain('role="region"');
  });

  it("exposes repeated-node fights and their navigation within a single player disclosure", () => {
    const [war] = summarizeWarDeaths([{ id: "war", season: 60, warNumber: 1, enemyAlliance: "Opponent", fights: [
      { id: "first", death: 3, battlegroup: 2, player: { id: "former", ingameName: "Former member" }, node: { nodeNumber: 4 }, notes: "First attempt", videoId: "first-video" },
      { id: "second", death: 2, battlegroup: 2, player: { id: "former", ingameName: "Former member" }, node: { nodeNumber: 4 }, notes: "Another recorded fight" },
      { id: "next-node", death: 1, battlegroup: 2, player: { id: "former", ingameName: "Former member" }, node: { nodeNumber: 9 } },
    ] }]);
    const html = renderToStaticMarkup(createElement(BattlegroupDeathBreakdown, { warId: war.warId, summary: war.battlegroups[1] }));
    expect(html.match(/<details[ >]/g)).toHaveLength(1);
    expect(html.match(/<li[ >]/g)).toHaveLength(3);
    expect(html).toContain("Nodes 4, 9");
    expect(html).toContain("Fight 1/2");
    expect(html).toContain("Fight 2/2");
    expect(html).toContain("First attempt");
    expect(html).toContain("Another recorded fight");
    expect(html).toContain("/player/former");
    expect(html).toContain("/war-videos/first-video");
    expect(html).toContain("/planning/war?bg=2&amp;node=9");
  });
});

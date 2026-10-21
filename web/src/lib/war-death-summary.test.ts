import { describe, expect, it } from "vitest";
import type { ChampionClass } from "@prisma/client";
import { summarizeWarDeaths, type DeathSummaryWar } from "./war-death-summary";

describe("war battlegroup recorded deaths", () => {
  it("keeps champion names and neutral fallbacks for null, missing and malformed metadata", () => {
    const blankImages = { hero: "", full_primary: "", full_secondary: "", p_32: "", s_32: "", p_64: "", s_64: "", p_128: "", s_128: "" };
    const [summary] = summarizeWarDeaths([{
      id: "war", season: 60, warNumber: 1, enemyAlliance: null,
      fights: [
        null, { name: "Named without metadata" },
        { name: "Null metadata", images: null, class: null },
        { name: "Malformed", images: { p_64: "/not-a-complete-image-record.png" } },
        { name: "Empty URL", images: blankImages },
        { name: "Non-string URL", images: { ...blankImages, p_64: 123 } },
        { name: "Unknown class", class: "UNRECOGNIZED" as ChampionClass },
      ].map((attacker, index) => ({ id: `fight-${index}`, attacker, death: 1, battlegroup: 1, node: { nodeNumber: 4 }, player: null })),
    }]);
    const fights = summary.battlegroups[0].players[0].nodes[0].fights;
    expect(fights.map(fight => fight.attackerName)).toEqual(["Unknown attacker", "Named without metadata", "Null metadata", "Malformed", "Empty URL", "Non-string URL", "Unknown class"]);
    for (const fight of fights) {
      expect(fight.attacker).toEqual({ class: null, imageUrl: null });
      expect(fight.defender).toEqual({ class: null, imageUrl: null });
    }
    expect(summary.deaths).toBe(7);
  });

  it("projects champion portraits and classes from season and planner fight shapes without leaking full records", () => {
    const images = { hero: "/hulk.png", full_primary: "/hulk.png", full_secondary: "", p_32: "/hulk-32.png", s_32: "", p_64: "/hulk-64.png", s_64: "", p_128: "", s_128: "" };
    const champion = { id: 1, name: "Hulk", class: "SCIENCE" as const, images, tags: [{ name: "Hero" }] };
    const seasonChampion = { ...champion, shortName: "hulk", abilities: [], releaseDate: null };
    const [summary] = summarizeWarDeaths([{
      id: "war", season: 60, warNumber: 1, enemyAlliance: "Opponent",
      fights: [seasonChampion, champion].map((attacker, index) => ({
        id: `fight-${index}`, battlegroup: 2, death: 3, node: { nodeNumber: 4 }, player: null,
        attacker, defender: { ...attacker, name: "Thing" },
      })),
    }]);
    const fights = summary.battlegroups[1].players[0].nodes[0].fights;
    for (const fight of fights) {
      expect(fight).toMatchObject({ attackerName: "Hulk", defenderName: "Thing", attacker: { class: "SCIENCE", imageUrl: "/hulk-64.png" }, defender: { class: "SCIENCE", imageUrl: "/hulk-64.png" } });
      expect(fight.attacker).toEqual({ class: "SCIENCE", imageUrl: "/hulk-64.png" });
    }
    expect(summary.deaths).toBe(6);
    expect(summary.battlegroups.map(bg => bg.deaths)).toEqual([0, 6, 0]);
  });

  it("sums deaths per war and BG and preserves player, node and fight drilldown", () => {
    const wars: DeathSummaryWar[] = [
      {
        id: "war-1", season: 60, warNumber: 1, enemyAlliance: "Opponent 1",
        fights: [
          { id: "fight-1", battlegroup: 2, death: 3, node: { nodeNumber: 4 }, player: { id: "player-1", ingameName: "Former member" }, attacker: { name: "Hulk" }, defender: { name: "Thing" }, videoId: "video-1", notes: "Retry" },
          { id: "fight-2", battlegroup: 2, death: 2, node: { nodeNumber: 4 }, player: { id: "player-1", ingameName: "Former member" } },
          { id: "fight-3", battlegroup: 1, death: 1, node: { nodeNumber: 8 }, player: { id: "player-2", ingameName: "Other BG" } },
        ],
      },
      { id: "war-2", season: 60, warNumber: 2, enemyAlliance: "Opponent 2", fights: [
        { id: "fight-4", battlegroup: 2, death: 2, node: { nodeNumber: 9 }, player: { id: "player-1", ingameName: "Former member" } },
      ] },
    ];
    const summaries = summarizeWarDeaths(wars);
    const war1 = summaries.find(war => war.warId === "war-1")!;
    expect(war1.deaths).toBe(6);
    expect(war1.battlegroups.map(bg => bg.deaths)).toEqual([1, 5, 0]);
    expect(war1.battlegroups[1].players).toMatchObject([{
      playerId: "player-1", playerName: "Former member", deaths: 5,
      nodes: [{ nodeNumber: 4, deaths: 5, fights: [{ id: "fight-1", deaths: 3, videoId: "video-1", notes: "Retry", attackerName: "Hulk", defenderName: "Thing" }, { id: "fight-2", deaths: 2 }] }],
    }]);
    expect(summaries.find(war => war.warId === "war-2")?.deaths).toBe(2);
  });

  it("keeps unassigned/deleted-player deaths and separates identities with matching names", () => {
    const summary = summarizeWarDeaths([{ id: "war", season: 60, warNumber: 1, enemyAlliance: null, fights: [
      { id: "deleted", death: 4, battlegroup: 3, player: null, node: { nodeNumber: 50 } },
      { id: "a", death: 1, battlegroup: 3, player: { id: "a", ingameName: "Same name" }, node: { nodeNumber: 1 } },
      { id: "b", death: 2, battlegroup: 3, player: { id: "b", ingameName: "Same name" }, node: { nodeNumber: 2 } },
      { id: "assignment", death: 0, battlegroup: 3, player: null, node: { nodeNumber: 3 } },
    ] }])[0];
    expect(summary.deaths).toBe(7);
    expect(summary.battlegroups[2].players.map(p => [p.playerId, p.deaths])).toEqual([[null, 4], ["b", 2], ["a", 1]]);
    expect(summary.battlegroups[2].players[0].playerName).toBe("Unassigned / deleted player");
  });

  it("returns explicit zero totals without treating zero-death plans as completed fights", () => {
    expect(summarizeWarDeaths([])).toEqual([]);
    const [summary] = summarizeWarDeaths([{ id: "war", season: 60, warNumber: null, enemyAlliance: null, fights: [
      { id: "planned", death: 0, battlegroup: 1, player: { id: "a", ingameName: "Player" }, node: { nodeNumber: 1 } },
      { id: "invalid-bg", death: 8, battlegroup: 4, player: null, node: { nodeNumber: 1 } },
    ] }]);
    expect(summary.deaths).toBe(0);
    expect(summary.battlegroups).toEqual([1, 2, 3].map(battlegroup => ({ battlegroup, deaths: 0, players: [] })));
  });
});

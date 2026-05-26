import { describe, expect, it } from "vitest";
import { ChampionClass, EncounterDifficulty } from "@prisma/client";
import {
  formatCategoryRef,
  formatChampionRef,
  makeRoutePathKey,
  makeRouteSectionKey,
  parseQuestPlanExport,
  summarizeMissingQuestImportReferences,
} from "../../lib/quest-plan-transfer";

describe("Quest Plan Transfer", () => {
  it("parses route keys, references, and defaults through one transfer shape", () => {
    const sectionKey = makeRouteSectionKey(1, "Opening");
    const pathKey = makeRoutePathKey(sectionKey, 1, "Path A");

    const payload = parseQuestPlanExport(JSON.stringify({
      kind: "cerebro.questPlan",
      schemaVersion: 1,
      quest: {
        title: "Necropolis",
        bannerFit: null,
        bannerPosition: null,
        requiredClasses: [ChampionClass.SCIENCE, "NOT_A_CLASS"],
        requiredTags: [{ name: "#Saga Champions", category: "Meta" }],
        creators: [{ discordId: "123" }],
      },
      routeSections: [{
        key: sectionKey,
        title: "Opening",
        order: 1,
        parentPathKey: null,
        paths: [{ key: pathKey, title: "Path A", order: 1 }],
      }],
      objectives: [{
        slug: "carina",
        title: "Carina",
        order: 1,
        routeRecommendations: [{
          slug: "recommended",
          title: "Recommended",
          order: 1,
          choices: [{ routeSectionKey: sectionKey, routePathKey: pathKey }],
        }],
      }],
      encounters: [{
        sequence: 2,
        difficulty: "BOGUS",
        tips: null,
        videoUrl: null,
        defender: { slug: "spider-man", name: "Spider-Man" },
        recommendedTags: ["Slow"],
        recommendedChampions: [{ slug: null, name: "Scorpion" }],
        requiredTags: [{ name: "#Hero", category: "Role" }],
        nodes: [{ name: "Aspect of War", description: "Node text", isHighlighted: true }],
        routePathKey: pathKey,
        videos: [{
          videoUrl: "https://youtu.be/example",
          player: { discordId: "p1", ingameName: "Player One", botUserDiscordId: "u1" },
        }],
      }],
    }));

    expect(payload.quest).toMatchObject({
      title: "Necropolis",
      bannerFit: "cover",
      bannerPosition: "center",
      requiredClasses: [ChampionClass.SCIENCE],
    });
    expect(payload.routeSections[0].paths[0].key).toBe(pathKey);
    expect(payload.objectives[0].routeRecommendations).toEqual([{
      slug: "recommended",
      title: "Recommended",
      order: 1,
      choices: [{ routeSectionKey: sectionKey, routePathKey: pathKey }],
    }]);
    expect(payload.encounters[0]).toMatchObject({
      difficulty: EncounterDifficulty.NORMAL,
      routePathKey: pathKey,
      defender: { slug: "spider-man", name: "Spider-Man" },
    });
  });

  it("rejects unsupported export envelopes before touching persistence", () => {
    expect(() => parseQuestPlanExport(JSON.stringify({
      kind: "other",
      schemaVersion: 1,
      quest: { title: "Quest" },
    }))).toThrow(/Unsupported quest plan export/);

    expect(() => parseQuestPlanExport(JSON.stringify({
      kind: "cerebro.questPlan",
      schemaVersion: 1,
      quest: { title: " " },
    }))).toThrow(/quest.title is required/);
  });

  it("summarizes missing import references deterministically", () => {
    expect(summarizeMissingQuestImportReferences({
      champions: [formatChampionRef({ slug: "doom", name: "Doctor Doom" })],
      tags: ["#Saga Champions (Meta)"],
      nodeModifiers: ["Aspect of War"],
      categories: [formatCategoryRef({ name: "Everest", path: ["Story", "Everest"] })],
      creators: ["123"],
    })).toBe([
      "Champions: Doctor Doom [doom]",
      "Tags: #Saga Champions (Meta)",
      "Node modifiers: Aspect of War",
      "Categories: Story / Everest",
      "Creators: 123",
    ].join("\n"));
  });
});

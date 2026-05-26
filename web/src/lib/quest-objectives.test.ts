import { describe, expect, it } from "vitest";
import {
  getEffectiveEncounterRecommendedChampions,
  getFirstQuestObjectiveRouteRecommendationChoices,
  getQuestObjectiveRouteRecommendationVariants,
  isNecropolisQuestTitle,
} from "./quest-objectives";

describe("quest objective helpers", () => {
  it("matches only Necropolis quest titles for seed gating", () => {
    expect(isNecropolisQuestTitle("The Necropolis")).toBe(true);
    expect(isNecropolisQuestTitle("Necropolis")).toBe(true);
    expect(isNecropolisQuestTitle(" the--necropolis ")).toBe(true);
    expect(isNecropolisQuestTitle("Necropolis Practice")).toBe(false);
    expect(isNecropolisQuestTitle("Abyss of Legends")).toBe(false);
  });

  it("falls back to base recommendations when no objective set exists", () => {
    const baseChampion = { id: 1, name: "Base" };
    expect(getEffectiveEncounterRecommendedChampions({
      recommendedChampions: [baseChampion],
      objectiveRecommendationSets: [],
    }, "objective_1")).toEqual([baseChampion]);
  });

  it("uses objective recommendations over base recommendations", () => {
    const baseChampion = { id: 1, name: "Base" };
    const objectiveChampion = { id: 2, name: "Objective" };

    expect(getEffectiveEncounterRecommendedChampions({
      recommendedChampions: [baseChampion],
      objectiveRecommendationSets: [{
        questObjectiveId: "objective_1",
        champions: [{ champion: objectiveChampion, order: 0 }],
      }],
    }, "objective_1")).toEqual([objectiveChampion]);
  });

  it("preserves explicit empty objective recommendations", () => {
    const baseChampion = { id: 1, name: "Base" };

    expect(getEffectiveEncounterRecommendedChampions({
      recommendedChampions: [baseChampion],
      objectiveRecommendationSets: [{
        questObjectiveId: "objective_1",
        champions: [],
      }],
    }, "objective_1")).toEqual([]);
  });

  it("never applies objective recommendation sets in base scope", () => {
    const baseChampion = { id: 1, name: "Base" };
    const objectiveChampion = { id: 2, name: "Objective" };

    expect(getEffectiveEncounterRecommendedChampions({
      recommendedChampions: [baseChampion],
      objectiveRecommendationSets: [{
        questObjectiveId: "objective_1",
        champions: [{ champion: objectiveChampion, order: 0 }],
      }],
    }, null)).toEqual([baseChampion]);
  });

  it("orders objective route recommendation variants and exposes choice maps", () => {
    const objective = {
      id: "objective_1",
      slug: "challenge",
      title: "Challenge",
      order: 1,
      requiredClasses: [],
      requiredTags: [],
      routeRecommendations: [
        {
          id: "variant_2",
          slug: "alternate",
          title: "Alternate",
          order: 2,
          choices: [{ questRouteSectionId: "section_1", questRoutePathId: "path_b" }],
        },
        {
          id: "variant_1",
          slug: "primary",
          title: "Primary",
          order: 1,
          choices: [{ questRouteSectionId: "section_1", questRoutePathId: "path_a" }],
        },
      ],
    };

    expect(getQuestObjectiveRouteRecommendationVariants(objective)).toEqual([
      { id: "variant_1", slug: "primary", title: "Primary", order: 1, choices: { section_1: "path_a" } },
      { id: "variant_2", slug: "alternate", title: "Alternate", order: 2, choices: { section_1: "path_b" } },
    ]);
    expect(getFirstQuestObjectiveRouteRecommendationChoices(objective)).toEqual({ section_1: "path_a" });
  });
});

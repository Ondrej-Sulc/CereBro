// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { QuestPreparation } from "@cerebro/core/domain/game-quests/quest-details";
import { QuestPreparationSummary } from "./quest-preparation";

const source = { file: "quest.json", sha256: "fixture", pointer: "/preparation", capturedAt: "2026-11-18T00:00:00Z" };

function render(preparation?: QuestPreparation) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestPreparationSummary preparation={preparation} />);
  return host;
}

function metric(host: HTMLElement, label: string) {
  return [...host.querySelectorAll("dt")].find(term => term.textContent === label)?.parentElement;
}

it.each([0, 3])("uses the original game energy artwork for an energy cost of %i", energyPerTile => {
  const host = render({ source, energyPerTile });
  const energy = metric(host, "Energy per tile");
  const icon = energy?.querySelector("dt img");
  expect(icon?.getAttribute("src")).toBe("/game-quests/reward-artwork/full/30d269d059a4641d12373b731bab807b8098ea9ca2e39cfc5a872f1408287829.webp");
  expect(icon?.getAttribute("alt")).toBe("");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(icon?.getAttribute("width")).toBe("26");
  expect(icon?.getAttribute("height")).toBe("26");
  expect(energy?.querySelector("dt svg")).toBeNull();
  expect(energy?.querySelector("dd")?.textContent).toBe(String(energyPerTile));
});

it("shows a recorded zero energy cost without filling in unknown preparation fields", () => {
  const host = render({ source, energyPerTile: 0 });
  expect(metric(host, "Energy per tile")?.querySelector("dd")?.textContent).toBe("0");
  expect(metric(host, "Recommended team rating")).toBeUndefined();
  expect(metric(host, "Team size")).toBeUndefined();
  expect(host.querySelector("[data-champion-requirement]")).toBeNull();
});

it("omits the summary when preparation is absent or contains no useful values", () => {
  expect(render().innerHTML).toBe("");
  expect(render({ source }).innerHTML).toBe("");
  expect(render({ source, minTeamSize: 0, maxTeamSize: 0 }).innerHTML).toBe("");
});

it("separates a recommended team rating from the champion eligibility rule", () => {
  const label = "7-star Deathless champions only";
  const host = render({ source, recommendedTeamRating: 25000, championRequirement: { groups: [["7-star", "Deathless"]], label, resolved: true } });
  expect(metric(host, "Recommended team rating")?.querySelector("dd")?.textContent).toBe("25,000");
  const requirement = host.querySelector("[data-champion-requirement]");
  expect(requirement?.querySelector("strong")?.textContent).toBe(label);
  expect(requirement?.textContent).toContain("Champion requirement");
  expect(requirement?.textContent).not.toContain("25,000");
  expect(host.textContent).not.toMatch(/required rating|combat PI|account|eligible/i);
});

it("preserves the source's AND/OR requirement label without recomputing its groups", () => {
  const label = "(7-star AND Deathless) OR (6-star AND #Saga) champions only";
  const host = render({ source, championRequirement: { groups: [["star7", "deathless"], ["star6", "saga"]], label, resolved: true } });
  expect(host.querySelector("[data-champion-requirement] strong")?.textContent).toBe(label);
  expect(host.querySelector("dl")).toBeNull();
});

it.each([
  [{ minTeamSize: 1, maxTeamSize: 5 }, "1–5 champions"],
  [{ minTeamSize: 3, maxTeamSize: 3 }, "3 champions"],
  [{ minTeamSize: 1, maxTeamSize: 1 }, "1 champion"],
  [{ maxTeamSize: 5 }, "Up to 5 champions"],
  [{ minTeamSize: 3 }, "At least 3 champions"],
  [{ minTeamSize: 3, maxTeamSize: 0 }, "At least 3 champions"],
] as const)("describes meaningful team bounds %j", (bounds, expected) => {
  const host = render({ source, ...bounds });
  expect(metric(host, "Team size")?.querySelector("dd")?.textContent).toBe(expected);
  expect(host.textContent).not.toMatch(/unlimited|0 champions/i);
});

it("never displays a zero or unknown maximum as a team limit", () => {
  for (const maxTeamSize of [undefined, 0]) {
    const host = render({ source, energyPerTile: 3, maxTeamSize });
    expect(metric(host, "Team size")).toBeUndefined();
    expect(host.textContent).not.toMatch(/unlimited|0 champions/i);
  }
});

it("hides a trivial one-champion minimum without a positive maximum and keeps zero energy", () => {
  for (const maxTeamSize of [undefined, 0]) {
    expect(render({ source, minTeamSize: 1, maxTeamSize }).innerHTML).toBe("");
    const host = render({ source, energyPerTile: 0, minTeamSize: 1, maxTeamSize });
    expect(metric(host, "Team size")).toBeUndefined();
    expect(metric(host, "Energy per tile")?.querySelector("dd")?.textContent).toBe("0");
  }
});

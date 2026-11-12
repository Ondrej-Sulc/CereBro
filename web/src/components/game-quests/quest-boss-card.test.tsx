// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";
import { findQuest } from "@cerebro/core/data/game-quests";
import { getBossPreview } from "@cerebro/core/data/game-quests/permanent";
import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { QuestBossCard } from "./quest-boss-card";

vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
  void prefetch;
  return <a {...props} />;
} }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
  // eslint-disable-next-line @next/next/no-img-element -- Test-only Next Image boundary.
  <img alt="" {...props} />
) }));

const story = findQuest("a05_ch02_q01")!;
const portraits: Record<string, QuestPortrait> = {
  psylocke: { name: "Psylocke", imageUrl: "/test/psylocke.png", href: "/champions/psylocke", className: "Mutant", color: "#eab308" },
};

function render(quest: QuestSummary, images = portraits) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestBossCard quest={quest} portraits={images} />);
  return host;
}

it("leads with the quest number and title, followed by an explicitly labelled boss", () => {
  const host = render(story);
  const link = host.querySelector("a")!;
  expect(link.getAttribute("href")).toBe("/quests/a05_ch02_q01");
  expect(link.getAttribute("aria-label")).toBe("Quest 5.2.1: Weird Science");
  const heading = host.querySelector("h3")!;
  expect(heading.textContent).toMatch(/5\.2\.1\s+Weird Science/);
  const bosses = host.querySelector('ul[aria-label="Boss"]')!;
  expect(bosses).not.toBeNull();
  expect(heading.compareDocumentPosition(bosses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(bosses.textContent).toContain("Psylocke");
  expect(bosses.textContent).toContain("4★");
  expect(bosses.querySelector("img")?.getAttribute("src")).toBe("/test/psylocke.png");
  expect(host.querySelectorAll("a")).toHaveLength(1);
});

it("omits internal quest data and route or opponent totals from selection cards", () => {
  const host = render(story);
  expect(host.querySelector("details")).toBeNull();
  expect(host.textContent).not.toMatch(/Quest data|recorded routes?|placed opponents?/i);
  expect(host.textContent).not.toContain(story.id);
  expect(host.textContent).not.toContain(story.sourceHash);
  expect(host.textContent).not.toContain("psylocke_ep");
});

it("keeps every exact boss in a multi-boss Special quest, including native NPC portraits", () => {
  const quest = findQuest("me_crucible_ch02_q02")!;
  const preview = getBossPreview(quest)!;
  const host = render(quest, {});
  const rows = [...host.querySelectorAll('ul[aria-label="Bosses"] > li')];
  expect(rows).toHaveLength(preview.bosses.length);
  preview.bosses.forEach((boss, i) => {
    expect(rows[i].textContent).toContain(boss.champion?.name ?? boss.name);
    expect(rows[i].textContent).toContain(`${boss.rarity}★`);
  });
  expect(rows.every(row => row.querySelector("img"))).toBe(true);
  expect(host.querySelectorAll("a")).toHaveLength(1);
});

it("shows an honest missing-boss message when the preview does not match this source", () => {
  const host = render({ ...story, sourceHash: "different-source" });
  expect(host.querySelector("ul")).toBeNull();
  expect(host.querySelector("img")).toBeNull();
  expect(host.textContent).toContain("Boss information unavailable");
  expect(host.textContent).not.toContain("Psylocke");
});

it("retains variant difficulty and a clear summary-only label when applicable", () => {
  const host = render({ ...story, difficulty: "Paragon", coverage: "summary-only" });
  expect(host.textContent).toContain("Paragon");
  expect(host.textContent).toContain("Map unavailable");
  expect(host.textContent).not.toMatch(/recorded routes?|placed opponents?/i);
});

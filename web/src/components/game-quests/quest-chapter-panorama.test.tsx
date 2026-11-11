// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { ImgHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";
import { questCatalog } from "@cerebro/core/data/game-quests";
import { storyChapters } from "@cerebro/core/domain/game-quests/browse";
import { QuestChapterPanorama } from "./quest-chapter-panorama";

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/image", () => ({ default: ({ fill, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
  void fill;
  // eslint-disable-next-line @next/next/no-img-element -- Native element at the test-only Next Image boundary.
  return <img alt="" {...props} />;
} }));

it("offers complete chapter names and exact destinations without repeated zero-map counts", () => {
  const chapters = storyChapters(questCatalog, "act_08").map(chapter => ({
    ...chapter,
    quests: chapter.quests.map(quest => ({ ...quest, coverage: "summary-only" as const })),
  }));
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestChapterPanorama chapters={chapters} href={id => `/quests?category=Story&act=act_08&chapter=${id}`} />);

  const navigation = host.querySelector('nav[aria-label="Story chapters"]');
  expect(navigation).not.toBeNull();
  expect([...navigation!.querySelectorAll("a")].map(link => link.getAttribute("href")))
    .toEqual(chapters.map(chapter => `/quests?category=Story&act=act_08&chapter=${chapter.id}`));
  expect([...navigation!.querySelectorAll("h3")].map(heading => heading.textContent))
    .toEqual(chapters.map(chapter => chapter.label));
  expect(navigation!.querySelectorAll("img")).toHaveLength(chapters.length);
  expect(navigation!.textContent).not.toContain("0 maps");
  expect(navigation!.textContent).not.toContain("Artwork not captured");
});

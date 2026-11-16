// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";
import { questCatalog } from "@cerebro/core/data/game-quests";
import QuestExplorerPage from "@/app/quests/page";

vi.mock("@/lib/game-quests/champions", () => ({ loadBossPortraits: vi.fn(async () => ({})) }));
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
  void prefetch;
  return <a {...props} />;
} }));
vi.mock("next/image", () => ({ default: ({ priority, fill, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; fill?: boolean }) => {
  void priority;
  void fill;
  // eslint-disable-next-line @next/next/no-img-element -- Framework boundary for server-rendered catalog checks.
  return <img alt="" {...props} />;
} }));

it("keeps quest search usable through old coverage links after every quest has a map", async () => {
  expect(questCatalog.every(quest => quest.coverage === "full-map")).toBe(true);
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(await QuestExplorerPage({ searchParams: Promise.resolve({ q: "Nomad", coverage: "summary-only" }) }));
  expect(host.querySelector('a[href="/quests/epilogue_ch02_q01"]')).not.toBeNull();
  expect(host.querySelector('[name="coverage"]')).toBeNull();
  expect(host.textContent).not.toContain("Map coverage");
  expect(host.querySelector<HTMLInputElement>('[name="q"]')?.value).toBe("Nomad");
  expect([...host.querySelectorAll("a")].every(link => !link.href.includes("coverage="))).toBe(true);
});

it("opens the Story overview through an old captured-layout link", async () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(await QuestExplorerPage({ searchParams: Promise.resolve({ category: "Story", coverage: "full-map" }) }));
  expect(host.textContent).toContain("Choose an act");
  expect(host.querySelector('nav[aria-label="Quest result pages"]')).toBeNull();
  expect(host.querySelector('[name="coverage"]')).toBeNull();
});

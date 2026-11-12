// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";
import { findQuest } from "@cerebro/core/data/game-quests";
import { QuestPageHeader } from "./quest-page-header";

vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}/> }));
vi.mock("next/image", () => ({ default: ({ fill, priority, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  void fill; void priority;
  // eslint-disable-next-line @next/next/no-img-element -- Native image mock preserves decorative alt semantics.
  return <img alt={alt ?? ""} {...props}/>;
} }));
const render = (id: string, stale = false) => {
  const quest = findQuest(id)!;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<QuestPageHeader quest={stale ? { ...quest, sourceHash: "changed" } : quest}/>);
  return host;
};

it("keeps the Story quest identity and links to its exact Act and Chapter", () => {
  const host = render("a05_ch03_q03");
  expect(host.querySelector("h1")?.textContent).toBe("Dire Warning");
  expect(host.querySelector('[data-quest-number]')?.textContent).toBe("5.3.3");
  const links = [...host.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Quest location"] a')];
  expect(links.map(a => a.getAttribute("href"))).toContain("/quests?category=Story&act=act5&chapter=a05_ch03");
  expect(host.textContent).toContain("The Struggle");
  expect(host.textContent).not.toMatch(/Chapter artwork|Act artwork|sourceHash/);
});

it("uses the Special collection without exposing the single native Stars wrapper", () => {
  const host = render("realm3");
  expect(host.querySelector("h1")?.textContent).toBe("DESPAIR GIVEN FORM");
  expect(host.textContent).toContain("Abyss of Legends");
  expect(host.textContent).not.toMatch(/1 Stars|artwork/);
  expect(host.querySelector('a[href="/quests?category=Special&collection=realm3_abyss"]')).not.toBeNull();
});

it("retains the title, number and hierarchy when artwork is unavailable", () => {
  const host = render("a05_ch03_q03", true);
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("h1")?.textContent).toBe("Dire Warning");
  expect(host.querySelector('[data-quest-number]')?.textContent).toBe("5.3.3");
  expect(host.querySelector('nav[aria-label="Quest location"]')).not.toBeNull();
});

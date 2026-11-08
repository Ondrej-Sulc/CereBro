// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { HomeChampionSearch } from "./HomeChampionSearch";

const champions = [
  { name: "Spider-Man (Stark Enhanced)", slug: "spider-man-stark-enhanced" },
  { name: "Spider-Man", slug: "spider-man" },
  { name: "Ghost Rider (Robbie Reyes)", slug: "ghost-rider-robbie-reyes" },
];
let root: Root;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify(champions)));
  push.mockReset();
  document.body.innerHTML = '<div id="root"></div><button id="outside">Outside</button>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

async function mount() { await act(async () => root.render(<HomeChampionSearch />)); }
function input() { return document.querySelector<HTMLInputElement>('input[role="combobox"]')!; }
async function focus() { await act(async () => input().focus()); }
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(key: string, isComposing = false) {
  let event: KeyboardEvent;
  await act(async () => {
    event = new KeyboardEvent("keydown", { key, isComposing, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
  });
  return event!;
}

it("loads only after interaction, fuzzy matches full names and opens the selected real page by keyboard", async () => {
  await mount();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(input().labels?.[0].textContent).toBe("Search champion pages");
  await focus();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/champions/lookup");
  await type("Spidr");
  const options = [...document.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
  expect(options).toHaveLength(2);
  expect(options.map(option => option.textContent)).toContain("Spider-Man (Stark Enhanced)");
  expect(options.every(option => option.getAttribute("href")?.startsWith("/champions/spider-man"))).toBe(true);
  await key("ArrowDown");
  const selected = document.getElementById(input().getAttribute("aria-activedescendant")!)!;
  expect(selected.getAttribute("aria-selected")).toBe("true");
  await key("Enter");
  expect(push).toHaveBeenCalledWith(selected.getAttribute("href"));
});

it("reports no matches and an empty deployed lookup without inventing featured-only results", async () => {
  await mount();
  await focus();
  await type("zzzzzzzz");
  expect(document.querySelector('[role="status"]')?.textContent).toContain("No champions match");
  expect(document.querySelector('[role="option"]')).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(document.getElementById("root")!);
  fetchMock.mockResolvedValue(new Response("[]"));
  await mount();
  await focus();
  expect(document.querySelector('[role="status"]')?.textContent).toContain("No champion pages available");
});

it("shows loading and a recoverable failure while preserving the search", async () => {
  let resolveFetch!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveFetch = resolve; }));
  await mount();
  await focus();
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Loading champion names");
  await type("Ghost");
  await act(async () => resolveFetch(new Response("{}", { status: 503 })));
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Champion search is unavailable");
  const retry = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Try again")!;
  await act(async () => retry.click());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(input().value).toBe("Ghost");
  expect(document.querySelector('[role="option"]')?.textContent).toBe("Ghost Rider (Robbie Reyes)");
});

it("leaves composition and Tab alone, dismisses with Escape and reuses the loaded names", async () => {
  await mount();
  await focus();
  await type("Ghost");
  await key("ArrowDown");
  expect((await key("Enter", true)).defaultPrevented).toBe(false);
  expect(push).not.toHaveBeenCalled();
  expect((await key("Tab")).defaultPrevented).toBe(false);
  await key("Escape");
  expect(input().getAttribute("aria-expanded")).toBe("false");
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  await act(async () => input().click());
  expect(input().getAttribute("aria-expanded")).toBe("true");
  await act(async () => document.getElementById("outside")!.focus());
  await focus();
  expect(input().getAttribute("aria-expanded")).toBe("true");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

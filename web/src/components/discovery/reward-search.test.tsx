// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RewardSearch, type RewardSearchOption } from "./reward-search";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
  // eslint-disable-next-line @next/next/no-img-element -- Framework image boundary.
  <img alt="" {...props} />
) }));

const options: RewardSearchOption[] = Array.from({ length: 12 }, (_, index) => ({
  key: `crystal${index}`, name: index ? `7-Star Hero Crystal ${index}` : "7-Star Hero Crystal",
  href: `/rewards?type=crystal&item=crystal${index}`, imageUrl: index ? null : "/crystal.png", sources: index + 1, rarity: null,
}));
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  push.mockReset();
  document.body.innerHTML = '<div id="root"></div><button id="outside">Outside</button>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
async function mount(initialQuery = "") { await act(async () => root.render(<RewardSearch options={options} initialQuery={initialQuery} />)); }
function input() { return document.querySelector<HTMLInputElement>('[role="combobox"]')!; }
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(name: string, isComposing = false) {
  const event = new KeyboardEvent("keydown", { key: name, isComposing, bubbles: true, cancelable: true });
  await act(async () => input().dispatchEvent(event));
  return event;
}

it("renders an ordinary GET search form before JavaScript runs", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<RewardSearch options={options} initialQuery="crystal" />);
  const form = host.querySelector("form")!;
  expect(form.getAttribute("action")).toBe("/rewards");
  expect(form.getAttribute("method")).toBe("get");
  expect(host.querySelector('input[name="q"]')?.getAttribute("value")).toBe("crystal");
  expect(host.querySelector('input[name="q"]')?.getAttribute("maxlength")).toBe("180");
  expect(host.querySelector('button[type="submit"]')?.textContent).toContain("Search");
  expect(host.querySelector('[role="listbox"]')).toBeNull();
});

it("offers bounded matching rewards and opens only an explicitly keyboard-selected source page", async () => {
  await mount();
  await act(async () => input().focus());
  await type("7* crystal");
  const results = [...document.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
  expect(results).toHaveLength(7);
  expect(results[0].textContent).toContain("7-Star Hero Crystal");
  expect(results[0].textContent).toContain("1 source");
  expect(results[0].querySelector("img")).not.toBeNull();
  expect(input().getAttribute("aria-expanded")).toBe("true");
  expect((await key("Enter")).defaultPrevented).toBe(false);
  expect(push).not.toHaveBeenCalled();
  await key("ArrowDown");
  const selected = document.getElementById(input().getAttribute("aria-activedescendant")!)!;
  expect(selected.getAttribute("aria-selected")).toBe("true");
  expect((await key("Enter")).defaultPrevented).toBe(true);
  expect(push).toHaveBeenCalledWith(selected.getAttribute("href"));
  expect(input().getAttribute("aria-expanded")).toBe("false");
});

it("supports pointer selection and leaves modified links to the browser", async () => {
  await mount(); await act(async () => input().focus()); await type("crystal");
  const result = document.querySelector<HTMLAnchorElement>('[role="option"]')!;
  const pointer = new Event("pointerdown", { bubbles: true, cancelable: true });
  await act(async () => result.dispatchEvent(pointer));
  expect(pointer.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(input());
  const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  // Observe the framework handler before suppressing jsdom's unsupported navigation.
  let preventedByComponent = false;
  const observe = (event: Event) => { preventedByComponent = event.defaultPrevented; event.preventDefault(); };
  document.addEventListener("click", observe, { once: true });
  await act(async () => result.dispatchEvent(modified));
  expect(preventedByComponent).toBe(false); expect(push).not.toHaveBeenCalled();
  await act(async () => result.click());
  expect(push).toHaveBeenCalledWith(result.getAttribute("href"));
});

it("dismisses on Escape, Tab and outside interaction; clearing keeps focus and resets the active item", async () => {
  await mount(); await act(async () => input().focus()); await type("crystal");
  await key("ArrowUp"); expect(input().getAttribute("aria-activedescendant")).toBeTruthy();
  await key("Escape"); expect(document.querySelector('[role="listbox"]')).toBeNull();
  await act(async () => input().click()); await key("Tab");
  expect(input().getAttribute("aria-expanded")).toBe("false");
  await act(async () => input().click());
  await act(async () => document.getElementById("outside")!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(input().getAttribute("aria-expanded")).toBe("false");
  await act(async () => input().click()); await key("ArrowDown");
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Clear reward search"]')!.click());
  expect(input().value).toBe(""); expect(document.activeElement).toBe(input());
  expect(input().getAttribute("aria-activedescendant")).toBeNull();
});

it("keeps IME composition and no-result queries from navigating to unrelated rewards", async () => {
  await mount(); await act(async () => input().focus()); await type("crystal"); await key("ArrowDown");
  expect((await key("Enter", true)).defaultPrevented).toBe(true); expect(push).not.toHaveBeenCalled();
  await type("unrecorded reward");
  expect(document.querySelector('[role="status"]')?.textContent).toContain("No matching rewards");
  expect(document.querySelector('[role="option"]')).toBeNull();
  expect(input().getAttribute("aria-activedescendant")).toBeNull();
  expect((await key("Enter")).defaultPrevented).toBe(false); expect(push).not.toHaveBeenCalled();
});

it("syncs a new server query after client navigation instead of retaining stale search text", async () => {
  await mount("crystal"); await type("changed");
  await mount("catalyst");
  expect(input().value).toBe("catalyst");
  expect(input().getAttribute("aria-expanded")).toBe("false");
});

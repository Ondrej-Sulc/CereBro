// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ArtworkBrowser } from "./artwork-browser";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
let root: Root;
let container: HTMLDivElement;
let resolveSearch: (response: Response) => void;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "", "/assets?q=Hulkbuster&source=installed&category=unclassified");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { resolveSearch = resolve; })));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("retains cold saved-URL source/category selections when their options arrive and Search is submitted", async () => {
  await act(async () => root.render(<ArtworkBrowser />));
  await act(async () => resolveSearch(Response.json({ items: [], total: 0, libraryTotal: 10049, page: 1, pageSize: 48,
    sources: ["image-cache", "installed"], categories: ["portrait", "unclassified"] })));
  expect(container.querySelector<HTMLSelectElement>('[name="source"]')?.value).toBe("installed");
  expect(container.querySelector<HTMLSelectElement>('[name="category"]')?.value).toBe("unclassified");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const query = new URLSearchParams(window.location.search);
  expect(query.get("source")).toBe("installed"); expect(query.get("category")).toBe("unclassified");
});

it("opens the inspector with a linked accessible description and no missing-description warning", async () => {
  const asset = { id: "a".repeat(64), name: "Star", kind: "sprite", width: 40, height: 40, format: "PNG", transparent: true, aliasCount: 1 };
  window.history.replaceState(null, "", `/assets?asset=${asset.id}`);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url === "/api/game-artwork" || url.startsWith("/api/game-artwork?")
    ? { items: [asset], total: 1, libraryTotal: 10049, page: 1, pageSize: 48, sources: [], categories: [] }
    : { ...asset, bytes: 2650, pixelSha256: "b".repeat(64), blobSha256: "c".repeat(64), aliases: [] })));
  await act(async () => root.render(<ArtworkBrowser />));
  const dialog = document.querySelector('[role="dialog"]')!;
  const description = document.getElementById(dialog.getAttribute("aria-describedby")!);
  expect(description?.textContent).toContain("40");
  expect(warning.mock.calls.filter(call => String(call[0]).includes("Description"))).toEqual([]);
});

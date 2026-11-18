// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionHeading, CollectionMemoryProvider, CollectionScreen } from "./collection-navigation";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean }) => {
  void prefetch; return createElement("a", { ...props, href }, children);
} }));
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!); push.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it("prompts a guest arriving at their roster and retains the gate filters through sign-in", async () => {
  window.history.replaceState(null, "", `/champions?view=personal&questGate=1&unowned=false&tagLogic=AND&tags=${encodeURIComponent('["Hero","Stark Tech"]')}`);
  await act(async () => root.render(<CollectionMemoryProvider><CollectionScreen section="champions" view="catalog" profileId="guest" signedIn={false} canUsePersonal={false}><CollectionHeading/></CollectionScreen></CollectionMemoryProvider>));
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Sign in to manage your roster");
  const signin = document.querySelector<HTMLAnchorElement>('a[href^="/auth/signin"]')!;
  const callback = new URL(new URL(signin.href).searchParams.get('callbackUrl')!, window.location.origin);
  expect(callback.searchParams.get('view')).toBe('personal');
  expect(JSON.parse(callback.searchParams.get('tags')!)).toEqual(['Hero','Stark Tech']);
  expect(callback.searchParams.get('unowned')).toBe('false');
});

it("carries the gate filter and includes unowned champions when switching to the personal roster", async () => {
  window.history.replaceState(null, "", `/champions?view=catalog&questGate=1&unowned=true&tags=${encodeURIComponent('["Hero"]')}`);
  await act(async () => root.render(<CollectionMemoryProvider><CollectionScreen section="champions" view="catalog" profileId="player" signedIn canUsePersonal><CollectionHeading/></CollectionScreen></CollectionMemoryProvider>));
  const personal = [...document.querySelectorAll<HTMLAnchorElement>('a')].find(link => link.textContent === 'My Roster')!;
  await act(async () => personal.click());
  const target = new URL(push.mock.calls[0][0], window.location.origin);
  expect(target.searchParams.get('view')).toBe('personal');
  expect(JSON.parse(target.searchParams.get('tags')!)).toEqual(['Hero']);
  expect(target.searchParams.get('unowned')).toBe('true');
});

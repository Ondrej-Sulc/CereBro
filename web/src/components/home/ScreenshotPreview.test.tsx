// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    delete imageProps.unoptimized;
    return createElement("img", { alt: "", ...imageProps });
  },
}));

import { ScreenshotPreview } from "./ScreenshotPreview";

let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

async function renderPreview() {
  await act(async () => root.render(<ScreenshotPreview src="/war-map.png" title="Alliance War planner" alt="War map with player assignments" width={1729} height={1078} />));
  return document.querySelector<HTMLButtonElement>('button[aria-label="Enlarge Alliance War planner screenshot"]')!;
}

it("opens an accessible screenshot dialog and keeps keyboard focus inside until Escape restores the trigger", async () => {
  const trigger = await renderPreview();
  expect(document.querySelectorAll("img")).toHaveLength(1);
  trigger.focus();
  await act(async () => trigger.click());

  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Alliance War planner");
  expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe("Choose Actual size to read text, then scroll or swipe to pan.");
  const image = dialog.querySelector("img")!;
  expect(image.getAttribute("src")).toBe("/war-map.png");
  expect(image.alt).toBe("War map with player assignments");
  const original = dialog.querySelector<HTMLAnchorElement>('a[href="/war-map.png"]')!;
  expect(original.target).toBe("_blank");
  expect(original.rel).toContain("noopener");

  original.focus();
  await act(async () => original.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Close screenshot");

  await act(async () => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.querySelectorAll("img")).toHaveLength(1);
});

it("allows inspection at intrinsic resolution and resets to fit mode when reopened", async () => {
  const trigger = await renderPreview();
  await act(async () => trigger.click());
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const toggle = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Actual size")!;
  expect(toggle.textContent).toBe("Actual size");
  await act(async () => toggle.click());
  expect(toggle.textContent).toBe("Fit to screen");
  expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe("Scroll or swipe to pan. Fit to screen shows the whole image.");
  expect(dialog.querySelector("img")?.style.width).toBe("1729px");
  expect(dialog.querySelector('[role="region"]')?.getAttribute("tabindex")).toBe("0");

  await act(async () => dialog.querySelector<HTMLButtonElement>('button[aria-label="Close screenshot"]')!.click());
  await act(async () => trigger.click());
  const reopened = document.querySelector('[role="dialog"]')!;
  expect([...reopened.querySelectorAll("button")].some((button) => button.textContent === "Actual size")).toBe(true);
  expect(document.getElementById(reopened.getAttribute("aria-describedby")!)?.textContent).toContain("Choose Actual size to read text");
  expect(reopened.querySelector("img")?.style.width).toBe("");
});

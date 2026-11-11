"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Browser fullscreen where available; an accessible full-window view otherwise. */
export function useQuestMapFullscreen(ref: RefObject<HTMLDivElement | null>) {
  const [native, setNative] = useState(false);
  const [windowMode, setWindowMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const element = ref.current;
    const sync = () => {
      const active = document.fullscreenElement === element;
      setNative(active);
      if (active) setWindowMode(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement === element && document.exitFullscreen)
        void document.exitFullscreen().catch(() => {});
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", escape);
      if (document.fullscreenElement === element && document.exitFullscreen)
        void document.exitFullscreen().catch(() => {});
    };
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!windowMode || !element) return;
    const overflow = document.body.style.overflow;
    const opener = document.activeElement;
    document.body.style.overflow = "hidden";
    element.querySelector<HTMLButtonElement>("[data-map-fullscreen-toggle]")?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); setWindowMode(false); return;
      }
      if (event.key !== "Tab") return;
      const items = [...element.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select:not(:disabled),[tabindex="0"]')]
        .filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      const outside = !element.contains(document.activeElement);
      if (!first) { event.preventDefault(); element.focus(); }
      else if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [ref, windowMode]);

  async function toggle() {
    const element = ref.current;
    if (!element || pending.current) return;
    if (windowMode) { setWindowMode(false); return; }
    pending.current = true; setBusy(true);
    try {
      if (document.fullscreenElement === element) {
        // Escape can win this race; fullscreenchange remains the state authority.
        await document.exitFullscreen().catch(() => {});
      } else if (typeof element.requestFullscreen === "function") {
        try { await element.requestFullscreen({ navigationUI: "hide" }); }
        catch { if (element.isConnected) setWindowMode(true); }
      } else setWindowMode(true);
    } finally { pending.current = false; if (element.isConnected) setBusy(false); }
  }

  return { fullscreen: native || windowMode, windowMode, busy, toggle };
}

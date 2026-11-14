"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export type HeaderOverlay = "navigation" | "alliance" | "explore" | "more" | "account" | null;
export const HeaderOverlayContext = createContext<{
  overlay: HeaderOverlay;
  setOverlay: Dispatch<SetStateAction<HeaderOverlay>>;
} | null>(null);

/** The server-rendered account slot and navigation share one open surface. */
export function useHeaderOverlay() {
  const context = useContext(HeaderOverlayContext);
  const [overlay, setOverlay] = useState<HeaderOverlay>(null);
  return context ?? { overlay, setOverlay };
}

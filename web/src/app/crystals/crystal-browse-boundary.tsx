"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { consumeCrystalBrowseScroll, parseCrystalReturnTo } from "@/lib/crystal-browse-return"

const CrystalBrowseContext = createContext<string | null>(null)
export const useCrystalBrowseReturn = () => useContext(CrystalBrowseContext)

export function CrystalBrowseBoundary({ returnTo, children }: { returnTo?: string | null; children: ReactNode }) {
  const target = parseCrystalReturnTo(returnTo)
  useEffect(() => {
    if (!target || parseCrystalReturnTo(window.location.pathname + window.location.search) !== target) return
    const frame = window.requestAnimationFrame(() => {
      if (parseCrystalReturnTo(window.location.pathname + window.location.search) !== target) return
      try {
        const y = consumeCrystalBrowseScroll(target, window.sessionStorage)
        if (y !== null) window.scrollTo({ top: y, behavior: "instant" })
      } catch { /* URL context still works when storage is blocked. */ }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [target])
  return <CrystalBrowseContext.Provider value={target}>{children}</CrystalBrowseContext.Provider>
}

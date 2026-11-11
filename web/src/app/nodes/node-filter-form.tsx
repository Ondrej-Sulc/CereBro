"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"

/** Keep native GET fields aligned with the URL after browser/Next history restores. */
export function NodeFilterForm({ children, className }: { children: ReactNode; className: string }) {
  const form = useRef<HTMLFormElement>(null)
  const query = useSearchParams().toString()
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search)
      for (const name of ["q", "catalog", "source", "target", "binding"]) {
        const control = form.current?.elements.namedItem(name)
        if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
          const value = params.get(name) || (name === "catalog" ? "all" : "")
          control.value = control instanceof HTMLSelectElement && ![...control.options].some(option => option.value === value)
            ? (name === "catalog" ? "all" : "") : value
        }
      }
    }
    const restored = () => requestAnimationFrame(sync)
    sync()
    window.addEventListener("pageshow", restored)
    window.addEventListener("popstate", restored)
    return () => {
      window.removeEventListener("pageshow", restored)
      window.removeEventListener("popstate", restored)
    }
  }, [query])
  return <form ref={form} action="/nodes" className={className} aria-label="Filter node modifiers">{children}</form>
}

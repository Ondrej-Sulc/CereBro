"use client"

import Link from "next/link"
import { useState, type ComponentProps } from "react"
import { useCrystalBrowseReturn } from "./crystal-browse-boundary"
import { parseCrystalReturnTo, saveCrystalBrowseScroll, withCrystalReturnTo } from "@/lib/crystal-browse-return"

/** A catalog can expose dozens of expensive destinations; warm only user intent. */
export function CrystalIntentLink({ href, returnTo: hostReturnTo, onPointerEnter, onFocus, onClick, ...props }: Omit<ComponentProps<typeof Link>, "prefetch" | "href"> & { href: string; returnTo?: string | null }) {
  const browseReturnTo = useCrystalBrowseReturn()
  const returnTo = hostReturnTo === undefined ? browseReturnTo : parseCrystalReturnTo(hostReturnTo)
  const destination = withCrystalReturnTo(href, returnTo)
  const [warmHref, setWarmHref] = useState<string | null>(null)
  return <Link {...props} href={destination} prefetch={warmHref === destination ? null : false}
    onClick={event => {
      onClick?.(event)
      if (!returnTo || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank") return
      try {
        const current = parseCrystalReturnTo(window.location.pathname + window.location.search)
        if (current?.split("?")[0] === returnTo.split("?")[0]) saveCrystalBrowseScroll(returnTo, window.scrollY, window.sessionStorage)
      } catch { /* Storage is optional. */ }
    }}
    onPointerEnter={event => { if (event.pointerType === "mouse") setWarmHref(destination); onPointerEnter?.(event) }}
    onFocus={event => { setWarmHref(destination); onFocus?.(event) }} />
}

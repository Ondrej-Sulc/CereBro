"use client"

import { useSyncExternalStore } from "react"
import { CaseSensitive } from "lucide-react"
import styles from "./crystal-tools.module.css"

const key = "cerebro:crystal-portrait-names"
let fallback = false
const snapshot = () => { try { return localStorage.getItem(key) === "true" } catch { return fallback } }
const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener)
  window.addEventListener(key, listener)
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(key, listener) }
}
export function useCrystalGridNames() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
export function CrystalGridNamesToggle() {
  const showNames = useCrystalGridNames()
  return <button type="button" className={styles.namesToggle} aria-pressed={showNames} onClick={() => {
    fallback = !showNames
    try { localStorage.setItem(key, String(fallback)) } catch { /* Keep the preference for this session when storage is unavailable. */ }
    window.dispatchEvent(new Event(key))
  }}><CaseSensitive aria-hidden="true" />Show names</button>
}

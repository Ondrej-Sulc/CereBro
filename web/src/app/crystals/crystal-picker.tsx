"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Check, Gem, LoaderCircle, Search, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import type { searchCrystalOptions } from "@/lib/data/crystals"
import styles from "./crystal-tools.module.css"

type Results = ReturnType<typeof searchCrystalOptions>
export function CrystalPicker({ selectedId, label, onSelect }: { selectedId: string; label: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQuery] = useState("")
  const [result, setResult] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true); setError(false)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/crystals/search?${new URLSearchParams({ q })}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Crystal search failed")
        const data: Results = await response.json()
        if (!controller.signal.aborted) { setResult(data); setLoading(false) }
      } catch { if (!controller.signal.aborted) { setError(true); setLoading(false) } }
    }, q ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, q, attempt])
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setQuery(""); setResult(null) } }}>
    <DialogTrigger asChild><button type="button" className={styles.changeCrystal}>{label}</button></DialogTrigger>
    <DialogContent className={styles.pickerDialog} onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }}>
      <div className={styles.pickerHeading}><div><DialogTitle>Choose a crystal</DialogTitle><DialogDescription>Search main, featured and recorded event pools.</DialogDescription></div><DialogClose className={styles.iconButton} aria-label="Close crystal picker"><X aria-hidden="true" /></DialogClose></div>
      <label className={styles.pickerSearch}><Search aria-hidden="true" /><span className={styles.srOnly}>Search crystals to compare</span><input ref={inputRef} type="search" value={q} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="Search crystal names…" autoComplete="off" />{loading && <LoaderCircle className={styles.spinner} aria-hidden="true" />}</label>
      <p role="status" className={styles.pickerStatus}>{loading ? "Searching crystals…" : error ? "Could not load crystals." : q ? `${result?.total ?? 0} matching pools${(result?.total ?? 0) > 20 ? " · showing the first 20" : ""}` : "Main pools"}</p>
      <div className={styles.pickerResults} aria-busy={loading}>
        {error ? <button type="button" className={styles.changeCrystal} onClick={() => setAttempt(value => value + 1)}>Try again</button> : !loading && result?.options.length === 0 ? <p className={styles.smallEmpty}>No crystals found. Try a shorter name.</p> : result?.options.map(option => <button type="button" key={option.id} className={styles.pickerOption} disabled={loading} aria-pressed={option.id === selectedId} onClick={() => { onSelect(option.id); setOpen(false); setQuery(""); setResult(null) }}>
          {option.artworkUrl ? <Image src={option.artworkUrl} alt="" width={48} height={56} sizes="48px" /> : <Gem aria-hidden="true" />}<span><strong>{option.name}</strong><small>{option.rarities.map(value => `${value}★`).join(" · ")}<span> · {option.championCount} champions</span></small></span>{option.id === selectedId && <Check aria-hidden="true" />}
        </button>)}
      </div>
      <p className={styles.pickerFootnote}>Different names may share a champion pool. Comparison uses the recorded contents.</p>
    </DialogContent>
  </Dialog>
}

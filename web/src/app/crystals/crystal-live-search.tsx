"use client"

import { useId } from "react"
import { LoaderCircle, Search, X } from "lucide-react"
import styles from "./crystals.module.css"

export function CrystalLiveSearch({ value, label, placeholder, updating, action, fields, onChange, onClear, onSubmit, onCompositionStart, onCompositionEnd, compact = false }: {
  value: string; label: string; placeholder: string; updating: boolean
  action: string; fields: Record<string, string>
  onChange: (value: string) => void; onClear: () => void; onSubmit: () => void
  onCompositionStart: () => void; onCompositionEnd: (value: string) => void; compact?: boolean
}) {
  const id = useId()
  return <form action={action} method="get" className={styles.liveSearch} role="search" aria-label={label} onSubmit={event => { event.preventDefault(); onSubmit() }}>
    {Object.entries(fields).filter(([, value]) => value).map(([name, value]) => <input type="hidden" key={name} name={name} value={value} />)}
    <label htmlFor={id} className={compact ? styles.srOnly : styles.filterLabel}>{label}</label>
    <div className={styles.liveSearchField}>
      {updating ? <LoaderCircle className={styles.searchSpinner} aria-hidden="true" /> : <Search aria-hidden="true" />}
      <input id={id} type="search" name="q" value={value} onChange={event => onChange(event.target.value)} onCompositionStart={onCompositionStart} onCompositionEnd={event => onCompositionEnd(event.currentTarget.value)} placeholder={placeholder} maxLength={100} autoComplete="off" />
      {value && <button type="button" className={styles.clearQuery} aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear}><X aria-hidden="true" /></button>}
    </div>
  </form>
}

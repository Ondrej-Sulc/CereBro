"use client"

import { useId, useState } from "react"
import { nativeModifierIcons, type NativeModifierIconKey } from "@cerebro/core/domain/node-modifiers/native-icons"
import { NodeModifierIcon } from "./NodeModifierIcon"
import { cn } from "@/lib/utils"

export function NodeModifierIconPicker({ value, onChange, disabled = false }: {
  value: string | null; onChange: (key: NativeModifierIconKey | null) => void; disabled?: boolean
}) {
  const id = useId(), [search, setSearch] = useState("")
  const icons = nativeModifierIcons.filter(icon => icon.label.toLowerCase().includes(search.trim().toLowerCase()))
  return <fieldset disabled={disabled} className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold text-slate-200">Modifier icon</legend>
    <p className="text-xs text-slate-400">Display choice shared wherever this modifier appears. It does not link the record to a game definition.</p>
    <label htmlFor={id} className="block text-xs text-slate-300">Find an icon</label>
    <input id={id} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Dice, Health, Spade…" className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" />
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {[{ key: null, label: 'No icon' }, ...icons].map(icon => <label key={icon.key ?? 'none'} className={cn("relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border px-1 py-2 text-center text-[10px] text-slate-300 focus-within:ring-2 focus-within:ring-sky-400", value === icon.key ? "border-sky-400 bg-sky-950/50" : "border-slate-700 bg-slate-900/50")}>
        <input className="sr-only" type="radio" name={id+'-icon'} checked={value === icon.key} onChange={() => onChange(icon.key)} aria-label={icon.label} />
        {icon.key ? <NodeModifierIcon iconKey={icon.key} size={23} /> : <span aria-hidden="true" className="h-[23px] text-lg leading-none">—</span>}
        <span>{icon.label}</span>
      </label>)}
    </div>
    {!icons.length && <p className="text-xs text-slate-400">No matching icons.</p>}
  </fieldset>
}

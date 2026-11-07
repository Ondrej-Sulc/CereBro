"use client"

import { useId } from "react"
import { normalizeRosterAscensionState, rosterAscensionLevels, type OwnedAscensionInput, type RosterAscensionState } from "@cerebro/core/domain/roster-ascension-state"
import { cn } from "@/lib/utils"

export function RosterAscensionControl({ value, maxLevel, onChange }: { value: OwnedAscensionInput; maxLevel?: number | null; onChange: (state: RosterAscensionState) => void }) {
  const id = useId()
  const state = normalizeRosterAscensionState(value)
  return <div className="space-y-2">
    <label id={`${id}-label`} htmlFor={maxLevel == null ? id : undefined} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ascension</label>
    {maxLevel == null ? <><input id={id} type="number" min={0} max={2147483647} step={1} value={state.ascensionLevel} aria-describedby={`${id}-hint`} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200" onChange={event => {
      const level = Number(event.currentTarget.value)
      if (Number.isSafeInteger(level) && level >= 0 && level <= 2147483647) onChange(normalizeRosterAscensionState({ ascensionLevel: level }))
    }} /><p id={`${id}-hint`} className="text-[10px] leading-4 text-slate-500">Enter the ascension level shown in game.</p></> : <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${id}-label`}>
      {rosterAscensionLevels(maxLevel, state.ascensionLevel).map(level => <button type="button" key={level} aria-pressed={state.ascensionLevel === level} className={cn("min-h-9 flex-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold", state.ascensionLevel === level ? "border-amber-400/30 bg-amber-500/20 text-amber-400" : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200")} onClick={() => onChange(normalizeRosterAscensionState({ ascensionLevel: level }))}>{level === 0 ? "None" : `A${level}${level > maxLevel ? " · owned" : ""}`}</button>)}
    </div>}
    {maxLevel === 0 && state.ascensionLevel === 0 && <p className="text-[10px] leading-4 text-slate-500">No ascension tiers recorded for this champion.</p>}
  </div>
}

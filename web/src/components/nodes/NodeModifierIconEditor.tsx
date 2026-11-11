"use client"

import { useEffect, useState } from "react"
import { resolveNativeModifierIcon, type CuratedNodeModifier, type ModifierIconEdit } from "@cerebro/core/domain/node-modifiers/native-icons"
import { updateModifierIcon } from "@/app/admin/nodes/actions"
import { NodeModifierIconPicker } from "./NodeModifierIconPicker"
import { Button } from "@/components/ui/button"

export function NodeModifierIconEditor({ modifier, onSave = updateModifierIcon, onSaved }: {
  modifier: CuratedNodeModifier; onSave?: (input: ModifierIconEdit) => Promise<CuratedNodeModifier>; onSaved?: (updated: CuratedNodeModifier) => void
}) {
  const [saved, setSaved] = useState(modifier), [choice, setChoice] = useState(resolveNativeModifierIcon(modifier.iconKey)?.key ?? null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  useEffect(() => {
    setSaved(modifier); setChoice(resolveNativeModifierIcon(modifier.iconKey)?.key ?? null)
    if (modifier.id !== saved.id) setMessage("")
  }, [modifier, saved.id])
  async function save() {
    setBusy(true); setMessage("")
    try {
      const updated = await onSave({ id: saved.id, iconKey: choice, expected: { name: saved.name, description: saved.description, iconKey: saved.iconKey ?? null } })
      setSaved(updated); setMessage("Icon saved."); onSaved?.(updated)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the icon.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-lg border border-slate-800 p-3">
    <NodeModifierIconPicker value={choice} onChange={setChoice} disabled={busy} />
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" disabled={busy || choice === (saved.iconKey ?? null)} onClick={save}>{busy ? "Saving…" : "Save icon"}</Button><p role="status" className="text-xs text-slate-300">{message}</p></div>
  </div>
}

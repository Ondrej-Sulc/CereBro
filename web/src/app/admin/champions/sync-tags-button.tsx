"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { syncTagsFromGameData } from "./actions"
import { RefreshCw } from "lucide-react"

export function SyncTagsButton() {
  const { toast } = useToast()
  const championsRef = useRef<HTMLInputElement>(null)
  const tagsRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    const champFile = championsRef.current?.files?.[0]
    const tagsFile = tagsRef.current?.files?.[0]

    if (!champFile || !tagsFile) {
      toast({ title: "Select both files first", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("champion_display", champFile)
      formData.append("tags", tagsFile)

      const result = await syncTagsFromGameData(formData)

      toast({
        title: `Tags synced — ${result.updated} champions updated`,
        description: result.skipped.length > 0
          ? `${result.skipped.length} unmatched: ${result.skipped.slice(0, 5).join(", ")}${result.skipped.length > 5 ? "…" : ""}`
          : undefined,
      })
    } catch (e) {
      toast({ title: "Sync failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground">
        <span className="sr-only">champion_display.json</span>
        <input ref={championsRef} type="file" accept=".json" className="w-44 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer" placeholder="champion_display.json" />
      </label>
      <label className="text-sm text-muted-foreground">
        <span className="sr-only">tags.json</span>
        <input ref={tagsRef} type="file" accept=".json" className="w-28 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer" />
      </label>
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        Sync Tags
      </Button>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { McocSynergiesImportReport } from "@cerebro/core/services/mcocSynergiesImportService"

export function ImportSynergiesButton() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [report, setReport] = useState<McocSynergiesImportReport | null>(null)
  const [loading, setLoading] = useState(false)
  async function run(write: boolean) {
    if (!file) return
    setLoading(true)
    try {
      const body = write ? previewText : await file.text()
      if (!body) throw new Error("Preview the snapshot first")
      const response = await fetch(`/api/admin/champion-synergies/import?write=${write}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      })
      const result = await response.json() as McocSynergiesImportReport & { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Synergy import failed")
      setPreviewText(body)
      setReport(result)
      if (write) toast({ title: `Imported ${result.written?.records.toLocaleString()} synergies` })
    } catch (error) {
      setReport(null)
      toast({ title: "Synergy import failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" })
    } finally { setLoading(false) }
  }
  return (
    <div className="space-y-3">
      <input aria-label="Synergy snapshot JSON" type="file" accept=".json,application/json" disabled={loading}
        className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1"
        onChange={event => { setFile(event.target.files?.[0] ?? null); setReport(null); setPreviewText(null) }} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!file || loading} onClick={() => run(false)}>Preview import</Button>
        <Button size="sm" disabled={loading || !report?.canWrite || !!report.written} onClick={() => run(true)}>
          <Users className="mr-2 h-4 w-4" />{loading ? "Processing…" : "Import snapshot"}
        </Button>
      </div>
      {report && <div role="status" className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
        <p>{report.written ? "Imported" : report.canWrite ? "Ready to import" : "Cannot import"}: {report.records.toLocaleString()} synergies across {report.ownerChampions} champions.</p>
        {!report.written && <p className="text-xs text-muted-foreground">Replaces {report.previousRecords.toLocaleString()} previously imported game synergies. Curated ability links are preserved.</p>}
        {!!report.filteredTemplateTiers.length && <p className="text-xs text-muted-foreground">{report.filteredTemplateTiers.length} unavailable template tiers retained in source data only.</p>}
        {!!report.unmatchedTiers.length && <details className="text-xs"><summary className="cursor-pointer">{report.unmatchedTiers.length} unmatched tiers retained in source data</summary><p className="mt-2 max-h-32 overflow-auto break-words">{report.unmatchedTiers.join(", ")}</p></details>}
        {!report.canWrite && <p className="text-destructive">Import blocked: no matched owners or unsupported grouped requirements.</p>}
      </div>}
    </div>
  )
}

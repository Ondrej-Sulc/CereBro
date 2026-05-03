"use client"

import { useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Upload, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import type { GlossaryIconsImportReport } from "@cerebro/core/services/glossaryIconsImportService"

export function ImportGlossaryIconsButton() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<GlossaryIconsImportReport | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast({ title: "Select glossary icons JSON first", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const text = await file.text()
      const trimmed = text.trimStart()
      if (!trimmed.startsWith("[")) {
        throw new Error("Selected file is not a JSON array.")
      }

      const response = await fetch("/api/admin/glossary-icons/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      })
      const responseText = await response.text()
      let payload: unknown
      try {
        payload = JSON.parse(responseText)
      } catch {
        throw new Error(
          `Import request returned ${response.status} ${response.statusText}: ${responseText.slice(0, 300)}`
        )
      }
      if (!response.ok) {
        const errorPayload = payload as { error?: string }
        throw new Error(errorPayload.error ?? "Import failed")
      }

      const result = payload as GlossaryIconsImportReport
      const written = result.written
      setReport(result)
      setResultsOpen(true)

      toast({
        title: written
          ? `Imported ${written.termsUpdated} terms`
          : "Icons checked",
        description: [
          `${result.termsFound}/${result.totalUpdates} updates matched`,
          `${result.unmatchedTerms.length} unmatched`,
        ].join(", "),
        variant: result.canWrite ? "default" : "destructive",
      })
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm text-muted-foreground">
          <span className="sr-only">glossary_icons.json</span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer sm:w-64"
          />
        </label>
        <Button variant="outline" size="sm" onClick={handleImport} disabled={loading}>
          {loading ? (
            <ImageIcon className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1.5" />
          )}
          Import Icons
        </Button>
      </div>
      <ImportResultsDialog
        open={resultsOpen}
        onOpenChange={setResultsOpen}
        report={report}
      />
    </>
  )
}

function ImportResultsDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: GlossaryIconsImportReport | null
}) {
  if (!report) return null

  const written = report.written
  const blocked = !report.canWrite

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {blocked ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            Glossary Icons Import Results
          </DialogTitle>
          <DialogDescription>
            Processed {report.totalUpdates} updates from JSON.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResultMetric label="Terms Matched" value={`${report.termsFound}/${report.totalUpdates}`} />
          <ResultMetric label="Terms Updated" value={(written?.termsUpdated ?? 0).toLocaleString()} />
          <ResultMetric label="Abilities Linked/Updated" value={(written?.abilitiesLinked ?? 0).toLocaleString()} />
          <ResultMetric label="New Abilities Created" value={(written?.abilitiesCreated ?? 0).toLocaleString()} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={report.canWrite ? "default" : "destructive"}>
            {report.canWrite ? "Write allowed" : "Write blocked"}
          </Badge>
          <Badge variant={report.unmatchedTerms.length ? "destructive" : "outline"}>
            {report.unmatchedTerms.length} skipped
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-1">
          <ResultList title="Skipped/Unmatched Glossary Keys" items={report.unmatchedTerms} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      <ScrollArea className="h-36">
        {items.length ? (
          <ul className="space-y-1 p-3 text-xs text-muted-foreground">
            {items.map((item, index) => (
              <li key={`${title}-${index}`} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-3 text-xs text-muted-foreground">None</div>
        )}
      </ScrollArea>
    </div>
  )
}

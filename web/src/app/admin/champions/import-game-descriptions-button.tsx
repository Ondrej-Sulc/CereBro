"use client"

import { useRef, useState } from "react"
import { AlertTriangle, BookOpenText, CheckCircle2 } from "lucide-react"
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
import type { McocGameDescriptionsImportReport } from "@cerebro/core/services/mcocGameDescriptionsImportService"

export function ImportGameDescriptionsButton() {
  const { toast } = useToast()
  const championsRef = useRef<HTMLInputElement>(null)
  const glossaryRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<McocGameDescriptionsImportReport | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)

  async function readJsonFile(file: File, expectedName: string) {
    const text = await file.text()
    const trimmed = text.trimStart()
    if (!trimmed.startsWith("{")) {
      throw new Error(`${expectedName} must be a JSON object`)
    }
    return JSON.parse(text) as unknown
  }

  async function handleImport() {
    const championsFile = championsRef.current?.files?.[0]
    const glossaryFile = glossaryRef.current?.files?.[0]

    if (!championsFile || !glossaryFile) {
      toast({ title: "Select both files first", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const [champions, glossary] = await Promise.all([
        readJsonFile(championsFile, "champions.json"),
        readJsonFile(glossaryFile, "glossary.json"),
      ])

      const response = await fetch("/api/admin/champion-game-descriptions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ champions, glossary }),
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

      const result = payload as McocGameDescriptionsImportReport
      setReport(result)
      setResultsOpen(true)

      toast({
        title: `Imported ${result.written?.textRecordsCreated ?? 0} description records`,
        description: [
          `${result.matched}/${result.championCount} champions matched`,
          `${result.glossaryTerms} glossary terms`,
          `${result.unmatched.length} skipped`,
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
          <span className="sr-only">champions.json</span>
          <input
            ref={championsRef}
            type="file"
            accept=".json,application/json"
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer sm:w-48"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          <span className="sr-only">glossary.json</span>
          <input
            ref={glossaryRef}
            type="file"
            accept=".json,application/json"
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer sm:w-44"
          />
        </label>
        <Button variant="outline" size="sm" onClick={handleImport} disabled={loading}>
          <BookOpenText className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-pulse" : ""}`} />
          Import Text
        </Button>
      </div>
      <DescriptionsResultsDialog
        open={resultsOpen}
        onOpenChange={setResultsOpen}
        report={report}
      />
    </>
  )
}

function DescriptionsResultsDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: McocGameDescriptionsImportReport | null
}) {
  if (!report) return null

  const blocked = report.ambiguous.length > 0 || report.conflicts.length > 0
  const written = report.written

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
            Champion Text Import Results
          </DialogTitle>
          <DialogDescription>
            Imported game ability text templates and glossary terms without changing existing full abilities.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResultMetric label="Champions matched" value={`${report.matched}/${report.championCount}`} />
          <ResultMetric label="Text records" value={(written?.textRecordsCreated ?? report.textRecords).toLocaleString()} />
          <ResultMetric label="Glossary terms" value={(written?.glossaryTermsUpserted ?? report.glossaryTerms).toLocaleString()} />
          <ResultMetric label="Old text removed" value={(written?.textRecordsDeleted ?? 0).toLocaleString()} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={blocked ? "destructive" : "default"}>
            {blocked ? "Some matches skipped" : "Import completed"}
          </Badge>
          <Badge variant="outline">{report.unmatched.length} skipped</Badge>
          <Badge variant={report.ambiguous.length ? "destructive" : "outline"}>
            {report.ambiguous.length} ambiguous
          </Badge>
          <Badge variant={report.conflicts.length ? "destructive" : "outline"}>
            {report.conflicts.length} conflicts
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ResultList title="Skipped Champions" items={report.unmatched} />
          <ResultList title="Blocked Matches" items={[...report.ambiguous, ...report.conflicts]} />
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

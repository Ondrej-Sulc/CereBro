"use client"

import { useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
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
import { syncTagsFromGameData, type SyncTagsResult } from "./actions"

export function SyncTagsButton() {
  const { toast } = useToast()
  const championsRef = useRef<HTMLInputElement>(null)
  const tagsRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SyncTagsResult | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)

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
      setReport(result)
      setResultsOpen(true)

      const parts = [`${result.updated} champions updated`, `${result.deletedTags} stale tags removed`]

      toast({
        title: `Tags synced - ${parts.join(", ")}`,
        description: result.skipped.length > 0 || result.blocked.length > 0
          ? `${result.skipped.length} skipped, ${result.blocked.length} blocked`
          : undefined,
        variant: result.blocked.length > 0 ? "destructive" : "default",
      })
    } catch (e) {
      toast({
        title: "Sync failed",
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
          <span className="sr-only">champion_display.json</span>
          <input
            ref={championsRef}
            type="file"
            accept=".json"
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer sm:w-52"
            placeholder="champion_display.json"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          <span className="sr-only">tags.json</span>
          <input
            ref={tagsRef}
            type="file"
            accept=".json"
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium cursor-pointer sm:w-36"
          />
        </label>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Sync Tags
        </Button>
      </div>
      <TagsResultsDialog
        open={resultsOpen}
        onOpenChange={setResultsOpen}
        report={report}
      />
    </>
  )
}

function TagsResultsDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: SyncTagsResult | null
}) {
  if (!report) return null

  const blocked = report.blocked.length > 0

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
            Champion Tags Import Results
          </DialogTitle>
          <DialogDescription>
            Synced champion_display.json and tags.json into champion tag assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResultMetric label="Champions updated" value={report.updated.toLocaleString()} />
          <ResultMetric label="Entries processed" value={`${report.dedupedChampions}/${report.sourceChampions}`} />
          <ResultMetric label="Tags in file" value={report.sourceTags.toLocaleString()} />
          <ResultMetric label="Stale tags removed" value={report.deletedTags.toLocaleString()} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={blocked ? "destructive" : "default"}>
            {blocked ? "Review blocked matches" : "Sync completed"}
          </Badge>
          <Badge variant="outline">{report.skipped.length} skipped</Badge>
          <Badge variant={blocked ? "destructive" : "outline"}>
            {report.blocked.length} blocked
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ResultList title="Skipped Champions" items={report.skipped} />
          <ResultList title="Blocked Matches" items={report.blocked} />
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

"use client";

import { useRef, useState } from "react";
import { Database, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { DuelImportReport, DuelImportSource } from "@cerebro/core/services/duelImportService";

const sourceOptions: Array<{ label: string; value: DuelImportSource }> = [
  { label: "GuiaMTC", value: "GUIA_MTC" },
  { label: "CoCPit", value: "COCPIT" },
  { label: "MCOCHUB", value: "MCOCHUB" },
];

export function DuelImportPanel() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<DuelImportSource>("GUIA_MTC");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DuelImportReport | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Select a CSV file first", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.set("source", source);
    formData.set("csv", file);

    setLoading(true);
    try {
      const response = await fetch("/api/admin/duels/import", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Import failed");
      }

      const result = payload as DuelImportReport;
      setReport(result);
      setResultsOpen(true);
      toast({
        title: `Imported ${result.processedCount.toLocaleString()} duel targets`,
        description: `${result.markedOutdatedCount.toLocaleString()} old active targets marked outdated, ${result.skippedArchivedCount.toLocaleString()} archived skipped.`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Database className="h-4 w-4" />
            CSV Source Import
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload source duel data. Existing active rows for that source become outdated before incoming rows are activated.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={source} onValueChange={(value) => setSource(value as DuelImportSource)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-background file:px-2 file:py-1 file:text-xs file:font-medium sm:w-64"
          />
          <Button size="sm" onClick={handleImport} disabled={loading}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {loading ? "Importing" : "Import"}
          </Button>
        </div>
      </div>
      <ImportResultsDialog open={resultsOpen} onOpenChange={setResultsOpen} report={report} />
    </div>
  );
}

function ImportResultsDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DuelImportReport | null;
}) {
  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Duel Import Results</DialogTitle>
          <DialogDescription>{report.source} source import summary.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Activated" value={report.activatedCount} />
          <Metric label="Marked outdated" value={report.markedOutdatedCount} />
          <Metric label="Skipped archived" value={report.skippedArchivedCount} />
          <Metric label="Skipped rows" value={report.skippedRows.length} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={report.unmatchedChampions.length ? "destructive" : "outline"}>
            {report.unmatchedChampions.length} unmatched champions
          </Badge>
          <Badge variant={report.duplicateInputTargets.length ? "destructive" : "outline"}>
            {report.duplicateInputTargets.length} duplicate targets
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ResultList title="Unmatched Champions" items={report.unmatchedChampions} />
          <ResultList title="Duplicate Targets" items={report.duplicateInputTargets} />
          <ResultList
            title="Skipped Rows"
            items={report.skippedRows.map((row) => `Row ${row.rowNumber}: ${row.reason}`)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value.toLocaleString()}</div>
    </div>
  );
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
  );
}

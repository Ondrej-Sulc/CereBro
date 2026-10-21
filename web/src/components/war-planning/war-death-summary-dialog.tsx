"use client";

import { useState } from "react";
import Link from "next/link";
import { Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WarDeathSummary } from "@/lib/war-death-summary";
import { BattlegroupDeathBreakdown, recordedDeathsLabel, warLabel } from "./war-death-summary";
import { cn } from "@/lib/utils";

/** The planner knows only its loaded BG. Never expose the projection's other zero-filled BGs. */
export function WarDeathSummaryDialog({ summary, battlegroup, loading, error, onSelectNode }: {
  summary: WarDeathSummary;
  battlegroup: number;
  loading: boolean;
  error: string | null;
  onSelectNode: (nodeNumber: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const bg = summary.battlegroups.find(group => group.battlegroup === battlegroup);
  const unavailable = !!error || !bg;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Skull aria-hidden="true" className="h-4 w-4 text-red-400" />
          {`BG${battlegroup} deaths: ${loading ? "Loading" : unavailable ? "Unavailable" : bg.deaths}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl border-slate-800 bg-slate-950 p-0 text-slate-200 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-800/60 bg-slate-900/40 p-4 text-left sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight leading-snug"><Skull aria-hidden="true" className="h-4 w-4 shrink-0 text-red-400" /> BG{battlegroup} recorded deaths</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 [overflow-wrap:anywhere]">{warLabel(summary)} vs {summary.opponent} · Season {summary.season}</DialogDescription>
              {!loading && !unavailable && <p className={cn("text-sm", bg.deaths ? "text-red-300" : "text-slate-400")}>{recordedDeathsLabel(bg.deaths)} <span className="text-slate-400">· {bg.players.length} {bg.players.length === 1 ? "player" : "players"}</span></p>}
            </div>
            <DialogClose asChild><button type="button" aria-label="Close death summary" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:h-9 sm:w-9"><X aria-hidden="true" className="h-4 w-4" /></button></DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5">
          {loading ? <p role="status" className="py-6 text-sm text-slate-400">Loading recorded deaths for BG{battlegroup}…</p> : unavailable ? <p role="alert" className="py-6 text-sm text-red-300">Recorded deaths could not be loaded for BG{battlegroup}. Try refreshing the planner.</p> : (
            <BattlegroupDeathBreakdown key={`${summary.warId}-${battlegroup}`} warId={summary.warId} summary={bg} onSelectNode={node => { setOpen(false); onSelectNode(node); }} />
          )}
        </div>
        <div className="shrink-0 border-t border-slate-800 px-4 py-3 sm:px-5">
          <Link href={`/analysis/season-overview?season=${summary.season}&war=${summary.warId}&bg=${battlegroup}#war-deaths`} className="inline-flex min-h-9 items-center rounded text-xs text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">View season death statistics</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useId, useState } from "react";
import { Upload, ChevronDown } from "lucide-react";
import { RosterUpdateForm } from "@/components/RosterUpdateForm";
import type { RosterScreenshotQuotaSummary } from "@/components/RosterUpdateForm";
import { cn } from "@/lib/utils";

interface UploadSectionProps {
    targetPlayerId: string;
    playerName: string;
    quota: RosterScreenshotQuotaSummary | null;
}

export function UploadSection({ targetPlayerId, playerName, quota }: UploadSectionProps) {
    const [open, setOpen] = useState(false);
    const panelId = useId();

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(prev => !prev)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 sm:px-4"
            >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-indigo-400/20 bg-indigo-400/10 text-indigo-200">
                    <Upload className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-100">Upload roster for {playerName}</span>
                <span className="hidden shrink-0 rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-200 sm:inline">Officer access</span>
                <ChevronDown className={cn("size-4 shrink-0 text-slate-400 motion-safe:transition-transform", open && "rotate-180")} aria-hidden="true" />
            </button>
            <div id={panelId} hidden={!open} className="border-t border-slate-800 p-3 sm:p-4">
                {open && <RosterUpdateForm targetPlayerId={targetPlayerId} compact quota={quota} />}
            </div>
        </div>
    );
}

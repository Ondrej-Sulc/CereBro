"use client";

import { useState } from "react";
import { Upload, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RosterUpdateForm } from "@/components/RosterUpdateForm";
import type { RosterScreenshotQuotaSummary } from "@/components/RosterUpdateForm";

interface UploadSectionProps {
    targetPlayerId: string;
    playerName: string;
    quota: RosterScreenshotQuotaSummary | null;
}

export function UploadSection({ targetPlayerId, playerName, quota }: UploadSectionProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border border-amber-900/40 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-950/20 hover:bg-amber-950/30 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-300">
                        Upload Roster for {playerName}
                    </span>
                    <span className="text-xs text-amber-500/70">(officer access)</span>
                </div>
                {open ? (
                    <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
                )}
            </button>
            {open && (
                <div className="p-4 bg-slate-900/50">
                    <RosterUpdateForm targetPlayerId={targetPlayerId} compact quota={quota} />
                </div>
            )}
        </div>
    );
}

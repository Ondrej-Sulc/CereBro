"use client";

import { SimpleMarkdown } from "@/components/ui/simple-markdown";

export function StrategyTips({ tips }: { tips: string | null | undefined }) {
    if (!tips) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="h-6 w-1 rounded-full bg-indigo-500" />
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Strategy & Tips</h4>
            </div>
            <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-5 text-sm leading-relaxed text-indigo-100 shadow-inner">
                <SimpleMarkdown content={tips} />
            </div>
        </div>
    );
}

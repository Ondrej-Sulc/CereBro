"use client";

import type { SyntheticEvent } from "react";
import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviveOrbIcon({ className }: { className?: string }) {
    const iconId = useId().replace(/:/g, "");
    const coreGradientId = `revive-orb-core-${iconId}`;
    const metalGradientId = `revive-orb-metal-${iconId}`;

    return (
        <svg
            viewBox="0 0 32 32"
            aria-hidden="true"
            className={className}
        >
            <defs>
                <radialGradient id={coreGradientId} cx="36%" cy="28%" r="72%">
                    <stop offset="0%" stopColor="#dcfce7" />
                    <stop offset="34%" stopColor="#4ade80" />
                    <stop offset="68%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#052e16" />
                </radialGradient>
                <linearGradient id={metalGradientId} x1="5" y1="4" x2="27" y2="28">
                    <stop offset="0%" stopColor="#e5e7eb" />
                    <stop offset="55%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#111827" />
                </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="13.5" fill="#03130a" />
            <circle cx="16" cy="16" r="12" fill={`url(#${coreGradientId})`} />
            <path d="M7.5 18.2c2.4 1.5 5.1 2.2 8.2 1.9 3.1-.3 5.9-1.4 8.6-3.3-.4 4.8-4 8.3-8.5 8.3-4.1 0-7.5-2.9-8.3-6.9Z" fill="#052e16" opacity="0.36" />
            <path d="M9.3 8.1C12.8 5 18.6 4.7 22.5 7.6" fill="none" stroke="#bbf7d0" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
            <path d="M6.1 13.5 3.8 11.8l2.6-5.2 4.1.7-1.2 5.1Z" fill={`url(#${metalGradientId})`} stroke="#0f172a" strokeWidth="1" />
            <path d="M25.9 13.5 28.2 11.8l-2.6-5.2-4.1.7 1.2 5.1Z" fill={`url(#${metalGradientId})`} stroke="#0f172a" strokeWidth="1" />
            <path d="M6.1 18.6 3.9 20.4l2.8 5.1 4.1-.9-1.4-5Z" fill={`url(#${metalGradientId})`} stroke="#0f172a" strokeWidth="1" />
            <path d="M25.9 18.6 28.1 20.4l-2.8 5.1-4.1-.9 1.4-5Z" fill={`url(#${metalGradientId})`} stroke="#0f172a" strokeWidth="1" />
            <path d="M16 9v14M9 16h14" stroke="#ecfdf5" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M16 9v14M9 16h14" stroke="#15803d" strokeWidth="1.25" strokeLinecap="round" opacity="0.65" />
            <circle cx="16" cy="16" r="12" fill="none" stroke="#86efac" strokeWidth="1.4" opacity="0.9" />
        </svg>
    );
}

export function ReviveControl({
    encounterId,
    revivesUsed,
    readOnly,
    onSetRevives
}: {
    encounterId: string;
    revivesUsed: number;
    readOnly: boolean;
    onSetRevives: (encounterId: string, revivesUsed: number) => void;
}) {
    if (readOnly && revivesUsed === 0) return null;

    const stopPropagation = (event: SyntheticEvent) => {
        event.stopPropagation();
    };

    if (readOnly) {
        return (
            <div
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200"
                title={`${revivesUsed} revives used`}
                onClick={stopPropagation}
                onKeyDown={stopPropagation}
            >
                <ReviveOrbIcon className="h-4 w-4" />
                <span>{revivesUsed}</span>
            </div>
        );
    }

    return (
        <div
            className="inline-flex items-center rounded-full border border-emerald-800/60 bg-emerald-950/35 p-0.5 shadow-inner"
            title="Revives used"
            onClick={stopPropagation}
            onKeyDown={stopPropagation}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-100"
                disabled={revivesUsed <= 0}
                onClick={(event) => {
                    event.stopPropagation();
                    onSetRevives(encounterId, revivesUsed - 1);
                }}
            >
                <Minus className="h-3 w-3" />
            </Button>
            <div className="flex min-w-10 items-center justify-center gap-1 px-1 text-[10px] font-black text-emerald-100">
                <ReviveOrbIcon className="h-4 w-4" />
                <span>{revivesUsed}</span>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-100"
                disabled={revivesUsed >= 99}
                onClick={(event) => {
                    event.stopPropagation();
                    onSetRevives(encounterId, revivesUsed + 1);
                }}
            >
                <Plus className="h-3 w-3" />
            </Button>
        </div>
    );
}

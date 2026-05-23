"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { cn } from "@/lib/utils";
import type { PotentialRecommendation, Recommendation } from "../../types";

type PrestigeImpactModalProps = {
    impact: { type: "potential"; rec: PotentialRecommendation } | { type: "rank"; rec: Recommendation } | null;
    onClose: () => void;
};

export function PrestigeImpactModal({ impact, onClose }: PrestigeImpactModalProps) {
    if (!impact) return null;

    const rec = impact.rec;
    const colors = getChampionClassColors(rec.championClass);
    const currentState = impact.type === "potential"
        ? `${impact.rec.stars}\u2605 R${impact.rec.fromRank} S${impact.rec.fromSig} A${impact.rec.ascensionLevel}`
        : `${impact.rec.stars}\u2605 R${impact.rec.fromRank} A${impact.rec.ascensionLevel}`;
    const targetState = impact.type === "potential"
        ? `${impact.rec.stars}\u2605 R${impact.rec.toRank} S${impact.rec.toSig} A${impact.rec.ascensionLevel}`
        : `${impact.rec.stars}\u2605 R${impact.rec.toRank} A${impact.rec.ascensionLevel}`;
    const currentPrestige = impact.type === "potential" ? impact.rec.currentPrestige : null;
    const targetPrestige = impact.type === "potential" ? impact.rec.targetPrestige : null;
    const championPrestigeGain = rec.prestigeGain;
    const reason = recommendationReasonCopy(rec.reason);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="overflow-hidden p-0 bg-slate-950 border-slate-800 text-slate-200 sm:max-w-[620px] shadow-2xl">
                <div className="relative h-32 w-full">
                    <Image
                        src={getChampionImageUrlOrPlaceholder(rec.championImage, "full", "hero")}
                        alt=""
                        fill
                        sizes="620px"
                        className="object-cover opacity-35 blur-sm scale-110 saturate-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-px opacity-80" style={{ backgroundColor: colors.color }} />
                    <DialogHeader className="absolute bottom-4 left-4 flex flex-row items-end gap-4 p-0 pr-4">
                        <div className={cn("relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900 shadow-2xl", colors.border)}>
                            <Image src={getChampionImageUrlOrPlaceholder(rec.championImage, "full")} alt={rec.championName} fill sizes="80px" className="object-cover" />
                        </div>
                        <div className="min-w-0 pb-1 text-left">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <DialogTitle className="truncate text-2xl font-black tracking-tight text-white drop-shadow-md sm:text-3xl">
                                    {rec.championName}
                                </DialogTitle>
                                {rec.globalPrestigeRank && (
                                    <span className={cn("rounded px-2 py-1 text-[10px] font-bold leading-none ring-1", globalRankTone(rec.globalPrestigeRank))}>
                                        Global #{rec.globalPrestigeRank}
                                    </span>
                                )}
                            </div>
                            <DialogDescription className="mt-1 text-sm font-medium text-slate-300">
                                {impact.type === "potential" ? "Upgrade potential impact" : "Rank-up impact"}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                </div>

                <div className="space-y-3 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <StateBlock label="Current" value={currentState} />
                        <StateBlock label="Target" value={targetState} active />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <ImpactMetric label="Account Gain" value={`+${rec.accountGain.toLocaleString("en-US")}`} tone="primary" />
                        <ImpactMetric label="Champion Prestige" value={`+${championPrestigeGain.toLocaleString("en-US")}`} />
                    </div>

                    {currentPrestige !== null && targetPrestige !== null && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <ImpactMetric label="Current Prestige" value={currentPrestige.toLocaleString("en-US")} />
                            <ImpactMetric label="Target Prestige" value={targetPrestige.toLocaleString("en-US")} tone="primary" />
                        </div>
                    )}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Badge className="border-0 bg-slate-800 text-slate-300 hover:bg-slate-800">Why suggested</Badge>
                            {rec.globalPrestigeRankTotal && (
                                <span className="text-xs text-slate-500">Ranked against {rec.globalPrestigeRankTotal.toLocaleString("en-US")} champions at target state.</span>
                            )}
                        </div>
                        <p className="text-sm leading-relaxed text-slate-300">{reason}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function globalRankTone(rank: number) {
    if (rank === 1) return "bg-amber-400/20 text-amber-200 ring-amber-300/35 shadow-[0_0_12px_rgba(251,191,36,0.18)]";
    if (rank <= 5) return "bg-yellow-500/15 text-yellow-200 ring-yellow-400/30";
    if (rank <= 10) return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25";
    if (rank <= 25) return "bg-sky-500/12 text-sky-300 ring-sky-400/20";
    return "bg-slate-800/70 text-slate-400 ring-white/10";
}

function StateBlock({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
    return (
        <div className={cn("rounded-lg border p-3", active ? "border-emerald-500/30 bg-emerald-500/10" : "border-slate-800 bg-slate-900/35")}>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
            <div className={cn("mt-1 font-mono text-base font-black sm:text-lg", active ? "text-emerald-200" : "text-slate-100")}>{value}</div>
        </div>
    );
}

function ImpactMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "primary" }) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
            <div className={cn("mt-1 truncate font-mono text-base font-black sm:text-lg", tone === "primary" ? "text-emerald-300" : "text-slate-100")}>{value}</div>
        </div>
    );
}

function recommendationReasonCopy(reason: PotentialRecommendation["reason"]) {
    if (reason === "improves_top30") return "This champion is already contributing to your Top 30 and the target upgrade directly raises that contribution.";
    if (reason === "enters_top30") return "At the target state, this champion is projected to enter your Top 30 and improve your account prestige.";
    return "The projected prestige is high enough to matter for your Top 30 once other roster context is considered.";
}

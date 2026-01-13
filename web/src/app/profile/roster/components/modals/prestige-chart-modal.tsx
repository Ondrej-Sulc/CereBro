"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { PrestigeCurveChart } from "../../prestige-curve-chart";
import { SigRecommendation, PrestigePoint } from "../../types";

interface PrestigeChartModalProps {
    chartData: { data: PrestigePoint[], rec: SigRecommendation } | null;
    loading: boolean;
    onClose: () => void;
}

export function PrestigeChartModal({ chartData, loading, onClose }: PrestigeChartModalProps) {
    if (!chartData && !loading) return null;

    return (
        <Dialog open={!!chartData || loading} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-[500px]">
                {loading ? (
                    <>
                         <DialogTitle className="sr-only">Loading Chart</DialogTitle>
                         <DialogDescription className="sr-only">Please wait while the chart data is loading.</DialogDescription>
                        <div className="h-[300px] flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                        </div>
                    </>
                ) : chartData ? (
                    <>
                        <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-800 pb-4">
                            <div className={cn("relative w-16 h-16 rounded-lg overflow-hidden border-2 shadow-md shrink-0", getChampionClassColors(chartData.rec.championClass).border)}>
                                <Image src={getChampionImageUrl(chartData.rec.championImage, 'full')} alt={chartData.rec.championName} fill sizes="64px" className="object-cover" />
                            </div>
                            <div className="flex flex-col gap-1 text-left">
                                <DialogTitle className={cn("text-xl", getChampionClassColors(chartData.rec.championClass).text)}>{chartData.rec.championName}</DialogTitle>
                                <DialogDescription>{chartData.rec.stars}-Star Rank {chartData.rec.rank} • Current Sig: {chartData.rec.fromSig}</DialogDescription>
                            </div>
                        </DialogHeader>
                        <PrestigeCurveChart data={chartData.data} currentSig={chartData.rec.fromSig} championClass={chartData.rec.championClass} />
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

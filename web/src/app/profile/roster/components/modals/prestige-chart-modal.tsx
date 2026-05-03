"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl, getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
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
            <DialogContent className="overflow-hidden p-0 bg-slate-950 border-slate-800 text-slate-200 sm:max-w-[600px] shadow-2xl">
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
                        <div className="relative h-32 w-full">
                            <Image 
                                src={getChampionImageUrlOrPlaceholder(chartData.rec.championImage, 'full', 'hero')} 
                                alt="" 
                                fill 
                                sizes="600px" 
                                className="object-cover opacity-40 blur-sm scale-110 saturate-50" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                            <div 
                                className="absolute inset-x-0 bottom-0 h-px opacity-80" 
                                style={{ backgroundColor: getChampionClassColors(chartData.rec.championClass).color }} 
                            />
                            
                            <DialogHeader className="absolute bottom-4 left-4 flex flex-row items-end gap-4 p-0">
                                <div className={cn("relative w-20 h-20 rounded-lg overflow-hidden border-2 shadow-2xl shrink-0 bg-slate-900", getChampionClassColors(chartData.rec.championClass).border)}>
                                    <Image 
                                        src={getChampionImageUrlOrPlaceholder(chartData.rec.championImage, 'full')} 
                                        alt={chartData.rec.championName} 
                                        fill 
                                        sizes="80px" 
                                        className="object-cover" 
                                    />
                                    <div className="absolute inset-0 ring-1 ring-inset ring-black/20 rounded-lg" />
                                </div>
                                <div className="flex flex-col gap-0 text-left pb-1">
                                    <DialogTitle className="text-3xl font-black tracking-tight text-white drop-shadow-md">
                                        {chartData.rec.championName}
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-300 font-medium text-sm mt-1">
                                        {chartData.rec.stars}-Star Rank {chartData.rec.rank} • Current Sig: {chartData.rec.fromSig}
                                    </DialogDescription>
                                </div>
                            </DialogHeader>
                        </div>
                        <div className="p-6 pt-4">
                            <PrestigeCurveChart data={chartData.data} currentSig={chartData.rec.fromSig} championClass={chartData.rec.championClass} />
                        </div>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

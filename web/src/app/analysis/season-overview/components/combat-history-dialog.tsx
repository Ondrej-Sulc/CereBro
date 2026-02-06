import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Skull, Swords, Trophy, TrendingUp, ChevronDown, ChevronRight, Video, Shield } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { PlayerStats } from "../types";

interface CombatHistoryDialogProps {
  player: PlayerStats | null;
  onClose: () => void;
}

export function CombatHistoryDialog({ player, onClose }: CombatHistoryDialogProps) {
  const [expandedWars, setExpandedWars] = useState<Record<string, boolean>>({});

  const toggleWar = (warId: string) => {
    const isCurrentlyExpanded = expandedWars[warId] ?? true;
    setExpandedWars(prev => ({
      ...prev,
      [warId]: !isCurrentlyExpanded
    }));
  };

  // Reset expanded wars when player changes (though the dialog remounts usually, this is safe)
  if (!player) return null;

  return (
    <Dialog
        open={!!player}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="bg-slate-950/95 border-slate-800 text-slate-200 max-w-2xl max-h-[90vh] flex flex-col backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 gap-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-900/50 via-transparent to-transparent pointer-events-none" />
          
          <DialogHeader className="p-6 pb-4 border-b border-slate-800/60 relative z-10 bg-slate-900/40 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <>
                    <div className="relative">
                        <Avatar className="h-16 w-16 border-none shadow-2xl ring-2 ring-slate-800 bg-slate-900">
                            <AvatarImage src={player.avatar || undefined} />
                            <AvatarFallback className="text-xl bg-slate-800 text-slate-400 font-black">
                            {player.playerName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 rounded-full p-1 shadow-lg">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                            {player.playerName}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="text-amber-500">Combat History</span>
                            <span className="opacity-30">|</span>
                            <span>BG {player.battlegroup}</span>
                        </DialogDescription>
                    </div>
                    </>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-center bg-slate-950/50 border border-slate-800/60 rounded-lg px-4 py-2 min-w-[100px]">
                        <div className="text-xs font-black text-slate-500 uppercase mb-0.5">Survival</div>
                        <div className="text-lg font-black italic text-emerald-400 font-mono">
                            {(((player.fights - player.deaths) / (player.fights || 1)) * 100).toFixed(0)}%
                        </div>
                    </div>
                    <div className="text-center bg-slate-950/50 border border-slate-800/60 rounded-lg px-4 py-2 min-w-[100px]">
                        <div className="text-xs font-black text-slate-500 uppercase mb-0.5">Fights / Deaths</div>
                        <div className="text-lg font-black italic font-mono">
                            <span className="text-slate-200">{player.fights}</span>
                            <span className="text-slate-600 mx-1">/</span>
                            <span className="text-red-400">{player.deaths}</span>
                        </div>
                    </div>
                </div>
            </div>
          </DialogHeader>

          <div className="p-6 relative z-10 overflow-y-auto flex-1 custom-scrollbar">
            <div className="space-y-4">
            {player.warStats
                .sort((a, b) => b.warNumber - a.warNumber)
                .map((war) => {
                    const isExpanded = expandedWars[war.warId] ?? true;
                    return (
                        <Card
                            key={war.warId}
                            className="bg-slate-950/40 border-slate-800/60 overflow-hidden shadow-lg group/war hover:border-slate-700 transition-colors"
                        >
                            <CardHeader 
                                className="py-3 px-4 border-b border-slate-800/40 bg-slate-900/40 group-hover/war:bg-slate-900/60 transition-colors cursor-pointer"
                                onClick={() => toggleWar(war.warId)}
                            >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-amber-500">
                                        {war.warNumber}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Target Alliance</span>
                                        <span className="text-base font-black uppercase italic text-slate-200 tracking-tight">
                                            {war.opponent || "Unknown"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-black text-slate-500 uppercase">Fights</span>
                                        <span className="text-base font-mono font-black italic text-slate-300">
                                            {war.fights}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-black text-slate-500 uppercase">War Result</span>
                                        <div className={cn(
                                            "text-base font-mono font-black italic flex items-center gap-1.5",
                                            war.deaths === 0 ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {war.deaths > 0 && <Skull className="w-4 h-4" />}
                                            {war.deaths === 0 ? "SOLO" : `${war.deaths} DEATH${war.deaths > 1 ? "S" : ""}`}
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronRight className="w-5 h-5 text-slate-600" />}
                                </div>
                            </div>
                            </CardHeader>
                            {isExpanded && (
                                <CardContent className="p-0 animate-in slide-in-from-top-2 duration-300">
                                    <div className="divide-y divide-slate-800/30">
                                        {war.fightDetails.map((fight, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between py-2 px-4 hover:bg-slate-800/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-5">
                                            <div className="w-11 h-11 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-base text-slate-500 shrink-0">
                                                {fight.nodeNumber}
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center bg-slate-900/80 rounded-full pl-1.5 pr-5 py-1.5 border border-slate-800 shadow-inner group/pill">
                                                    <div className="relative shrink-0">
                                                        <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", getChampionClassColors(fight.attackerClass).bg)} />
                                                        <Avatar className={cn("h-10 w-10 border-none bg-slate-950 shadow-md relative", getChampionClassColors(fight.attackerClass).border)}>
                                                            <AvatarImage src={fight.attackerImageUrl} />
                                                            <AvatarFallback className="text-xs font-black">
                                                                {fight.attackerName.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {fight.isAttackerTactic && (
                                                            <div className="absolute -top-1 -left-1 bg-emerald-950/90 rounded-full border border-emerald-500 flex items-center justify-center w-4 h-4 shadow-lg shadow-black z-10">
                                                                <Swords className="w-2 h-2 text-emerald-400" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="mx-3 flex flex-col items-center">
                                                        <span className="text-[10px] font-black text-slate-600 uppercase">VS</span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", getChampionClassColors(fight.defenderClass).bg)} />
                                                            <Avatar className={cn("h-10 w-10 border-none bg-slate-950 shadow-md relative", getChampionClassColors(fight.defenderClass).border)}>
                                                                <AvatarImage src={fight.defenderImageUrl} />
                                                                <AvatarFallback className="text-xs font-black">
                                                                    {fight.defenderName.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {fight.isDefenderTactic && (
                                                                <div className="absolute -top-1 -left-1 bg-red-950/90 rounded-full border border-red-500 flex items-center justify-center w-4 h-4 shadow-lg shadow-black z-10">
                                                                    <Shield className="w-2 h-2 text-red-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            "text-sm font-black uppercase italic tracking-tighter pr-2",
                                                            getChampionClassColors(fight.defenderClass).text
                                                        )}>
                                                            {fight.defenderName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center">
                                                    {fight.deaths > 0 ? (
                                                        <div className="flex items-center gap-1.5 text-red-400 text-sm font-black uppercase italic tracking-tighter">
                                                            <Skull className="w-3.5 h-3.5" />
                                                            {fight.deaths} Death{fight.deaths > 1 ? "s" : ""}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-emerald-500 text-sm font-black uppercase italic tracking-tighter">
                                                            <Trophy className="w-3.5 h-3.5" />
                                                            Solo
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {fight.videoId && (
                                                    <Link 
                                                        href={`/war-videos/${fight.videoId}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="p-2 ml-2 bg-sky-600/20 border border-sky-600/50 rounded-full hover:bg-sky-600 text-sky-300 hover:text-white transition-all duration-300 group/video shadow-md shadow-sky-500/10 hover:shadow-sky-500/30"
                                                        title="Watch Fight Video"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Video className="w-4 h-4 group-hover/video:scale-110 transition-transform" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-800/60 bg-slate-950 relative z-50 shrink-0 flex justify-end">
            <DialogClose asChild>
                <button 
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-6 py-2 rounded-lg text-sm font-black uppercase tracking-[0.2em] text-slate-400 transition-all hover:text-white"
                >
                    Close Log
                </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
  );
}

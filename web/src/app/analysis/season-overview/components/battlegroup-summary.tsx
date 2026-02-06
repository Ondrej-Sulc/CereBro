import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { useMemo } from "react";
import { PlayerStats } from "../types";

interface BattlegroupSummaryProps {
  allPlayers: PlayerStats[];
  bgColors: { 1: string; 2: string; 3: string };
  selectedBg: 1 | 2 | 3 | null;
  onSelectBg: (bg: 1 | 2 | 3 | null) => void;
}

export function BattlegroupSummary({ allPlayers, bgColors, selectedBg, onSelectBg }: BattlegroupSummaryProps) {
  const bgStats = useMemo(() => {
    const stats = {
      1: { fights: 0, deaths: 0, players: 0, pathDeaths: 0, miniBossDeaths: 0, bossDeaths: 0 },
      2: { fights: 0, deaths: 0, players: 0, pathDeaths: 0, miniBossDeaths: 0, bossDeaths: 0 },
      3: { fights: 0, deaths: 0, players: 0, pathDeaths: 0, miniBossDeaths: 0, bossDeaths: 0 },
    };
    allPlayers.forEach(p => {
      if (p.battlegroup >= 1 && p.battlegroup <= 3) {
        const bg = p.battlegroup as 1|2|3;
        stats[bg].fights += p.fights;
        stats[bg].deaths += p.deaths;
        stats[bg].players += 1;
        stats[bg].pathDeaths += p.pathDeaths;
        stats[bg].miniBossDeaths += p.miniBossDeaths;
        stats[bg].bossDeaths += p.bossDeaths;
      }
    });
    return stats;
  }, [allPlayers]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/60 border-b border-slate-800/60 bg-slate-900/20">
      {[1, 2, 3].map((bgNum) => {
          const bg = bgNum as 1|2|3;
          const stat = bgStats[bg];
          const accent = bgColors[bg];
          const soloRate = stat.fights > 0 ? ((stat.fights - stat.deaths) / stat.fights) * 100 : 0;
          const isSelected = selectedBg === bg;
          const isDimmed = selectedBg !== null && !isSelected;
          
          return (
              <div 
                  key={bg}
                  onClick={() => onSelectBg(selectedBg === bg ? null : bg)}
                  className={cn(
                      "p-4 flex items-center justify-between group/bg transition-all duration-300 relative overflow-hidden cursor-pointer",
                      isSelected ? "bg-slate-900/60 ring-1 ring-inset ring-white/10" : "hover:bg-slate-900/40",
                      isDimmed ? "opacity-40 grayscale-[0.5]" : "opacity-100"
                  )}
              >
                  <div className="absolute top-0 left-0 w-1 h-full opacity-50 transition-opacity group-hover/bg:opacity-100" style={{ backgroundColor: accent }} />
                  <div className="flex flex-col gap-1">
                      <h3 className="font-black italic uppercase tracking-tighter text-sm flex items-center gap-2 text-slate-400">
                          <Users className="w-4 h-4" style={{ color: accent }} />
                          Battlegroup {bg}
                      </h3>
                      <div className="flex items-baseline gap-2">
                          <span className={cn(
                              "text-2xl font-black italic font-mono leading-none",
                              soloRate >= 95 ? "text-emerald-400" : soloRate >= 80 ? "text-slate-200" : "text-amber-500"
                          )}>
                              {soloRate.toFixed(1)}%
                          </span>
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Efficiency</span>
                      </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                       <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-slate-600 uppercase leading-none mb-0.5">Path</span>
                              <span className={cn("text-sm font-mono font-black", stat.pathDeaths > 0 ? "text-red-400" : "text-slate-500")}>{stat.pathDeaths}</span>
                          </div>
                          <div className="w-px h-6 bg-slate-800/60" />
                          <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-slate-600 uppercase leading-none mb-0.5">MB</span>
                              <span className={cn("text-sm font-mono font-black", stat.miniBossDeaths > 0 ? "text-red-400" : "text-slate-500")}>{stat.miniBossDeaths}</span>
                          </div>
                          <div className="w-px h-6 bg-slate-800/60" />
                          <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-slate-600 uppercase leading-none mb-0.5">Boss</span>
                              <span className={cn("text-sm font-mono font-black", stat.bossDeaths > 0 ? "text-red-400" : "text-slate-500")}>{stat.bossDeaths}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-2 bg-slate-950/40 rounded px-2 py-1 border border-slate-800/40">
                          <span className="text-[10px] font-black text-slate-500 uppercase">Total Deaths</span>
                          <span className="text-sm font-mono font-black text-red-400 leading-none">{stat.deaths}</span>
                      </div>
                  </div>
              </div>
          );
      })}
    </div>
  );
}

import { useState, useEffect, memo } from "react";
import { War } from "@prisma/client";
import { HistoricalFightStat, getHistoricalCounters } from "@/app/planning/history-actions";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronRight, PlayCircle, Settings2, Users } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface NodeHistoryProps {
  nodeId: number | null;
  defenderId?: number;
  currentWar?: War;
  filters: {
    onlyCurrentTier: boolean;
    onlyAlliance: boolean;
    minSeason: number | undefined;
  };
  onFiltersChange: React.Dispatch<React.SetStateAction<{
    onlyCurrentTier: boolean;
    onlyAlliance: boolean;
    minSeason: number | undefined;
  }>>;
  cache: React.MutableRefObject<Map<string, HistoricalFightStat[]>>;
}

export function NodeHistory({
  nodeId,
  defenderId,
  currentWar,
  filters,
  onFiltersChange,
  cache,
}: NodeHistoryProps) {
  const [history, setHistory] = useState<HistoricalFightStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch history when defender changes (with debounce and cache)
  useEffect(() => {
    if (!nodeId || !defenderId) {
      setHistory([]);
      return;
    }

    const filtersKey = JSON.stringify(filters);
    const cacheKey = `${nodeId}-${defenderId}-${filtersKey}`;

    if (cache.current.has(cacheKey)) {
      setHistory(cache.current.get(cacheKey)!);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const stats = await getHistoricalCounters(nodeId, defenderId, {
          minTier: filters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
          maxTier: filters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
          allianceId: filters.onlyAlliance && currentWar?.allianceId ? currentWar.allianceId : undefined,
          minSeason: filters.minSeason,
        });
        cache.current.set(cacheKey, stats);
        setHistory(stats);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [nodeId, defenderId, filters, currentWar, cache]);

  if (!defenderId) return null;

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Historical Matchups</h4>
        <div className="flex items-center gap-2">
          {isLoading && <span className="text-xs text-muted-foreground font-normal">Loading...</span>}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Settings2 className="h-4 w-4 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-950 border-slate-800 p-4" align="end">
              <h5 className="font-semibold mb-3 text-sm">History Filters</h5>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tier-filter"
                    checked={filters.onlyCurrentTier}
                    onCheckedChange={(c) => onFiltersChange(prev => ({ ...prev, onlyCurrentTier: !!c }))}
                  />
                  <Label htmlFor="tier-filter" className="text-sm font-normal cursor-pointer">
                    Current Tier Only {currentWar?.warTier ? `(T${currentWar.warTier})` : ''}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="alliance-filter"
                    checked={filters.onlyAlliance}
                    onCheckedChange={(c) => onFiltersChange(prev => ({ ...prev, onlyAlliance: !!c }))}
                  />
                  <Label htmlFor="alliance-filter" className="text-sm font-normal cursor-pointer">
                    My Alliance Only
                  </Label>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="min-season" className="text-xs text-muted-foreground">Min Season</Label>
                  <Input
                    id="min-season"
                    type="number"
                    placeholder="All time"
                    className="h-8 bg-slate-900 border-slate-800 text-xs no-spin-buttons"
                    value={filters.minSeason || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      onFiltersChange(prev => ({ ...prev, minSeason: val }));
                    }}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {history.length === 0 && !isLoading ? (
        <p className="text-xs text-muted-foreground">No history found for this defender on this node.</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {history.map((stat) => (
            <HistoricalRow key={stat.attackerId} stat={stat} />
          ))}
        </div>
      )}
    </div>
  );
}

const HistoricalRow = memo(function HistoricalRow({ stat }: { stat: HistoricalFightStat }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-md overflow-hidden">
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight className={cn("h-3 w-3 text-slate-500 transition-transform", expanded && "rotate-90")} />
          <div className="relative h-8 w-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
            <Image
              src={getChampionImageUrl(stat.attackerImages, '64')}
              alt={stat.attackerName}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="truncate">
            <div className="font-bold truncate text-xs">{stat.attackerName}</div>
            <div className="text-[10px] text-muted-foreground">{stat.totalFights} Fights</div>
            {/* Display Prefights */}
            {stat.prefightChampions && stat.prefightChampions.length > 0 && (
              <div className="flex -space-x-1 mt-1">
                {stat.prefightChampions.map((pf, idx) => (
                  <div key={idx} className="relative h-3 w-3 rounded-full ring-1 ring-slate-900 overflow-hidden bg-slate-800" title={pf.name}>
                    <Image
                      src={getChampionImageUrl(pf.images, '64')}
                      alt={pf.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-center w-8">
            <span className="font-bold text-emerald-400 text-xs">{stat.solos}</span>
            <span className="text-[8px] text-muted-foreground uppercase">Solos</span>
          </div>
          <div className="flex flex-col items-center w-8">
            <span className="font-bold text-red-400 text-xs">{stat.deaths}</span>
            <span className="text-[8px] text-muted-foreground uppercase">Deaths</span>
          </div>
          {(stat.sampleVideoInternalId || stat.sampleVideoUrl) && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (stat.sampleVideoInternalId) {
                  window.open(`/war-videos/${stat.sampleVideoInternalId}`, '_blank');
                } else if (stat.sampleVideoUrl) {
                  window.open(stat.sampleVideoUrl, '_blank');
                }
              }}
              className="ml-1 p-1 hover:bg-slate-700 rounded-full transition-colors text-amber-400 cursor-pointer"
              title="Watch Sample Video"
            >
              <PlayCircle className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {expanded && stat.players && stat.players.length > 0 && (
        <div className="border-t border-slate-800/50 bg-slate-950/30">
          {stat.players.map((player, idx) => (
            <div key={idx} className="flex items-center justify-between px-8 py-1.5 text-xs hover:bg-slate-800/30">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative w-4 h-4 rounded-full overflow-hidden bg-slate-800 shrink-0">
                  {player.avatar ? (
                    <Image
                      src={player.avatar}
                      alt={player.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <Users className="w-2.5 h-2.5 text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  )}
                </div>
                <span className="text-slate-300 truncate">{player.name}</span>
                {player.battlegroup && (
                  <span className={cn(
                    "px-1 py-0.5 rounded text-[9px] font-mono leading-none",
                    player.battlegroup === 1 ? "bg-red-900/30 text-red-400 border border-red-900/50" :
                      player.battlegroup === 2 ? "bg-green-900/30 text-green-400 border border-green-900/50" :
                        "bg-blue-900/30 text-blue-400 border border-blue-900/50"
                  )}>
                    BG{player.battlegroup}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {player.prefightChampions && player.prefightChampions.length > 0 && (
                  <div className="flex -space-x-1">
                    {player.prefightChampions.map((pf, i) => (
                      <div key={i} className="relative h-4 w-4 rounded-full ring-1 ring-slate-900 overflow-hidden bg-slate-800" title={pf.name}>
                        <Image
                          src={getChampionImageUrl(pf.images, '64')}
                          alt={pf.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 w-12 justify-end">
                  <span className={cn("font-medium", player.death === 0 ? "text-emerald-500" : "text-red-500")}>
                    {player.death === 0 ? "Solo" : `${player.death} Deaths`}
                  </span>
                </div>
                {player.videoId && (
                  <a
                    href={`/war-videos/${player.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-500/70 hover:text-amber-400"
                  >
                    <PlayCircle className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

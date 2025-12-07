import { War, WarStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, PanelRightClose, PanelRightOpen, Users, Ban, Plus, X, Share } from "lucide-react";
import { RightPanelState } from "../hooks/use-war-planning";
import PlanningTools from "../planning-tools";
import { Champion } from "@/types/champion";
import { PlayerWithRoster, SeasonBanWithChampion, WarBanWithChampion } from "@cerebro/core/data/war-planning/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { useState } from "react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WarHeaderProps {
  war: War;
  status: WarStatus;
  isUpdatingStatus: boolean;
  onToggleStatus: () => void;
  rightPanelState: RightPanelState;
  onToggleTools: () => void;
  players: PlayerWithRoster[];
  champions: Champion[];
  currentBattlegroup: number;
  isFullscreen: boolean;
  onTogglePlayerPanel?: () => void;
  isPlayerPanelOpen?: boolean;
  seasonBans: SeasonBanWithChampion[];
  warBans: WarBanWithChampion[];
  onAddWarBan: (championId: number) => Promise<void>;
  onRemoveWarBan: (banId: string) => Promise<void>;
  onAddExtra: (playerId: string, championId: number) => void;
  onDistribute: (battlegroup?: number) => void;
}

export function WarHeader({
  war,
  status,
  isUpdatingStatus,
  onToggleStatus,
  rightPanelState,
  onToggleTools,
  players,
  champions,
  currentBattlegroup,
  isFullscreen,
  onTogglePlayerPanel,
  isPlayerPanelOpen,
  seasonBans,
  warBans,
  onAddWarBan,
  onRemoveWarBan,
  onAddExtra,
  onDistribute
}: WarHeaderProps) {
  const [isBanPopoverOpen, setIsBanPopoverOpen] = useState(false);

  // Filter out champions already banned
  const availableChampions = champions.filter(c => 
    !warBans.some(b => b.championId === c.id) &&
    !seasonBans.some(b => b.championId === c.id)
  );

  return (
    <div className={cn(
       "flex flex-col gap-4 mb-4",
       isFullscreen && "hidden"
    )}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden">
           <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {war.enemyAlliance} <span className="text-lg font-normal text-muted-foreground whitespace-nowrap">AW S{war.season} War {war.warNumber} T{war.warTier}</span>
           </h1>
           {status === 'FINISHED' && (
               <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10">Finished</Badge>
           )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {/* Player Roster Toggle */}
          {onTogglePlayerPanel && (
              <div>
                  <Button 
                      variant={isPlayerPanelOpen ? "secondary" : "outline"} 
                      size="sm"
                      onClick={onTogglePlayerPanel}
                      className="gap-2"
                  >
                      <Users className="h-4 w-4" />
                      Players
                  </Button>
              </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Share className="h-4 w-4" /> Distribute
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDistribute()}>
                    Distribute All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDistribute(1)}>
                    Distribute BG1
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDistribute(2)}>
                    Distribute BG2
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDistribute(3)}>
                    Distribute BG3
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant={status === 'PLANNING' ? "destructive" : "outline"} 
            size="sm"
            onClick={onToggleStatus} 
            disabled={isUpdatingStatus}
            className="gap-2"
          >
            {status === 'PLANNING' ? (
                <>
                    <Lock className="h-4 w-4" /> Finish War
                </>
            ) : (
                <>
                    <Unlock className="h-4 w-4" /> Reopen War
                </>
            )}
          </Button>

          {/* Mobile Tools (Sheet) */}
          <div className="md:hidden">
            <PlanningTools 
              players={players} 
              champions={champions} 
              allianceId={war.allianceId}
              currentBattlegroup={currentBattlegroup}
              onAddExtra={onAddExtra}
            />
          </div>

          {/* Desktop Tools (Sidebar Toggle) */}
          <div className="hidden md:block">
            <Button variant="outline" onClick={onToggleTools} className="gap-2">
              {rightPanelState === 'tools' ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              Tools
            </Button>
          </div>
        </div>
      </div>

      {/* Bans Section */}
      <div className="flex items-center gap-4 py-2 border-t border-slate-800/50">
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
          <Ban className="h-4 w-4 text-red-500" />
          <span>Bans:</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Season Bans */}
          {seasonBans.map(ban => (
            <TooltipProvider key={ban.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative h-8 w-8 rounded-full overflow-hidden border-2 border-red-900/50 opacity-80 hover:opacity-100 transition-opacity">
                    <Image 
                      src={getChampionImageUrl(ban.champion.images, '64')}
                      alt={ban.champion.name}
                      fill
                      className="object-cover grayscale"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Lock className="h-3 w-3 text-white/70" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold text-red-400">Season Ban</p>
                  <p>{ban.champion.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}

          {/* War Bans */}
          {warBans.map(ban => (
             <TooltipProvider key={ban.id}>
             <Tooltip>
               <TooltipTrigger asChild>
                  <div className="group relative h-8 w-8 rounded-full overflow-hidden border-2 border-red-500 cursor-pointer">
                    <Image 
                      src={getChampionImageUrl(ban.champion.images, '64')}
                      alt={ban.champion.name}
                      fill
                      className="object-cover"
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onRemoveWarBan(ban.id)}
                    >
                      <X className="h-4 w-4 text-white" />
                    </div>
                  </div>
               </TooltipTrigger>
               <TooltipContent>
                 <p className="font-semibold text-red-400">War Ban</p>
                 <p>{ban.champion.name}</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>
          ))}

          {/* Add Ban Button */}
          {warBans.length < 5 && (
            <Popover open={isBanPopoverOpen} onOpenChange={setIsBanPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800">
                  <Plus className="h-4 w-4 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 w-64" align="start">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none text-sm">Add War Ban</h4>
                  <ChampionCombobox 
                    champions={availableChampions}
                    value=""
                    onSelect={(val) => {
                      if (val) {
                        onAddWarBan(parseInt(val));
                        setIsBanPopoverOpen(false);
                      }
                    }}
                    placeholder="Select champion..."
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}

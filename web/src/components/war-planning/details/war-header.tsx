import { War, WarStatus, Tag, WarResult, WarMapType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, PanelRightClose, PanelRightOpen, Ban, Plus, X, Share, ChevronLeft, Pencil, Trophy, XCircle, Loader2 } from "lucide-react";
import { RightPanelState } from "../hooks/use-war-planning";
import PlanningTools from "../planning-tools";
import { Champion } from "@/types/champion";
import { PlayerWithRoster, SeasonBanWithChampion, WarBanWithChampion } from "@cerebro/core/data/war-planning/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoPopover } from "@/components/ui/info-popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditWarDialog } from "../edit-war-dialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGuildChannels, DiscordChannel } from "@/app/planning/actions";

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
  activeTab: string;
  onTabChange: (tab: string) => void;
  isFullscreen: boolean;
  seasonBans: SeasonBanWithChampion[];
  warBans: WarBanWithChampion[];
  onAddWarBan: (championId: number) => Promise<void>;
  onRemoveWarBan: (banId: string) => Promise<void>;
  onAddExtra: (playerId: string, championId: number) => void;
  onDistribute: (battlegroup?: number, targetChannelId?: string) => void;
  assignedChampions?: { playerId: string; championId: number }[];
  activeTag?: Tag | null;
  isReadOnly?: boolean;
  bgColors?: Record<number, string>;
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
  activeTab,
  onTabChange,
  isFullscreen,
  seasonBans,
  warBans,
  onAddWarBan,
  onRemoveWarBan,
  onAddExtra,
  onDistribute,
  assignedChampions = [],
  activeTag,
  isReadOnly = false,
  bgColors
}: WarHeaderProps) {
  const { toast } = useToast();
  const [isBanPopoverOpen, setIsBanPopoverOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Share Dialog State
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  const handleOpenShareDialog = async () => {
    setIsShareDialogOpen(true);
    setSelectedChannel("");

    if (channels.length === 0) {
      setIsLoadingChannels(true);
      try {
        const fetched = await getGuildChannels(war.allianceId);
        setChannels(fetched);
      } catch (e) {
        toast({ title: "Failed to fetch channels", description: "Could not load Discord channels.", variant: "destructive" });
      } finally {
        setIsLoadingChannels(false);
      }
    }
  };

  const handleShareToChannel = () => {
    if (!selectedChannel) return;
    onDistribute(currentBattlegroup, selectedChannel);
    setIsShareDialogOpen(false);
  };

  // Filter out champions already banned
  const availableChampions = champions.filter(c =>
    !warBans.some(b => b.championId === c.id) &&
    !seasonBans.some(b => b.championId === c.id)
  );

  const getButtonStyle = (bgId: number, isActive: boolean) => {
    const color = bgColors?.[bgId];
    if (color && isActive) {
      return {
        backgroundColor: `${color}1A`, // 10% opacity
        color: color,
        borderColor: `${color}33`, // 20% opacity
        boxShadow: `0 0 0 1px ${color}33`
      };
    }
    return {};
  };

  return (
    <div className={cn(
      "flex flex-col gap-4",
      isFullscreen && "hidden"
    )}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/planning">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold truncate flex items-center gap-2">
            {war.name || war.enemyAlliance}
            <span className="text-lg font-normal text-muted-foreground whitespace-nowrap">AW S{war.season} {war.warNumber ? `War ${war.warNumber}` : 'Off-Season'} T{war.warTier}</span>
            {war.name && war.enemyAlliance && (
              <span className="text-sm font-normal text-slate-500 italic truncate hidden lg:inline">({war.enemyAlliance})</span>
            )}
            {!isReadOnly && (
              <EditWarDialog
                war={war}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                isFinished={status === 'FINISHED'}
                trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 shrink-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
            )}
          </h1>
          {status === 'FINISHED' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10">Finished</Badge>
              {war.result !== WarResult.UNKNOWN && (
                <Badge variant="outline" className={cn(
                  "border-none px-2 py-0.5",
                  war.result === WarResult.WIN ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {war.result === WarResult.WIN ? (
                    <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> Win</span>
                  ) : (
                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Loss</span>
                  )}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {!isReadOnly && (
            <>
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 rounded-r-none border-r-0 pr-2">
                      <Share className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDistribute()}>
                      Share All
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDistribute(1)}>
                      Share BG1
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDistribute(2)}>
                      Share BG2
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDistribute(3)}>
                      Share BG3
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenShareDialog(); }}>
                      Share to Channel...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <InfoPopover
                  className="h-8 w-8 border border-input border-l-0 rounded-r-md rounded-l-none bg-background hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-colors"
                  iconClassName="text-foreground/80"
                  content={
                    <div className="space-y-2">
                      <h4 className="font-medium">Share Options</h4>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        <li>
                          <span className="text-white font-medium">To Channel:</span> Posts just the overview map. Best for drafts/previews.
                        </li>
                        <li>
                          <span className="text-white font-medium">All / BG:</span> Distributes the full plan (overview + player maps) via private threads.
                        </li>
                      </ul>
                    </div>
                  }
                />
              </div>

              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share War Plan</DialogTitle>
                    <DialogDescription>
                      Select a Discord channel to share the War Plan Overview map to.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    {isLoadingChannels ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading channels...
                      </div>
                    ) : (
                      <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a channel..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {channels.map(c => (
                            <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleShareToChannel} disabled={!selectedChannel || isLoadingChannels}>Share</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {!isReadOnly && (
            <Button
              variant={status === 'PLANNING' ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleStatus}
              disabled={isUpdatingStatus}
              className="gap-2"
            >
              {status === 'PLANNING' ? (
                <>
                  <Lock className="h-4 w-4" /> <span className="hidden sm:inline">Finish War</span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" /> <span className="hidden sm:inline">Reopen War</span>
                </>
              )}
            </Button>
          )}

          {/* Mobile Tools (Sheet) */}
          <div className="md:hidden">
            <PlanningTools
              players={players}
              champions={champions}
              allianceId={war.allianceId}
              currentBattlegroup={currentBattlegroup}
              onAddExtra={onAddExtra}
              assignedChampions={assignedChampions}
              activeTag={activeTag}
              isReadOnly={isReadOnly}
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

      {/* Bans Section & BG Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2 border-t border-slate-800/50">
        <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium shrink-0">
            <Ban className="h-4 w-4 text-red-500" />
            <span>Bans:</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Season Bans */}
            {seasonBans.map(ban => (
              <TooltipProvider key={ban.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative h-8 w-8 rounded-full overflow-hidden border-2 border-red-900/50 opacity-80 hover:opacity-100 transition-opacity shrink-0">
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
                    <div className="group relative h-8 w-8 rounded-full overflow-hidden border-2 border-red-500 cursor-pointer shrink-0">
                      <Image
                        src={getChampionImageUrl(ban.champion.images, '64')}
                        alt={ban.champion.name}
                        fill
                        className="object-cover"
                      />
                      {!isReadOnly && (
                        <div
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onRemoveWarBan(ban.id)}
                        >
                          <X className="h-4 w-4 text-white" />
                        </div>
                      )}
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
            {!isReadOnly && warBans.length < 5 && (
              <Popover open={isBanPopoverOpen} onOpenChange={setIsBanPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800 shrink-0">
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

        {/* BG Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 mx-auto">
          <button
            onClick={() => onTabChange('bg1')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all border border-transparent",
              !bgColors && activeTab === 'bg1'
                ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            )}
            style={getButtonStyle(1, activeTab === 'bg1')}
          >
            BG 1
          </button>
          <button
            onClick={() => onTabChange('bg2')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all border border-transparent",
              !bgColors && activeTab === 'bg2'
                ? "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            )}
            style={getButtonStyle(2, activeTab === 'bg2')}
          >
            BG 2
          </button>
          <button
            onClick={() => onTabChange('bg3')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all border border-transparent",
              !bgColors && activeTab === 'bg3'
                ? "bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            )}
            style={getButtonStyle(3, activeTab === 'bg3')}
          >
            BG 3
          </button>
        </div>
      </div>
    </div>
  );
}

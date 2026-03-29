import { War, WarStatus, Tag, WarResult, WarMapType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, PanelRightClose, PanelRightOpen, Ban, Plus, X, Share, ChevronLeft, Pencil, Trophy, XCircle, Loader2, AlertTriangle, Download, Copy, Send, Hash, Users, FileOutput } from "lucide-react";
import { RightPanelState, WarProgress } from "../hooks/use-war-planning";
import PlanningTools from "../planning-tools";
import { Champion } from "@/types/champion";
import { PlayerWithRoster, SeasonBanWithChampion, WarBanWithChampion } from "@cerebro/core/data/war-planning/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getChampionImageUrl, getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditWarDialog } from "../edit-war-dialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGuildChannels, DiscordChannel, getWarMapPng } from "@/app/planning/actions";

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
  warProgress?: WarProgress | null;
  onCopyBgText?: () => void;
  onCopyBgMarkdown?: () => void;
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
  bgColors,
  warProgress,
  onCopyBgText,
  onCopyBgMarkdown
}: WarHeaderProps) {
  const { toast } = useToast();
  const [isBanPopoverOpen, setIsBanPopoverOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Share Dialog State
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  // Share Warning State
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<{ bg?: number, channelId?: string } | null>(null);
  const [warningMessage, setWarningMessage] = useState<React.ReactNode>("");

  const checkProgressAndShare = (bg?: number, channelId?: string) => {
      if (!warProgress) {
          // If progress isn't loaded yet, just proceed
          onDistribute(bg, channelId);
          return;
      }

      const incompleteBgs: { bg: number, missing: number[] }[] = [];

      if (bg) {
          if (warProgress[bg] && warProgress[bg].planned < warProgress[bg].total) {
              incompleteBgs.push({ bg, missing: warProgress[bg].missingNodes });
          }
      } else {
          [1, 2, 3].forEach(b => {
              if (warProgress[b] && warProgress[b].planned < warProgress[b].total) {
                  incompleteBgs.push({ bg: b, missing: warProgress[b].missingNodes });
              }
          });
      }

      if (incompleteBgs.length > 0) {
          const message = (
              <div className="space-y-4">
                  <p>You are about to share an incomplete plan. The following battlegroups have fights without assigned attackers or players:</p>
                  <ul className="list-disc pl-5 space-y-1">
                      {incompleteBgs.map(info => (
                          <li key={info.bg}>
                              <strong>BG{info.bg}:</strong> Missing on nodes {info.missing.slice(0, 10).join(', ')}
                              {info.missing.length > 10 ? '...' : ''}
                          </li>
                      ))}
                  </ul>
                  <p>Are you sure you want to distribute it anyway?</p>
              </div>
          );
          setWarningMessage(message);
          setPendingShare({ bg, channelId });
          setIsWarningDialogOpen(true);
      } else {
          onDistribute(bg, channelId);
      }
  };

  const confirmShare = () => {
      if (pendingShare) {
          onDistribute(pendingShare.bg, pendingShare.channelId);
      }
      setIsWarningDialogOpen(false);
      setPendingShare(null);
      setWarningMessage("");
  };

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
    setIsShareDialogOpen(false);
    checkProgressAndShare(currentBattlegroup, selectedChannel);
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadMap = async (bg?: number) => {
    try {
      setIsDownloading(true);
      const targetBg = bg || currentBattlegroup;
      const base64 = await getWarMapPng(war.id, targetBg);
      
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${base64}`;
      link.download = `war-map-bg${targetBg}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Map Downloaded",
        description: `Battlegroup ${targetBg} overview map has been generated and downloaded.`,
      });
    } catch (e) {
      toast({
        title: "Download Failed",
        description: "Could not generate map image.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
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

  const getTabContent = (bg: number, label: string) => {
    if (!warProgress) return label;
    const progress = warProgress[bg];
    if (!progress || progress.total === 0) return label;

    const isComplete = progress.planned === progress.total;
    const isActive = activeTab === `bg${bg}`;
    
    return (
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <span className={cn(
          "text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1",
          isComplete 
            ? (isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-500/70") 
            : (isActive ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/10 text-amber-500/70")
        )}>
          {progress.planned}/{progress.total}
        </span>
      </div>
    );
  };

  return (
    <div className={cn(
      "flex flex-col gap-4",
      isFullscreen && "hidden"
    )}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
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

        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          {!isReadOnly && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Share className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold py-1.5">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current shrink-0">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.014.042.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Discord
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => checkProgressAndShare()}>
                    <Users className="h-4 w-4 mr-2 text-indigo-400" />
                    Distribute to All Members
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => checkProgressAndShare(1)}>
                    <Send className="h-4 w-4 mr-2 text-indigo-400" />
                    Distribute BG1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => checkProgressAndShare(2)}>
                    <Send className="h-4 w-4 mr-2 text-indigo-400" />
                    Distribute BG2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => checkProgressAndShare(3)}>
                    <Send className="h-4 w-4 mr-2 text-indigo-400" />
                    Distribute BG3
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenShareDialog(); }}>
                    <Hash className="h-4 w-4 mr-2 text-indigo-400" />
                    Post to Channel...
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold py-1.5">
                    <FileOutput className="h-3.5 w-3.5 shrink-0" />
                    Export
                  </DropdownMenuLabel>
                  {onCopyBgText && (
                    <DropdownMenuItem onClick={onCopyBgText}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy BG{currentBattlegroup} Plan (Text)
                    </DropdownMenuItem>
                  )}
                  {onCopyBgMarkdown && (
                    <DropdownMenuItem onClick={onCopyBgMarkdown}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy BG{currentBattlegroup} Plan (Markdown)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDownloadMap()} disabled={isDownloading}>
                    {isDownloading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin text-sky-400" /> Generating Map...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Download BG{currentBattlegroup} Map (PNG)</>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={isWarningDialogOpen} onOpenChange={setIsWarningDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="h-5 w-5" />
                            Incomplete Plan Warning
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 text-sm text-slate-300">
                        {warningMessage}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWarningDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmShare}>Distribute Anyway</Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

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
          <div className="lg:hidden">
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
          <div className="hidden lg:block">
            <Button variant="outline" onClick={onToggleTools} className="gap-2">
              {rightPanelState === 'tools' ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              Tools
            </Button>
          </div>
        </div>
      </div>

      {/* Bans Section & BG Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2 border-t border-slate-800/50">
        <div className="flex items-center gap-4 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
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
                        src={getChampionImageUrlOrPlaceholder(ban.champion.images, '64')}
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
                        src={getChampionImageUrlOrPlaceholder(ban.champion.images, '64')}
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
            {getTabContent(1, "BG 1")}
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
            {getTabContent(2, "BG 2")}
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
            {getTabContent(3, "BG 3")}
          </button>
        </div>
      </div>
    </div>
  );
}

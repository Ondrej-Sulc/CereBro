'use client';

import { Player } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    updatePlayerRole,
    updateAllianceColors,
    updateAlliancePalette,
    removeMember,
    leaveAlliance,
    respondToMembershipRequest,
    invitePlayerToAlliance,
    generateAllianceLinkCode,
    updateAllianceSettings,
    updateAllianceGeneral,
    getAllianceDiscordOptions,
    updateAllianceDiscordConfig,
    type AllianceDiscordConfig,
    type DiscordChannelOption,
    type DiscordRoleOption,
} from "../actions/alliance";
import { PALETTES, PALETTE_LABELS, PALETTE_DESCRIPTIONS, DEFAULT_PALETTE_STYLE, PlayerPaletteStyle } from "@/lib/player-colors";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowUpRight, Bot, Check, ChevronDown, ClipboardList, Clock, Crown, Ellipsis, Heart, HelpCircle, LayoutGrid, Link as LinkIcon, List, LogOut, Palette, Plus, RotateCcw, Settings, Shield, SlidersHorizontal, Sparkles, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/alliance/ColorPicker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { ALLIANCE_UNLOCK_THRESHOLD_MINOR } from "@cerebro/core/services/rosterScreenshotQuotaService";
import { DiscordConfigForm } from "@/components/alliance/discord-config-form";
import type { UserPlayerWithAlliance } from "@/lib/auth-helpers";
import { getActionErrorMessage } from "@/lib/action-errors";
import { AllianceMemberSearch } from "./member-search";
import { AllianceMemberList, AllianceMemberListSort, type MemberListSort } from "./member-list";
import { AllianceDialogContent, allianceDialogTabClass, allianceDialogTabsClass } from "./alliance-dialog";
import { RecruitDialog } from "./recruit-dialog";

interface MembershipRequest {
    id: string;
    status: string;
    type: string;
    createdAt: Date;
    player: Player;
}

interface AllianceWithRequests {
    id: string;
    name: string;
    tag: string | null;
    description: string | null;
    inviteOnly: boolean;
    guildId: string | null;
    battlegroup1Color: string;
    battlegroup2Color: string;
    battlegroup3Color: string;
    playerColorPalette: string;
    membershipRequests: MembershipRequest[];
    linkCode: string | null;
    linkCodeExpires: Date | null;
    removeMissingMembers: boolean;
    syncRolesFromDiscord: boolean;
    officerRole: string | null;
    plannerRole: string | null;
    battlegroup1Role: string | null;
    battlegroup2Role: string | null;
    battlegroup3Role: string | null;
    warVideosChannelId: string | null;
    deathChannelId: string | null;
    battlegroup1ChannelId: string | null;
    battlegroup2ChannelId: string | null;
    battlegroup3ChannelId: string | null;
    screenshotUnlock?: {
        currentMonthMinor: number;
        thresholdMinor: number;
        unlocked: boolean;
    };
}

type PlayerWithRoster = Player & {
    _count: { roster: number };
    rosterLastUpdatedAt: Date | string | null;
    isSupporter?: boolean;
};

interface ClientPageProps {
    members: PlayerWithRoster[];
    currentUser: UserPlayerWithAlliance;
    alliance: AllianceWithRequests;
}

const STALE_ROSTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDaysSince(date: Date | string | null): number | null {
    if (!date) return null;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / MS_PER_DAY));
}

// Uses Roster.updatedAt, so this is a roster-row freshness hint, not a strict content audit.
function getRosterFreshness(player: PlayerWithRoster) {
    if ((player._count?.roster ?? 0) === 0) {
        return { state: "missing" as const, label: "No roster" };
    }

    const days = getDaysSince(player.rosterLastUpdatedAt);
    if (days === null) {
        return { state: "unknown" as const, label: "Update date unknown" };
    }

    return {
        state: days >= STALE_ROSTER_DAYS ? "stale" as const : "fresh" as const,
        label: days === 0 ? "Updated today" : `Updated ${days}d ago`,
    };
}

function averagePrestige(players: PlayerWithRoster[]) {
    const scores = players.flatMap(player => player.championPrestige ?? []);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
}

export function AllianceManagementClient({ members, currentUser, alliance }: ClientPageProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRoleHelpOpen, setIsRoleHelpOpen] = useState(false);
    const moreAllianceActions = useRef<HTMLButtonElement>(null);

    const canManageAlliance = currentUser.isOfficer || currentUser.isBotAdmin;
    const screenshotUnlock = alliance.screenshotUnlock ?? {
        currentMonthMinor: 0,
        thresholdMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
        unlocked: false,
    };
    const screenshotUnlockPercent = Math.min(
        Math.floor((screenshotUnlock.currentMonthMinor / screenshotUnlock.thresholdMinor) * 100),
        100
    );
    const screenshotUnlockRemainingMinor = Math.max(
        screenshotUnlock.thresholdMinor - screenshotUnlock.currentMonthMinor,
        0
    );
    const formatEuroMinor = (amountMinor: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amountMinor / 100);

    const battlegroupColors = {
        bg1: alliance.battlegroup1Color || "#ef4444",
        bg2: alliance.battlegroup2Color || "#22c55e",
        bg3: alliance.battlegroup3Color || "#3b82f6",
    };
    const [colors, setColors] = useState(battlegroupColors);
    const [isSavingTheme, setIsSavingTheme] = useState(false);
    const isValidPalette = (v: string): v is PlayerPaletteStyle => (Object.keys(PALETTES) as string[]).includes(v);
    const [selectedPalette, setSelectedPalette] = useState<PlayerPaletteStyle>(
        isValidPalette(alliance.playerColorPalette) ? alliance.playerColorPalette : DEFAULT_PALETTE_STYLE
    );
    const [sortBy, setSortBy] = useState<'name' | 'prestige'>('name');
    const [memberView, setMemberView] = useState<"board" | "list">("board");
    const [listSort, setListSort] = useState<MemberListSort>("name");
    const [memberSearch, setMemberSearch] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<number | null | "all">("all");
    const memberSearchInput = useRef<HTMLInputElement>(null);

    // General Settings
    const [generalName, setGeneralName] = useState(alliance.name);
    const [generalTag, setGeneralTag] = useState(alliance.tag ?? '');
    const [generalDescription, setGeneralDescription] = useState(alliance.description ?? '');
    const [generalInviteOnly, setGeneralInviteOnly] = useState(alliance.inviteOnly);
    const [isSavingGeneral, setIsSavingGeneral] = useState(false);

    const handleSaveGeneral = async () => {
        if (!generalName.trim()) {
            toast({ title: "Validation Error", description: "Alliance name cannot be empty.", variant: "destructive" });
            return;
        }
        if (generalTag && (generalTag.length < 2 || generalTag.length > 5)) {
            toast({ title: "Validation Error", description: "Alliance tag must be between 2 and 5 characters.", variant: "destructive" });
            return;
        }
        setIsSavingGeneral(true);
        try {
            await updateAllianceGeneral({
                name: generalName,
                tag: generalTag || null,
                description: generalDescription || null,
                inviteOnly: generalInviteOnly,
            });
            toast({ title: "Saved", description: "Alliance settings updated." });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to save settings";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setIsSavingGeneral(false);
        }
    };

    // Discord Sync Settings
    const [removeMissingMembers, setRemoveMissingMembers] = useState(alliance.removeMissingMembers);
    const [syncRolesFromDiscord, setSyncRolesFromDiscord] = useState(alliance.syncRolesFromDiscord);
    const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
    const [discordConfig, setDiscordConfig] = useState<AllianceDiscordConfig | null>(null);
    const [discordRoles, setDiscordRoles] = useState<DiscordRoleOption[]>([]);
    const [discordChannels, setDiscordChannels] = useState<DiscordChannelOption[]>([]);
    const [isLoadingDiscordConfig, setIsLoadingDiscordConfig] = useState(false);
    const [isSavingDiscordConfig, setIsSavingDiscordConfig] = useState(false);
    const [discordConfigError, setDiscordConfigError] = useState<string | null>(null);

    useEffect(() => {
        if (!isSettingsOpen || !alliance.guildId || !canManageAlliance || discordConfig) return;

        let cancelled = false;
        setIsLoadingDiscordConfig(true);
        setDiscordConfigError(null);

        getAllianceDiscordOptions()
            .then((result) => {
                if (cancelled) return;
                if (!result.success) {
                    setDiscordConfigError(result.error.message);
                    toast({
                        title: "Failed to load Discord configuration",
                        description: result.error.message,
                        variant: "destructive",
                    });
                    return;
                }
                setDiscordConfig(result.config);
                setDiscordRoles(result.roles);
                setDiscordChannels(result.channels);
            })
            .catch((error: unknown) => {
                const message = getActionErrorMessage(
                    error,
                    "Could not load Discord configuration. Please try again."
                );
                if (!cancelled) {
                    setDiscordConfigError(message);
                    toast({ title: "Failed to load Discord configuration", description: message, variant: "destructive" });
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingDiscordConfig(false);
            });

        return () => {
            cancelled = true;
        };
    }, [alliance.guildId, canManageAlliance, discordConfig, isSettingsOpen, toast]);

    const handleUpdateSettings = async (settings: { removeMissingMembers?: boolean; syncRolesFromDiscord?: boolean }) => {
        const previousRemoveMissingMembers = removeMissingMembers;
        const previousSyncRolesFromDiscord = syncRolesFromDiscord;
        const nextRemoveMissingMembers = settings.removeMissingMembers ?? removeMissingMembers;
        const nextSyncRolesFromDiscord = settings.syncRolesFromDiscord ?? syncRolesFromDiscord;

        setRemoveMissingMembers(nextRemoveMissingMembers);
        setSyncRolesFromDiscord(nextSyncRolesFromDiscord);
        setIsUpdatingSettings(true);
        try {
            await updateAllianceSettings({
                removeMissingMembers: nextRemoveMissingMembers,
                syncRolesFromDiscord: nextSyncRolesFromDiscord,
            });
            toast({ title: "Settings Updated", description: "Alliance sync policy has been updated." });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to update settings";
            toast({ title: "Error", description: message, variant: "destructive" });
            setRemoveMissingMembers(previousRemoveMissingMembers);
            setSyncRolesFromDiscord(previousSyncRolesFromDiscord);
        } finally {
            setIsUpdatingSettings(false);
        }
    };

    // Discord Linking
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [linkCode, setLinkCode] = useState(alliance.linkCode);
    const [linkExpires, setLinkExpires] = useState(alliance.linkCodeExpires);

    const handleGenerateLinkCode = async () => {
        setIsGeneratingCode(true);
        try {
            const { code, expires } = await generateAllianceLinkCode();
            setLinkCode(code);
            setLinkExpires(expires);
            toast({ title: "Link Code Generated", description: "Use this code in Discord to link your server." });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to generate code";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const handleInvite = async (playerId: string) => {
        setLoadingId(playerId);
        try {
            await invitePlayerToAlliance(playerId);
            toast({ title: "Invitation Sent", description: "Player has been invited to join." });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to invite player";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const handleRespondToRequest = async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
        setLoadingId(requestId);
        try {
            await respondToMembershipRequest(requestId, status);
            toast({ title: status === 'ACCEPTED' ? "Member Accepted" : "Request Rejected" });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to respond to request";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const handleKick = async (playerId: string) => {
        if (!confirm("Are you sure you want to remove this player?")) return;
        setLoadingId(playerId);
        try {
            await removeMember(playerId);
            toast({ title: "Member Removed" });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to remove member";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const handleLeave = async () => {
        if (!confirm("Are you sure you want to leave the alliance?")) return;
        try {
            await leaveAlliance();
            toast({ title: "Left Alliance" });
            router.push("/");
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to leave alliance";
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };

    const handleToggleOfficer = async (player: Player) => {
        setLoadingId(player.id);
        try {
            await updatePlayerRole(player.id, { isOfficer: !player.isOfficer });
            toast({ title: player.isOfficer ? "Officer Demoted" : "Member Promoted" });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to update role";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const handleSaveDiscordConfig = async (config: AllianceDiscordConfig) => {
        setIsSavingDiscordConfig(true);
        try {
            const result = await updateAllianceDiscordConfig(config);
            if (!result.success) {
                toast({ title: "Error", description: result.error.message, variant: "destructive" });
                return;
            }
            setDiscordConfig(config);
            toast({
                title: "Discord configuration saved",
                description: result.queuedRoleSync ? "Role sync has been queued." : undefined,
            });
        } catch (error: unknown) {
            const message = getActionErrorMessage(
                error,
                "Failed to save Discord configuration. Please try again."
            );
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setIsSavingDiscordConfig(false);
        }
    };

    const handleTogglePlanner = async (player: Player) => {
        setLoadingId(player.id);
        try {
            await updatePlayerRole(player.id, { isPlanner: !player.isPlanner });
            toast({ title: player.isPlanner ? "Planner Removed" : "Planner Granted" });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Failed to update role";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const handleSaveTheme = async () => {
        setIsSavingTheme(true);
        try {
            const [colorsResult, paletteResult] = await Promise.allSettled([
                updateAllianceColors(colors),
                updateAlliancePalette(selectedPalette),
            ]);
            const colorsFailed = colorsResult.status === 'rejected';
            const paletteFailed = paletteResult.status === 'rejected';
            if (!colorsFailed && !paletteFailed) {
                toast({ title: "Theme Saved", description: "Alliance theme changes saved." });
            } else if (colorsFailed && paletteFailed) {
                const msg = colorsResult.reason instanceof Error ? colorsResult.reason.message : "Failed to save theme.";
                toast({ title: "Error", description: msg, variant: "destructive" });
            } else {
                const failedPart = colorsFailed ? "battlegroup colors" : "player palette";
                toast({ title: "Partially Saved", description: `Theme saved but failed to update ${failedPart}.`, variant: "destructive" });
            }
        } finally {
            setIsSavingTheme(false);
        }
    };

    const handleBgChange = async (playerId: string, bg: string) => {
        setLoadingId(playerId);
        try {
            const bgValue = bg === "unassigned" ? null : parseInt(bg);
            // We pass undefined for isOfficer to only update battlegroup
            await updatePlayerRole(playerId, { battlegroup: bgValue });
            toast({ title: "Updated", description: "Player battlegroup updated." });
        } catch (e: unknown) {
            const error = e as Error;
            toast({ title: "Error", description: error.message || "Failed to update player.", variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const searchQuery = memberSearch.trim().toLocaleLowerCase();
    const matchesMemberSearch = (member: PlayerWithRoster) => selectedMemberId === null
        ? member.ingameName.toLocaleLowerCase().includes(searchQuery)
        : member.id === selectedMemberId;
    const unassignedCount = members.filter(member => !member.battlegroup).length;
    const activeGroup = selectedGroup === null && unassignedCount === 0 ? "all" : selectedGroup;
    const rosterCount = members.filter(member => member._count.roster > 0).length;
    const alliancePrestige = averagePrestige(members);
    const prestigeMemberCount = members.filter(member => member.championPrestige !== null).length;
    const freshnessByMember = new Map(members.map(member => [member.id, getRosterFreshness(member)]));
    const needsRosterAttention = (playerId: string) => {
        const state = freshnessByMember.get(playerId)?.state;
        return state === "missing" || state === "stale";
    };
    const membersNeedingAttention = members.filter(member => needsRosterAttention(member.id)).length;
    const pendingRequests = alliance.membershipRequests.filter(request => request.status === "PENDING" && request.type === "REQUEST");

    const battlegroups = [
        { id: 1, title: "Battlegroup 1", color: battlegroupColors.bg1 },
        { id: 2, title: "Battlegroup 2", color: battlegroupColors.bg2 },
        { id: 3, title: "Battlegroup 3", color: battlegroupColors.bg3 },
        { id: null, title: "Unassigned", color: "#94a3b8" },
    ].filter(group => group.id !== null || unassignedCount > 0).map(group => {
        const players = members.filter(member => (member.battlegroup || null) === group.id);
        const visiblePlayers = players.filter(matchesMemberSearch);
        visiblePlayers.sort(sortBy === "prestige"
            ? (a, b) => (b.championPrestige ?? 0) - (a.championPrestige ?? 0)
            : (a, b) => a.ingameName.localeCompare(b.ingameName, undefined, { sensitivity: "base" }));
        return {
            ...group,
            players: visiblePlayers,
            total: players.length,
            average: averagePrestige(players),
            supporterCount: players.filter(player => player.isSupporter).length,
            needsAttention: players.filter(player => needsRosterAttention(player.id)).length,
        };
    });
    const scopedGroups = activeGroup === "all" ? battlegroups : battlegroups.filter(group => group.id === activeGroup);
    const listMembers = memberView === "list" ? members.filter(member => (
        (activeGroup === "all" || (member.battlegroup || null) === activeGroup) && matchesMemberSearch(member)
    )) : [];
    const filteredMembers = memberView === "list" ? listMembers : scopedGroups.flatMap(group => group.players);
    const matchingMembers = filteredMembers.length;
    const visibleGroups = searchQuery ? scopedGroups.filter(group => group.players.length > 0) : scopedGroups;
    const groupColors = new Map(battlegroups.map(group => [group.id, group.color]));
    const activeListSort = !canManageAlliance && listSort.startsWith("roster-") ? "name" : listSort;
    const memberSuggestions = searchQuery && selectedMemberId === null ? filteredMembers
        .map(player => ({
            id: player.id,
            name: player.ingameName,
            group: player.battlegroup ? "Battlegroup " + player.battlegroup : "Unassigned",
            color: groupColors.get(player.battlegroup || null) ?? "#94a3b8",
        }))
        .sort((a, b) => Number(b.name.toLocaleLowerCase().startsWith(searchQuery)) - Number(a.name.toLocaleLowerCase().startsWith(searchQuery)) || a.name.localeCompare(b.name))
        .slice(0, 8) : [];

    const playerColorMap = useMemo(() => {
        const palette = PALETTES[selectedPalette] ?? PALETTES.DEFAULT;
        const sorted = [...members].sort((a, b) => {
            const bgA = a.battlegroup || 999;
            const bgB = b.battlegroup || 999;
            if (bgA !== bgB) return bgA - bgB;
            return a.ingameName.localeCompare(b.ingameName);
        });
        return new Map(sorted.map((player, index) => [player.id, palette[index % palette.length]]));
    }, [members, selectedPalette]);

    const renderMember = (player: PlayerWithRoster) => {
        const freshness = freshnessByMember.get(player.id);
        const needsAttention = needsRosterAttention(player.id);
        const FreshnessIcon = needsAttention ? AlertTriangle : Clock;
        const playerColor = player.isSupporter ? "#fbbf24" : playerColorMap.get(player.id) ?? "#94a3b8";
        const isUpdating = loadingId === player.id;

        return (
            <li key={player.id} className={cn("flex min-h-[3.75rem] min-w-0 items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-slate-800/45", isUpdating && "opacity-50")}>
                <Avatar className="h-9 w-9 shrink-0 rounded-xl border" style={{ borderColor: playerColor + "66" }}>
                    <AvatarImage src={player.avatar || undefined} />
                    <AvatarFallback className="rounded-xl bg-slate-800 text-xs font-semibold text-white" style={{ backgroundColor: playerColor + "24" }}>
                        {player.ingameName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Link href={"/player/" + player.id} title={player.ingameName} className="truncate rounded-sm text-sm font-semibold text-slate-100 transition-colors hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                            {player.ingameName}
                        </Link>
                        {player.isOfficer && <Crown role="img" aria-label="Officer" className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                        {player.isPlanner && <ClipboardList role="img" aria-label="Planner" className="h-3.5 w-3.5 shrink-0 text-sky-300" />}
                        {player.isSupporter && <Heart role="img" aria-label="Supporter" className="h-3.5 w-3.5 shrink-0 fill-amber-300/25 text-amber-300" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-slate-400">
                        <span className="whitespace-nowrap">
                            <span className="font-medium text-slate-300">{player.championPrestige?.toLocaleString("en-US") ?? "—"}</span> prestige
                        </span>
                        <span className="whitespace-nowrap">{player._count.roster.toLocaleString("en-US")} champs</span>
                        {canManageAlliance && freshness && (
                            <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px]", needsAttention ? "text-amber-300" : "text-slate-400")}>
                                <FreshnessIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {freshness.label}
                            </span>
                        )}
                    </div>
                </div>
                {canManageAlliance && (
                    <div className="flex shrink-0 items-center gap-0.5">
                        <Select disabled={isUpdating} onValueChange={value => handleBgChange(player.id, value)} value={player.battlegroup?.toString() || "unassigned"}>
                            <SelectTrigger aria-label={"Battlegroup for " + player.ingameName} className="h-9 w-auto gap-1.5 rounded-lg border-slate-700/80 bg-slate-950/60 px-2 text-xs text-slate-300 [&_svg]:h-3 [&_svg]:w-3">
                                <SelectValue>{player.battlegroup ? "BG " + player.battlegroup : "Unassigned"}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                <SelectItem value="1">BG 1</SelectItem>
                                <SelectItem value="2">BG 2</SelectItem>
                                <SelectItem value="3">BG 3</SelectItem>
                            </SelectContent>
                        </Select>
                        {player.id !== currentUser.id ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isUpdating} aria-label={"Manage " + player.ingameName} className="h-9 w-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                                        <Ellipsis className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900 text-slate-100">
                                    <DropdownMenuItem onSelect={() => handleToggleOfficer(player)}>
                                        {player.isOfficer ? "Demote from Officer" : "Promote to Officer"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleTogglePlanner(player)}>
                                        {player.isPlanner ? "Remove Planner" : "Grant Planner"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-800" />
                                    <DropdownMenuItem onSelect={() => handleKick(player.id)} className="text-red-300 focus:text-red-200">
                                        Kick Member
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : <span aria-hidden="true" className="w-8" />}
                    </div>
                )}
            </li>
        );
    };

    const renderBattlegroup = (group: (typeof battlegroups)[number]) => {
        const GroupIcon = group.id ? Shield : Users;
        const sectionId = group.id ? "battlegroup-" + group.id : "unassigned";
        const headingId = sectionId + "-title";
        const wide = activeGroup !== "all" || group.id === null || visibleGroups.length === 1;

        return (
            <section key={sectionId} id={sectionId} aria-labelledby={headingId} className={cn(
                "relative min-w-0 scroll-mt-20 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50",
                wide && "col-span-full"
            )}>
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: group.color }} />
                <div className="border-b border-slate-800/80 px-4 pb-3 pt-3.5" style={{ backgroundImage: "linear-gradient(145deg, " + group.color + "18, transparent 75%)" }}>
                    <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ color: group.color, borderColor: group.color + "40", backgroundColor: group.color + "15" }}>
                            <GroupIcon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <h3 id={headingId} className="min-w-0 text-base font-semibold tracking-tight text-white">{group.title}</h3>
                        <span className="ml-auto shrink-0 rounded-full border border-slate-700/80 bg-slate-950/40 px-2.5 py-1 text-xs tabular-nums text-slate-300">
                            {searchQuery && group.players.length !== group.total ? group.players.length + " / " : ""}{group.total} {group.total === 1 ? "member" : "members"}
                        </span>
                    </div>
                    {(group.average !== null || group.supporterCount > 0 || (canManageAlliance && group.needsAttention > 0)) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            {group.average !== null && <span><span className="font-semibold tabular-nums text-slate-200">{group.average.toLocaleString("en-US")}</span> avg. prestige</span>}
                            {group.supporterCount > 0 && <span title={group.supporterCount + " supporters"} className="inline-flex items-center gap-1 text-amber-300/90"><Heart className="h-3 w-3" aria-hidden="true" />{group.supporterCount}<span className="sr-only"> supporters</span></span>}
                            {canManageAlliance && group.needsAttention > 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{group.needsAttention} {group.needsAttention === 1 ? "needs" : "need"} review</span>
                            )}
                        </div>
                    )}
                </div>
                {group.players.length > 0 ? (
                    <ul className={cn(
                        "divide-y divide-slate-800/70",
                        wide && group.players.length > 1 && "md:grid md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-r md:[&>li]:border-slate-800/70",
                        wide && group.players.length > 2 && "xl:grid-cols-3"
                    )}>
                        {group.players.map(renderMember)}
                    </ul>
                ) : (
                    <p className="px-4 py-5 text-sm text-slate-400">
                        {group.id ? "No members assigned yet." : "No unassigned members."}
                    </p>
                )}
            </section>
        );
    };

    return (
        <div className="mx-auto max-w-[1440px] space-y-5 px-4 pb-12 pt-5 sm:space-y-7 sm:px-6 sm:pt-7 lg:px-8">
            <header className="overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0b1221] shadow-xl shadow-black/10 sm:rounded-3xl">
                <div className="relative isolate flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-5 xl:flex-row xl:items-center xl:justify-between">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_0%_0%,rgba(99,102,241,0.24),transparent_68%)]" />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 bg-[repeating-linear-gradient(135deg,transparent_0_21px,rgba(129,140,248,0.07)_21px_22px)] [mask-image:linear-gradient(to_left,black,transparent)]" />
                    <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                        <div aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-indigo-300/25 bg-indigo-400/15 text-indigo-100 shadow-inner shadow-indigo-300/10 sm:h-14 sm:w-14 sm:rounded-2xl">
                            <Shield className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={1.6} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200">Alliance overview</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                                <h1 className="max-w-full break-words text-[1.6rem] font-bold leading-tight tracking-tight text-white sm:text-4xl">{alliance.name}</h1>
                                {alliance.tag && <span className="rounded-md border border-indigo-300/20 bg-indigo-400/10 px-2 py-0.5 font-mono text-xs text-indigo-200">{alliance.tag}</span>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                {alliance.description && <p className="max-w-2xl break-words text-xs leading-relaxed text-slate-300 sm:text-sm">{alliance.description}</p>}
                                <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs", alliance.guildId ? "text-emerald-300" : "text-slate-400")}>
                                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                                    {alliance.guildId ? "Discord linked" : "Discord not linked"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button asChild className="h-10 rounded-lg bg-indigo-500 px-3 text-white hover:bg-indigo-400 focus-visible:ring-indigo-300 sm:px-4">
                            <Link href="/alliance/roster">
                                <span><span className="sr-only sm:not-sr-only">Alliance </span>Roster</span>
                                <ArrowUpRight aria-hidden="true" />
                            </Link>
                        </Button>
                            <Dialog open={isRoleHelpOpen} onOpenChange={setIsRoleHelpOpen}>
                                <DialogContent
                                    className="w-[calc(100%-2rem)] rounded-2xl border-slate-700 bg-slate-900 text-slate-200 sm:rounded-2xl"
                                    onCloseAutoFocus={event => {
                                        event.preventDefault();
                                        moreAllianceActions.current?.focus();
                                    }}
                                >
                                    <DialogHeader>
                                        <DialogTitle>Managing Roles & Permissions</DialogTitle>
                                        <DialogDescription className="text-slate-400">
                                            Troubleshooting assignment issues
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 text-sm">
                                        <p>
                                            When you change a player&apos;s Battlegroup here, CereBro attempts to update their roles in your Discord server automatically.
                                        </p>
                                        <div className="bg-yellow-950/20 border border-yellow-900/30 p-3 rounded-md space-y-2">
                                            <p className="font-semibold text-yellow-500">If updates fail:</p>
                                            <p className="text-slate-300">
                                                Ensure the <strong>CereBro</strong> bot role is placed <strong>HIGHER</strong> than the Officer and Battlegroup roles in your Discord Server Settings &gt; Roles list.
                                            </p>
                                            <p className="text-slate-400 text-xs">
                                                Discord prevents bots from managing roles that are above them in the hierarchy.
                                            </p>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {canManageAlliance && (
                                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" aria-label="Alliance settings" className="h-10 rounded-lg border-slate-700/80 bg-slate-950/45 px-2.5 text-slate-200 hover:bg-slate-800 sm:px-3">
                                            <Settings aria-hidden="true" />
                                            <span className="hidden sm:inline">Settings</span>
                                        </Button>
                                    </DialogTrigger>
                                    <AllianceDialogContent title="Alliance settings" description={alliance.name} icon={Settings}>
                                        <Tabs defaultValue="general" className="flex min-h-0 flex-col">
                                            <TabsList aria-label="Alliance settings" className={allianceDialogTabsClass}>
                                                <TabsTrigger value="general" className={allianceDialogTabClass}><SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" /> General</TabsTrigger>
                                                <TabsTrigger value="theme" className={allianceDialogTabClass}><Palette className="size-4 shrink-0" aria-hidden="true" /> Theme</TabsTrigger>
                                                <TabsTrigger value="discord" className={allianceDialogTabClass}><Bot className="size-4 shrink-0" aria-hidden="true" /> Discord</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="general" className="m-0 min-h-0 focus-visible:ring-inset data-[state=active]:flex data-[state=active]:flex-col">
                                                <form className="flex min-h-0 flex-col" onSubmit={event => {
                                                    event.preventDefault();
                                                    if (!isSavingGeneral) void handleSaveGeneral();
                                                }}>
                                                    <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
                                                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                                                            <div className="space-y-2">
                                                                <Label htmlFor="allianceName" className="text-slate-200">Alliance name</Label>
                                                                <Input id="allianceName" value={generalName} onChange={event => setGeneralName(event.target.value)} maxLength={50} className="rounded-lg border-slate-700 bg-slate-950/70" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="allianceTag" className="text-slate-200">Tag <span className="text-xs text-slate-400">(optional)</span></Label>
                                                                <Input id="allianceTag" value={generalTag} onChange={event => setGeneralTag(event.target.value.replace(/\s/g, "").slice(0, 5))} aria-describedby="alliance-tag-hint" placeholder="e.g. NOVA" className="rounded-lg border-slate-700 bg-slate-950/70 font-mono" />
                                                                <p id="alliance-tag-hint" className="text-xs text-slate-400">2–5 characters</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <Label htmlFor="allianceDescription" className="text-slate-200">Description <span className="text-xs text-slate-400">(optional)</span></Label>
                                                                <span className="text-xs tabular-nums text-slate-400">{generalDescription.length}/200</span>
                                                            </div>
                                                            <Textarea id="allianceDescription" value={generalDescription} onChange={event => setGeneralDescription(event.target.value)} maxLength={200} placeholder="Tell players about your alliance…" rows={3} className="rounded-lg border-slate-700 bg-slate-950/70" />
                                                        </div>
                                                        <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3.5">
                                                            <Shield className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden="true" />
                                                            <div className="min-w-0 flex-1">
                                                                <Label htmlFor="inviteOnly" className="text-slate-100">Invite only</Label>
                                                                <p id="alliance-invite-hint" className="mt-1 text-xs leading-relaxed text-slate-400">Only officers can invite new members. Players can’t submit new join requests.</p>
                                                            </div>
                                                            <Checkbox id="inviteOnly" checked={generalInviteOnly} onCheckedChange={checked => setGeneralInviteOnly(checked === true)} aria-describedby="alliance-invite-hint" className="mt-0.5 size-5 shrink-0 border-slate-500 data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-500 data-[state=checked]:text-white" />
                                                        </div>
                                                    </div>
                                                    <DialogFooter className="shrink-0 border-t border-slate-800 bg-slate-950/30 px-4 py-3 sm:px-6">
                                                        <Button type="submit" disabled={isSavingGeneral} className="w-full rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 sm:w-auto">
                                                            {isSavingGeneral ? "Saving…" : "Save settings"}
                                                        </Button>
                                                    </DialogFooter>
                                                </form>
                                            </TabsContent>

                                            <TabsContent value="theme" className="m-0 min-h-0 focus-visible:ring-inset data-[state=active]:flex data-[state=active]:flex-col">
                                                <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-6">
                                                    <section aria-labelledby="alliance-battlegroup-colors" className="space-y-2.5">
                                                        <h3 id="alliance-battlegroup-colors" className="text-sm font-semibold text-slate-100">Battlegroup colors</h3>
                                                        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
                                                            {(["bg1", "bg2", "bg3"] as const).map((key, index) => {
                                                                const color = colors[key];
                                                                const name = "Battlegroup " + (index + 1);
                                                                return (
                                                                    <div key={key} className="flex items-center gap-3 border-l-2 px-3 py-2.5 [&+div]:border-t [&+div]:border-t-slate-800" style={{ borderLeftColor: color }}>
                                                                        <Shield className="size-4 shrink-0" style={{ color }} aria-hidden="true" />
                                                                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-200">{name}</span>
                                                                        <div className="w-24 shrink-0 sm:w-32">
                                                                            <ColorPicker color={color} ariaLabel={name + " color"} onChange={newColor => setColors(current => ({ ...current, [key]: newColor }))} className="h-9 gap-2 rounded-lg px-2 sm:px-3" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </section>
                                                    <section aria-labelledby="alliance-war-palette" className="space-y-2.5">
                                                        <div>
                                                            <h3 id="alliance-war-palette" className="text-sm font-semibold text-slate-100">Player palette</h3>
                                                            <p className="mt-0.5 text-xs text-slate-400">Distinguish players on war maps.</p>
                                                        </div>
                                                        <div role="group" aria-label="Player palette" className="grid gap-2 sm:grid-cols-2">
                                                            {(Object.keys(PALETTES) as PlayerPaletteStyle[]).map(style => (
                                                                <button
                                                                    key={style}
                                                                    type="button"
                                                                    aria-pressed={selectedPalette === style}
                                                                    onClick={() => setSelectedPalette(style)}
                                                                    className={cn(
                                                                        "space-y-1.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                                                                        selectedPalette === style ? "border-indigo-400/50 bg-indigo-400/10" : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                                                                    )}
                                                                >
                                                                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-200">
                                                                        {PALETTE_LABELS[style]}
                                                                        {selectedPalette === style && <Check className="size-4 shrink-0 text-indigo-300" aria-hidden="true" />}
                                                                    </span>
                                                                    <span aria-hidden="true" className="flex overflow-hidden rounded-full">
                                                                        {PALETTES[style].map((color, index) => <span key={index} className="h-2 flex-1" style={{ backgroundColor: color }} />)}
                                                                    </span>
                                                                    <span className="block text-xs text-slate-400">{PALETTE_DESCRIPTIONS[style]}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </section>
                                                </div>
                                                <DialogFooter className="shrink-0 border-t border-slate-800 bg-slate-950/30 px-4 py-3 sm:px-6">
                                                    <Button onClick={handleSaveTheme} disabled={isSavingTheme} className="w-full rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 sm:w-auto">
                                                        {isSavingTheme ? "Saving…" : "Save theme"}
                                                    </Button>
                                                </DialogFooter>
                                            </TabsContent>

                                            <TabsContent value="discord" className="m-0 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 focus-visible:ring-inset sm:p-6">
                                                {alliance.guildId ? (
                                                    <>
                                                        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3.5">
                                                            <Check className="size-5 shrink-0 text-emerald-300" aria-hidden="true" />
                                                            <div>
                                                                <p className="text-sm font-medium text-emerald-100">Discord linked</p>
                                                                <p className="text-xs text-slate-300">Manage role sync and channel assignments below.</p>
                                                            </div>
                                                        </div>

                                                        <section aria-labelledby="alliance-discord-sync" className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                                                            <h3 id="alliance-discord-sync" className="text-sm font-semibold text-white">Sync from Discord</h3>
                                                            <div className="flex items-start gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <Label htmlFor="syncRolesFromDiscord" className="text-slate-200">Sync member roles</Label>
                                                                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                                                        Discord roles update CereBro officers, planners, battlegroups, and role-based membership.
                                                                    </p>
                                                                </div>
                                                                <Checkbox id="syncRolesFromDiscord" checked={syncRolesFromDiscord} onCheckedChange={checked => handleUpdateSettings({ syncRolesFromDiscord: checked === true })} disabled={isUpdatingSettings} className="mt-0.5 shrink-0" />
                                                            </div>
                                                            <div className="flex items-start gap-3 border-t border-slate-800 pt-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <Label htmlFor="removeMissingMembers" className="text-slate-200">Strict Discord membership</Label>
                                                                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                                                        {syncRolesFromDiscord
                                                                            ? "Remove CereBro members who lack the configured Discord roles, including members added on the website."
                                                                            : "Available when member role sync is enabled. CereBro currently uses member roles set on the website."}
                                                                    </p>
                                                                </div>
                                                                <Checkbox id="removeMissingMembers" checked={removeMissingMembers} onCheckedChange={checked => handleUpdateSettings({ removeMissingMembers: checked === true })} disabled={isUpdatingSettings || !syncRolesFromDiscord} className="mt-0.5 shrink-0" />
                                                            </div>
                                                        </section>

                                                        <section aria-label="Discord roles and channels" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                                                            {isLoadingDiscordConfig ? (
                                                                <p role="status" className="flex items-center gap-2 text-sm text-slate-400">
                                                                    <RotateCcw className="size-4 shrink-0 animate-spin" aria-hidden="true" /> Loading roles and channels…
                                                                </p>
                                                            ) : discordConfigError ? (
                                                                <p role="alert" className="text-sm text-red-200">{discordConfigError}</p>
                                                            ) : discordConfig && (
                                                                <DiscordConfigForm initialConfig={discordConfig} roles={discordRoles} channels={discordChannels} onSave={handleSaveDiscordConfig} saving={isSavingDiscordConfig} />
                                                            )}
                                                        </section>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-3.5">
                                                            <LinkIcon className="mt-0.5 size-4 shrink-0 text-indigo-200" aria-hidden="true" />
                                                            <div>
                                                                <p className="text-sm font-medium text-indigo-100">Discord server not linked</p>
                                                                <p className="mt-1 text-xs leading-relaxed text-slate-300">Link a server to use Discord roles and channels with this alliance.</p>
                                                            </div>
                                                        </div>
                                                        <ol className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40">
                                                            <li className="flex gap-3 p-4">
                                                                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-semibold text-indigo-200" aria-hidden="true">1</span>
                                                                <div className="min-w-0 flex-1 space-y-2">
                                                                    <h3 className="text-sm font-semibold text-white">Invite CereBro to your server</h3>
                                                                    <Button asChild variant="outline" size="sm" className="rounded-lg border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
                                                                        <a href="https://discord.com/oauth2/authorize?client_id=1184180809771520091" target="_blank" rel="noreferrer">
                                                                            Invite Discord bot <ArrowUpRight aria-hidden="true" />
                                                                        </a>
                                                                    </Button>
                                                                </div>
                                                            </li>
                                                            <li className="flex gap-3 p-4">
                                                                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-semibold text-indigo-200" aria-hidden="true">2</span>
                                                                <div className="min-w-0 flex-1 space-y-2">
                                                                    <h3 className="text-sm font-semibold text-white">Link your server</h3>
                                                                    {linkCode && linkExpires && new Date(linkExpires) > new Date() ? (
                                                                        <>
                                                                            <div className="flex items-center gap-2">
                                                                                <code className="min-w-0 flex-1 break-words rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-indigo-200">/alliance link code:{linkCode}</code>
                                                                                <Button variant="ghost" size="icon" aria-label="Refresh link code" onClick={handleGenerateLinkCode} disabled={isGeneratingCode}>
                                                                                    <RotateCcw aria-hidden="true" />
                                                                                </Button>
                                                                            </div>
                                                                            <p className="text-xs text-slate-400">Run this command in Discord. Expires in {Math.ceil((new Date(linkExpires).getTime() - Date.now()) / 60000)} min.</p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-xs text-slate-400">Generate a code for the Discord link command.</p>
                                                                            <Button size="sm" onClick={handleGenerateLinkCode} disabled={isGeneratingCode} className="rounded-lg bg-indigo-500 text-white hover:bg-indigo-400">
                                                                                <Plus aria-hidden="true" /> {isGeneratingCode ? "Generating…" : "Generate link code"}
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </li>
                                                        </ol>
                                                    </>
                                                )}
                                            </TabsContent>
                                        </Tabs>
                                    </AllianceDialogContent>
                                </Dialog>
                            )}
                        {canManageAlliance && (
                            <RecruitDialog pendingRequests={pendingRequests} loadingId={loadingId} onInvite={handleInvite} onRespond={handleRespondToRequest} />
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button ref={moreAllianceActions} variant="outline" size="icon" aria-label="More alliance actions" className="h-10 w-10 rounded-lg border-slate-700/80 bg-slate-950/45 text-slate-200 hover:bg-slate-800">
                                    <Ellipsis aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900 text-slate-100">
                                <DropdownMenuItem onSelect={() => setIsRoleHelpOpen(true)} className="gap-2">
                                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                                    Roles &amp; permissions
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-800" />
                                <DropdownMenuItem onSelect={handleLeave} className="gap-2 text-red-300 focus:text-red-200">
                                    <LogOut className="h-4 w-4" aria-hidden="true" />
                                    Leave alliance
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="border-t border-slate-700/55 bg-slate-950/30 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(17rem,29%)]">
                    <dl className="grid grid-cols-3 divide-x divide-slate-800/90">
                        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                                <Users className="hidden size-3.5 shrink-0 text-indigo-300 sm:block" aria-hidden="true" /> Members
                            </dt>
                            <dd className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums sm:text-2xl">{members.length}</dd>
                            <dd className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
                                {unassignedCount > 0 ? (
                                    <a
                                        href="#alliance-battlegroups"
                                        onClick={() => {
                                            setSelectedGroup(null);
                                            setMemberSearch("");
                                            setSelectedMemberId(null);
                                        }}
                                        className="rounded-sm text-indigo-300 underline decoration-indigo-400/45 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                    >
                                        {unassignedCount} unassigned
                                    </a>
                                ) : members.length > 0 ? "All assigned" : "No members yet"}
                            </dd>
                        </div>
                        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                                <Trophy className="hidden size-3.5 shrink-0 text-indigo-300 sm:block" aria-hidden="true" /> Avg. prestige
                            </dt>
                            <dd className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums sm:text-2xl">{alliancePrestige?.toLocaleString("en-US") ?? "—"}</dd>
                            <dd className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
                                {alliancePrestige === null ? "No prestige yet" : `${prestigeMemberCount} ${prestigeMemberCount === 1 ? "member" : "members"}`}
                            </dd>
                        </div>
                        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                                <ClipboardList className="hidden size-3.5 shrink-0 text-indigo-300 sm:block" aria-hidden="true" /> Rosters on file
                            </dt>
                            <dd className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums sm:text-2xl">
                                {rosterCount}<span className="text-xs font-medium tracking-normal text-slate-400 sm:text-sm"> / {members.length}</span>
                            </dd>
                            {canManageAlliance && membersNeedingAttention > 0 && (
                                <dd className="mt-0.5 text-[11px] text-amber-300 sm:text-xs" title="Missing or last updated at least 30 days ago">
                                    {membersNeedingAttention} {membersNeedingAttention === 1 ? "needs" : "need"} review
                                </dd>
                            )}
                        </div>
                    </dl>

                    <details className="group border-t border-slate-800/90 bg-slate-900/45 lg:border-l lg:border-t-0">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 sm:px-5 lg:min-h-[6rem] lg:group-open:min-h-11 [&::-webkit-details-marker]:hidden">
                            <Sparkles className={cn("size-4 shrink-0", screenshotUnlock.unlocked ? "text-emerald-300" : "text-amber-300")} aria-hidden="true" />
                            <span className="flex-1 font-medium text-slate-200">Screenshot uploads</span>
                            <span className={cn("rounded-full border px-2 py-0.5 tabular-nums", screenshotUnlock.unlocked ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-200")}>
                                {screenshotUnlock.unlocked ? "Unlimited" : screenshotUnlockPercent + "% funded"}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="space-y-2 px-3 pb-3 text-xs text-slate-400 sm:px-5">
                            <div role="progressbar" aria-label="Funding for unlimited roster screenshot uploads" aria-valuenow={screenshotUnlockPercent} className="h-1 overflow-hidden rounded-full bg-slate-800">
                                <div className={cn("h-full rounded-full", screenshotUnlock.unlocked ? "bg-emerald-400" : "bg-amber-400")} style={{ width: screenshotUnlockPercent + "%" }} />
                            </div>
                            <p>
                                {screenshotUnlock.unlocked
                                    ? formatEuroMinor(screenshotUnlock.currentMonthMinor) + " in eligible support"
                                    : formatEuroMinor(screenshotUnlock.currentMonthMinor) + " of " + formatEuroMinor(screenshotUnlock.thresholdMinor) + " funded. " + formatEuroMinor(screenshotUnlockRemainingMinor) + " more for unlimited uploads."}
                            </p>
                        </div>
                    </details>
                </div>
            </header>

            <section aria-labelledby="alliance-battlegroups" className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 xl:shrink-0">
                        <h2 id="alliance-battlegroups" className="scroll-mt-24 text-2xl font-bold tracking-tight text-white">{memberView === "board" ? "Battlegroups" : "Members"}</h2>
                        <div role="group" aria-label="Member view" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-700/80 bg-slate-900/65 p-0.5">
                            {([{ id: "board", label: "Board", icon: LayoutGrid }, { id: "list", label: "List", icon: List }] as const).map(({ id, label, icon: Icon }) => (
                                <Button key={id} type="button" size="sm" variant="ghost" aria-pressed={memberView === id} aria-controls="alliance-battlegroup-results" onClick={() => setMemberView(id)} className={cn(
                                    "h-[34px] gap-1.5 rounded-md px-2.5 focus-visible:ring-indigo-400 [&_svg]:size-3.5",
                                    memberView === id ? "bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}>
                                    <Icon aria-hidden="true" /> {label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div role="group" aria-label="Filter by battlegroup" className="flex w-fit flex-wrap gap-0.5 rounded-xl border border-slate-800 bg-slate-900/65 p-1">
                        {[{ id: "all" as const, title: "All battlegroups", color: null, total: members.length }, ...battlegroups].map(group => (
                            <Button
                                key={group.id ?? "unassigned"}
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={group.title + ", " + group.total + (group.total === 1 ? " member" : " members")}
                                aria-pressed={activeGroup === group.id}
                                aria-controls="alliance-battlegroup-results"
                                onClick={() => setSelectedGroup(group.id)}
                                className={cn(
                                    "h-9 gap-1.5 rounded-lg px-2 text-xs focus-visible:ring-indigo-400",
                                    activeGroup === group.id ? "bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/20" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                {group.color && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />}
                                {group.id === "all" ? "All" : group.id === null ? "Unassigned" : "BG " + group.id}
                                <span aria-hidden="true" className="hidden rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-300 sm:inline">{group.total}</span>
                            </Button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <AllianceMemberSearch
                            value={memberSearch}
                            suggestions={memberSuggestions}
                            inputRef={memberSearchInput}
                            onChange={value => {
                                setMemberSearch(value);
                                setSelectedMemberId(null);
                            }}
                            onSelect={member => {
                                setMemberSearch(member.name);
                                setSelectedMemberId(member.id);
                            }}
                        />
                        {memberView === "list" ? (
                            <AllianceMemberListSort value={activeListSort} onChange={setListSort} canSeeRosterUpdates={canManageAlliance} />
                        ) : (
                            <div role="group" aria-label="Sort members by" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-700/80 bg-slate-900/65 p-0.5">
                                {(["name", "prestige"] as const).map(sort => (
                                    <Button key={sort} type="button" size="sm" variant="ghost" onClick={() => setSortBy(sort)} aria-pressed={sortBy === sort} className={cn(
                                        "h-[34px] rounded-md px-2.5 focus-visible:ring-indigo-400",
                                        sortBy === sort ? "bg-slate-700/75 text-white hover:bg-slate-700" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    )}>
                                        {sort === "name" ? "Name" : "Prestige"}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div id="alliance-battlegroup-results" className="space-y-4">
                    {searchQuery && (
                        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", matchingMembers === 0 && "rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3")}>
                            <p role="status" className="min-w-0 break-words text-sm text-slate-400">
                                {matchingMembers === 0 ? <>No members match “{memberSearch.trim()}”{activeGroup !== "all" ? " in " + scopedGroups[0]?.title : ""}.</> : <>{matchingMembers} matching {matchingMembers === 1 ? "member" : "members"}</>}
                            </p>
                            {matchingMembers === 0 && activeGroup !== "all" && (
                                <Button type="button" variant="link" size="sm" onClick={() => {
                                    setSelectedGroup("all");
                                    memberSearchInput.current?.focus();
                                }} className="h-auto px-0 py-1 text-indigo-300">Search all battlegroups</Button>
                            )}
                        </div>
                    )}
                    {memberView === "list" && (!searchQuery || matchingMembers > 0) && (
                        <AllianceMemberList
                            members={listMembers}
                            sort={activeListSort}
                            playerColors={playerColorMap}
                            groupColors={groupColors}
                            rosterFreshness={canManageAlliance ? freshnessByMember : undefined}
                            emptyMessage={activeGroup === "all" ? "No alliance members yet." : "No members assigned to this battlegroup yet."}
                        />
                    )}
                    {memberView === "board" && visibleGroups.length > 0 && (
                        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {visibleGroups.map(renderBattlegroup)}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

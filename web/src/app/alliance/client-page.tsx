'use client';

import { Player } from "@prisma/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePlayerRole, updateAllianceColors, removeMember, leaveAlliance, respondToMembershipRequest, invitePlayerToAlliance } from "../actions/alliance";
import { useToast } from "@/hooks/use-toast";
import { Crown, Shield, Users, HelpCircle, Settings, LogOut, UserPlus, Mail, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";

interface MembershipRequest {
    id: string;
    status: string;
    type: string;
    createdAt: Date;
    player: Player;
}

interface PlayerSearchResult {
    id: string;
    ingameName: string;
    avatar: string | null;
    allianceId: string | null;
    alliance: { name: string } | null;
}

interface AllianceWithRequests {
    id: string;
    name: string;
    battlegroup1Color: string;
    battlegroup2Color: string;
    battlegroup3Color: string;
    membershipRequests: MembershipRequest[];
}

type PlayerWithRoster = Player & { roster: unknown[] };

interface ClientPageProps {
    members: PlayerWithRoster[];
    currentUser: Player;
    alliance: AllianceWithRequests;
}

export function AllianceManagementClient({ members, currentUser, alliance }: ClientPageProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const isOfficer = currentUser.isOfficer || currentUser.isBotAdmin;

    const [colors, setColors] = useState({
        bg1: alliance.battlegroup1Color || "#ef4444",
        bg2: alliance.battlegroup2Color || "#22c55e",
        bg3: alliance.battlegroup3Color || "#3b82f6",
    });
    const [isSavingColors, setIsSavingColors] = useState(false);

    // Search for inviting players
    const [playerSearchQuery, setPlayerSearchQuery] = useState("");
    const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([]);
    const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);

    const handlePlayerSearch = async () => {
        if (!playerSearchQuery.trim()) return;
        setIsSearchingPlayers(true);
        try {
            const response = await fetch(`/api/player/search?q=${encodeURIComponent(playerSearchQuery)}`);
            const data = await response.json();
            setPlayerSearchResults(data);
        } catch {
            toast({ title: "Error", description: "Failed to search for players", variant: "destructive" });
        } finally {
            setIsSearchingPlayers(false);
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

    const handleSaveColors = async () => {
        setIsSavingColors(true);
        try {
            await updateAllianceColors(colors);
            toast({ title: "Colors Updated", description: "Alliance theme colors saved." });
        } catch (e: unknown) {
             const error = e as Error;
             if (error.message?.includes("Failed to find Server Action")) {
                 toast({ 
                    title: "Update Required", 
                    description: "Application updated. Reloading...", 
                    variant: "destructive" 
                 });
                 setTimeout(() => window.location.reload(), 1500);
                 return;
            }
            toast({ title: "Error", description: "Failed to save colors.", variant: "destructive" });
        } finally {
            setIsSavingColors(false);
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
            if (error.message?.includes("Failed to find Server Action")) {
                 toast({ 
                    title: "Update Required", 
                    description: "Application updated. Reloading...", 
                    variant: "destructive" 
                 });
                 setTimeout(() => window.location.reload(), 1500);
                 return;
            }
            toast({ title: "Error", description: "Failed to update player.", variant: "destructive" });
        } finally {
            setLoadingId(null);
        }
    };

    const groups = {
        unassigned: members.filter(m => !m.battlegroup),
        bg1: members.filter(m => m.battlegroup === 1),
        bg2: members.filter(m => m.battlegroup === 2),
        bg3: members.filter(m => m.battlegroup === 3),
    };

    const renderColumn = (title: string, players: PlayerWithRoster[], bgId: string, icon: React.ReactNode, accentColor?: string) => (
        <div className="flex-1 min-w-[300px] flex flex-col gap-3">
            <div 
                className="flex items-center gap-2 pb-1.5 border-b transition-colors"
                style={{ borderColor: accentColor ? `${accentColor}40` : '#1e293b' }} // 40 = 25% opacity
            >
                <div style={{ color: accentColor || '#94a3b8' }}>
                    {icon}
                </div>
                <h3 className="font-bold text-base" style={{ color: accentColor || '#e2e8f0' }}>{title}</h3>
                <Badge variant="secondary" className="ml-auto text-[10px] h-4">{players.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
                {players.map(player => (
                    <Card key={player.id} className={cn("bg-slate-900/50 border-slate-800 transition-all group/card", loadingId === player.id && "opacity-50")}>
                        <CardContent className="p-2.5 flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-700">
                                <AvatarImage src={player.avatar || undefined} />
                                <AvatarFallback className="text-xs">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-sm truncate">{player.ingameName}</p>
                                    {player.isOfficer && <Crown className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                </div>
                                <p className="text-[10px] text-slate-400">Prestige: {player.championPrestige?.toLocaleString('en-US') || "N/A"}</p>
                            </div>

                            {isOfficer ? (
                                <div className="flex items-center gap-2">
                                    <Select 
                                        disabled={loadingId === player.id}
                                        onValueChange={(val) => handleBgChange(player.id, val)} 
                                        defaultValue={player.battlegroup?.toString() || "unassigned"}
                                    >
                                        <SelectTrigger className="h-6 w-[80px] text-[10px]">
                                            <SelectValue placeholder="BG" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned" className="text-[10px]">Unassigned</SelectItem>
                                            <SelectItem value="1" className="text-[10px]">BG 1</SelectItem>
                                            <SelectItem value="2" className="text-[10px]">BG 2</SelectItem>
                                            <SelectItem value="3" className="text-[10px]">BG 3</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {player.id !== currentUser.id && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                    <Settings className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800">
                                                <DropdownMenuItem onClick={() => handleToggleOfficer(player)} className="text-xs">
                                                    {player.isOfficer ? "Demote from Officer" : "Promote to Officer"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-slate-800" />
                                                <DropdownMenuItem onClick={() => handleKick(player.id)} className="text-xs text-red-400 focus:text-red-300">
                                                    Kick Member
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            ) : (
                                <Badge variant="outline" className="text-[10px] h-5">
                                    {(player.battlegroup ?? 0) > 0 ? `BG ${player.battlegroup}` : 'No BG'}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{alliance.name}</h1>
                        <div className="flex items-center gap-1">
                            {/* Help Dialog */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300">
                                        <HelpCircle className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
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

                            {isOfficer && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
                                        <DialogHeader>
                                            <DialogTitle>Alliance Theme Settings</DialogTitle>
                                            <DialogDescription className="text-slate-400">
                                                Customize battlegroup identity colors.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="bg1" className="text-right">
                                                    BG 1
                                                </Label>
                                                <div className="col-span-3 flex items-center gap-3">
                                                    <Input
                                                        id="bg1"
                                                        type="color"
                                                        value={colors.bg1}
                                                        onChange={(e) => setColors({ ...colors, bg1: e.target.value })}
                                                        className="h-10 w-20 p-1 bg-slate-950 border-slate-800"
                                                    />
                                                    <span className="text-xs text-slate-500 uppercase">{colors.bg1}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="bg2" className="text-right">
                                                    BG 2
                                                </Label>
                                                <div className="col-span-3 flex items-center gap-3">
                                                    <Input
                                                        id="bg2"
                                                        type="color"
                                                        value={colors.bg2}
                                                        onChange={(e) => setColors({ ...colors, bg2: e.target.value })}
                                                        className="h-10 w-20 p-1 bg-slate-950 border-slate-800"
                                                    />
                                                    <span className="text-xs text-slate-500 uppercase">{colors.bg2}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="bg3" className="text-right">
                                                    BG 3
                                                </Label>
                                                <div className="col-span-3 flex items-center gap-3">
                                                    <Input
                                                        id="bg3"
                                                        type="color"
                                                        value={colors.bg3}
                                                        onChange={(e) => setColors({ ...colors, bg3: e.target.value })}
                                                        className="h-10 w-20 p-1 bg-slate-950 border-slate-800"
                                                    />
                                                    <span className="text-xs text-slate-500 uppercase">{colors.bg3}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleSaveColors} disabled={isSavingColors}>
                                                {isSavingColors ? "Saving..." : "Save Changes"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-slate-400">Alliance Management & Overview</p>
                </div>

                <div className="flex items-center gap-3">
                    {isOfficer && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2 border-slate-700 bg-slate-900/50">
                                    <UserPlus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Recruit Members</span>
                                    {alliance.membershipRequests?.some((r: MembershipRequest) => r.status === 'PENDING' && r.type === 'REQUEST') && (
                                        <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-sky-500">
                                            {alliance.membershipRequests.filter((r: MembershipRequest) => r.status === 'PENDING' && r.type === 'REQUEST').length}
                                        </Badge>
                                    )}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-2xl p-0 overflow-hidden">
                                <Tabs defaultValue="recruit" className="w-full">
                                    <div className="px-6 pt-6 pb-2 border-b border-slate-800">
                                        <TabsList className="bg-slate-950 border-slate-800">
                                            <TabsTrigger value="recruit" className="gap-2">
                                                <Search className="w-3.5 h-3.5" />
                                                Find Players
                                            </TabsTrigger>
                                            <TabsTrigger value="requests" className="gap-2">
                                                <Mail className="w-3.5 h-3.5" />
                                                Join Requests
                                                {alliance.membershipRequests?.some((r: MembershipRequest) => r.status === 'PENDING' && r.type === 'REQUEST') && (
                                                    <Badge variant="secondary" className="h-4 px-1 min-w-[16px]">
                                                        {alliance.membershipRequests.filter((r: MembershipRequest) => r.status === 'PENDING' && r.type === 'REQUEST').length}
                                                    </Badge>
                                                )}
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="p-6 h-[400px]">
                                        <TabsContent value="recruit" className="m-0 h-full flex flex-col gap-4">
                                            <div className="flex gap-2">
                                                <Input 
                                                    placeholder="Search by In-Game Name..." 
                                                    value={playerSearchQuery}
                                                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handlePlayerSearch()}
                                                    className="bg-slate-950 border-slate-800"
                                                />
                                                <Button variant="secondary" onClick={handlePlayerSearch} disabled={isSearchingPlayers}>
                                                    {isSearchingPlayers ? "..." : <Search className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                            <ScrollArea className="flex-1 pr-4">
                                                <div className="space-y-2">
                                                    {playerSearchResults.map(player => (
                                                        <div key={player.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarImage src={player.avatar || undefined} />
                                                                    <AvatarFallback>{player.ingameName[0]}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="text-sm font-medium">{player.ingameName}</p>
                                                                    <p className="text-[10px] text-slate-500">{player.alliance?.name || 'No Alliance'}</p>
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="text-sky-400 hover:bg-sky-500/10 h-8"
                                                                disabled={loadingId === player.id || !!player.allianceId}
                                                                onClick={() => handleInvite(player.id)}
                                                            >
                                                                {loadingId === player.id ? "..." : <UserPlus className="w-4 h-4" />}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </TabsContent>

                                        <TabsContent value="requests" className="m-0 h-full">
                                            <ScrollArea className="h-full pr-4">
                                                <div className="space-y-3">
                                                    {alliance.membershipRequests?.filter((r: MembershipRequest) => r.status === 'PENDING' && r.type === 'REQUEST').length === 0 && (
                                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 py-12">
                                                            <Mail className="w-12 h-12 opacity-10" />
                                                            <p>No pending join requests</p>
                                                        </div>
                                                    )}
                                                    {alliance.membershipRequests?.filter((r: MembershipRequest) => r.status === 'PENDING' && r.type === 'REQUEST').map((req: MembershipRequest) => (
                                                        <div key={req.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-950/50">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar>
                                                                    <AvatarImage src={req.player.avatar || undefined} />
                                                                    <AvatarFallback>{req.player.ingameName[0]}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-bold">{req.player.ingameName}</p>
                                                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="secondary"
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-8"
                                                                    onClick={() => handleRespondToRequest(req.id, 'ACCEPTED')}
                                                                    disabled={loadingId === req.id}
                                                                >
                                                                    Accept
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="text-slate-400 hover:text-white h-8"
                                                                    onClick={() => handleRespondToRequest(req.id, 'REJECTED')}
                                                                    disabled={loadingId === req.id}
                                                                >
                                                                    Decline
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </DialogContent>
                        </Dialog>
                    )}

                    <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-950/20 gap-2" onClick={handleLeave}>
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Leave Alliance</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {renderColumn("Unassigned", groups.unassigned, "unassigned", <Users className="w-5 h-5"/>)}
                {renderColumn("Battlegroup 1", groups.bg1, "1", <Shield className="w-5 h-5"/>, alliance.battlegroup1Color)}
                {renderColumn("Battlegroup 2", groups.bg2, "2", <Shield className="w-5 h-5"/>, alliance.battlegroup2Color)}
                {renderColumn("Battlegroup 3", groups.bg3, "3", <Shield className="w-5 h-5"/>, alliance.battlegroup3Color)}
            </div>
        </div>
    );
}


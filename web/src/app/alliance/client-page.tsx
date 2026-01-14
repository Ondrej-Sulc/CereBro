'use client';

import { Player, Alliance } from "@prisma/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePlayerRole, updateAllianceColors } from "../actions/alliance";
import { useToast } from "@/hooks/use-toast";
import { Crown, Shield, Users, HelpCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";

type PlayerWithRoster = Player & { roster: unknown[] };

interface ClientPageProps {
    members: PlayerWithRoster[];
    currentUser: Player;
    alliance: Alliance;
}

export function AllianceManagementClient({ members, currentUser, alliance }: ClientPageProps) {
    const { toast } = useToast();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const isOfficer = currentUser.isOfficer || currentUser.isBotAdmin;

    const [colors, setColors] = useState({
        bg1: alliance.battlegroup1Color || "#ef4444",
        bg2: alliance.battlegroup2Color || "#22c55e",
        bg3: alliance.battlegroup3Color || "#3b82f6",
    });
    const [isSavingColors, setIsSavingColors] = useState(false);

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
                    <Card key={player.id} className={cn("bg-slate-900/50 border-slate-800 transition-all", loadingId === player.id && "opacity-50")}>
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
                                <div className="flex flex-col gap-1">
                                    <Select 
                                        disabled={loadingId === player.id}
                                        onValueChange={(val) => handleBgChange(player.id, val)} 
                                        defaultValue={player.battlegroup?.toString() || "unassigned"}
                                    >
                                        <SelectTrigger className="h-6 w-[90px] text-[10px]">
                                            <SelectValue placeholder="BG" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned" className="text-[10px]">Unassigned</SelectItem>
                                            <SelectItem value="1" className="text-[10px]">BG 1</SelectItem>
                                            <SelectItem value="2" className="text-[10px]">BG 2</SelectItem>
                                            <SelectItem value="3" className="text-[10px]">BG 3</SelectItem>
                                        </SelectContent>
                                    </Select>
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
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{alliance.name}</h1>
                        {isOfficer && (
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

                                {/* Color Settings Dialog */}
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
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-slate-400">Alliance Management & Overview</p>
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

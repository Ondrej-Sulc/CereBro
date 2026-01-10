'use client';

import { Player } from "@prisma/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePlayerRole } from "../actions/alliance";
import { useToast } from "@/hooks/use-toast";
import { Crown, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type PlayerWithRoster = Player & { roster: any[] };

interface ClientPageProps {
    members: PlayerWithRoster[];
    currentUser: Player;
    allianceName: string;
}

export function AllianceManagementClient({ members, currentUser, allianceName }: ClientPageProps) {
    const { toast } = useToast();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const isOfficer = currentUser.isOfficer || currentUser.isBotAdmin;

    const handleBgChange = async (playerId: string, bg: string) => {
        setLoadingId(playerId);
        try {
            const bgValue = bg === "unassigned" ? null : parseInt(bg);
            // We pass undefined for isOfficer to only update battlegroup
            await updatePlayerRole(playerId, { battlegroup: bgValue });
            toast({ title: "Updated", description: "Player battlegroup updated." });
        } catch (e) {
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

    const renderColumn = (title: string, players: PlayerWithRoster[], bgId: string, icon: any) => (
        <div className="flex-1 min-w-[300px] flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800">
                {icon}
                <h3 className="font-bold text-base">{title}</h3>
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
                                    {player.battlegroup ? `BG ${player.battlegroup}` : 'No BG'}
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
                    <h1 className="text-2xl font-bold tracking-tight">{allianceName}</h1>
                    <p className="text-sm text-slate-400">Alliance Management & Overview</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {renderColumn("Unassigned", groups.unassigned, "unassigned", <Users className="w-5 h-5 text-slate-400"/>)}
                {renderColumn("Battlegroup 1", groups.bg1, "1", <Shield className="w-5 h-5 text-red-400"/>)}
                {renderColumn("Battlegroup 2", groups.bg2, "2", <Shield className="w-5 h-5 text-blue-400"/>)}
                {renderColumn("Battlegroup 3", groups.bg3, "3", <Shield className="w-5 h-5 text-green-400"/>)}
            </div>
        </div>
    );
}

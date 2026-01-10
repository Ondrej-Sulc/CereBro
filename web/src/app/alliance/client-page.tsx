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
        <div className="flex-1 min-w-[300px] flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                {icon}
                <h3 className="font-bold text-lg">{title}</h3>
                <Badge variant="secondary" className="ml-auto">{players.length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
                {players.map(player => (
                    <Card key={player.id} className={cn("bg-slate-900/50 border-slate-800 transition-all", loadingId === player.id && "opacity-50")}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-slate-700">
                                <AvatarImage src={player.avatar || undefined} />
                                <AvatarFallback>{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold truncate">{player.ingameName}</p>
                                    {player.isOfficer && <Crown className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                </div>
                                <p className="text-xs text-slate-400">Prestige: {player.championPrestige?.toLocaleString('en-US') || "N/A"}</p>
                            </div>

                            {isOfficer ? (
                                <div className="flex flex-col gap-1">
                                    <Select 
                                        disabled={loadingId === player.id}
                                        onValueChange={(val) => handleBgChange(player.id, val)} 
                                        defaultValue={player.battlegroup?.toString() || "unassigned"}
                                    >
                                        <SelectTrigger className="h-7 w-[110px] text-xs">
                                            <SelectValue placeholder="BG" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            <SelectItem value="1">BG 1</SelectItem>
                                            <SelectItem value="2">BG 2</SelectItem>
                                            <SelectItem value="3">BG 3</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <Badge variant="outline" className="text-xs">
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
        <div className="container mx-auto py-8 px-4">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{allianceName}</h1>
                    <p className="text-slate-400">Alliance Management & Overview</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {renderColumn("Unassigned", groups.unassigned, "unassigned", <Users className="w-5 h-5 text-slate-400"/>)}
                {renderColumn("Battlegroup 1", groups.bg1, "1", <Shield className="w-5 h-5 text-red-400"/>)}
                {renderColumn("Battlegroup 2", groups.bg2, "2", <Shield className="w-5 h-5 text-blue-400"/>)}
                {renderColumn("Battlegroup 3", groups.bg3, "3", <Shield className="w-5 h-5 text-green-400"/>)}
            </div>
        </div>
    );
}

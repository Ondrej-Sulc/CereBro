import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDiscordGuilds } from "@/app/actions/discord";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Users, Server } from "lucide-react";
import { CleanupButton, LeaveButton } from "./discord-client";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export default async function AdminDiscordPage() {
    const guilds = await getDiscordGuilds();
    const smallGuildsCount = guilds.filter(g => (g.approximate_member_count || 0) <= 1).length;

    // Fetch alliance names from DB to match with guilds
    const alliances = await prisma.alliance.findMany({
        where: { guildId: { in: guilds.map(g => g.id) } },
        select: { guildId: true, id: true, name: true }
    });

    const allianceMap = new Map(alliances.map(a => [a.guildId, a]));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Discord Servers</h1>
                    <p className="text-muted-foreground">Monitor and manage Discord servers CereBro is connected to.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-sm">
                        {guilds.length} / 100 Servers
                    </Badge>
                    <CleanupButton smallGuildCount={smallGuildsCount} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Connected Servers</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Server</TableHead>
                                <TableHead>Alliance ID</TableHead>
                                <TableHead>Members</TableHead>
                                <TableHead>Features</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {guilds.map((guild) => {
                                const alliance = guild.id ? allianceMap.get(guild.id) : null;
                                const isGlobal = alliance?.id === 'GLOBAL';

                                return (
                                    <TableRow key={guild.id} className={isGlobal ? "bg-primary/5" : ""}>
                                        <TableCell>
                                            <div className="flex items-center space-x-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : ""} />
                                                    <AvatarFallback><Server className="h-4 w-4" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{guild.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{guild.id}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {alliance ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{alliance.name}</span>
                                                    <code className="text-[10px] text-muted-foreground">{alliance.id}</code>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">No Alliance record</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className={cn(
                                                    "text-sm font-medium",
                                                    (guild.approximate_member_count || 0) <= 1 ? "text-destructive" : ""
                                                )}>
                                                    {guild.approximate_member_count?.toLocaleString() || "0"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {isGlobal && (
                                                    <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] h-4 px-1">GLOBAL</Badge>
                                                )}
                                                {guild.features.slice(0, 3).map(f => (
                                                    <Badge key={f} variant="outline" className="text-[9px] h-4 px-1">{f.toLowerCase().replace(/_/g, ' ')}</Badge>
                                                ))}
                                                {guild.features.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground">+{guild.features.length - 3}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!isGlobal && (
                                                <LeaveButton guildId={guild.id} guildName={guild.name} />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

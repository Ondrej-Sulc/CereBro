'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { leaveDiscordGuild, cleanupSmallGuilds } from "@/app/actions/discord";
import { toast } from "@/hooks/use-toast";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function LeaveButton({ guildId, guildName }: { guildId: string, guildName: string }) {
    const [loading, setLoading] = useState(false);

    async function handleLeave() {
        if (loading) return;
        setLoading(true);
        try {
            const result = await leaveDiscordGuild(guildId);
            if (result && result.success) {
                toast({
                    title: "Success",
                    description: `Queued leave for ${guildName}`,
                });
            } else {
                toast({
                    title: "Error",
                    description: (result as any)?.error || "Failed to leave server.",
                    variant: "destructive",
                });
            }
        } catch (e: unknown) {
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : String(e),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={loading} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will make the bot leave **{guildName}**. 
                        This action cannot be undone unless the bot is re-invited.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLeave} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Leave Server
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function CleanupButton({ smallGuildCount }: { smallGuildCount: number }) {
    const [loading, setLoading] = useState(false);

    async function handleCleanup() {
        if (smallGuildCount === 0 || loading) return;
        setLoading(true);
        try {
            const result = await cleanupSmallGuilds();
            if (result && result.success) {
                toast({
                    title: "Success",
                    description: `Queued leave for ${result.count} small servers.`,
                });
            } else {
                toast({
                    title: "Error",
                    description: (result as any)?.error || "Failed to cleanup servers.",
                    variant: "destructive",
                });
            }
        } catch (e: unknown) {
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : String(e),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" disabled={smallGuildCount === 0 || loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Cleanup {smallGuildCount} Small Servers
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cleanup Small Servers</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will make the bot leave **{smallGuildCount}** servers that have 1 or fewer members.
                        This is useful for clearing out test servers and reclaiming capacity.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCleanup} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirm Cleanup
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

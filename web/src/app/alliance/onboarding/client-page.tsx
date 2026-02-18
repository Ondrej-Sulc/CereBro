'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createAlliance, requestToJoinAlliance, respondToMembershipRequest } from "../../actions/alliance";
import { 
    Users, 
    Plus, 
    Search, 
    ArrowRight, 
    MailOpen, 
    Clock, 
    Check, 
    X,
    Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FormPageBackground from "@/components/FormPageBackground";

interface MembershipRequest {
    id: string;
    alliance: {
        id: string;
        name: string;
    };
    inviter?: {
        ingameName: string;
    } | null;
}

interface AllianceSearchResult {
    id: string;
    name: string;
    _count: {
        members: number;
    };
}

interface OnboardingProps {
    invitations: MembershipRequest[];
    sentRequests: MembershipRequest[];
}

export function AllianceOnboardingClient({ invitations, sentRequests }: OnboardingProps) {
    const { toast } = useToast();
    const [allianceName, setAllianceName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<AllianceSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allianceName.trim()) return;
        setIsCreating(true);
        try {
            const result = await createAlliance(allianceName);
            if (result && 'error' in result) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
                return;
            }
            toast({ title: "Alliance Created", description: `Welcome to ${allianceName}!` });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to create alliance";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch(`/api/alliance/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            setSearchResults(data);
        } catch {
            toast({ title: "Error", description: "Failed to search for alliances", variant: "destructive" });
        } finally {
            setIsSearching(false);
        }
    };

    const handleJoinRequest = async (allianceId: string) => {
        setLoadingAction(allianceId);
        try {
            const result = await requestToJoinAlliance(allianceId);
            if (result && 'error' in result) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
                return;
            }
            toast({ title: "Request Sent", description: "Your request to join has been sent to alliance officers." });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to send request";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingAction(null);
        }
    };

    const handleInviteResponse = async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
        setLoadingAction(requestId);
        try {
            const result = await respondToMembershipRequest(requestId, status);
            if (result && 'error' in result) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
                return;
            }
            toast({ title: status === 'ACCEPTED' ? "Joined Alliance" : "Invite Declined" });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to respond to invite";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
            <FormPageBackground />
            
            <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 py-8">
                {/* Left Side: Onboarding Options */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white tracking-tight">Alliance Onboarding</h1>
                        <p className="text-slate-400">Join an existing alliance or create a new one to start planning.</p>
                    </div>

                    {/* Pending Invitations */}
                    {invitations.length > 0 && (
                        <Card className="bg-sky-900/20 border-sky-800/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-sky-400">
                                    <MailOpen className="w-5 h-5" />
                                    Alliance Invitations
                                </CardTitle>
                                <CardDescription className="text-slate-400">You have been invited to join these alliances.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {invitations.map((invite) => (
                                    <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                                        <div>
                                            <p className="font-bold text-white">{invite.alliance.name}</p>
                                            {invite.inviter && <p className="text-xs text-slate-400">Invited by: {invite.inviter.ingameName}</p>}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="secondary"
                                                disabled={loadingAction === invite.id}
                                                onClick={() => handleInviteResponse(invite.id, 'ACCEPTED')}
                                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                            >
                                                <Check className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost"
                                                disabled={loadingAction === invite.id}
                                                onClick={() => handleInviteResponse(invite.id, 'REJECTED')}
                                                className="h-8 px-3 text-slate-400 hover:text-white"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Create Alliance */}
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Plus className="w-5 h-5 text-sky-400" />
                                Create New Alliance
                            </CardTitle>
                            <CardDescription>Start your own alliance and invite members to join.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Alliance Name</Label>
                                    <Input 
                                        id="name" 
                                        placeholder="Enter alliance name..." 
                                        value={allianceName}
                                        onChange={(e) => setAllianceName(e.target.value)}
                                        className="bg-slate-950 border-slate-800"
                                    />
                                </div>
                                <Button className="w-full" disabled={isCreating || !allianceName.trim()}>
                                    {isCreating ? "Creating..." : "Create Alliance"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* My Sent Requests */}
                    {sentRequests.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Pending Join Requests
                            </h3>
                            <div className="space-y-2">
                                {sentRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                                        <span className="text-slate-200 font-medium">{req.alliance.name}</span>
                                        <Badge variant="outline" className="text-sky-400 border-sky-900/50 bg-sky-900/20">Pending Review</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Join/Search */}
                <div className="space-y-6">
                    <Card className="bg-slate-900/50 border-slate-800 h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="w-5 h-5 text-sky-400" />
                                Find Alliance
                            </CardTitle>
                            <CardDescription>Search for an alliance to join.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Search by name..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="bg-slate-950 border-slate-800"
                                />
                                <Button variant="secondary" onClick={handleSearch} disabled={isSearching}>
                                    {isSearching ? "..." : <Search className="w-4 h-4" />}
                                </Button>
                            </div>

                            <Separator className="bg-slate-800" />

                            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                                {searchResults.length === 0 && !isSearching && searchQuery && (
                                    <div className="text-center py-8 text-slate-500 italic">
                                        No alliances found matching &quot;{searchQuery}&quot;
                                    </div>
                                )}
                                {searchResults.map((alliance) => (
                                    <div key={alliance.id} className="group p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900/80 transition-all flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                                                <Shield className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white group-hover:text-sky-400 transition-colors">{alliance.name}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Users className="w-3 h-3" />
                                                    {alliance._count.members} Members
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 gap-2"
                                            disabled={loadingAction === alliance.id}
                                            onClick={() => handleJoinRequest(alliance.id)}
                                        >
                                            {loadingAction === alliance.id ? "Sending..." : (
                                                <>
                                                    Join
                                                    <ArrowRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                ))}
                                {!searchQuery && (
                                    <div className="text-center py-20 text-slate-600 flex flex-col items-center gap-3">
                                        <Users className="w-12 h-12 opacity-10" />
                                        <p className="text-sm">Search for an alliance to see results.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

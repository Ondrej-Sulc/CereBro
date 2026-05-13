"use client";

import { useState } from "react";
import { RosterUpdateForm } from "@/components/RosterUpdateForm";
import type { RosterScreenshotQuotaSummary } from "@/components/RosterUpdateForm";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCircle, Shield } from "lucide-react";

interface PlayerOption {
    id: string;
    ingameName: string;
}

interface RosterUpdateClientProps {
    currentUser: PlayerOption;
    allProfiles: PlayerOption[];
    allianceMembers: PlayerOption[];
    quota: RosterScreenshotQuotaSummary | null;
}

export function RosterUpdateClient({ currentUser, allProfiles, allianceMembers, quota }: RosterUpdateClientProps) {
    const [targetPlayerId, setTargetPlayerId] = useState<string>(currentUser.id);

    // Make sure the active user is at the top of the "Your Profiles" list
    const sortedProfiles = [...allProfiles].sort((a, b) => {
        if (a.id === currentUser.id) return -1;
        if (b.id === currentUser.id) return 1;
        return a.ingameName.localeCompare(b.ingameName);
    });

    const otherAllianceMembers = allianceMembers.filter(m => !allProfiles.some(p => p.id === m.id));

    return (
        <div className="space-y-6">
            <div className="max-w-md mx-auto bg-slate-900/80 p-5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-sky-500 to-indigo-500" />
                <Label className="text-slate-300 mb-2 block font-semibold flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-sky-400" />
                    Updating Roster For
                </Label>
                <Select value={targetPlayerId} onValueChange={setTargetPlayerId}>
                    <SelectTrigger className="w-full bg-slate-950 border-slate-700 h-12 text-base shadow-inner">
                        <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectGroup>
                            <SelectLabel className="text-sky-400 font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                                <UserCircle className="w-3 h-3" />
                                Your Profiles
                            </SelectLabel>
                            {sortedProfiles.map(p => (
                                <SelectItem key={p.id} value={p.id} className="cursor-pointer focus:bg-slate-800 py-2">
                                    <span className="font-medium">{p.ingameName}</span>
                                    {p.id === currentUser.id && (
                                        <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        {otherAllianceMembers.length > 0 && (
                            <SelectGroup>
                                <SelectLabel className="text-amber-400 font-black uppercase tracking-widest text-[10px] mt-2 flex items-center gap-1.5">
                                    <Shield className="w-3 h-3" />
                                    Alliance Members (Officer Access)
                                </SelectLabel>
                                {otherAllianceMembers.map(m => (
                                    <SelectItem key={m.id} value={m.id} className="cursor-pointer focus:bg-slate-800 py-2">
                                        {m.ingameName}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        )}
                    </SelectContent>
                </Select>
            </div>
            
            <RosterUpdateForm targetPlayerId={targetPlayerId === currentUser.id ? undefined : targetPlayerId} quota={quota} />
        </div>
    );
}

"use client";

import { useState, useTransition } from "react";
import { SeasonBanWithChampion } from "@cerebro/core/data/war-planning/types";
import { Champion } from "@/types/champion";
import { addSeasonBan, deleteSeasonBan } from "@/app/admin/bans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MCOC_TIER_PRESETS = [
    { name: "Elite (Tier 1)", min: 1, max: 1 },
    { name: "Expert (Tier 2)", min: 2, max: 2 },
    { name: "Challenger (Tiers 3-5)", min: 3, max: 5 },
    { name: "Hard (Tiers 6-9)", min: 6, max: 9 },
    { name: "Intermediate (Tiers 10-12)", min: 10, max: 12 },
];

interface AdminBansManagerClientProps {
  initialBans: SeasonBanWithChampion[];
  champions: Champion[];
}

export default function AdminBansManagerClient({ initialBans, champions }: AdminBansManagerClientProps) {
  const [bans, setBans] = useState<SeasonBanWithChampion[]>(initialBans);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Form State
  const [season, setSeason] = useState<string>("");
  const [minTier, setMinTier] = useState<string>("");
  const [maxTier, setMaxTier] = useState<string>("");
  const [selectedChampionId, setSelectedChampionId] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value === "custom") {
        setMinTier("");
        setMaxTier("");
    } else {
        const preset = MCOC_TIER_PRESETS.find(p => p.name === value);
        if (preset) {
            setMinTier(String(preset.min));
            setMaxTier(String(preset.max));
        }
    }
  };

  const handleAddBan = async () => {
    if (!season || !selectedChampionId) {
      toast({
        title: "Validation Error",
        description: "Season and Champion are required.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        await addSeasonBan(
          parseInt(season),
          minTier ? parseInt(minTier) : undefined,
          maxTier ? parseInt(maxTier) : undefined,
          parseInt(selectedChampionId)
        );
        toast({ title: "Success", description: "Ban added successfully." });
        window.location.reload(); 
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to add ban",
          variant: "destructive",
        });
      }
    });
  };

  const handleDeleteBan = async (id: string) => {
    startTransition(async () => {
        try {
            await deleteSeasonBan(id);
            setBans(prev => prev.filter(b => b.id !== id));
            toast({ title: "Success", description: "Ban removed." });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to remove ban",
                variant: "destructive",
            });
        }
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Manage Season Bans</CardTitle>
          <CardDescription>Configure global bans for specific seasons and tiers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Season</Label>
              <Input 
                type="number" 
                placeholder="e.g. 55" 
                value={season} 
                onChange={e => setSeason(e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
               <Label>Tier Preset</Label>
               <Select value={selectedPreset} onValueChange={handlePresetChange}>
                   <SelectTrigger>
                       <SelectValue placeholder="Select a tier preset" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="custom">Custom Range</SelectItem>
                       {MCOC_TIER_PRESETS.map(preset => (
                           <SelectItem key={preset.name} value={preset.name}>
                               {preset.name}
                           </SelectItem>
                       ))}
                   </SelectContent>
               </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Min Tier (Optional)</Label>
              <Input 
                type="number" 
                placeholder="e.g. 1" 
                value={minTier} 
                onChange={e => setMinTier(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Max Tier (Optional)</Label>
              <Input 
                type="number" 
                placeholder="e.g. 5" 
                value={maxTier} 
                onChange={e => setMaxTier(e.target.value)} 
              />
            </div>
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label>Champion</Label>
              <ChampionCombobox 
                champions={champions}
                value={selectedChampionId}
                onSelect={setSelectedChampionId}
              />
            </div>
          </div>
          <Button 
            onClick={handleAddBan} 
            disabled={isPending || !season || !selectedChampionId}
            className="w-full md:w-auto"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Ban
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Bans</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left font-medium">Champion</th>
                            <th className="p-3 text-left font-medium">Season</th>
                            <th className="p-3 text-left font-medium">Tiers</th>
                            <th className="p-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bans.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-muted-foreground">No bans found.</td>
                            </tr>
                        ) : (
                            bans.map(ban => (
                                <tr key={ban.id} className="border-b last:border-0">
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-8 w-8 rounded-full overflow-hidden bg-slate-800">
                                                <Image 
                                                    src={getChampionImageUrl(ban.champion.images, '64')}
                                                    alt={ban.champion.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <span>{ban.champion.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">S{ban.season}</td>
                                    <td className="p-3">
                                        {ban.minTier && ban.maxTier 
                                            ? `T${ban.minTier} - T${ban.maxTier}`
                                            : ban.minTier 
                                                ? `T${ban.minTier}+` 
                                                : ban.maxTier 
                                                    ? `Up to T${ban.maxTier}`
                                                    : "All Tiers"
                                        }
                                    </td>
                                    <td className="p-3 text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteBan(ban.id)}
                                            disabled={isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

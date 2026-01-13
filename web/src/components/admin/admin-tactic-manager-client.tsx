"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WarTactic, Tag } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Trash2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { addTactic, deleteTactic } from "@/app/admin/tactics/actions";
import { searchWarTags } from "@/app/admin/tactics/tag-actions";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

const MCOC_TIER_PRESETS = [
    { name: "Elite (Tier 1)", min: 1, max: 1 },
    { name: "Expert (Tier 2)", min: 2, max: 2 },
    { name: "Challenger (Tiers 3-5)", min: 3, max: 5 },
    { name: "Hard (Tiers 6-9)", min: 6, max: 9 },
    { name: "Intermediate (Tiers 10-12)", min: 10, max: 12 },
];

type WarTacticWithTags = WarTactic & {
    attackTag: Tag | null;
    defenseTag: Tag | null;
};

interface AdminTacticManagerClientProps {
    initialTactics: WarTacticWithTags[];
}

export default function AdminTacticManagerClient({ initialTactics }: AdminTacticManagerClientProps) {
    const router = useRouter();
    
    // Form State
    const [season, setSeason] = useState<string>("");
    const [name, setName] = useState<string>("");
    const [minTier, setMinTier] = useState<string>("");
    const [maxTier, setMaxTier] = useState<string>("");
    const [attackTag, setAttackTag] = useState<string>("");
    const [defenseTag, setDefenseTag] = useState<string>("");
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

    const handleAdd = async () => {
        if (!season) return;

        try {
            await addTactic(
                parseInt(season), 
                minTier ? parseInt(minTier) : undefined, 
                maxTier ? parseInt(maxTier) : undefined,
                attackTag,
                defenseTag,
                name
            );
            router.refresh();
            // Reset optional fields
            setAttackTag("");
            setDefenseTag("");
            setName("");
        } catch (error) {
            console.error(error);
            alert("Failed to add tactic");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTactic(id);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to delete tactic");
        }
    };

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">War Tactics Manager</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Create Form */}
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader>
                        <CardTitle>Add New Season Tactic</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Season</Label>
                                <Input 
                                    type="number" 
                                    value={season} 
                                    onChange={e => setSeason(e.target.value)}
                                    placeholder="59"
                                    className="bg-slate-900 border-slate-800 no-spin-buttons"
                                />
                            </div>
                            <div>
                                <Label>Display Name</Label>
                                <Input 
                                    value={name} 
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Elite Map S59"
                                    className="bg-slate-900 border-slate-800"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Tier Preset</Label>
                            <Select value={selectedPreset} onValueChange={handlePresetChange}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-800">
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Best Tier (e.g. 1)</Label>
                                <Input 
                                    type="number" 
                                    value={minTier} 
                                    onChange={e => setMinTier(e.target.value)}
                                    placeholder="Min (1)"
                                    className="bg-slate-900 border-slate-800"
                                />
                            </div>
                            <div>
                                <Label>Worst Tier (e.g. 22)</Label>
                                <Input 
                                    type="number" 
                                    value={maxTier} 
                                    onChange={e => setMaxTier(e.target.value)}
                                    placeholder="Max (22)"
                                    className="bg-slate-900 border-slate-800"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Attack Tag</Label>
                                <TagSelector 
                                    value={attackTag} 
                                    onChange={setAttackTag} 
                                    placeholder="Select Attack Tag..." 
                                />
                            </div>
                            <div>
                                <Label>Defense Tag</Label>
                                <TagSelector 
                                    value={defenseTag} 
                                    onChange={setDefenseTag} 
                                    placeholder="Select Defense Tag..." 
                                />
                            </div>
                        </div>

                        <Button onClick={handleAdd} className="w-full bg-sky-600 hover:bg-sky-500 text-white mt-4">
                            <Plus className="mr-2 h-4 w-4" /> Add Tactic
                        </Button>
                    </CardContent>
                </Card>

                {/* List */}
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader>
                        <CardTitle>Existing Tactics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {initialTactics.length === 0 ? (
                            <p className="text-muted-foreground text-center italic">No tactics defined.</p>
                        ) : (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {initialTactics.map(tactic => (
                                    <div key={tactic.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="border-sky-500 text-sky-400">S{tactic.season}</Badge>
                                                <span className="font-semibold text-slate-200">{tactic.name || "Unnamed"}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 mb-2">
                                                Tiers: {tactic.minTier || "?"} - {tactic.maxTier || "?"}
                                            </div>
                                            <div className="flex gap-2">
                                                {tactic.attackTag && <Badge variant="secondary" className="bg-orange-900/30 text-orange-400 border-orange-900/50">{tactic.attackTag.name}</Badge>}
                                                {tactic.defenseTag && <Badge variant="secondary" className="bg-indigo-900/30 text-indigo-400 border-indigo-900/50">{tactic.defenseTag.name}</Badge>}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tactic.id)} className="text-red-500 hover:bg-red-950/50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function TagSelector({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [tags, setTags] = useState<Tag[]>([]);
    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        // Fetch all initially or search
        searchWarTags(debouncedQuery).then(setTags);
    }, [debouncedQuery]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-slate-900 border-slate-800 text-left font-normal"
                >
                    {value || <span className="text-muted-foreground">{placeholder}</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 bg-slate-950 border-slate-800">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search tags..." value={query} onValueChange={setQuery} />
                    <CommandList>
                        <CommandEmpty>
                            {query && (
                                <div 
                                    className="p-2 text-sm text-sky-400 cursor-pointer hover:bg-slate-900 px-4 py-2"
                                    onClick={() => {
                                        onChange(query);
                                        setOpen(false);
                                    }}
                                >
                                    Use &quot;{query}&quot;
                                </div>
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {tags.map((tag) => (
                                <CommandItem
                                    key={tag.id}
                                    value={tag.name}
                                    onSelect={() => {
                                        onChange(tag.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === tag.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {tag.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WarNode, WarNodeAllocation, NodeModifier } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchModifiers, addAllocation, removeAllocation } from "@/app/admin/nodes/actions";
import { Loader2, Plus, Trash2, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast"; // Import useToast

const MCOC_TIER_PRESETS = [
    { name: "Elite (Tier 1)", min: 1, max: 1 },
    { name: "Expert (Tier 2)", min: 2, max: 2 },
    { name: "Challenger (Tiers 3-5)", min: 3, max: 5 },
    { name: "Hard (Tiers 6-9)", min: 6, max: 9 },
    { name: "Intermediate (Tiers 10-12)", min: 10, max: 12 },
];

type WarNodeWithAllocations = WarNode & {
    allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
};

interface AdminNodeManagerClientProps {
    initialNodes: WarNodeWithAllocations[];
}

export default function AdminNodeManagerClient({ initialNodes }: AdminNodeManagerClientProps) {
    const router = useRouter();
    const { toast } = useToast(); // Initialize toast
    const [selectedNode, setSelectedNode] = useState<WarNodeWithAllocations | null>(null);
    const [modifierSearch, setModifierSearch] = useState("");
    const [searchResults, setSearchResults] = useState<NodeModifier[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Allocation form state
    const [minTier, setMinTier] = useState<string>("");
    const [maxTier, setMaxTier] = useState<string>("");
    const [season, setSeason] = useState<string>("");
    const [selectedPreset, setSelectedPreset] = useState<string>("custom");

    const debouncedSearch = useDebounce(modifierSearch, 300);

    useEffect(() => {
        if (debouncedSearch) {
            setIsSearching(true);
            searchModifiers(debouncedSearch).then(results => {
                setSearchResults(results);
                setIsSearching(false);
            });
        } else {
            setSearchResults([]);
        }
    }, [debouncedSearch]);

    // Update selectedNode from initialNodes when it changes (due to refresh)
    useEffect(() => {
        if (selectedNode) {
            const updatedNode = initialNodes.find(n => n.id === selectedNode.id);
            if (updatedNode) {
                setSelectedNode(updatedNode);
            }
        }
    }, [initialNodes]);

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

    const handleAddAllocation = async (modifier: NodeModifier) => {
        if (!selectedNode) return;
        
        try {
            await addAllocation(
                selectedNode.id, 
                modifier.id, 
                minTier ? parseInt(minTier) : undefined,
                maxTier ? parseInt(maxTier) : undefined,
                season ? parseInt(season) : undefined
            );
            
            router.refresh();
            toast({
                title: "Modifier Added",
                description: `Successfully added ${modifier.name} to Node ${selectedNode.nodeNumber}.`,
            });
        } catch (error: any) {
            console.error("Failed to add allocation:", error);
            toast({
                title: "Failed to Add Modifier",
                description: error.message || "Please check the console for details.",
                variant: "destructive",
            });
        }
    };

    const handleRemoveAllocation = async (allocationId: string) => {
        try {
            await removeAllocation(allocationId);
            router.refresh();
            toast({
                title: "Modifier Removed",
                description: "Successfully removed modifier.",
            });
        } catch (error: any) {
            console.error("Failed to remove allocation:", error);
            toast({
                title: "Failed to Remove Modifier",
                description: error.message || "Please check the console for details.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="container mx-auto py-8 h-[calc(100vh-64px)] flex gap-6">
            {/* Left Sidebar: Node List */}
            <Card className="w-64 flex flex-col h-full bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle>Nodes</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full">
                        <div className="grid grid-cols-3 gap-2 p-4">
                            {initialNodes.map(node => (
                                <Button
                                    key={node.id}
                                    variant={selectedNode?.id === node.id ? "default" : "outline"}
                                    className="h-12 w-full font-mono text-lg"
                                    onClick={() => setSelectedNode(node)}
                                >
                                    {node.nodeNumber}
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Main Content: Allocation Editor */}
            <Card className="flex-1 flex flex-col bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle>
                        {selectedNode ? `Editing Node ${selectedNode.nodeNumber}` : "Select a Node"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                    {selectedNode ? (
                        <div className="space-y-6">
                            {/* Current Allocations */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Active Modifiers</h3>
                                <div className="space-y-3">
                                    {selectedNode.allocations.length === 0 ? (
                                        <p className="text-muted-foreground italic">No modifiers assigned.</p>
                                    ) : (
                                        selectedNode.allocations.map(alloc => (
                                            <div key={alloc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/50">
                                                <div>
                                                    <div className="font-bold text-sky-400">{alloc.nodeModifier.name}</div>
                                                    <div className="text-sm text-slate-400">{alloc.nodeModifier.description}</div>
                                                    <div className="flex gap-2 mt-2">
                                                        {alloc.minTier && <Badge variant="secondary" className="text-xs">Best: T{alloc.minTier}</Badge>}
                                                        {alloc.maxTier && <Badge variant="secondary" className="text-xs">Worst: T{alloc.maxTier}</Badge>}
                                                        {alloc.season && <Badge variant="secondary" className="text-xs">Season: {alloc.season}</Badge>}
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveAllocation(alloc.id)} className="text-red-500 hover:bg-red-950">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Add New Allocation */}
                            <div className="border-t border-slate-800 pt-6">
                                <h3 className="text-lg font-semibold mb-4">Add Modifier</h3>
                                <div className="mb-4">
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

                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <Label>Best Tier (e.g. 1)</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="Min (1)" 
                                            value={minTier} 
                                            onChange={e => setMinTier(e.target.value)}
                                            className="bg-slate-900 border-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <Label>Worst Tier (e.g. 22)</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="Max (22)" 
                                            value={maxTier} 
                                            onChange={e => setMaxTier(e.target.value)}
                                            className="bg-slate-900 border-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <Label>Season</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="Any" 
                                            value={season} 
                                            onChange={e => setSeason(e.target.value)}
                                            className="bg-slate-900 border-slate-800"
                                        />
                                    </div>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search modifiers..."
                                        value={modifierSearch}
                                        onChange={(e) => setModifierSearch(e.target.value)}
                                        className="pl-9 bg-slate-900 border-slate-800"
                                    />
                                    {modifierSearch && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute right-2 top-2 h-6 w-6"
                                            onClick={() => setModifierSearch("")}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>

                                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto rounded-md border border-slate-800 p-2">
                                    {isSearching ? (
                                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map(mod => (
                                            <div key={mod.id} className="flex items-center justify-between p-2 hover:bg-slate-800 rounded group cursor-pointer" onClick={() => handleAddAllocation(mod)}>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-sm text-sky-300 group-hover:text-sky-200">{mod.name}</div>
                                                    <div className="text-xs text-slate-500 line-clamp-1">{mod.description}</div>
                                                </div>
                                                <Plus className="h-4 w-4 text-slate-600 group-hover:text-sky-400" />
                                            </div>
                                        ))
                                    ) : modifierSearch ? (
                                        <div className="text-center text-muted-foreground p-4">No results found</div>
                                    ) : (
                                        <div className="text-center text-muted-foreground p-4">Type to search...</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Select a node from the list to manage its modifiers.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

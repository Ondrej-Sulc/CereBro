"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WarNode, WarNodeAllocation, NodeModifier, WarMapType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchModifiers, addAllocation, removeAllocation, updateAllocation, copyAllocations, massCopyAllocations } from "@/app/admin/nodes/actions";
import { Loader2, Plus, Trash2, Search, X, Pencil, Copy, ArrowRight, Layers } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMemo } from "react";

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
    const { toast } = useToast();
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [modifierSearch, setModifierSearch] = useState("");
    const [searchResults, setSearchResults] = useState<NodeModifier[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mapType, setMapType] = useState<WarMapType>(WarMapType.STANDARD);
    
    // Derived selected node
    const selectedNode = selectedNodeId ? initialNodes.find(n => n.id === selectedNodeId) : null;

    // Allocation form state
    const [minTier, setMinTier] = useState<string>("");
    const [maxTier, setMaxTier] = useState<string>("");
    const [season, setSeason] = useState<string>("");
    const [selectedPreset, setSelectedPreset] = useState<string>("custom");

    // Editing state
    const [editingAllocation, setEditingAllocation] = useState<(WarNodeAllocation & { nodeModifier: NodeModifier }) | null>(null);

    // Copying state
    const [copySource, setCopySource] = useState<{ min: number | null, max: number | null } | null>(null);
    const [copyTargetPreset, setCopyTargetPreset] = useState<string>("custom");
    const [copyTargetMin, setCopyTargetMin] = useState<string>("");
    const [copyTargetMax, setCopyTargetMax] = useState<string>("");

    // Mass copying state
    const [massCopyDialogOpen, setMassCopyDialogOpen] = useState(false);
    const [massCopySourceMin, setMassCopySourceMin] = useState<string>("");
    const [massCopySourceMax, setMassCopySourceMax] = useState<string>("");
    const [massCopyTargetMin, setMassCopyTargetMin] = useState<string>("");
    const [massCopyTargetMax, setMassCopyTargetMax] = useState<string>("");

    // Grouping logic
    const groupedAllocations = useMemo(() => {
        if (!selectedNode) return [];
        const groups: Record<string, (WarNodeAllocation & { nodeModifier: NodeModifier })[]> = {};
        
        selectedNode.allocations
            .filter(a => a.mapType === mapType)
            .forEach(alloc => {
                const key = `${alloc.minTier ?? 'any'}-${alloc.maxTier ?? 'any'}-${alloc.season ?? 'any'}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(alloc);
            });

        return Object.entries(groups).map(([key, allocs]) => ({
            key,
            minTier: allocs[0].minTier,
            maxTier: allocs[0].maxTier,
            season: allocs[0].season,
            allocations: allocs
        })).sort((a, b) => (a.minTier ?? 0) - (b.minTier ?? 0));
    }, [selectedNode, mapType]);

    // Filter nodes based on map type (Standard: 1-50, Big Thing: 1-10)
    const displayedNodes = initialNodes.filter(n => 
        mapType === WarMapType.STANDARD ? n.nodeNumber <= 50 : n.nodeNumber <= 10
    );

    const debouncedSearch = useDebounce(modifierSearch, 300);

    useEffect(() => {
        let isMounted = true;

        if (debouncedSearch) {
            setIsSearching(true);
            const fetchModifiers = async () => {
                try {
                    const results = await searchModifiers(debouncedSearch);
                    if (isMounted) {
                        setSearchResults(results);
                    }
                } catch (error) {
                    console.error("Failed to search modifiers:", error);
                } finally {
                    if (isMounted) {
                        setIsSearching(false);
                    }
                }
            };
            fetchModifiers();
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }

        return () => {
            isMounted = false;
        };
    }, [debouncedSearch]);

    // Reset selected node when map type changes if out of range
    useEffect(() => {
        if (selectedNode) {
            if (mapType === WarMapType.BIG_THING && selectedNode.nodeNumber > 10) {
                setSelectedNodeId(null);
            }
        }
    }, [mapType, selectedNode]);

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

    const handleCopyTargetPresetChange = (value: string) => {
        setCopyTargetPreset(value);
        if (value === "custom") {
            setCopyTargetMin("");
            setCopyTargetMax("");
        } else {
            const preset = MCOC_TIER_PRESETS.find(p => p.name === value);
            if (preset) {
                setCopyTargetMin(String(preset.min));
                setCopyTargetMax(String(preset.max));
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
                season ? parseInt(season) : undefined,
                mapType
            );
            
            router.refresh();
            toast({
                title: "Modifier Added",
                description: `Successfully added ${modifier.name} to Node ${selectedNode.nodeNumber} (${mapType}).`,
            });
            setModifierSearch("");
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Failed to add allocation:", err);
            toast({
                title: "Failed to Add Modifier",
                description: err.message || "Please check the console for details.",
                variant: "destructive",
            });
        }
    };

    const handleUpdateAllocation = async (newModifierId?: string) => {
        if (!editingAllocation) return;
        
        try {
            await updateAllocation(
                editingAllocation.id,
                {
                    nodeModifierId: newModifierId,
                    minTier: minTier ? parseInt(minTier) : undefined,
                    maxTier: maxTier ? parseInt(maxTier) : undefined,
                    season: season ? parseInt(season) : undefined,
                }
            );
            
            router.refresh();
            toast({
                title: "Modifier Updated",
                description: "Successfully updated modifier settings.",
            });
            setEditingAllocation(null);
            setMinTier("");
            setMaxTier("");
            setSeason("");
            setSelectedPreset("custom");
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Failed to update allocation:", err);
            toast({
                title: "Failed to Update Modifier",
                description: err.message || "Please check the console for details.",
                variant: "destructive",
            });
        }
    };

    const handleCopyAllocations = async () => {
        if (!selectedNode || !copySource) return;
        
        try {
            await copyAllocations(
                selectedNode.id,
                copySource.min ?? 0, // 0 usually means null in terms of the function expecting numbers
                copySource.max ?? 0,
                copyTargetMin ? parseInt(copyTargetMin) : 0,
                copyTargetMax ? parseInt(copyTargetMax) : 0,
                mapType
            );
            
            router.refresh();
            toast({
                title: "Modifiers Copied",
                description: "Successfully duplicated modifiers to target tiers.",
            });
            setCopySource(null);
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Failed to copy allocations:", err);
            toast({
                title: "Failed to Copy Modifiers",
                description: err.message || "Please check the console for details.",
                variant: "destructive",
            });
        }
    };

    const handleMassCopyAllocations = async () => {
        try {
            await massCopyAllocations(
                massCopySourceMin ? parseInt(massCopySourceMin) : 0,
                massCopySourceMax ? parseInt(massCopySourceMax) : 0,
                massCopyTargetMin ? parseInt(massCopyTargetMin) : 0,
                massCopyTargetMax ? parseInt(massCopyTargetMax) : 0,
                mapType
            );
            
            router.refresh();
            toast({
                title: "Mass Copy Complete",
                description: "Successfully duplicated modifiers across all nodes to target tiers.",
            });
            setMassCopyDialogOpen(false);
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Failed to mass copy allocations:", err);
            toast({
                title: "Failed Mass Copy",
                description: err.message || "Please check the console for details.",
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
            if (editingAllocation?.id === allocationId) {
                setEditingAllocation(null);
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Failed to remove allocation:", err);
            toast({
                title: "Failed to Remove Modifier",
                description: err.message || "Please check the console for details.",
                variant: "destructive",
            });
        }
    };

    const startEditing = (alloc: WarNodeAllocation & { nodeModifier: NodeModifier }) => {
        setEditingAllocation(alloc);
        setMinTier(alloc.minTier ? String(alloc.minTier) : "");
        setMaxTier(alloc.maxTier ? String(alloc.maxTier) : "");
        setSeason(alloc.season ? String(alloc.season) : "");
        setSelectedPreset("custom");
    };

    const cancelEditing = () => {
        setEditingAllocation(null);
        setMinTier("");
        setMaxTier("");
        setSeason("");
        setSelectedPreset("custom");
    };

    return (
        <div className="container mx-auto py-8 h-[calc(100vh-64px)] flex flex-col gap-4">
            {/* Header / Map Type Selector */}
            <div className="flex items-center justify-between">
                <div className="w-64">
                    <Tabs value={mapType} onValueChange={(v) => setMapType(v as WarMapType)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-800">
                            <TabsTrigger value={WarMapType.STANDARD}>Standard</TabsTrigger>
                            <TabsTrigger value={WarMapType.BIG_THING}>Big Thing</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => setMassCopyDialogOpen(true)}>
                    <Layers className="h-4 w-4" />
                    Mass Copy All Nodes
                </Button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Left Sidebar: Node List */}
                <Card className="w-64 flex flex-col h-full bg-slate-950 border-slate-800">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm uppercase tracking-wider text-slate-500">
                            {mapType === WarMapType.STANDARD ? "Standard Nodes (1-50)" : "Big Thing Nodes (1-10)"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                            <div className="grid grid-cols-3 gap-2 p-4">
                                {displayedNodes.map(node => (
                                    <Button
                                        key={node.id}
                                        variant={selectedNodeId === node.id ? "default" : "outline"}
                                        className="h-12 w-full font-mono text-lg"
                                        onClick={() => setSelectedNodeId(node.id)}
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
                            {selectedNode ? `Editing Node ${selectedNode.nodeNumber} (${mapType})` : "Select a Node"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {selectedNode ? (
                            <div className="space-y-6">
                                {/* Current Allocations (Grouped) */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                                        <span>Active Modifiers</span>
                                        <Badge variant="outline" className="font-mono">
                                            {selectedNode.allocations.filter(a => a.mapType === mapType).length} Total
                                        </Badge>
                                    </h3>
                                    
                                    <div className="space-y-6">
                                        {groupedAllocations.length === 0 ? (
                                            <p className="text-muted-foreground italic">No modifiers assigned for this map type.</p>
                                        ) : (
                                            groupedAllocations.map(group => (
                                                <div key={group.key} className="space-y-3">
                                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="secondary" className="bg-sky-950 text-sky-400 border-sky-900">
                                                                {group.minTier && group.maxTier 
                                                                    ? (group.minTier === group.maxTier ? `Tier ${group.minTier}` : `Tiers ${group.minTier}-${group.maxTier}`)
                                                                    : "All Tiers"}
                                                            </Badge>
                                                            {group.season && (
                                                                <Badge variant="outline">Season {group.season}</Badge>
                                                            )}
                                                        </div>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-8 text-xs gap-2 hover:bg-sky-950 hover:text-sky-400"
                                                            onClick={() => {
                                                                setCopySource({ min: group.minTier ?? null, max: group.maxTier ?? null });
                                                                setCopyTargetPreset("custom");
                                                                setCopyTargetMin("");
                                                                setCopyTargetMax("");
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                            Copy Tier
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="grid gap-2">
                                                        {group.allocations.map(alloc => (
                                                            <div key={alloc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/50 group">
                                                                <div>
                                                                    <div className="font-bold text-sky-300 group-hover:text-sky-200">{alloc.nodeModifier.name}</div>
                                                                    <div className="text-sm text-slate-400">{alloc.nodeModifier.description}</div>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => startEditing(alloc)} 
                                                                        className="h-8 w-8 text-slate-400 hover:text-sky-400"
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => handleRemoveAllocation(alloc.id)} 
                                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-950"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Add/Edit Form */}
                                <div className="border-t border-slate-800 pt-6">
                                    <h3 className="text-lg font-semibold mb-4">
                                        {editingAllocation ? `Edit Modifier: ${editingAllocation.nodeModifier.name}` : "Add Modifier"}
                                    </h3>
                                    
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
                                            <Label>Best Tier</Label>
                                            <Input 
                                                type="number" 
                                                placeholder="Min (1)" 
                                                value={minTier} 
                                                onChange={e => setMinTier(e.target.value)}
                                                className="bg-slate-900 border-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <Label>Worst Tier</Label>
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

                                    <div className="space-y-4">
                                        {editingAllocation && (
                                            <div className="p-3 rounded-lg border border-sky-900 bg-sky-950/20 text-sky-400 text-sm flex items-center justify-between">
                                                <div>
                                                    <span className="font-semibold">Current Modifier:</span> {editingAllocation.nodeModifier.name}
                                                </div>
                                                <Button size="sm" onClick={() => handleUpdateAllocation()}>Save Tiers Only</Button>
                                            </div>
                                        )}

                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder={editingAllocation ? "Search to change modifier..." : "Search modifiers..."}
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

                                        {editingAllocation && (
                                            <Button variant="outline" className="w-full" onClick={cancelEditing}>Cancel Edit</Button>
                                        )}
                                    </div>

                                    <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto rounded-md border border-slate-800 p-2">
                                        {isSearching ? (
                                            <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                                        ) : searchResults.length > 0 ? (
                                            searchResults.map(mod => (
                                                <div 
                                                    key={mod.id} 
                                                    className="flex items-center justify-between p-2 hover:bg-slate-800 rounded group cursor-pointer" 
                                                    onClick={() => editingAllocation ? handleUpdateAllocation(mod.id) : handleAddAllocation(mod)}
                                                >
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-sm text-sky-300 group-hover:text-sky-200">
                                                            {editingAllocation ? `Replace with: ${mod.name}` : mod.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 line-clamp-1">{mod.description}</div>
                                                    </div>
                                                    {editingAllocation ? <Pencil className="h-4 w-4 text-sky-400" /> : <Plus className="h-4 w-4 text-slate-600 group-hover:text-sky-400" />}
                                                </div>
                                            ))
                                        ) : modifierSearch ? (
                                            <div className="text-center text-muted-foreground p-4">No results found</div>
                                        ) : (
                                            !editingAllocation && <div className="text-center text-muted-foreground p-4">Type to search...</div>
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

            {/* Copy Tier Dialog */}
            <Dialog open={!!copySource} onOpenChange={(open) => !open && setCopySource(null)}>
                <DialogContent className="bg-slate-950 border-slate-800 text-slate-200">
                    <DialogHeader>
                        <DialogTitle>Copy Modifiers (Current Node)</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Source</div>
                                <div className="font-bold text-sky-400">
                                    {copySource?.min && copySource?.max 
                                        ? (copySource.min === copySource.max ? `Tier ${copySource.min}` : `Tiers ${copySource.min}-${copySource.max}`)
                                        : "All Tiers"}
                                </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-600" />
                            <div className="text-right">
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Target</div>
                                <div className="font-bold text-sky-400">
                                    {copyTargetMin && copyTargetMax 
                                        ? (copyTargetMin === copyTargetMax ? `Tier ${copyTargetMin}` : `Tiers ${copyTargetMin}-${copyTargetMax}`)
                                        : "Select Target..."}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label>Target Tier Preset</Label>
                                <Select value={copyTargetPreset} onValueChange={handleCopyTargetPresetChange}>
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
                                    <Label>Target Best Tier</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="Min" 
                                        value={copyTargetMin} 
                                        onChange={e => setCopyTargetMin(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                </div>
                                <div>
                                    <Label>Target Worst Tier</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="Max" 
                                        value={copyTargetMax} 
                                        onChange={e => setCopyTargetMax(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCopySource(null)}>Cancel</Button>
                        <Button onClick={handleCopyAllocations} disabled={!copyTargetMin || !copyTargetMax}>
                            Confirm Copy
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mass Copy Dialog */}
            <Dialog open={massCopyDialogOpen} onOpenChange={setMassCopyDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-slate-200">
                    <DialogHeader>
                        <DialogTitle>Mass Copy Modifiers (All Nodes)</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="p-4 rounded-lg bg-red-950/20 border border-red-900 text-red-400 text-sm">
                            <strong>Warning:</strong> This will copy all modifiers from the source tier range to the target tier range for <strong>EVERY</strong> node on the current map ({mapType}).
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-400 text-sm uppercase">Source Range</h4>
                                <div>
                                    <Label>Source Best Tier</Label>
                                    <Input 
                                        type="number" 
                                        value={massCopySourceMin} 
                                        onChange={e => setMassCopySourceMin(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                </div>
                                <div>
                                    <Label>Source Worst Tier</Label>
                                    <Input 
                                        type="number" 
                                        value={massCopySourceMax} 
                                        onChange={e => setMassCopySourceMax(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-400 text-sm uppercase">Target Range</h4>
                                <div>
                                    <Label>Target Best Tier</Label>
                                    <Input 
                                        type="number" 
                                        value={massCopyTargetMin} 
                                        onChange={e => setMassCopyTargetMin(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                </div>
                                <div>
                                    <Label>Target Worst Tier</Label>
                                    <Input 
                                        type="number" 
                                        value={massCopyTargetMax} 
                                        onChange={e => setMassCopyTargetMax(e.target.value)}
                                        className="bg-slate-900 border-slate-800"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMassCopyDialogOpen(false)}>Cancel</Button>
                        <Button 
                            variant="destructive"
                            onClick={handleMassCopyAllocations} 
                            disabled={!massCopySourceMin || !massCopySourceMax || !massCopyTargetMin || !massCopyTargetMax}
                        >
                            Confirm Mass Copy
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
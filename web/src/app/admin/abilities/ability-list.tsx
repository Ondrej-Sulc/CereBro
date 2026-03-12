"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Edit2, Trash2, Plus, Check, Search, Sparkles } from "lucide-react"
import { createAbility, updateAbility, deleteAbility } from "./actions"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from "next/navigation"

type Ability = {
    id: number;
    name: string;
    description: string | null;
    emoji: string | null;
    categories: { id: number; name: string }[];
    _count: { champions: number };
}

type Category = {
    id: number;
    name: string;
}

function DiscordEmoji({ emoji, className }: { emoji: string | null, className?: string }) {
    if (!emoji) return null;
    
    const match = emoji.match(/<(a?):([a-zA-Z0-9_]+):(\d+)>/);
    if (match) {
        const isAnimated = match[1] === 'a';
        const name = match[2];
        const id = match[3];
        const ext = isAnimated ? 'gif' : 'png';
        return (
            <img 
                src={`https://cdn.discordapp.com/emojis/${id}.${ext}`} 
                alt={name} 
                title={`:${name}:`}
                className={cn("w-6 h-6 inline-block object-contain", className)}
            />
        );
    }
    // Fallback to text if it's not a standard discord emoji (e.g. unicode)
    return <span className={cn("text-lg inline-block text-center", className)}>{emoji}</span>;
}

export function AbilityList({ initialAbilities, allCategories }: { initialAbilities: Ability[], allCategories: Category[] }) {
    const abilities = initialAbilities;
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [emoji, setEmoji] = useState("")
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const { toast } = useToast()
    const router = useRouter()

    const handleOpenDialog = (ability?: Ability) => {
        if (ability) {
            setEditingAbility(ability)
            setName(ability.name)
            setDescription(ability.description || "")
            setEmoji(ability.emoji || "")
            setSelectedCategoryIds(ability.categories.map(c => c.id))
        } else {
            setEditingAbility(null)
            setName("")
            setDescription("")
            setEmoji("")
            setSelectedCategoryIds([])
        }
        setIsDialogOpen(true)
    }

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds(prev => 
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        )
    }

    const handleSave = async () => {
        if (!name.trim()) return

        setIsSubmitting(true)
        try {
            if (editingAbility) {
                await updateAbility(editingAbility.id, name, description || null, emoji || null, selectedCategoryIds)
                toast({ title: "Ability updated" })
            } else {
                await createAbility(name, description || null, emoji || null, selectedCategoryIds)
                toast({ title: "Ability created" })
            }
            setIsDialogOpen(false)
            router.refresh()
        } catch (error) {
            toast({ title: "Error saving ability", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure? This will remove this ability from all champions.")) return
        try {
            await deleteAbility(id)
            toast({ title: "Ability deleted" })
            router.refresh()
        } catch (error) {
            toast({ title: "Error deleting ability", variant: "destructive" })
        }
    }

    const filteredAbilities = abilities.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search abilities..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-card"
                    />
                </div>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 mr-2" /> Add Ability
                </Button>
            </div>

            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[300px]">Ability</TableHead>
                            <TableHead>Categories</TableHead>
                            <TableHead className="w-[150px] text-center">Linked Champions</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAbilities.map((ability) => (
                            <TableRow key={ability.id} className="group">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-md bg-muted/50 border flex items-center justify-center shrink-0 shadow-inner">
                                            {ability.emoji ? (
                                                <DiscordEmoji emoji={ability.emoji} />
                                            ) : (
                                                <Sparkles className="w-4 h-4 text-muted-foreground/30" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{ability.name}</div>
                                            {ability.description && (
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px] xl:max-w-[300px]" title={ability.description}>
                                                    {ability.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {ability.categories.length > 0 ? (
                                            ability.categories.map(c => (
                                                <Badge key={c.id} variant="secondary" className="text-[10px] font-medium bg-background border-muted-foreground/20 hover:bg-muted">
                                                    {c.name}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50 italic">Uncategorized</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                        {ability._count.champions}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(ability)} aria-label="Edit ability">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(ability.id)} aria-label="Delete ability">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredAbilities.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Sparkles className="w-8 h-8 opacity-20" />
                                        <p>No abilities found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingAbility ? "Edit Ability" : "Add Ability"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bleed" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Discord Emoji</Label>
                                    {emoji && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            Preview: <DiscordEmoji emoji={emoji} className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                                <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="e.g. <:bleed:123456789>" className="font-mono text-sm" />
                                <p className="text-[10px] text-muted-foreground">Format: <code>&lt;:name:id&gt;</code> or <code>&lt;a:name:id&gt;</code></p>
                            </div>
                            <div className="space-y-2">
                                <Label>Description (Optional)</Label>
                                <Textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    placeholder="Brief description of how the ability works..."
                                    className="h-24 resize-none"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2 flex flex-col h-[350px]">
                            <Label>Categories</Label>
                            <div className="border rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm bg-muted/20">
                                <div className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                                    Select Mappings
                                </div>
                                <ScrollArea className="flex-1 p-2">
                                    <div className="space-y-1">
                                        {allCategories.map(category => {
                                            const isSelected = selectedCategoryIds.includes(category.id);
                                            return (
                                                <button
                                                    key={category.id}
                                                    type="button"
                                                    onClick={() => toggleCategory(category.id)}
                                                    aria-pressed={isSelected}
                                                    className={cn(
                                                        "flex items-center w-full px-2 py-2 text-sm rounded-md transition-all border border-transparent",
                                                        isSelected 
                                                            ? "bg-primary/10 text-primary font-medium border-primary/20 shadow-sm" 
                                                            : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "mr-3 h-4 w-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
                                                        isSelected 
                                                            ? "border-primary bg-primary text-primary-foreground" 
                                                            : "border-muted-foreground/30 bg-background"
                                                    )}>
                                                        {isSelected && <Check className="h-3 w-3" />}
                                                    </div>
                                                    <span className="truncate">{category.name}</span>
                                                </button>
                                            )
                                        })}
                                        {allCategories.length === 0 && (
                                            <div className="text-center py-8 text-xs text-muted-foreground italic">
                                                No categories created yet.
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !name.trim()}>Save Ability</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { ChampionAbilityLink, AbilityLinkType, Ability, AttackType } from "@prisma/client"
import { updateChampionAbility, removeChampionAbility, updateChampionDetails, addSynergy, removeSynergy, saveChampionAttacks } from "./actions"
import { AdminChampionData } from "./champion-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown, Trash2, Plus, CalendarIcon, Save, X, Edit2, Sword } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getChampionImageUrl } from "@/lib/championHelper"
import Image from "next/image"
import { ChampionImages } from "@/types/champion"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { CLASSES } from "@/app/profile/roster/constants"
import { Badge } from "@/components/ui/badge"

interface ChampionEditorProps {
  champion: AdminChampionData | null
  allChampions: { id: number; name: string }[]
  allAbilities: Ability[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ATTACK_TYPES_BASIC: AttackType[] = ["L1", "L2", "L3", "L4", "M1", "M2", "H"]
const ATTACK_TYPES_SPECIAL: AttackType[] = ["S1", "S2"]
const COMMON_HIT_PROPERTIES = ["Contact", "Physical", "Energy", "Projectile"]

export function ChampionEditor({ champion, allChampions, allAbilities, open, onOpenChange }: ChampionEditorProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")

  // Form States
  const [name, setName] = useState("")
  const [shortName, setShortName] = useState("")
  const [champClass, setChampClass] = useState<string>("")
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined)
  const [obtainable, setObtainable] = useState<string>("") // comma separated for now
  
  // Ability States
  const [newAbilityId, setNewAbilityId] = useState<number | null>(null)
  const [newType, setNewType] = useState<AbilityLinkType>("ABILITY")
  
  // Combobox States
  const [abilityComboboxOpen, setAbilityComboboxOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingInstance, setIsAddingInstance] = useState(false)

  // Load data on open
  useEffect(() => {
    if (champion) {
        setName(champion.name)
        setShortName(champion.shortName)
        setChampClass(champion.class)
        setReleaseDate(new Date(champion.releaseDate))
        setObtainable(champion.obtainable.join(", "))
    }
  }, [champion])

  // Group abilities and sort alphabetically
  const groupedAbilities = useMemo(() => {
      if (!champion) return []
      
      const groups: Record<string, typeof champion.abilities> = {}
      
      champion.abilities.forEach(link => {
          // Use name as key to group Ability and Immunity together
          const key = link.ability.name
          if (!groups[key]) {
              groups[key] = []
          }
          groups[key].push(link)
      })
      
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [champion])

  if (!champion) return null

  const handleSaveDetails = async () => {
    if (!name || !shortName || !champClass || !releaseDate) {
        toast({ title: "Please fill in all required fields", variant: "destructive" })
        return
    }

    setIsSubmitting(true)
    try {
        await updateChampionDetails(champion.id, {
            name,
            shortName,
            class: champClass,
            releaseDate,
            obtainable: obtainable.split(",").map(s => s.trim()).filter(Boolean)
        })
        toast({ title: "Details updated" })
    } catch (error) {
        toast({ title: "Failed to update details", variant: "destructive" })
    } finally {
        setIsSubmitting(false)
    }
  }

  const handleAddAbilityLink = async () => {
    if (!newAbilityId) return

    setIsSubmitting(true)
    try {
      await updateChampionAbility(undefined, champion.id, newAbilityId, newType, undefined)
      toast({ title: "Ability added" })
      setNewAbilityId(null)
    } catch (error) {
      toast({ title: "Error adding ability", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddInstance = async (abilityId: number, type: AbilityLinkType) => {
      setIsAddingInstance(true)
      try {
          await updateChampionAbility(undefined, champion.id, abilityId, type, undefined)
          toast({ title: "Ability instance added" })
      } catch (error) {
          toast({ title: "Failed to add instance", variant: "destructive" })
      } finally {
          setIsAddingInstance(false)
      }
  }

  const handleRemoveLink = async (linkId: number) => {
    try {
      await removeChampionAbility(linkId)
      toast({ title: "Ability removed" })
    } catch (error) {
      toast({ title: "Error removing ability", variant: "destructive" })
    }
  }

  const handleUpdateSource = async (linkId: number, source: string, type: AbilityLinkType) => {
      try {
          // Find the link to get current values
          const link = champion.abilities.find(a => a.id === linkId)
          if (!link) return

          await updateChampionAbility(linkId, champion.id, link.abilityId, type, source || undefined)
          toast({ title: "Source updated" })
      } catch (error) {
          toast({ title: "Failed to update source", variant: "destructive" })
      }
  }

  const handleAddSynergy = async (linkId: number, championId: number) => {
      try {
          await addSynergy(linkId, championId)
          toast({ title: "Synergy added" })
      } catch (error) {
           toast({ title: "Failed to add synergy", variant: "destructive" })
      }
  }

  const handleRemoveSynergy = async (linkId: number, championId: number) => {
      try {
          await removeSynergy(linkId, championId)
          toast({ title: "Synergy removed" })
      } catch (error) {
          toast({ title: "Failed to remove synergy", variant: "destructive" })
      }
  }

  const images = champion.images as unknown as ChampionImages

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="flex flex-col h-full">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
                <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-full border border-slate-700 overflow-hidden">
                        <Image src={getChampionImageUrl(images, '64')} alt={champion.name} fill className="object-cover" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl">{champion.name}</DialogTitle>
                        <DialogDescription>
                            {champion.class} • Released {format(new Date(champion.releaseDate), 'MMM yyyy')}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-6 border-b shrink-0">
                    <TabsList className="bg-transparent h-12 w-full justify-start gap-6 p-0">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0">Details</TabsTrigger>
                        <TabsTrigger value="abilities" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0">Abilities & Immunities</TabsTrigger>
                        <TabsTrigger value="attacks" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0">Attacks</TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 bg-slate-950/50 min-h-0 flex flex-col">
                    <TabsContent value="overview" className="mt-0 flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Short Name (Internal ID)</Label>
                                    <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Class</Label>
                                    <Select value={champClass} onValueChange={setChampClass}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CLASSES.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2 flex flex-col">
                                    <Label>Release Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !releaseDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {releaseDate ? format(releaseDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={releaseDate}
                                                onSelect={setReleaseDate}
                                                autoFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label>Obtainable In (Comma separated)</Label>
                                    <Input value={obtainable} onChange={(e) => setObtainable(e.target.value)} placeholder="3, 4, 5, 6, 7" />
                                </div>
                            </div>
                        </div>

                        {/* Image Assets View */}
                        <div className="space-y-3">
                            <Label>Assets</Label>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <span className="text-xs text-muted-foreground">Primary (Full)</span>
                                    <div className="relative aspect-square rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                                        <Image src={getChampionImageUrl(images, 'full', 'primary')} alt="Primary" fill className="object-contain" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-xs text-muted-foreground">Secondary (Full)</span>
                                    <div className="relative aspect-square rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                                        <Image src={getChampionImageUrl(images, 'full', 'secondary')} alt="Secondary" fill className="object-contain" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-xs text-muted-foreground">Hero (Landscape)</span>
                                    <div className="relative aspect-square rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                                        <Image src={getChampionImageUrl(images, 'full', 'hero')} alt="Hero" fill className="object-contain" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveDetails} disabled={isSubmitting}>Save Changes</Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="abilities" className="mt-0 flex-1 p-6 data-[state=active]:flex flex-col h-full min-h-0">
                        {/* Add New Ability Bar */}
                        <div className="p-4 border rounded-lg bg-background/50 space-y-4 shrink-0 shadow-sm mb-6">
                            <div className="flex items-end gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label>Add New Ability/Immunity Group</Label>
                                    <div className="flex gap-2">
                                        <Popover open={abilityComboboxOpen} onOpenChange={setAbilityComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={abilityComboboxOpen}
                                                className="w-full justify-between"
                                                >
                                                {newAbilityId
                                                    ? allAbilities.find((a) => a.id === newAbilityId)?.name
                                                    : "Select ability..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0">
                                                <Command>
                                                <CommandInput placeholder="Search ability..." />
                                                <CommandList>
                                                    <CommandEmpty>No ability found.</CommandEmpty>
                                                    <CommandGroup>
                                                    {allAbilities.map((ability) => (
                                                        <CommandItem
                                                        key={ability.id}
                                                        value={ability.name}
                                                        onSelect={() => {
                                                            setNewAbilityId(ability.id)
                                                            setAbilityComboboxOpen(false)
                                                        }}
                                                        >
                                                        <Check
                                                            className={cn(
                                                            "mr-2 h-4 w-4",
                                                            newAbilityId === ability.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {ability.name}
                                                        </CommandItem>
                                                    ))}
                                                    </CommandGroup>
                                                </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>

                                        <Select value={newType} onValueChange={(v) => setNewType(v as AbilityLinkType)}>
                                            <SelectTrigger className="w-[140px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ABILITY">Ability</SelectItem>
                                                <SelectItem value="IMMUNITY">Immunity</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        
                                        <Button onClick={handleAddAbilityLink} disabled={!newAbilityId || isSubmitting}>
                                            <Plus className="w-4 h-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grouped Abilities List */}
                        <ScrollArea className="flex-1 pr-4 -mr-4">
                            <div className="space-y-6 pb-20 pr-4">
                                {groupedAbilities.map(([title, links]) => {
                                    const hasImmunity = links.some(l => l.type === "IMMUNITY")
                                    const hasAbility = links.some(l => l.type === "ABILITY")
                                    const firstLink = links[0]
                                    
                                    return (
                                        <div key={title} className="border rounded-lg bg-card overflow-hidden">
                                            <div className={cn(
                                                "px-4 py-2 border-b flex items-center gap-3",
                                                hasImmunity && !hasAbility ? "bg-sky-500/10 border-sky-500/20" : 
                                                !hasImmunity && hasAbility ? "bg-amber-500/10 border-amber-500/20" :
                                                "bg-muted/50 border-muted"
                                            )}>
                                                <span className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    hasImmunity && !hasAbility ? "bg-sky-500" : 
                                                    !hasImmunity && hasAbility ? "bg-amber-500" :
                                                    "bg-slate-400"
                                                )} />
                                                <h4 className={cn(
                                                    "font-bold text-sm uppercase tracking-wide",
                                                    hasImmunity && !hasAbility ? "text-sky-500" : 
                                                    !hasImmunity && hasAbility ? "text-amber-500" :
                                                    "text-slate-200"
                                                )}>
                                                    {title}
                                                </h4>
                                                <div className="ml-auto">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-6 text-xs"
                                                        onClick={() => handleAddInstance(firstLink.abilityId, firstLink.type)}
                                                        disabled={isAddingInstance}
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" /> Add Instance
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="divide-y divide-border/50">
                                                {links.map((link) => (
                                                    <AbilityLinkRow 
                                                        key={link.id} 
                                                        link={link} 
                                                        allChampions={allChampions}
                                                        onUpdateSource={(source) => handleUpdateSource(link.id, source, link.type)}
                                                        onAddSynergy={(champId) => handleAddSynergy(link.id, champId)}
                                                        onRemoveSynergy={(champId) => handleRemoveSynergy(link.id, champId)}
                                                        onDelete={() => handleRemoveLink(link.id)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="attacks" className="mt-0 flex-1 p-6 h-full min-h-0">
                        <ScrollArea className="h-full pr-4 -mr-4">
                            <div className="space-y-8 pb-10 pr-4">
                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 px-1">Basic Attacks</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {ATTACK_TYPES_BASIC.map(type => (
                                            <AttackEditor 
                                                key={type} 
                                                type={type} 
                                                championId={champion.id}
                                                existingAttack={champion.attacks.find(a => a.type === type)}
                                            />
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 px-1">Special Attacks</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {ATTACK_TYPES_SPECIAL.map(type => (
                                            <AttackEditor 
                                                key={type} 
                                                type={type} 
                                                championId={champion.id}
                                                existingAttack={champion.attacks.find(a => a.type === type)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AbilityLinkRow({ link, allChampions, onUpdateSource, onAddSynergy, onRemoveSynergy, onDelete }: {
    link: AdminChampionData['abilities'][number],
    allChampions: { id: number; name: string }[],
    onUpdateSource: (val: string) => void,
    onAddSynergy: (id: number) => void,
    onRemoveSynergy: (id: number) => void,
    onDelete: () => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [source, setSource] = useState(link.source || "")
    const [synergyOpen, setSynergyOpen] = useState(false)

    // Update local state if prop changes
    useEffect(() => {
        setSource(link.source || "")
    }, [link.source])

    if (!isEditing) {
        return (
            <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                            {link.source || <span className="text-muted-foreground italic">No specific source</span>}
                        </div>
                    </div>
                    
                    {/* Compact Synergy View */}
                    <div className="flex items-center gap-1">
                        {link.synergyChampions.length > 0 ? (
                            <div className="flex -space-x-2">
                                {link.synergyChampions.slice(0, 5).map(synergy => {
                                    const images = synergy.champion.images as unknown as ChampionImages
                                    return (
                                        <div key={synergy.champion.id} className="relative w-6 h-6 rounded-full border border-background overflow-hidden ring-1 ring-border" title={synergy.champion.name}>
                                            <Image src={getChampionImageUrl(images, '32')} alt={synergy.champion.name} fill className="object-cover" />
                                        </div>
                                    )
                                })}
                                {link.synergyChampions.length > 5 && (
                                    <div className="relative w-6 h-6 rounded-full border border-background bg-muted flex items-center justify-center text-[9px] font-bold ring-1 ring-border">
                                        +{link.synergyChampions.length - 5}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground/50 italic">No synergies</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setIsEditing(true)}
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={onDelete}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col gap-4 bg-muted/20 border-l-2 border-primary">
            <div className="flex justify-between items-start">
                <h5 className="text-sm font-semibold">Editing Source</h5>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setIsEditing(false)}
                >
                    Done
                </Button>
            </div>

            <div className="flex gap-4 items-start">
                <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Source Description</Label>
                    <div className="flex gap-2">
                        <Input 
                            value={source} 
                            onChange={(e) => setSource(e.target.value)} 
                            className="h-8 text-sm"
                            placeholder="e.g. While Awakened"
                        />
                        {source !== (link.source || "") && (
                            <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => onUpdateSource(source)}>
                                <Save className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                     <Label className="text-xs text-muted-foreground">Synergies</Label>
                     <Popover open={synergyOpen} onOpenChange={setSynergyOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2">
                                <Plus className="w-3 h-3 mr-1" /> Add Synergy
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                            <Command>
                                <CommandInput placeholder="Search champion..." />
                                <CommandList>
                                    <CommandEmpty>No champion found.</CommandEmpty>
                                    <CommandGroup>
                                        {allChampions.map((c) => (
                                            <CommandItem 
                                                key={c.id} 
                                                value={c.name}
                                                onSelect={() => {
                                                    onAddSynergy(c.id)
                                                    setSynergyOpen(false)
                                                }}
                                            >
                                                {c.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                     </Popover>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    {link.synergyChampions.length === 0 && (
                        <div className="text-[11px] text-muted-foreground italic px-2 py-1 border border-dashed rounded bg-muted/30">
                            No active synergies linked
                        </div>
                    )}
                    {link.synergyChampions.map(synergy => {
                         const images = synergy.champion.images as unknown as ChampionImages
                         return (
                            <Badge key={synergy.champion.id} variant="secondary" className="pl-1 pr-2 py-0.5 h-7 gap-1.5 bg-background border">
                                <div className="relative w-5 h-5 rounded-full overflow-hidden border border-muted-foreground/20">
                                    <Image src={getChampionImageUrl(images, '32')} alt={synergy.champion.name} fill className="object-cover" />
                                </div>
                                <span className="font-normal">{synergy.champion.name}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-4 w-4 ml-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive -mr-1"
                                    onClick={() => onRemoveSynergy(synergy.champion.id)}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </Badge>
                         )
                    })}
                </div>
            </div>
            
            <div className="flex justify-end pt-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={onDelete}
                >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete Entire Link
                </Button>
            </div>
        </div>
    )
}

// -- Hit Grouping Logic --

interface HitGroup {
    id: string
    count: number
    properties: string[]
}

function groupHits(hits: { properties: string[] }[]): HitGroup[] {
    if (hits.length === 0) return []
    
    const groups: HitGroup[] = []
    let currentGroup: HitGroup = { 
        id: crypto.randomUUID(), 
        count: 1, 
        properties: [...hits[0].properties].sort() 
    }

    for (let i = 1; i < hits.length; i++) {
        const hit = hits[i]
        const props = [...hit.properties].sort()
        
        // Compare sorted properties
        if (JSON.stringify(props) === JSON.stringify(currentGroup.properties)) {
            currentGroup.count++
        } else {
            groups.push(currentGroup)
            currentGroup = { 
                id: crypto.randomUUID(), 
                count: 1, 
                properties: props 
            }
        }
    }
    groups.push(currentGroup)
    return groups
}

function flattenGroups(groups: HitGroup[]): { properties: string[] }[] {
    return groups.flatMap(group => 
        Array(group.count).fill(null).map(() => ({ properties: group.properties }))
    )
}

function AttackEditor({ type, championId, existingAttack }: { type: AttackType, championId: number, existingAttack: AdminChampionData['attacks'][0] | undefined }) {
    const [groups, setGroups] = useState<HitGroup[]>(() => groupHits(existingAttack?.hits.map(h => ({ properties: h.properties })) || []))
    const [isSaving, setIsSaving] = useState(false)
    const { toast } = useToast()

    const handleSave = async () => {
        setIsSaving(true)
        const flatHits = flattenGroups(groups)
        try {
            await saveChampionAttacks(championId, type, flatHits)
            toast({ title: `${type} saved` })
        } catch (error) {
            toast({ title: "Failed to save attack", variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    const addGroup = () => {
        setGroups([...groups, { id: crypto.randomUUID(), count: 1, properties: ["Contact", "Physical"] }])
    }

    const removeGroup = (index: number) => {
        setGroups(groups.filter((_, i) => i !== index))
    }

    const updateGroupCount = (index: number, count: number) => {
        if (count < 1) return
        const newGroups = [...groups]
        newGroups[index] = { ...newGroups[index], count }
        setGroups(newGroups)
    }

    const toggleGroupProperty = (groupIndex: number, property: string) => {
        const newGroups = [...groups]
        const currentProps = newGroups[groupIndex].properties
        let newProps: string[]
        if (currentProps.includes(property)) {
            newProps = currentProps.filter(p => p !== property).sort()
        } else {
            newProps = [...currentProps, property].sort()
        }
        newGroups[groupIndex] = { ...newGroups[groupIndex], properties: newProps }
        setGroups(newGroups)
    }

    const totalHits = groups.reduce((acc, g) => acc + g.count, 0)
    const currentFlatHits = flattenGroups(groups)
    const originalFlatHits = existingAttack?.hits.map(h => ({ properties: [...h.properties].sort() })) || []
    const hasChanges = JSON.stringify(currentFlatHits) !== JSON.stringify(originalFlatHits)

    return (
        <div className={cn(
            "border rounded-xl bg-slate-900/40 flex flex-col h-auto min-h-[180px] max-h-[400px] transition-all border-slate-800",
            hasChanges && "ring-1 ring-primary/30 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
        )}>
            <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-800/30 border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center font-bold text-sm font-mono text-primary shadow-inner">
                        {type}
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none mb-1">
                            {type.startsWith('S') ? 'Special' : 'Basic'}
                        </div>
                        <div className="text-xs font-semibold text-slate-300 leading-none">
                            {totalHits} Hit{totalHits !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                {hasChanges && (
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 w-7 p-0 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm animate-in fade-in zoom-in"
                        onClick={handleSave} 
                        disabled={isSaving}
                    >
                        <Save className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {groups.map((group, i) => (
                    <div key={group.id} className="space-y-2 p-3 rounded-lg bg-slate-950/40 border border-slate-800/50 group relative">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md overflow-hidden">
                                <button 
                                    className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono border-r border-slate-800"
                                    onClick={() => updateGroupCount(i, group.count - 1)}
                                >
                                    -
                                </button>
                                <span className="px-2 text-xs font-mono font-bold w-8 text-center">{group.count}</span>
                                <button 
                                    className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono border-l border-slate-800"
                                    onClick={() => updateGroupCount(i, group.count + 1)}
                                >
                                    +
                                </button>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                {group.count > 1 ? 'Hits' : 'Hit'}
                            </span>
                            
                            <div className="ml-auto">
                                <button 
                                    onClick={() => removeGroup(i)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-slate-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5">
                            {COMMON_HIT_PROPERTIES.map(prop => {
                                const isActive = group.properties.includes(prop)
                                return (
                                    <button
                                        key={prop}
                                        onClick={() => toggleGroupProperty(i, prop)}
                                        className={cn(
                                            "text-[10px] px-2 py-1 rounded-md border transition-all font-medium",
                                            isActive 
                                                ? "bg-primary/20 border-primary/40 text-primary" 
                                                : "bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-600"
                                        )}
                                    >
                                        {prop}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}

                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full border-dashed border-2 border-slate-800/50 hover:border-primary/30 hover:bg-primary/5 text-slate-500 hover:text-primary h-10 transition-dashed" 
                    onClick={addGroup}
                >
                    <Plus className="w-3.5 h-3.5 mr-2" /> 
                    <span className="text-xs">Add Hit Group</span>
                </Button>
            </div>
        </div>
    )
}
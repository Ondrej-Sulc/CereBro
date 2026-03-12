"use client"

import { useState, useEffect, useMemo } from "react"
import { ChampionAbilityLink, AbilityLinkType, Ability, AttackType } from "@prisma/client"
import { updateChampionAbility, removeChampionAbility, updateChampionDetails, addSynergy, removeSynergy, saveChampionAttacks, updateChampionFullAbilities } from "./actions"
import { AdminChampionData } from "./champion-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Check, ChevronsUpDown, Trash2, Plus, CalendarIcon, Save, X, Edit2, Sword, Shield, Zap } from "lucide-react"
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
import { getChampionClassColors } from "@/lib/championClassHelper"

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
  const [activeTab, setActiveTab] = useState("info")

  // Form States
  const [name, setName] = useState("")
  const [shortName, setShortName] = useState("")
  const [champClass, setChampClass] = useState<string>("")
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined)
  const [obtainable, setObtainable] = useState<string>("") // comma separated for now
  
  // JSON Editor State
  const [fullAbilitiesJson, setFullAbilitiesJson] = useState("")
  const [isEditingJson, setIsEditingJson] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Ability States
  const [newAbilityId, setNewAbilityId] = useState<number | null>(null)
  const [newType, setNewType] = useState<AbilityLinkType>("ABILITY")
  
  // Combobox States
  const [abilityComboboxOpen, setAbilityComboboxOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingInstance, setIsAddingInstance] = useState(false)

  // Load data on open
  useEffect(() => {
    if (champion && open) {
        // Form Data
        setName(champion.name)
        setShortName(champion.shortName)
        setChampClass(champion.class)
        setReleaseDate(new Date(champion.releaseDate))
        setObtainable(champion.obtainable.join(", "))

        // Reset Editor State
        setActiveTab("info")
        setNewAbilityId(null)
        setNewType("ABILITY")
        setAbilityComboboxOpen(false)
        setIsAddingInstance(false)
        
        setIsEditingJson(false)
        setJsonError(null)
        setFullAbilitiesJson(champion.fullAbilities ? JSON.stringify(champion.fullAbilities, null, 2) : "{}")
    }
  }, [champion, open])

  // Group abilities and sort alphabetically
  const groupedAbilities = useMemo(() => {
      if (!champion) return { abilities: [], immunities: [] }
      
      const abilities: Record<string, typeof champion.abilities> = {}
      const immunities: Record<string, typeof champion.abilities> = {}
      
      champion.abilities.forEach(link => {
          const key = link.ability.name
          if (link.type === "ABILITY") {
              if (!abilities[key]) abilities[key] = []
              abilities[key].push(link)
          } else if (link.type === "IMMUNITY") {
              if (!immunities[key]) immunities[key] = []
              immunities[key].push(link)
          }
      })
      
      return {
          abilities: Object.entries(abilities).sort((a, b) => a[0].localeCompare(b[0])),
          immunities: Object.entries(immunities).sort((a, b) => a[0].localeCompare(b[0]))
      }
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

  const handleSaveJson = async () => {
    let parsedJson;
    try {
      parsedJson = JSON.parse(fullAbilitiesJson)
      setJsonError(null)
    } catch (error: any) {
      setJsonError(error.message || "Invalid JSON format")
      toast({ title: "Invalid JSON format", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      await updateChampionFullAbilities(champion.id, parsedJson)
      toast({ title: "Descriptions JSON updated" })
      setIsEditingJson(false)
    } catch (error: any) {
      setJsonError(error.message || "Server Error")
      toast({ title: "Failed to save JSON", description: error.message, variant: "destructive" })
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

  const images = champion.images
  const classColors = getChampionClassColors(champion.class)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-slate-800 shadow-2xl sm:rounded-2xl">
        <div className="flex flex-col h-full relative">
            {/* Header with Class Gradient Background */}
            <DialogHeader className="px-8 py-6 border-b border-slate-800 shrink-0 relative overflow-hidden bg-slate-900/50">
                {/* Dynamic Class Background Effect */}
                <div className={cn(
                    "absolute inset-0 opacity-10 blur-3xl pointer-events-none transition-colors duration-500",
                    classColors.bg
                )} />
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none rounded-bl-full" />
                
                <div className="flex items-center gap-5 relative z-10">
                    <div className={cn(
                        "relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 transition-colors",
                        classColors.border,
                        "ring-4 ring-slate-950"
                    )}>
                        <Image src={getChampionImageUrl(images, '64')} alt={champion.name} fill className="object-cover" />
                        <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] pointer-events-none" />
                    </div>
                    <div>
                        <DialogTitle className="text-3xl font-extrabold tracking-tight text-white mb-1 flex items-center gap-2">
                            {champion.name}
                            <Badge variant="outline" className={cn(
                                "ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0 border-transparent shadow-sm",
                                classColors.bg, classColors.text
                            )}>
                                {champion.class}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <span className="bg-slate-800/50 px-2 py-0.5 rounded text-xs font-mono">{champion.shortName}</span>
                            <span>•</span>
                            Released {format(new Date(champion.releaseDate), 'MMMM yyyy')}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            {/* Refined Tabs Segmented Control */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 bg-slate-950">
                <div className="px-8 py-3 border-b border-slate-800/50 shrink-0 bg-slate-900/30">
                    <TabsList className="bg-slate-900 border border-slate-800 h-10 p-1 w-full flex gap-1 rounded-lg">
                        <TabsTrigger value="info" className="flex-1 rounded-md text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
                            Configuration
                        </TabsTrigger>
                        <TabsTrigger value="descriptions" className="flex-1 rounded-md text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
                            Descriptions
                        </TabsTrigger>
                        <TabsTrigger value="abilities" className="flex-1 rounded-md text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
                            Abilities & Links
                        </TabsTrigger>
                        <TabsTrigger value="attacks" className="flex-1 rounded-md text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
                            Attacks & Hits
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 bg-[url('/assets/noise.svg')] bg-[length:100px_100px] min-h-0 flex flex-col relative">
                    <div className="absolute inset-0 bg-slate-950/95 pointer-events-none" />
                    
                    {/* Info Tab Content */}
                    <TabsContent value="info" className="mt-0 data-[state=active]:flex-1 overflow-y-auto p-8 relative z-10 space-y-8 scrollbar-thin scrollbar-thumb-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                                <section className="p-5 rounded-xl border border-slate-800/60 bg-slate-900/40 shadow-sm space-y-5">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Core Identity</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Display Name</Label>
                                            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950/50 border-slate-800/80 focus-visible:ring-primary/50" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Short Name (ID)</Label>
                                            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} className="bg-slate-950/50 border-slate-800/80 focus-visible:ring-primary/50 font-mono text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Champion Class</Label>
                                            <Select value={champClass} onValueChange={setChampClass}>
                                                <SelectTrigger className="bg-slate-950/50 border-slate-800/80 focus:ring-primary/50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-slate-800">
                                                    {CLASSES.map(c => (
                                                        <SelectItem key={c} value={c} className="hover:bg-slate-800 focus:bg-slate-800">{c}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <section className="p-5 rounded-xl border border-slate-800/60 bg-slate-900/40 shadow-sm space-y-5">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Availability</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5 flex flex-col">
                                            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Release Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal bg-slate-950/50 border-slate-800/80 hover:bg-slate-900",
                                                        !releaseDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                                                    {releaseDate ? format(releaseDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={releaseDate}
                                                    onSelect={setReleaseDate}
                                                    initialFocus
                                                    className="bg-slate-900 rounded-md"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Rarities (CSV)</Label>
                                        <Input value={obtainable} onChange={(e) => setObtainable(e.target.value)} placeholder="3, 4, 5, 6, 7" className="bg-slate-950/50 border-slate-800/80 font-mono text-sm focus-visible:ring-primary/50" />
                                    </div>
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Image Assets View */}
                        <section className="p-6 rounded-xl border border-slate-800/60 bg-slate-900/40 shadow-sm space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Visual Assets</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Model</span>
                                    </div>
                                    <div className="relative aspect-square rounded-xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-inner group-hover:border-slate-600 transition-colors">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/10 to-transparent pointer-events-none" />
                                        <Image src={getChampionImageUrl(images, 'full', 'primary')} alt="Primary" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain p-2 hover:scale-105 transition-transform duration-500" />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Secondary Model</span>
                                    </div>
                                    <div className="relative aspect-square rounded-xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-inner group-hover:border-slate-600 transition-colors">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/10 to-transparent pointer-events-none" />
                                        <Image src={getChampionImageUrl(images, 'full', 'secondary')} alt="Secondary" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain p-2 hover:scale-105 transition-transform duration-500" />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hero Landscape</span>
                                    </div>
                                    <div className="relative aspect-video sm:aspect-square rounded-xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-inner group-hover:border-slate-600 transition-colors flex items-center justify-center">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/10 to-transparent pointer-events-none" />
                                        <Image src={getChampionImageUrl(images, 'full', 'hero')} alt="Hero" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain hover:scale-105 transition-transform duration-500" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end pt-4 pb-12">
                            <Button size="lg" className="rounded-full shadow-lg hover:shadow-primary/20 px-8" onClick={handleSaveDetails} disabled={isSubmitting}>
                                <Save className="w-4 h-4 mr-2" /> Save Configuration
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="abilities" className="mt-0 data-[state=active]:flex flex-col flex-1 p-8 h-full min-h-0 relative z-10 scrollbar-thin scrollbar-thumb-slate-800">
                        {/* Add New Ability Bar */}
                        <div className="p-4 border rounded-xl bg-slate-900/60 border-slate-800/60 shadow-sm backdrop-blur-md mb-8 shrink-0 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-end gap-3 relative z-10">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Add New Ability / Immunity</Label>
                                    <div className="flex gap-2">
                                        <Popover open={abilityComboboxOpen} onOpenChange={setAbilityComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={abilityComboboxOpen}
                                                className="w-full justify-between bg-slate-950/50 border-slate-800/80 hover:bg-slate-900 hover:text-white"
                                                >
                                                {newAbilityId
                                                    ? allAbilities.find((a) => a.id === newAbilityId)?.name
                                                    : <span className="text-slate-500 font-normal">Select ability...</span>}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0 bg-slate-900 border-slate-800">
                                                <Command className="bg-transparent">
                                                <CommandInput placeholder="Search ability..." className="border-b border-slate-800" />
                                                <CommandList>
                                                    <CommandEmpty className="p-4 text-center text-sm text-slate-500">No ability found.</CommandEmpty>
                                                    <CommandGroup>
                                                    {allAbilities.map((ability) => (
                                                        <CommandItem
                                                        key={ability.id}
                                                        value={ability.name}
                                                        onSelect={() => {
                                                            setNewAbilityId(ability.id)
                                                            setAbilityComboboxOpen(false)
                                                        }}
                                                        className="hover:bg-slate-800/50 cursor-pointer"
                                                        >
                                                        <Check
                                                            className={cn(
                                                            "mr-2 h-4 w-4 text-primary",
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
                                            <SelectTrigger className="w-[140px] bg-slate-950/50 border-slate-800/80">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800">
                                                <SelectItem value="ABILITY" className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">Ability</SelectItem>
                                                <SelectItem value="IMMUNITY" className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">Immunity</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        
                                        <Button onClick={handleAddAbilityLink} disabled={!newAbilityId || isSubmitting} className="shadow-lg shadow-primary/20">
                                            <Plus className="w-4 h-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grouped Abilities List */}
                        <ScrollArea className="flex-1 pr-4 -mr-4">
                            <div className="space-y-8 pb-20 pr-4">
                                {groupedAbilities.abilities.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                            <div className="w-4 h-px bg-slate-700/50" />
                                            Abilities
                                            <div className="flex-1 h-px bg-slate-700/50" />
                                        </h3>
                                        <div className="space-y-4">
                                        {groupedAbilities.abilities.map(([title, links]) => {
                                            const firstLink = links[0]
                                            return (
                                                <div key={`ability-${title}`} className="border border-slate-800/60 rounded-xl bg-slate-900/40 relative overflow-hidden group/card transition-all hover:border-amber-500/30 shadow-sm">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 group-hover/card:bg-amber-500 transition-colors" />
                                                    <div className="px-5 py-3 border-b border-slate-800/50 flex items-center gap-3 bg-slate-900/80">
                                                        <h4 className="font-bold text-sm uppercase tracking-wide text-amber-500/90 group-hover/card:text-amber-400 transition-colors">
                                                            {title}
                                                        </h4>
                                                        <div className="ml-auto">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-7 text-[11px] font-semibold text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-full px-3"
                                                                onClick={() => handleAddInstance(firstLink.abilityId, firstLink.type)}
                                                                disabled={isAddingInstance}
                                                            >
                                                                <Plus className="w-3 h-3 mr-1" /> Add Source
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="divide-y divide-slate-800/50">
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
                                    </div>
                                )}

                                {groupedAbilities.immunities.length > 0 && (
                                    <div className="space-y-4 mt-8">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                            <div className="w-4 h-px bg-slate-700/50" />
                                            Immunities
                                            <div className="flex-1 h-px bg-slate-700/50" />
                                        </h3>
                                        <div className="space-y-4">
                                        {groupedAbilities.immunities.map(([title, links]) => {
                                            const firstLink = links[0]
                                            return (
                                                <div key={`immunity-${title}`} className="border border-slate-800/60 rounded-xl bg-slate-900/40 relative overflow-hidden group/card transition-all hover:border-sky-500/30 shadow-sm">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-sky-500/50 group-hover/card:bg-sky-500 transition-colors" />
                                                    <div className="px-5 py-3 border-b border-slate-800/50 flex items-center gap-3 bg-slate-900/80">
                                                        <h4 className="font-bold text-sm uppercase tracking-wide text-sky-500/90 group-hover/card:text-sky-400 transition-colors">
                                                            {title}
                                                        </h4>
                                                        <div className="ml-auto">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-7 text-[11px] font-semibold text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-full px-3"
                                                                onClick={() => handleAddInstance(firstLink.abilityId, firstLink.type)}
                                                                disabled={isAddingInstance}
                                                            >
                                                                <Plus className="w-3 h-3 mr-1" /> Add Source
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="divide-y divide-slate-800/50">
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
                                    </div>
                                )}
                                {groupedAbilities.abilities.length === 0 && groupedAbilities.immunities.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-slate-800/60 border-dashed rounded-xl">
                                        <Shield className="w-8 h-8 text-slate-700 mb-3" />
                                        <p className="text-slate-500 font-medium">No abilities or immunities assigned.</p>
                                        <p className="text-xs text-slate-600 mt-1">Use the command bar above to add one.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="descriptions" className="mt-0 data-[state=active]:flex flex-col flex-1 p-8 h-full min-h-0 relative z-10 scrollbar-thin scrollbar-thumb-slate-800">
                        {isEditingJson ? (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800/60 p-3 rounded-xl backdrop-blur-sm shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                        <Label className="text-sm font-semibold tracking-wide text-slate-300">Editing fullAbilities JSON</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" disabled={isSubmitting} className="hover:bg-slate-800 hover:text-white" onClick={() => {
                                            setIsEditingJson(false);
                                            setFullAbilitiesJson(champion.fullAbilities ? JSON.stringify(champion.fullAbilities, null, 2) : "{}");
                                            setJsonError(null);
                                        }}>
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={handleSaveJson} disabled={isSubmitting} className="shadow-sm shadow-primary/20">
                                            <Save className="w-4 h-4 mr-2" /> Save JSON
                                        </Button>
                                    </div>
                                </div>
                                {jsonError && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-mono">{jsonError}</div>}
                                <div className="flex-1 rounded-xl overflow-hidden border border-slate-800/60 bg-[#0d1117] relative group shadow-inner">
                                    <div className="absolute top-2 right-4 text-[10px] font-mono font-bold text-slate-600 uppercase pointer-events-none">JSON</div>
                                    <Textarea 
                                        disabled={isSubmitting}
                                        className={cn(
                                            "flex-1 font-mono text-sm resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-300 h-full p-6",
                                            jsonError && "bg-destructive/5 text-destructive",
                                            isSubmitting && "opacity-50 cursor-not-allowed"
                                        )} 
                                        value={fullAbilitiesJson} 
                                        onChange={e => setFullAbilitiesJson(e.target.value)} 
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1 pr-4 -mr-4 relative group">
                                <div className="absolute top-0 right-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity mt-2 mr-2">
                                    <Button variant="outline" size="sm" onClick={() => setIsEditingJson(true)} className="bg-slate-900/80 backdrop-blur-md shadow-lg border-primary/30 hover:border-primary text-slate-300 hover:text-white rounded-full px-4 h-8">
                                        <Edit2 className="w-3.5 h-3.5 mr-2" /> Quick Edit JSON
                                    </Button>
                                </div>
                                <div className="space-y-8 pb-20 pr-4">
                                    {(() => {
                                        const fa = champion.fullAbilities as any;
                                        if (!fa || (!fa.signature && (!fa.abilities_breakdown || fa.abilities_breakdown.length === 0))) {
                                            return (
                                                <div className="flex flex-col items-center justify-center py-32 bg-slate-900/40 border border-slate-800/60 border-dashed rounded-xl">
                                                    <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center mb-4">
                                                        <span className="font-mono text-slate-500 text-xl">{'{ }'}</span>
                                                    </div>
                                                    <p className="text-slate-400 font-medium">No full abilities descriptions available.</p>
                                                    <Button variant="link" onClick={() => setIsEditingJson(true)} className="text-primary mt-2">Edit JSON to add content</Button>
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                {fa.signature && (
                                                    <section className="bg-gradient-to-br from-amber-500/10 to-transparent p-px rounded-2xl">
                                                        <div className="bg-slate-950/80 rounded-[15px] p-6 backdrop-blur-xl">
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                                                    <Zap className="w-4 h-4 text-amber-500" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Signature Ability</h3>
                                                                    <h4 className="font-bold text-xl text-amber-400 tracking-tight">{fa.signature.name}</h4>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                                {fa.signature.description}
                                                            </p>
                                                        </div>
                                                    </section>
                                                )}

                                                {fa.abilities_breakdown && fa.abilities_breakdown.length > 0 && (
                                                    <section>
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className="h-px bg-slate-800/80 flex-1" />
                                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">Abilities Breakdown</h3>
                                                            <div className="h-px bg-slate-800/80 flex-1" />
                                                        </div>
                                                        <div className="space-y-4">
                                                            {fa.abilities_breakdown.map((ability: any, idx: number) => (
                                                                <div key={idx} className="p-5 border border-slate-800/60 rounded-xl bg-slate-900/40 shadow-sm transition-colors hover:border-slate-700/80">
                                                                    <div className="flex items-baseline gap-3 mb-3 border-b border-slate-800/40 pb-3">
                                                                        <h4 className="font-bold text-lg text-slate-200">{ability.title}</h4>
                                                                        {ability.type && (
                                                                            <Badge variant="outline" className="text-[10px] font-mono text-slate-400 tracking-tight uppercase px-1.5 py-0 border-slate-700 bg-slate-800/50">
                                                                                {ability.type}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                                                                        {ability.description}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </ScrollArea>
                        )}
                    </TabsContent>

                    <TabsContent value="attacks" className="mt-0 data-[state=active]:flex-1 p-8 h-full min-h-0 relative z-10 scrollbar-thin scrollbar-thumb-slate-800">
                        <ScrollArea className="h-full pr-4 -mr-4">
                            <div className="space-y-12 pb-10 pr-4">
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-px bg-slate-800/80 flex-1" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">Basic Attacks</h3>
                                        <div className="h-px bg-slate-800/80 flex-1" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-px bg-slate-800/80 flex-1" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary text-center">Special Attacks</h3>
                                        <div className="h-px bg-slate-800/80 flex-1" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 shadow-lg shadow-primary/5 rounded-2xl p-4 md:p-6 bg-primary/5 border border-primary/20 gap-6">
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
    const [prevSource, setPrevSource] = useState(link.source || "")
    const [synergyOpen, setSynergyOpen] = useState(false)

    // Reset state if link source changes from outside (standard React pattern)
    const normalizedSource = link.source || ""
    if (normalizedSource !== prevSource) {
        setSource(normalizedSource)
        setPrevSource(normalizedSource)
    }

    const availableChampions = useMemo(() => {
        const existingIds = new Set(link.synergyChampions.map(s => s.champion.id))
        return allChampions.filter(c => !existingIds.has(c.id))
    }, [allChampions, link.synergyChampions])

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
                                    const images = synergy.champion.images
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

                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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
                                        {availableChampions.length === 0 ? (
                                            <CommandItem disabled className="text-[10px] text-muted-foreground italic">
                                                All champions already added
                                            </CommandItem>
                                        ) : (
                                            availableChampions.map((c) => (
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
                                            ))
                                        )}
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
                         const images = synergy.champion.images
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

    useEffect(() => {
        setGroups(groupHits(existingAttack?.hits.map(h => ({ properties: h.properties })) || []))
    }, [existingAttack])

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
            "border rounded-xl bg-slate-900/60 flex flex-col h-auto min-h-[180px] max-h-[400px] transition-all border-slate-800 shadow-sm backdrop-blur-sm",
            hasChanges && "ring-1 ring-primary/40 border-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.15)] bg-slate-900/80"
        )}>
            <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-950/40 border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-sm font-mono text-primary shadow-inner ring-1 ring-black/50">
                        {type}
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 leading-none mb-1.5">
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
                        className="h-8 px-3 rounded-full bg-primary/20 hover:bg-primary text-primary hover:text-white transition-all shadow-sm animate-in fade-in zoom-in font-semibold text-[11px]"
                        onClick={handleSave} 
                        disabled={isSaving}
                    >
                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {groups.map((group, i) => (
                    <div key={group.id} className="space-y-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 group relative shadow-inner">
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
                                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-slate-600"
                                    aria-label="Remove hit group"
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
                    className="w-full border-dashed border-2 border-slate-800 hover:border-primary/50 hover:bg-primary/10 text-slate-400 hover:text-primary h-11 transition-all rounded-xl shadow-sm" 
                    onClick={addGroup}
                >
                    <Plus className="w-4 h-4 mr-2" /> 
                    <span className="text-xs font-bold uppercase tracking-wider">Add Hit Group</span>
                </Button>
            </div>
        </div>
    )
}
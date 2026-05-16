"use client"

import { useState, useEffect, useMemo } from "react"
import { ChampionAbilityLink, AbilityLinkType, Ability, AttackType, ChampionClass } from "@prisma/client"
import { updateChampionAbility, removeChampionAbility, updateChampionDetails, addSynergy, removeSynergy, saveChampionAttacks, updateChampionFullAbilities, draftChampionAbilities, redraftChampionAbilities, confirmAbilityDraft, fetchDraftModels, AbilityDraft, ModelOption } from "./actions"
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
import { Check, ChevronsUpDown, Trash2, Plus, CalendarIcon, Save, X, Edit2, Sword, Shield, Zap, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getChampionImageUrl, getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import Image from "next/image"
import { ChampionImages } from "@/types/champion"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { CLASSES } from "@/app/profile/roster/constants"
import { Badge } from "@/components/ui/badge"
import { getChampionClassColors } from "@/lib/championClassHelper"

type ChampionListItem = { id: number; name: string; class: string; images: ChampionImages }
type FullAbilityDescription = {
  title?: string;
  type?: string;
  description?: string;
};
type FullAbilitiesView = {
  signature?: {
    name?: string;
    description?: string;
  };
  abilities_breakdown?: FullAbilityDescription[];
};

interface ChampionEditorProps {
  champion: AdminChampionData | null
  allChampions: ChampionListItem[]
  allAbilities: Ability[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ATTACK_TYPES_BASIC: AttackType[] = ["L1", "L2", "L3", "L4", "M1", "M2", "H"]
const ATTACK_TYPES_SPECIAL: AttackType[] = ["S1", "S2"]
const COMMON_HIT_PROPERTIES = ["Contact", "Physical", "Energy", "Projectile"]

export function ChampionEditor({ champion, allChampions, allAbilities, open, onOpenChange }: ChampionEditorProps) {
  const { toast } = useToast()
  
  // Track current champion ID to reset state only when needed (React 19 pattern)
  const [currentId, setCurrentId] = useState<number | null>(null)

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

  // Per-group "add source" inline form: abilityId → draft source string (undefined = not open)
  const [addingSourceFor, setAddingSourceFor] = useState<Record<number, string>>({})
  // Source field in the top-level add bar
  const [newSource, setNewSource] = useState("")

  // AI Draft States
  type DraftStep = 'idle' | 'loading' | 'review' | 'applying' | 'confirming'
  const [draftStep, setDraftStep] = useState<DraftStep>('idle')
  const [draft, setDraft] = useState<AbilityDraft | null>(null)
  const [draftInitialPrompt, setDraftInitialPrompt] = useState<string>("")
  const [draftSuggestions, setDraftSuggestions] = useState<string>("")
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [draftModel, setDraftModel] = useState("google/gemini-2.5-pro")
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)

  // Sync props to state when champion ID changes or dialog is opened
  if (open && champion && champion.id !== currentId) {
    setCurrentId(champion.id)
    
    // Initial data load for this champion
    setName(champion.name)
    setShortName(champion.shortName)
    setChampClass(champion.class)
    setReleaseDate(champion.releaseDate ? new Date(champion.releaseDate) : undefined)
    setObtainable(champion.obtainable.join(", "))

    // Reset Editor State
    setActiveTab("info")
    setNewAbilityId(null)
    setNewType("ABILITY")
    setAbilityComboboxOpen(false)
    
    setIsEditingJson(false)
    setJsonError(null)
    setFullAbilitiesJson(champion.fullAbilities ? JSON.stringify(champion.fullAbilities, null, 2) : "{}")
    setDraftStep('idle')
    setDraft(null)
    setDraftInitialPrompt("")
    setDraftSuggestions("")
    setShowSuggestForm(false)
    setNewSource("")
    setAddingSourceFor({})
  }

  // Clear currentId when closed so it resets if reopened for same champ
  useEffect(() => {
    if (!open) {
      setCurrentId(null)
    }
  }, [open])

  // Lazy-load models when abilities tab first becomes active
  useEffect(() => {
    if (activeTab !== 'abilities' || models.length > 0 || modelsLoading) return
    setModelsLoading(true)
    fetchDraftModels()
      .then(setModels)
      .catch(() => { /* silently ignore — static fallback still usable */ })
      .finally(() => setModelsLoading(false))
  }, [activeTab, models.length, modelsLoading])

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

      if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
          if (parsedJson.signature && (typeof parsedJson.signature !== 'object' || Array.isArray(parsedJson.signature) || typeof parsedJson.signature.name !== 'string')) {
              throw new Error("Invalid signature format: must be an object with a 'name' string.");
          }
          if (parsedJson.abilities_breakdown && !Array.isArray(parsedJson.abilities_breakdown)) {
              throw new Error("abilities_breakdown must be an array.");
          }
      } else if (parsedJson !== null) {
          throw new Error("Root of fullAbilities must be an object or null.");
      }

      setJsonError(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid JSON format"
      setJsonError(message)
      toast({ title: "Invalid JSON format", description: message, variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      await updateChampionFullAbilities(champion.id, parsedJson)
      toast({ title: "Descriptions JSON updated" })
      setIsEditingJson(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Server Error"
      setJsonError(message)
      toast({ title: "Failed to save JSON", description: message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddAbilityLink = async () => {
    if (!newAbilityId) return

    setIsSubmitting(true)
    try {
      await updateChampionAbility(undefined, champion.id, newAbilityId, newType, newSource || undefined)
      toast({ title: "Ability added" })
      setNewAbilityId(null)
      setNewSource("")
    } catch (error) {
      toast({ title: "Error adding ability", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddInstance = async (abilityId: number, type: AbilityLinkType, source?: string) => {
      try {
          await updateChampionAbility(undefined, champion.id, abilityId, type, source || undefined)
          toast({ title: "Source added" })
      } catch (error) {
          toast({ title: "Failed to add source", variant: "destructive" })
          throw error
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

  const handleDraftAbilities = async () => {
    if (!champion.fullAbilities) {
      toast({ title: "No Descriptions JSON found", description: "Add fullAbilities JSON in the Descriptions tab first.", variant: "destructive" })
      return
    }
    setDraftStep('loading')
    try {
      const result = await draftChampionAbilities(champion.id, draftModel)
      setDraft(result.draft)
      setDraftInitialPrompt(result.initialUserPrompt)
      setDraftStep('review')
    } catch (error) {
      toast({ title: "AI draft failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" })
      setDraftStep('idle')
    }
  }

  const handleApplySuggestions = async () => {
    if (!draft || !draftSuggestions.trim()) return
    setDraftStep('applying')
    try {
      const newDraft = await redraftChampionAbilities(draftInitialPrompt, draft, draftSuggestions, draftModel)
      setDraft(newDraft)
      setDraftSuggestions("")
      setShowSuggestForm(false)
      setDraftStep('review')
    } catch (error) {
      toast({ title: "Re-draft failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" })
      setDraftStep('review')
    }
  }

  const handleConfirmDraft = async () => {
    if (!draft) return
    setDraftStep('confirming')
    try {
      await confirmAbilityDraft(champion.id, draft)
      toast({ title: "Abilities saved", description: "AI draft has been applied to this champion." })
      setDraft(null)
      setDraftStep('idle')
    } catch (error) {
      toast({ title: "Failed to save draft", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" })
      setDraftStep('review')
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
                        <Image src={getChampionImageUrlOrPlaceholder(images, '64')} alt={champion.name} fill className="object-cover" />
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
                                        <Image src={getChampionImageUrlOrPlaceholder(images, 'full', 'primary')} alt="Primary" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain p-2 hover:scale-105 transition-transform duration-500" />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Secondary Model</span>
                                    </div>
                                    <div className="relative aspect-square rounded-xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-inner group-hover:border-slate-600 transition-colors">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/10 to-transparent pointer-events-none" />
                                        <Image src={getChampionImageUrlOrPlaceholder(images, 'full', 'secondary')} alt="Secondary" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain p-2 hover:scale-105 transition-transform duration-500" />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hero Landscape</span>
                                    </div>
                                    <div className="relative aspect-video sm:aspect-square rounded-xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-inner group-hover:border-slate-600 transition-colors flex items-center justify-center">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/10 to-transparent pointer-events-none" />
                                        <Image src={getChampionImageUrlOrPlaceholder(images, 'full', 'hero')} alt="Hero" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain hover:scale-105 transition-transform duration-500" />
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
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Add New Ability / Immunity</Label>
                                        {draftStep === 'idle' && (
                                            <div className="flex items-center gap-2">
                                                <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            role="combobox"
                                                            className="h-7 text-[11px] bg-transparent border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-slate-300 rounded-full px-2.5 gap-1.5 max-w-[180px]"
                                                        >
                                                            {modelsLoading
                                                                ? <><Loader2 className="w-3 h-3 animate-spin shrink-0" /><span className="truncate">Loading…</span></>
                                                                : <><span className="truncate">{models.find(m => m.id === draftModel)?.name ?? draftModel}</span><ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50" /></>
                                                            }
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[280px] p-0 bg-slate-900 border-slate-800" align="end">
                                                        <Command className="bg-transparent">
                                                            <CommandInput placeholder="Search models…" className="border-b border-slate-800 text-xs" />
                                                            <CommandList className="max-h-64">
                                                                <CommandEmpty className="p-4 text-center text-xs text-slate-500">No models found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {models.map(m => (
                                                                        <CommandItem
                                                                            key={m.id}
                                                                            value={`${m.name} ${m.id}`}
                                                                            onSelect={() => { setDraftModel(m.id); setModelPickerOpen(false) }}
                                                                            className="flex flex-col items-start gap-0.5 hover:bg-slate-800/50 cursor-pointer py-2"
                                                                        >
                                                                            <div className="flex items-center gap-2 w-full">
                                                                                <Check className={cn("w-3 h-3 shrink-0 text-primary", draftModel === m.id ? "opacity-100" : "opacity-0")} />
                                                                                <span className="text-xs font-medium truncate">{m.name}</span>
                                                                            </div>
                                                                            <span className="text-[10px] text-slate-500 font-mono pl-5">{m.id}</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <Button variant="outline" size="sm" onClick={handleDraftAbilities} className="h-7 text-[11px] font-semibold border-violet-500/30 hover:border-violet-500/60 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-full px-3 gap-1.5">
                                                    <Sparkles className="w-3 h-3" /> Draft with AI
                                                </Button>
                                            </div>
                                        )}
                                        {draftStep === 'loading' && (
                                            <div className="flex items-center gap-1.5 text-xs text-violet-400/70">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                <span>AI analyzing...</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Popover open={abilityComboboxOpen} onOpenChange={setAbilityComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={abilityComboboxOpen}
                                                    className="flex-1 justify-between bg-slate-950/50 border-slate-800/80 hover:bg-slate-900 hover:text-white min-w-0"
                                                >
                                                    {newAbilityId ? (() => {
                                                        const a = allAbilities.find(a => a.id === newAbilityId)
                                                        return a ? <span className="flex items-center gap-2 truncate">{a.emoji && <span>{a.emoji}</span>}<span className="truncate">{a.name}</span></span> : null
                                                    })() : <span className="text-slate-500 font-normal">Select ability…</span>}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0 bg-slate-900 border-slate-800">
                                                <Command className="bg-transparent">
                                                    <CommandInput placeholder="Search ability…" className="border-b border-slate-800" />
                                                    <CommandList className="max-h-64">
                                                        <CommandEmpty className="p-4 text-center text-sm text-slate-500">No ability found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {allAbilities.map(ability => (
                                                                <CommandItem
                                                                    key={ability.id}
                                                                    value={ability.name}
                                                                    onSelect={() => { setNewAbilityId(ability.id); setAbilityComboboxOpen(false) }}
                                                                    className="flex items-center gap-2 hover:bg-slate-800/50 cursor-pointer"
                                                                >
                                                                    <Check className={cn("h-4 w-4 shrink-0 text-primary", newAbilityId === ability.id ? "opacity-100" : "opacity-0")} />
                                                                    {ability.emoji && <span className="shrink-0">{ability.emoji}</span>}
                                                                    <span className="truncate">{ability.name}</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>

                                        <Select value={newType} onValueChange={(v) => setNewType(v as AbilityLinkType)}>
                                            <SelectTrigger className="w-[130px] bg-slate-950/50 border-slate-800/80">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800">
                                                <SelectItem value="ABILITY" className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">Ability</SelectItem>
                                                <SelectItem value="IMMUNITY" className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">Immunity</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Input
                                            value={newSource}
                                            onChange={e => setNewSource(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && newAbilityId) handleAddAbilityLink() }}
                                            placeholder="Source (optional)"
                                            className="flex-1 bg-slate-950/50 border-slate-800/80 text-sm focus-visible:ring-primary/50"
                                        />

                                        <Button onClick={handleAddAbilityLink} disabled={!newAbilityId || isSubmitting} className="shadow-lg shadow-primary/20 shrink-0">
                                            <Plus className="w-4 h-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI Draft Panel */}
                        {(draftStep === 'review' || draftStep === 'applying' || draftStep === 'confirming') && draft && (
                            <div className="mb-8 shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                                <div className="px-4 py-3 border-b border-violet-500/20 bg-violet-500/10 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-violet-400">AI Draft</span>
                                    <span className="text-xs text-slate-500 ml-1">
                                        {(draft.abilities?.length ?? 0) + (draft.immunities?.length ?? 0)} entries
                                    </span>
                                    <span className="text-xs text-slate-600 font-mono ml-auto">{draftModel}</span>
                                </div>

                                <div className="p-4 space-y-4 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                    {(draft.abilities?.length ?? 0) > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80 mb-2">Abilities ({draft.abilities!.length})</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {draft.abilities!.map((item, i) => (
                                                    <div key={i} className="flex items-baseline gap-1 text-xs bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5">
                                                        <span className="font-semibold text-amber-400">{item.name}</span>
                                                        {item.source && <span className="text-slate-400">— {item.source}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(draft.immunities?.length ?? 0) > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500/80 mb-2">Immunities ({draft.immunities!.length})</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {draft.immunities!.map((item, i) => (
                                                    <div key={i} className="flex items-baseline gap-1 text-xs bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5">
                                                        <span className="font-semibold text-sky-400">{item.name}</span>
                                                        {item.source && <span className="text-slate-400">— {item.source}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {showSuggestForm && (
                                        <div className="space-y-2 pt-2 border-t border-slate-700/40">
                                            <Label className="text-xs text-slate-400">What would you like to change?</Label>
                                            <Textarea
                                                value={draftSuggestions}
                                                onChange={e => setDraftSuggestions(e.target.value)}
                                                placeholder="e.g. Add Fury from SP1, remove the Shock entry, source for Bleed should be SP2..."
                                                className="bg-slate-950/50 border-slate-700 resize-none text-sm h-20 focus-visible:ring-violet-500/50"
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={handleApplySuggestions} disabled={draftStep === 'applying' || !draftSuggestions.trim()}>
                                                    {draftStep === 'applying' && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                                                    Apply
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => { setShowSuggestForm(false); setDraftSuggestions("") }} disabled={draftStep === 'applying'}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 py-3 border-t border-violet-500/20 flex items-center gap-2">
                                    <Button size="sm" onClick={handleConfirmDraft} disabled={draftStep !== 'review'} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                                        {draftStep === 'confirming' && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                                        Confirm
                                    </Button>
                                    {!showSuggestForm && (
                                        <Button size="sm" variant="outline" onClick={() => setShowSuggestForm(true)} disabled={draftStep !== 'review'} className="border-violet-500/30 hover:border-violet-500/60 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                                            Suggest Edits
                                        </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => { setDraftStep('idle'); setDraft(null); setDraftSuggestions(""); setShowSuggestForm(false) }} disabled={draftStep === 'confirming'} className="ml-auto text-slate-500 hover:text-slate-300">
                                        Discard
                                    </Button>
                                </div>
                            </div>
                        )}

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
                                            const pendingSource = addingSourceFor[firstLink.abilityId]
                                            const isAddingSource = pendingSource !== undefined
                                            const closeAddSource = () => setAddingSourceFor(prev => { const n = { ...prev }; delete n[firstLink.abilityId]; return n })
                                            return (
                                                <div key={`ability-${title}`} className="border border-slate-800/60 rounded-xl bg-slate-900/40 relative overflow-hidden group/card transition-all hover:border-amber-500/30 shadow-sm">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 group-hover/card:bg-amber-500 transition-colors" />
                                                    <div className="px-4 py-2.5 border-b border-slate-800/50 flex items-center gap-2.5 bg-slate-900/80">
                                                        <h4 className="font-bold text-xs uppercase tracking-widest text-amber-500/90 group-hover/card:text-amber-400 transition-colors shrink-0">
                                                            {title}
                                                        </h4>
                                                        <span className="text-[10px] font-mono text-amber-500/40 shrink-0">{links.length}</span>
                                                        <div className="ml-auto flex items-center gap-2">
                                                            {isAddingSource ? (
                                                                <>
                                                                    <Input
                                                                        autoFocus
                                                                        value={pendingSource}
                                                                        onChange={e => setAddingSourceFor(prev => ({ ...prev, [firstLink.abilityId]: e.target.value }))}
                                                                        onKeyDown={async e => {
                                                                            if (e.key === 'Enter') { await handleAddInstance(firstLink.abilityId, firstLink.type, pendingSource); closeAddSource() }
                                                                            if (e.key === 'Escape') closeAddSource()
                                                                        }}
                                                                        placeholder="Source description…"
                                                                        className="h-7 w-44 text-xs bg-slate-950/70 border-slate-700 focus-visible:ring-amber-500/40 px-2"
                                                                    />
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-400 hover:bg-amber-500/10"
                                                                        onClick={async () => { await handleAddInstance(firstLink.abilityId, firstLink.type, pendingSource); closeAddSource() }}>
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-300" onClick={closeAddSource}>
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 text-[11px] font-semibold text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-full px-2.5"
                                                                    onClick={() => setAddingSourceFor(prev => ({ ...prev, [firstLink.abilityId]: "" }))}
                                                                >
                                                                    <Plus className="w-3 h-3 mr-1" /> Add Source
                                                                </Button>
                                                            )}
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
                                            const pendingSource = addingSourceFor[firstLink.abilityId]
                                            const isAddingSource = pendingSource !== undefined
                                            const closeAddSource = () => setAddingSourceFor(prev => { const n = { ...prev }; delete n[firstLink.abilityId]; return n })
                                            return (
                                                <div key={`immunity-${title}`} className="border border-slate-800/60 rounded-xl bg-slate-900/40 relative overflow-hidden group/card transition-all hover:border-sky-500/30 shadow-sm">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-sky-500/50 group-hover/card:bg-sky-500 transition-colors" />
                                                    <div className="px-4 py-2.5 border-b border-slate-800/50 flex items-center gap-2.5 bg-slate-900/80">
                                                        <h4 className="font-bold text-xs uppercase tracking-widest text-sky-500/90 group-hover/card:text-sky-400 transition-colors shrink-0">
                                                            {title}
                                                        </h4>
                                                        <span className="text-[10px] font-mono text-sky-500/40 shrink-0">{links.length}</span>
                                                        <div className="ml-auto flex items-center gap-2">
                                                            {isAddingSource ? (
                                                                <>
                                                                    <Input
                                                                        autoFocus
                                                                        value={pendingSource}
                                                                        onChange={e => setAddingSourceFor(prev => ({ ...prev, [firstLink.abilityId]: e.target.value }))}
                                                                        onKeyDown={async e => {
                                                                            if (e.key === 'Enter') { await handleAddInstance(firstLink.abilityId, firstLink.type, pendingSource); closeAddSource() }
                                                                            if (e.key === 'Escape') closeAddSource()
                                                                        }}
                                                                        placeholder="Source description…"
                                                                        className="h-7 w-44 text-xs bg-slate-950/70 border-slate-700 focus-visible:ring-sky-500/40 px-2"
                                                                    />
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-sky-400 hover:bg-sky-500/10"
                                                                        onClick={async () => { await handleAddInstance(firstLink.abilityId, firstLink.type, pendingSource); closeAddSource() }}>
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-300" onClick={closeAddSource}>
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 text-[11px] font-semibold text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-full px-2.5"
                                                                    onClick={() => setAddingSourceFor(prev => ({ ...prev, [firstLink.abilityId]: "" }))}
                                                                >
                                                                    <Plus className="w-3 h-3 mr-1" /> Add Source
                                                                </Button>
                                                            )}
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
                                        const fa = champion.fullAbilities as FullAbilitiesView | null;
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
                                                {fa?.signature && (fa.signature.name || fa.signature.description) && (
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

                                                {fa?.abilities_breakdown && fa.abilities_breakdown.length > 0 && (
                                                    <section>
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className="h-px bg-slate-800/80 flex-1" />
                                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">Abilities Breakdown</h3>
                                                            <div className="h-px bg-slate-800/80 flex-1" />
                                                        </div>
                                                        <div className="space-y-4">
                                                            {fa.abilities_breakdown.map((ability, idx) => {
                                                                if (!ability?.title && !ability?.description) return null;
                                                                return (
                                                                <div key={idx} className="p-5 border border-slate-800/60 rounded-xl bg-slate-900/40 shadow-sm transition-colors hover:border-slate-700/80">
                                                                    <div className="flex items-baseline gap-3 mb-3 border-b border-slate-800/40 pb-3">
                                                                        <h4 className="font-bold text-lg text-slate-200">{ability.title || 'Untitled'}</h4>
                                                                        {ability.type && (
                                                                            <Badge variant="outline" className="text-[10px] font-mono text-slate-400 tracking-tight uppercase px-1.5 py-0 border-slate-700 bg-slate-800/50">
                                                                                {ability.type}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                                                                        {ability.description || ''}
                                                                    </p>
                                                                </div>
                                                            )})}
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
    allChampions: ChampionListItem[],
    onUpdateSource: (val: string) => Promise<void>,
    onAddSynergy: (id: number) => void,
    onRemoveSynergy: (id: number) => void,
    onDelete: () => void
}) {
    const [source, setSource] = useState(link.source || "")
    const [prevSource, setPrevSource] = useState(link.source || "")
    const [isSavingSource, setIsSavingSource] = useState(false)
    const [synergyOpen, setSynergyOpen] = useState(false)

    const normalizedSource = link.source || ""
    if (normalizedSource !== prevSource) {
        setSource(normalizedSource)
        setPrevSource(normalizedSource)
    }

    const isDirty = source !== normalizedSource

    const availableChampions = useMemo(() => {
        const existingIds = new Set(link.synergyChampions.map(s => s.champion.id))
        return allChampions.filter(c => !existingIds.has(c.id))
    }, [allChampions, link.synergyChampions])

    const handleSaveSource = async () => {
        setIsSavingSource(true)
        try {
            await onUpdateSource(source)
        } finally {
            setIsSavingSource(false)
        }
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/20 transition-colors group min-w-0">
            {/* Inline source input — always editable */}
            <Input
                value={source}
                onChange={e => setSource(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && isDirty) handleSaveSource()
                    if (e.key === 'Escape' && isDirty) setSource(normalizedSource)
                }}
                placeholder="No specific source"
                className="flex-1 h-7 text-xs bg-transparent border-transparent hover:border-slate-700/60 hover:bg-slate-800/40 focus:bg-slate-800/60 focus:border-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 min-w-0 transition-colors"
            />

            {/* Save / cancel shown only when dirty */}
            {isDirty && (
                <>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-primary hover:bg-primary/10" onClick={handleSaveSource} disabled={isSavingSource}>
                        {isSavingSource ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-slate-500 hover:text-slate-300" onClick={() => setSource(normalizedSource)}>
                        <X className="w-3 h-3" />
                    </Button>
                </>
            )}

            {/* Synergy avatars with per-avatar remove */}
            <div className="flex items-center gap-1 shrink-0">
                {link.synergyChampions.map(synergy => (
                    <div key={synergy.champion.id} className="relative group/synergy" title={synergy.champion.name}>
                        <div className="relative w-6 h-6 rounded-full border border-slate-700 overflow-hidden ring-1 ring-slate-900">
                            <Image src={getChampionImageUrlOrPlaceholder(synergy.champion.images, '32')} alt={synergy.champion.name} fill className="object-cover" />
                        </div>
                        <button
                            onClick={() => onRemoveSynergy(synergy.champion.id)}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover/synergy:opacity-100 transition-opacity"
                        >
                            <X className="w-2 h-2" />
                        </button>
                    </div>
                ))}

                {/* Add synergy — visible on row hover */}
                <Popover open={synergyOpen} onOpenChange={setSynergyOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full border border-dashed border-slate-700 hover:border-primary text-slate-500 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Add synergy"
                        >
                            <Plus className="w-3 h-3" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-0 bg-slate-900 border-slate-800" align="end">
                        <Command className="bg-transparent">
                            <CommandInput placeholder="Search champion…" className="border-b border-slate-800 text-xs" />
                            <CommandList className="max-h-64">
                                <CommandEmpty className="p-3 text-center text-xs text-slate-500">No champion found.</CommandEmpty>
                                <CommandGroup>
                                    {availableChampions.map(c => {
                                        const colors = getChampionClassColors(c.class as ChampionClass)
                                        return (
                                            <CommandItem
                                                key={c.id}
                                                value={c.name}
                                                onSelect={() => { onAddSynergy(c.id); setSynergyOpen(false) }}
                                                className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-800/50 cursor-pointer"
                                            >
                                                <div className={cn("relative w-7 h-7 rounded-full overflow-hidden shrink-0 border-2", colors.border)}>
                                                    <Image src={getChampionImageUrlOrPlaceholder(c.images, '64')} alt={c.name} fill className="object-cover" />
                                                </div>
                                                <span className="text-xs truncate">{c.name}</span>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Delete — visible on row hover */}
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-slate-600 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                onClick={onDelete}
            >
                <Trash2 className="w-3.5 h-3.5" />
            </Button>
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

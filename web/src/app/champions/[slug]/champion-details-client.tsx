"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { ArrowLeft, BarChart3, BookOpenText, Dumbbell, ExternalLink, Gauge, Hash, HeartPulse, Shield, Sparkles, Star, Sword, Zap } from "lucide-react"
import { ChampionClass } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Slider } from "@/components/ui/slider"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { applyAscensionToStatValue, maxSigForRarity, projectMcocPrestige } from "@/lib/mcoc-prestige"
import {
  groupAbilityTexts,
  prepareChampionAbilityCurveView,
  prepareChampionAbilityText,
  type PreparedChampionAbilityTextNode,
} from "@/lib/champion-ability-text"
import { cn } from "@/lib/utils"
import { ChampionImages } from "@/types/champion"

const CURVE_COLORS = ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#fb7185", "#f97316", "#22c55e", "#e879f9"]

type ChampionDetailsPayload = {
  id: number
  name: string
  shortName: string
  slug: string | null
  gameId: string | null
  class: ChampionClass
  images: unknown
  tags: Array<{ id: number; name: string; category: string | null }>
  abilities: Array<{
    id: number
    type: "ABILITY" | "IMMUNITY"
    source: string | null
    ability: { name: string; categories: Array<{ name: string }>; iconUrl?: string | null; gameGlossaryTermId?: string | null }
    synergyChampions: Array<{ champion: { name: string; slug: string | null; images: unknown } }>
  }>
  abilityTexts: Array<{
    id: number
    group: string
    title: string | null
    sortOrder: number
    template: unknown
  }>
  abilityCurves: Array<{
    id: number
    curveId: string
    kind: string
    formula: string
    params: unknown
    minSig: number | null
    maxSig: number | null
  }>
  stats: ChampionStatRow[]
  prestigeData: Array<{
    id: number
    rarity: number
    rank: number
    sig: number
    prestige: number
  }>
}

type ChampionStatRow = {
  id: number
  tierId: string
  rarity: number | null
  rarityLabel: string | null
  rank: number
  level: number | null
  challengeRating: number
  health: number | null
  attack: number | null
  healthRating: number | null
  attackRating: number | null
  prestige: number | null
  armorRating: number | null
  armorPenetration: number | null
  criticalRating: number | null
  criticalResistance: number | null
  criticalDamageRating: number | null
  blockProficiency: number | null
  blockPenetration: number | null
  specialDamageMultiplier: number | null
  energyResistance: number | null
  physicalResistance: number | null
  baseAbilityIds: string[]
  sigAbilityIds: string[]
}

type GlossaryTerm = {
  id: string
  name: string
  description: string | null
  category: string | null
  iconUrl: string | null
  raw: unknown
}

type GroupedAbilityLink = {
  name: string
  iconUrl?: string | null
  gameGlossaryTermId?: string | null
  sources: Array<{
    label: string
    synergyChampions: Array<{ name: string; slug: string | null; images: unknown }>
  }>
}

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function ChampionDetailsClient({
  champion,
  glossaryTerms,
  maxStatsByTier,
}: {
  champion: ChampionDetailsPayload
  glossaryTerms: GlossaryTerm[]
  maxStatsByTier: Record<string, Record<string, number | null>>
}) {
  const classColors = getChampionClassColors(champion.class)
  const heroUrl = getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full", "hero")
  const portraitUrl = getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full")
  const secondaryUrl = getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full", "secondary")
  const stats = champion.stats.filter(row => row.rarity)
  const rarityOptions = Array.from(new Set(stats.map(row => row.rarity).filter(Boolean) as number[])).sort((a, b) => b - a)
  const [selectedRarity, setSelectedRarity] = useState(String(rarityOptions[0] ?? ""))
  const rankOptions = stats
    .filter(row => String(row.rarity) === selectedRarity)
    .map(row => row.rank)
    .sort((a, b) => b - a)
  const [selectedRankByRarity, setSelectedRankByRarity] = useState<Record<string, string>>({})
  const selectedRank = selectedRankByRarity[selectedRarity] ?? String(rankOptions[0] ?? "")
  const selectedStat = stats.find(row => String(row.rarity) === selectedRarity && String(row.rank) === selectedRank) ?? stats[0]
  const currentMaxSig = maxSigForRarity(selectedStat?.rarity)
  const [sigLevel, setSigLevel] = useState(200)
  const [ascensionLevel, setAscensionLevel] = useState(0)
  useEffect(() => {
    setSigLevel(value => Math.min(value, currentMaxSig))
  }, [currentMaxSig])
  useEffect(() => {
    if (selectedStat?.rarity !== 7) setAscensionLevel(0)
  }, [selectedStat?.rarity])

  const glossaryById = useMemo(() => new Map(glossaryTerms.map(term => [term.id, term])), [glossaryTerms])
  const immunities = champion.abilities.filter(link => link.type === "IMMUNITY")
  const abilities = champion.abilities.filter(link => link.type === "ABILITY")
  const textGroups = groupAbilityTexts(champion.abilityTexts)
  const signatureTexts = textGroups.signature ?? []
  const specialAttackTexts = textGroups.special ?? []
  const descriptionGroups = Object.entries(textGroups).filter(([group]) => group !== "signature" && group !== "bio" && group !== "special")
  const bioTexts = textGroups.bio ?? []
  const specialAttackTextByNumber = useMemo(() => {
    const entries = new Map<string, ChampionDetailsPayload["abilityTexts"][number]>()
    for (const [index, record] of specialAttackTexts.entries()) {
      entries.set(String(index + 1), record)
    }
    return entries
  }, [specialAttackTexts])
  const selectedRarityLabel = selectedStat?.rarityLabel ?? (selectedRarity ? `${selectedRarity}-star` : "No stats")
  const selectedCurves = champion.abilityCurves.filter(curve => (curve.maxSig ?? 200) === currentMaxSig)
  const selectedPrestige = projectMcocPrestige({
    prestigeData: champion.prestigeData,
    stat: selectedStat,
    sigLevel,
    ascensionLevel,
  })
  const displayStat = useMemo(
    () => applyAscensionToStat(selectedStat, ascensionLevel),
    [selectedStat, ascensionLevel]
  )

  const tierKey = selectedStat?.rarity && selectedStat?.rank ? `${selectedStat.rarity}-${selectedStat.rank}` : "";
  const maxStats = maxStatsByTier[tierKey] || {};
  const displayMaxStats = useMemo(
    () => ({
      ...maxStats,
      health: applyAscensionToStatValue(maxStats.health, selectedStat?.rarity, ascensionLevel),
      attack: applyAscensionToStatValue(maxStats.attack, selectedStat?.rarity, ascensionLevel),
    }),
    [maxStats, selectedStat?.rarity, ascensionLevel]
  )

  return (
    <TooltipProvider>
      <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <Image src={heroUrl} alt="" fill priority sizes="100vw" className="object-cover object-center opacity-24 blur-2xl scale-110 saturate-50" />
          <div className="absolute inset-0 bg-slate-950/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/85 to-slate-950" />
          <div className="absolute inset-x-0 top-0 h-px opacity-80" style={{ backgroundColor: classColors.color }} />
          <div className="absolute -right-32 top-12 h-96 w-96 rounded-full blur-[120px] opacity-25" style={{ backgroundColor: classColors.color }} />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/profile/roster" className="inline-flex w-fit items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to roster
          </Link>

          <section className="grid min-h-[420px] gap-6 lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-end">
            <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/50 shadow-2xl shadow-black/40">
              <Image src={heroUrl} alt="" fill priority sizes="(max-width: 1024px) 80vw, 360px" className="object-cover object-center opacity-25 blur-md scale-110" />
              <Image src={portraitUrl} alt={champion.name} fill priority sizes="(max-width: 1024px) 80vw, 360px" className="object-cover object-center p-2" />
              <div className="absolute inset-0 shadow-[inset_0_0_30px_20px_rgba(2,6,23,1)] pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none" />
            </div>

            <div className="space-y-5 pb-2">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border-transparent px-2 py-1 text-xs font-bold uppercase", classColors.bg, classColors.text)}>
                    {champion.class}
                  </Badge>
                </div>
                <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                  {champion.name}
                </h1>
                {champion.shortName && champion.shortName !== champion.name && (
                  <p className="text-base text-slate-400">{champion.shortName}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {champion.tags.map(tag => (
                  <Badge key={tag.id} variant="outline" className="border-slate-700 bg-slate-900/50 text-slate-300">
                    <Hash className="mr-1 h-3 w-3 text-slate-500" />
                    {tag.name}
                  </Badge>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroMetric icon={<Star className="fill-current text-yellow-300" />} label={selectedRarityLabel} value={`R${selectedStat?.rank ?? "-"} / L${selectedStat?.level ?? "-"}`} accent={classColors.color} />
                <HeroMetric icon={<Gauge />} label="Prestige" value={formatNumber(selectedPrestige)} accent={classColors.color} />
                <HeroMetric icon={<Dumbbell />} label="Challenge Rating" value={formatNumber(selectedStat?.challengeRating)} accent={classColors.color} />
              </div>
            </div>
          </section>

          {!!bioTexts.length && (
            <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 backdrop-blur flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpenText className="h-5 w-5" style={{ color: classColors.color }} />
                  <h2 className="text-lg font-black text-white">Bio</h2>
                </div>
                {bioTexts.map(record => (
                  <div key={record.id} className="text-sm leading-7 text-slate-300">
                    <RenderedTemplate template={record.template} glossaryById={glossaryById} curves={selectedCurves} sigLevel={sigLevel} stat={displayStat} />
                  </div>
                ))}
              </div>
              {secondaryUrl && (
                <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50 shadow-inner shrink-0 hidden md:block">
                  <Image src={secondaryUrl} alt="Secondary portrait" fill sizes="160px" className="object-cover object-center opacity-80 mix-blend-lighten" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                </div>
              )}
            </section>
          )}

          <section className="grid items-start gap-6 lg:grid-cols-[330px_1fr]">
            <div className="sticky top-4 space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-slate-300">
                  <Gauge className="h-4 w-4" />
                  Stat View
                </h2>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-500">
                      Star
                      <Select value={selectedRarity} onValueChange={value => setSelectedRarity(value)}>
                        <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                          {rarityOptions.map(rarity => (
                            <SelectItem key={rarity} value={String(rarity)}>{rarity} Star</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-500">
                      Rank
                      <Select
                        value={selectedRank}
                        onValueChange={value => setSelectedRankByRarity(prev => ({ ...prev, [selectedRarity]: value }))}
                      >
                        <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                          {rankOptions.map(rank => (
                            <SelectItem key={rank} value={String(rank)}>Rank {rank}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <label className="grid gap-3 text-xs font-semibold uppercase text-slate-500">
                    Signature Level
                    <div className="flex items-center gap-4">
                      <Slider
                        min={0}
                        max={currentMaxSig}
                        step={1}
                        value={[sigLevel]}
                        onValueChange={(val: number[]) => setSigLevel(val[0])}
                        className="flex-1"
                      />
                      <span className="w-12 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-sm text-slate-100">
                        {sigLevel}
                      </span>
                    </div>
                  </label>
                  {selectedStat?.rarity === 7 && (
                    <label className="grid gap-2 text-xs font-semibold uppercase text-slate-500">
                      Ascension
                      <div className="grid grid-cols-6 gap-1">
                        {[0, 1, 2, 3, 4, 5].map(level => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setAscensionLevel(level)}
                            className={cn(
                              "h-9 rounded border text-xs font-black transition-colors",
                              ascensionLevel === level
                                ? "border-amber-400/40 bg-amber-500/20 text-amber-200"
                                : "border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                            )}
                          >
                            {level === 0 ? "0" : `A${level}`}
                          </button>
                        ))}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <StatTile icon={<HeartPulse />} label="Health" value={displayStat?.health} max={displayMaxStats.health} accent={classColors.color} />
                <StatTile icon={<Sword />} label="Attack" value={displayStat?.attack} max={displayMaxStats.attack} accent={classColors.color} />
              </div>

              <StatsPanel stat={selectedStat} maxStatsByTier={maxStatsByTier} accent={classColors.color} />

            </div>

            <div className="min-w-0">
              <Tabs defaultValue="overview" className="space-y-5">
                <TabsList className="grid w-full grid-cols-2 bg-slate-950/80 border border-slate-800 p-1 h-11 rounded-lg">
                  <TabsTrigger value="overview" className="rounded-md font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="descriptions" className="rounded-md font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                    Full Descriptions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0 space-y-6 outline-none">
                  {immunities.length > 0 && (
                    <AbilitySummary title="Immunities" icon={<Shield className="h-4 w-4" />} items={immunities} tone="sky" glossaryById={glossaryById} accent={classColors.color} />
                  )}
                  <AbilitySummary title="Abilities" icon={<Zap className="h-4 w-4" />} items={abilities} tone="amber" glossaryById={glossaryById} accent={classColors.color} />
                </TabsContent>

                <TabsContent value="descriptions" className="mt-0 space-y-6 outline-none">
                  <section className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 backdrop-blur">
                    <p className="text-sm leading-relaxed text-amber-100">
                      Full descriptions are still a work in progress. Some exact numeric values may be inaccurate while the parsing and value resolution logic is being refined.
                    </p>
                  </section>
                  <TextPanel
                    title="Signature Ability"
                    icon={<Sparkles className="h-5 w-5" />}
                    records={signatureTexts}
                    glossaryById={glossaryById}
                    curves={selectedCurves}
                    sigLevel={sigLevel}
                    stat={displayStat}
                    accent={classColors.color}
                    emptyText="No signature ability text imported."
                    chart={<CurvePanel curves={selectedCurves} sigLevel={sigLevel} stat={displayStat} accent={classColors.color} />}
                  />
                  {descriptionGroups.map(([group, records]) => {
                    const specialMatch = group.match(/^special([123])$/)
                    const specialIntro = specialMatch ? specialAttackTextByNumber.get(specialMatch[1]) : undefined
                    const groupTitle = specialIntro?.title
                      ? `${abilityTextGroupTitle(group)} - ${formatGameText(specialIntro.title)}`
                      : abilityTextGroupTitle(group);
                    return (
                      <TextPanel
                        key={group}
                        title={groupTitle}
                        icon={<BookOpenText className="h-5 w-5" />}
                        records={records}
                        introRecord={specialIntro}
                        glossaryById={glossaryById}
                        curves={selectedCurves}
                        sigLevel={sigLevel}
                        stat={displayStat}
                        accent={classColors.color}
                      />
                    );
                  })}
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </div>
      </main>
    </TooltipProvider>
  )
}

function HeroMetric({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
      {accent && <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundColor: accent }} />}
      <div className="relative z-10 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">{icon}{label}</div>
      <div className="relative z-10 mt-2 font-mono text-2xl font-black text-white">{value}</div>
    </div>
  )
}

function applyAscensionToStat(stat: ChampionStatRow | undefined, ascensionLevel: number): ChampionStatRow | undefined {
  if (!stat) return stat
  return {
    ...stat,
    health: applyAscensionToStatValue(stat.health, stat.rarity, ascensionLevel),
    attack: applyAscensionToStatValue(stat.attack, stat.rarity, ascensionLevel),
  }
}

function StatTile({ icon, label, value, max, accent }: { icon: ReactNode; label: string; value: number | null | undefined; max?: number | null; accent: string }) {
  const percentage = value != null && max != null ? Math.min(100, Math.max(0, (value / max) * 100)) : null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-4 backdrop-blur md:p-5">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundColor: accent }} />
      <div className="relative z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500" style={{ color: accent }}>{icon}{label}</div>
        <div className="font-mono text-2xl font-black text-white truncate" title={formatNumber(value)}>{formatNumber(value)}</div>
      </div>
      {percentage != null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div onClick={(e) => e.preventDefault()} className="relative z-10 mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-900 cursor-help">
              <div className="h-full rounded-full opacity-80" style={{ width: `${percentage}%`, backgroundColor: accent }} />
            </div>
          </TooltipTrigger>
          <TooltipContent className="border-slate-700 bg-slate-950 text-xs text-slate-200">
            {percentage.toFixed(1)}% of maximum ({formatNumber(max)})
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function StatsPanel({ stat, maxStatsByTier, accent }: { stat?: ChampionStatRow; maxStatsByTier: Record<string, Record<string, number | null>>; accent: string }) {
  const tierKey = stat?.rarity && stat?.rank ? `${stat.rarity}-${stat.rank}` : "";
  const maxStats = maxStatsByTier[tierKey] || {};

  const rows = [
    ["Armor Rating", stat?.armorRating, maxStats.armorRating ?? 3000],
    ["Armor Penetration", stat?.armorPenetration, maxStats.armorPenetration ?? 300],
    ["Critical Rating", stat?.criticalRating, maxStats.criticalRating ?? 3500],
    ["Critical Resistance", stat?.criticalResistance, maxStats.criticalResistance ?? 1500],
    ["Critical Damage Rating", stat?.criticalDamageRating, maxStats.criticalDamageRating ?? 4000],
    ["Block Proficiency", stat?.blockProficiency, maxStats.blockProficiency ?? 10500],
    ["Block Penetration", stat?.blockPenetration, maxStats.blockPenetration ?? 700],
    ["Special Damage Multiplier", stat?.specialDamageMultiplier, maxStats.specialDamageMultiplier ?? 1.5],
    ["Energy Resistance", stat?.energyResistance, maxStats.energyResistance ?? 6500],
    ["Physical Resistance", stat?.physicalResistance, maxStats.physicalResistance ?? 1500],
  ] as const

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" style={{ color: accent }} />
        <h2 className="text-lg font-black text-white">Advanced Stats</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {rows.map(([label, value, max]) => {
          if (value == null) return null;
          const numValue = typeof value === 'number' ? value : 0;
          const percentage = Math.min(100, Math.max(0, (numValue / (max || 1)) * 100));
          return (
            <div key={label} className="grid gap-1.5 rounded-md border border-slate-800/80 bg-slate-900/50 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
                <span>{label}</span>
                <span className="font-mono text-slate-200">{formatStatValue(value)}{label.includes("Multiplier") && value !== null ? "x" : ""}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div onClick={(e) => e.preventDefault()} className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 cursor-help">
                    <div className="h-full rounded-full opacity-80" style={{ width: `${percentage}%`, backgroundColor: accent }} />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="border-slate-700 bg-slate-950 text-xs text-slate-200">
                  {percentage.toFixed(1)}% of maximum ({formatNumber(max)})
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TextPanel({
  title,
  icon,
  records,
  glossaryById,
  curves = [],
  sigLevel = 200,
  stat,
  accent,
  emptyText = "No text imported.",
  chart,
  introRecord,
}: {
  title: string
  icon: ReactNode
  records: ChampionDetailsPayload["abilityTexts"]
  introRecord?: ChampionDetailsPayload["abilityTexts"][number]
  glossaryById: Map<string, GlossaryTerm>
  curves?: ChampionDetailsPayload["abilityCurves"]
  sigLevel?: number
  stat?: ChampionStatRow
  accent: string
  emptyText?: string
  chart?: ReactNode
}) {
  const groupedRecords = useMemo(() => {
    const groups: { id: string; title: string; records: typeof records }[] = [];
    let currentGroup: { id: string; title: string; records: typeof records } | null = null;

    for (const record of records) {
      if (record.title) {
        currentGroup = {
          id: String(record.id),
          title: formatGameText(record.title),
          records: [record],
        };
        groups.push(currentGroup);
      } else {
        if (currentGroup) {
          currentGroup.records.push(record);
        } else {
          currentGroup = {
            id: String(record.id),
            title: title === "Special Attacks" ? "Attack Details" : "Always Active",
            records: [record],
          };
          groups.push(currentGroup);
        }
      }
    }
    return groups;
  }, [records, title]);

  return (
    <Accordion type="multiple" defaultValue={[title]} className="w-full">
      <AccordionItem value={title} className="rounded-lg border border-slate-800 bg-slate-950/70 backdrop-blur px-4 border-none">
        <AccordionTrigger className="hover:no-underline py-3 border-none text-left">
          <div className="flex items-center gap-2">
            <span style={{ color: accent }}>{icon}</span>
            <h2 className="text-lg font-black text-white">{title}</h2>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          {chart && <div className="mb-6">{chart}</div>}
          {introRecord && (
            <div className="mb-4 rounded-lg border border-slate-800/80 bg-slate-900/30 p-3 italic text-slate-300">
              <RenderedTemplate template={introRecord.template} glossaryById={glossaryById} curves={curves} sigLevel={sigLevel} stat={stat} />
            </div>
          )}

          {groupedRecords.length ? (
            <div className="space-y-3">
              {groupedRecords.map(group => (
                <div key={group.id} className="rounded-lg border border-slate-800/80 bg-slate-900/30 p-3 space-y-2">
                  {group.title && (
                    <h3 className="text-sm font-bold text-white/90">{group.title}</h3>
                  )}
                  <div className="space-y-3 text-slate-300">
                    {group.records.map(record => (
                      <RenderedTemplate key={record.id} template={record.template} glossaryById={glossaryById} curves={curves} sigLevel={sigLevel} stat={stat} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{emptyText}</p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function RenderedTemplate({
  template,
  glossaryById,
  curves = [],
  sigLevel = 200,
  stat,
}: {
  template: unknown
  glossaryById: Map<string, GlossaryTerm>
  curves?: ChampionDetailsPayload["abilityCurves"]
  sigLevel?: number
  stat?: ChampionStatRow
}) {
  const prepared = prepareChampionAbilityText({ template, curves, sigLevel, stat })
  if (prepared.status === "error") {
    return (
      <div className="rounded border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-sm text-amber-100">
        {prepared.error.message}
      </div>
    )
  }

  return (
    <div className="space-y-1.5 text-sm leading-6 text-slate-300">
      {prepared.blocks.map((block, index) => (
        <div key={index} className="inline-block w-full">{block.children.map((node, nodeIndex) => renderNode(node, nodeIndex, glossaryById))}</div>
      ))}
    </div>
  )
}

function renderNode(
  node: PreparedChampionAbilityTextNode,
  index: number,
  glossaryById: Map<string, GlossaryTerm>
): ReactNode {
  if (node.type === "text") return <span key={index}>{node.value}</span>
  if (node.type === "value") {
    const resolved = node.resolution
    return (
      <Tooltip key={index}>
        <TooltipTrigger asChild>
          <span
            onClick={(e) => e.preventDefault()}
            className={cn(
              "inline-flex cursor-help items-center rounded px-1.5 py-0.5 text-xs font-semibold",
              resolved.status === "resolved"
                ? "bg-slate-800 text-slate-100"
                : "border border-amber-500/40 bg-amber-950/40 text-amber-100"
            )}
          >
            {resolved.status === "resolved" ? resolved.displayValue : `Error ${node.placeholderIndex}`}
          </span>
        </TooltipTrigger>
        <TooltipContent className="border-slate-700 bg-slate-950 text-xs text-slate-300">
          {resolved.detail}
        </TooltipContent>
      </Tooltip>
    )
  }
  if (node.type === "glossary") {
    const term = glossaryById.get(node.id)
    const description = term?.description?.trim() || rawGlossaryDescription(term?.raw) || "No glossary description imported yet."
    const raw = term?.raw as Record<string, unknown> | undefined;
    const primaryColor = typeof raw?.color_primary === "string" ? normalizeHexColor(raw.color_primary) : undefined;
    
    return (
      <Tooltip key={index}>
        <TooltipTrigger asChild>
          <button onClick={(e) => e.preventDefault()} type="button" className="inline-flex items-center gap-1 font-semibold text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200">
            {node.label}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm border-slate-700 bg-slate-950 p-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            {term?.iconUrl && (
              <div 
                className="mt-0.5 shrink-0 h-6 w-6" 
                style={{
                  backgroundColor: primaryColor || "currentColor",
                  maskImage: `url(${term.iconUrl})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskImage: `url(${term.iconUrl})`,
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                }}
              />
            )}
            <div className="space-y-1.5">
              <p className="font-black text-base text-white" style={{ color: primaryColor || "inherit" }}>
                {term?.name?.trim() || node.label}
              </p>
              <p className="text-sm leading-relaxed text-slate-300">{description}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }
  if (node.type === "color") {
    return <span key={index} style={{ color: normalizeHexColor(node.color) }}>{node.children.map((child, childIndex) => renderNode(child, childIndex, glossaryById))}</span>
  }
  return null
}

function CurvePanel({ curves, sigLevel, stat, accent }: { curves: ChampionDetailsPayload["abilityCurves"]; sigLevel: number; stat?: ChampionStatRow; accent: string }) {
  const curveView = useMemo(
    () => prepareChampionAbilityCurveView({ curves, stat, sigLevel }),
    [curves, stat, sigLevel]
  )

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: accent }} />
          <h2 className="text-sm font-black uppercase text-white">Signature Curve</h2>
        </div>
      </div>
      {curveView.series.length && curveView.data.length ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <AreaChart data={curveView.data} margin={{ left: 0, right: 12, top: 10, bottom: 8 }}>
            <defs>
              {curveView.series.map((series, index) => (
                <linearGradient key={series.id} id={`signatureCurveFill${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CURVE_COLORS[index % CURVE_COLORS.length] ?? accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CURVE_COLORS[index % CURVE_COLORS.length] ?? accent} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis dataKey="sig" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={46} tick={{ fontSize: 11, fill: "#94a3b8" }} domain={curveView.domain} tickFormatter={(val) => Math.round(val).toLocaleString()} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" labelFormatter={(_, payload) => {
              const sig = payload?.[0]?.payload?.sig;
              return sig === sigLevel ? `Sig ${sig} (Selected)` : `Sig ${sig ?? '?'}`;
            }} />} />
            {curveView.series.map((series, index) => (
              <Area
                key={series.id}
                dataKey={series.dataKey}
                name={series.label}
                type="monotone"
                fill={`url(#signatureCurveFill${index})`}
                stroke={CURVE_COLORS[index % CURVE_COLORS.length] ?? accent}
                strokeWidth={2}
              />
            ))}
            <ReferenceLine x={sigLevel} stroke="#f8fafc" strokeDasharray="3 3" />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="rounded-md border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm leading-6 text-slate-400">
          Signature curve records are not imported yet. The chart is ready to render once `ChampionAbilityCurve` has data.
        </div>
      )}
      {curveView.series.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {curveView.series.map((series, index) => (
            <span key={series.id} className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CURVE_COLORS[index % CURVE_COLORS.length] ?? accent }} />
              {series.label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function AbilitySummary({
  title,
  icon,
  items,
  tone,
  glossaryById,
  accent,
}: {
  title: string
  icon: ReactNode
  items: ChampionDetailsPayload["abilities"]
  tone: "sky" | "amber"
  glossaryById: Map<string, GlossaryTerm>
  accent?: string
}) {
  const grouped = groupAbilityLinks(items)
  const defaultIconColor = tone === "sky" ? "#38bdf8" : "#fbbf24"

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-white">
          <span style={{ color: accent ?? defaultIconColor }}>{icon}</span>
          {title}
        </h2>
      </div>
      {grouped.length ? (
        <div className="grid gap-3">
          {grouped.map(item => {
            const term = item.gameGlossaryTermId ? glossaryById.get(item.gameGlossaryTermId) : undefined
            const raw = term?.raw as Record<string, unknown> | undefined
            const primaryColor = typeof raw?.color_primary === "string" ? normalizeHexColor(raw.color_primary) : undefined
            const description = term?.description?.trim() || rawGlossaryDescription(term?.raw)
            const displayColor = primaryColor || accent || defaultIconColor

            const cardContent = (
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className={cn(
                  "group relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 text-left transition-colors hover:border-slate-600 hover:bg-slate-900/70"
                )}
                style={{
                  boxShadow: `inset 3px 0 0 ${displayColor}88`,
                }}
              >
                <div className="absolute -left-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: displayColor }} />
                <div className="relative px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    {item.iconUrl ? (
                      <div
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 shadow-inner"
                        style={{
                          backgroundColor: displayColor,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -10px 16px rgba(0,0,0,0.22), 0 0 24px ${displayColor}24`,
                        }}
                        >
                        <div className="absolute left-1.5 top-1.5 h-4 w-4 rounded-full bg-white/35 blur-[2px]" />
                        <div className="absolute inset-x-1 bottom-0 h-4 rounded-full bg-black/15 blur-sm" />
                        <div
                          className="relative h-8 w-8"
                          style={{
                            backgroundColor: "#ffffff",
                            maskImage: `url(${item.iconUrl})`,
                            maskSize: "contain",
                            maskRepeat: "no-repeat",
                            maskPosition: "center",
                            WebkitMaskImage: `url(${item.iconUrl})`,
                            WebkitMaskSize: "contain",
                            WebkitMaskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-white" style={{ color: primaryColor || undefined }}>
                            {item.name}
                          </div>
                        </div>
                      </div>
                      {item.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {item.sources.map(source => (
                            <span key={`${item.name}-${source.label}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium leading-tight text-slate-300">
                              {source.label}
                              {source.synergyChampions.length > 0 && (
                                <span className="flex -space-x-1">
                                  {source.synergyChampions.slice(0, 3).map(champion => (
                                    <span
                                      key={`${item.name}-${source.label}-${champion.name}`}
                                      className="relative h-5 w-5 overflow-hidden rounded-full border border-slate-950 ring-1 ring-slate-700"
                                      title={champion.name}
                                    >
                                      <Image
                                        src={getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "64")}
                                        alt={champion.name}
                                        fill
                                        sizes="20px"
                                        className="object-cover"
                                      />
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )

            if (!description) {
              return <div key={`${title}-${item.name}`}>{cardContent}</div>
            }

            return (
              <Tooltip key={`${title}-${item.name}`}>
                <TooltipTrigger asChild>
                  {cardContent}
                </TooltipTrigger>
                <TooltipContent className="max-w-sm border-slate-700 bg-slate-950 p-4 shadow-xl">
                  <AbilityTooltipContent item={item} description={description} color={displayColor} />
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No {title.toLowerCase()} recorded.</p>
      )}
    </section>
  )
}

function AbilityTooltipContent({ item, description, color }: { item: GroupedAbilityLink; description: string; color: string }) {
  return (
    <div className="flex items-start gap-3.5">
      {item.iconUrl && (
        <div
          className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15"
          style={{
            backgroundColor: color,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -8px 12px rgba(0,0,0,0.2), 0 0 20px ${color}24`,
          }}
        >
          <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white/35 blur-[2px]" />
          <div className="absolute inset-x-1 bottom-0 h-3 rounded-full bg-black/15 blur-sm" />
          <div
            className="relative h-6 w-6"
            style={{
              backgroundColor: "#ffffff",
              maskImage: `url(${item.iconUrl})`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: `url(${item.iconUrl})`,
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-base font-black text-white" style={{ color }}>
          {item.name}
        </p>
        <p className="text-sm leading-relaxed text-slate-300">
          {description}
        </p>
      </div>
    </div>
  )
}

function abilityTextGroupTitle(group: string) {
  if (group === "base") return "Base Abilities"
  if (group === "special") return "Special Attacks"
  const specialMatch = group.match(/^special([123])$/)
  if (specialMatch) return `Special Attack ${specialMatch[1]}`
  return group
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function groupAbilityLinks<
  T extends {
    source: string | null
    ability: { name: string; iconUrl?: string | null; gameGlossaryTermId?: string | null }
    synergyChampions?: Array<{ champion: { name: string; slug: string | null; images: unknown } }>
  }
>(items: T[]): GroupedAbilityLink[] {
  const names = new Map<string, GroupedAbilityLink>()

  for (const item of items) {
    const name = item.ability.name
    const existing = names.get(name)
    const normalizedSource = normalizeAbilitySource(item.source)
    const sourceSynergies = dedupeSynergyChampions(item.synergyChampions ?? [])

    if (!existing) {
      names.set(name, {
        name,
        iconUrl: item.ability.iconUrl,
        gameGlossaryTermId: item.ability.gameGlossaryTermId,
        sources: normalizedSource ? [{ label: normalizedSource, synergyChampions: sourceSynergies }] : [],
      })
      continue
    }

    if (!normalizedSource) {
      continue
    }

    const existingSource = existing.sources.find(source => source.label === normalizedSource)
    if (!existingSource) {
      existing.sources.push({ label: normalizedSource, synergyChampions: sourceSynergies })
      continue
    }

    existingSource.synergyChampions = dedupeSynergyChampions([
      ...existingSource.synergyChampions.map(champion => ({ champion })),
      ...(item.synergyChampions ?? []),
    ])
  }

  return Array.from(names.values())
    .map(item => ({
      ...item,
      sources: item.sources.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function dedupeSynergyChampions(
  items: Array<{ champion: { name: string; slug: string | null; images: unknown } }>
): Array<{ name: string; slug: string | null; images: unknown }> {
  const champions = new Map<string, { name: string; slug: string | null; images: unknown }>()
  for (const item of items) {
    champions.set(item.champion.slug ?? item.champion.name, item.champion)
  }
  return Array.from(champions.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeAbilitySource(source: string | null) {
  if (!source) return null
  const trimmed = source.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase().replace(/\s+/g, "_")
  return abilityTextGroupTitle(normalized)
}

function rawGlossaryDescription(raw: unknown) {
  if (!raw || typeof raw !== "object") return null
  const description = (raw as { description?: unknown }).description
  return typeof description === "string" && description.trim() ? description : null
}

function normalizeHexColor(color: string): CSSProperties["color"] {
  if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`
  if (/^[0-9a-fA-F]{8}$/.test(color)) return `#${color.slice(0, 6)}`
  return undefined
}

function formatGameText(value: string) {
  return value.replace(/\[[0-9a-fA-F]{6,8}\]([\s\S]*?)\[-\]/g, "$1")
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("en-US")
}

function formatStatValue(value: number | string | null | undefined) {
  if (value == null || value === "") return "-"
  if (typeof value === "number") return value.toLocaleString("en-US")
  return value
}

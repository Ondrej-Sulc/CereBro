"use client"

// PROTOTYPE: Five structural directions for champion details, each on its own route.
import Image from "next/image"
import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Copy,
  Database,
  Gauge,
  HeartPulse,
  Hexagon,
  Info,
  Layers3,
  LockKeyhole,
  Orbit,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  Zap,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { applyAscensionToStatValue, maxSigForRarity, projectMcocPrestige } from "@/lib/mcoc-prestige"
import {
  formatGameText,
  prepareChampionAbilityTextView,
  type ChampionAbilityTextRecord,
  type PreparedChampionAbilityText,
  type PreparedChampionAbilityCurveSeries,
  type PreparedChampionAbilityTextNode,
  type PreparedChampionAbilityTextPanel,
} from "@/lib/champion-ability-text"
import { cn } from "@/lib/utils"
import type { ChampionImages } from "@/types/champion"
import type { ChampionDetailsPayload, ChampionStatRow } from "../../champion-details-client"
import { getExternalDuelSourceCredits } from "../../duel-targets"

export const PROTOTYPE_CONCEPTS = [
  { key: "dossier", short: "01", name: "Dossier", note: "Cinematic identity" },
  { key: "war-room", short: "02", name: "War Room", note: "Dense decision support" },
  { key: "field-guide", short: "03", name: "Field Guide", note: "Calm editorial scan" },
  { key: "matrix", short: "04", name: "Matrix", note: "Ability-first explorer" },
  { key: "vault", short: "05", name: "Vault", note: "Collectible showcase" },
] as const

export type PrototypeConcept = (typeof PROTOTYPE_CONCEPTS)[number]["key"]

type GlossaryTerm = {
  id: string
  name: string
  description: string | null
  category: string | null
  iconUrl: string | null
  raw: unknown
}

type PrototypeProps = {
  concept: PrototypeConcept
  champion: ChampionDetailsPayload
  glossaryTerms: GlossaryTerm[]
  maxStatsByTier: Record<string, Record<string, number | null>>
}

type PrototypeView = {
  champion: ChampionDetailsPayload
  portraitUrl: string
  heroUrl: string
  secondaryUrl: string
  accent: string
  selectedStat: ChampionStatRow | undefined
  selectedRarity: string
  selectedRank: string
  rarityOptions: number[]
  rankOptions: number[]
  sigLevel: number
  maxSig: number
  ascensionLevel: number
  prestige: number | null
  health: number | null
  attack: number | null
  maxStats: Record<string, number | null>
  abilities: ChampionDetailsPayload["abilities"]
  immunities: ChampionDetailsPayload["abilities"]
  glossaryById: Map<string, GlossaryTerm>
  descriptionView: ReturnType<typeof prepareChampionAbilityTextView>
  setRarity: (value: string) => void
  setRank: (value: string) => void
  setSigLevel: (value: number) => void
  setAscensionLevel: (value: number) => void
}

export function ChampionPrototype(props: PrototypeProps) {
  const { champion, maxStatsByTier } = props
  const stats = useMemo(() => champion.stats.filter(row => row.rarity), [champion.stats])
  const rarityOptions = useMemo(
    () => Array.from(new Set(stats.map(row => row.rarity).filter(Boolean) as number[])).sort((a, b) => b - a),
    [stats]
  )
  const [raritySelection, setSelectedRarity] = useState(String(rarityOptions[0] ?? ""))
  const selectedRarity = rarityOptions.includes(Number(raritySelection))
    ? raritySelection
    : String(rarityOptions[0] ?? "")
  const rankOptions = useMemo(
    () => stats
      .filter(row => String(row.rarity) === selectedRarity)
      .map(row => row.rank)
      .sort((a, b) => b - a),
    [selectedRarity, stats]
  )
  const [rankByRarity, setRankByRarity] = useState<Record<string, string>>({})
  const rememberedRank = rankByRarity[selectedRarity]
  const selectedRank = rememberedRank && rankOptions.includes(Number(rememberedRank))
    ? rememberedRank
    : String(rankOptions[0] ?? "")
  const selectedStat = stats.find(row => String(row.rarity) === selectedRarity && String(row.rank) === selectedRank) ?? stats[0]
  const currentMaxSig = maxSigForRarity(selectedStat?.rarity)
  const [sigLevel, setSigLevel] = useState(currentMaxSig)
  const [ascensionLevel, setAscensionLevel] = useState(0)
  const effectiveAscension = selectedStat?.rarity === 7 ? ascensionLevel : 0
  const cappedSig = Math.min(sigLevel, currentMaxSig)
  const tierKey = selectedStat?.rarity && selectedStat.rank ? `${selectedStat.rarity}-${selectedStat.rank}` : ""
  const accent = getChampionClassColors(champion.class).color
  const health = applyAscensionToStatValue(selectedStat?.health, selectedStat?.rarity, effectiveAscension)
  const attack = applyAscensionToStatValue(selectedStat?.attack, selectedStat?.rarity, effectiveAscension)
  const descriptionView = prepareChampionAbilityTextView({
    records: champion.abilityTexts,
    curves: champion.abilityCurves,
    maxSig: currentMaxSig,
    sigLevel: cappedSig,
    stat: selectedStat ? { ...selectedStat, health, attack } : undefined,
  })
  const view: PrototypeView = {
    champion,
    portraitUrl: getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full"),
    heroUrl: getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full", "hero"),
    secondaryUrl: getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full", "secondary"),
    accent,
    selectedStat,
    selectedRarity,
    selectedRank,
    rarityOptions,
    rankOptions,
    sigLevel: cappedSig,
    maxSig: currentMaxSig,
    ascensionLevel: effectiveAscension,
    prestige: projectMcocPrestige({
      prestigeData: champion.prestigeData,
      stat: selectedStat,
      sigLevel: cappedSig,
      ascensionLevel: effectiveAscension,
    }),
    health,
    attack,
    maxStats: maxStatsByTier[tierKey] ?? {},
    abilities: dedupeAbilities(champion.abilities.filter(item => item.type === "ABILITY")),
    immunities: dedupeAbilities(champion.abilities.filter(item => item.type === "IMMUNITY")),
    glossaryById: new Map(props.glossaryTerms.map(term => [term.id, term])),
    descriptionView,
    setRarity: value => {
      setSelectedRarity(value)
      const nextStat = stats.find(row => String(row.rarity) === value)
      setSigLevel(maxSigForRarity(nextStat?.rarity))
      setAscensionLevel(0)
    },
    setRank: value => setRankByRarity(current => ({ ...current, [selectedRarity]: value })),
    setSigLevel,
    setAscensionLevel,
  }

  return (
    <>
      {props.concept === "dossier" && <DossierConcept view={view} />}
      {props.concept === "war-room" && <WarRoomConcept view={view} />}
      {props.concept === "field-guide" && <FieldGuideConcept view={view} />}
      {props.concept === "matrix" && <MatrixConcept view={view} />}
      {props.concept === "vault" && <VaultConcept view={view} />}
      {props.concept !== "dossier" && <PrototypeSwitcher concept={props.concept} slug={champion.slug ?? ""} />}
    </>
  )
}

function DossierConcept({ view }: { view: PrototypeView }) {
  const abilities = view.champion.abilities.filter(item => item.type === "ABILITY")
  const immunities = view.champion.abilities.filter(item => item.type === "IMMUNITY")

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#080b10] pb-32 text-[#f5f1e8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(circle_at_76%_22%,rgba(255,255,255,.05),transparent_42%)]" />

      <div className="relative mx-auto max-w-[1500px] px-5 py-7 md:px-10 lg:px-14">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/profile/roster" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-white/45 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to roster</Link>
          <Link href={`/champions/${view.champion.slug}`} className="text-xs font-bold uppercase tracking-[.2em] text-white/30 hover:text-white">Original profile</Link>
        </div>

        <section className="relative mt-6 min-h-[660px] overflow-hidden border-y border-white/10 sm:min-h-[720px] lg:min-h-[700px]">
          <div
            className="absolute inset-y-0 -right-[72%] w-[185%] sm:-right-[34%] sm:w-[135%] lg:-right-[6%] lg:w-[78%]"
            style={{
              maskImage: "linear-gradient(90deg,transparent 0%,black 24%,black 86%,transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg,transparent 0%,black 24%,black 86%,transparent 100%)",
            }}
          >
            <Image src={view.heroUrl} alt="" fill priority sizes="(max-width: 1024px) 150vw, 1150px" className="object-cover object-center opacity-60 saturate-[.8] sm:opacity-75 lg:opacity-100 lg:saturate-100" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#080b10_0%,rgba(8,11,16,.97)_22%,rgba(8,11,16,.72)_46%,rgba(8,11,16,.18)_72%,rgba(8,11,16,.55)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#080b10] via-[#080b10]/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0 opacity-[.045] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:88px_88px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-32" style={{ background: view.accent }} />

          <div className="relative z-10 flex min-h-[660px] flex-col justify-between px-5 py-7 sm:min-h-[720px] sm:px-8 sm:py-9 lg:min-h-[700px] lg:px-10">
            <div className="flex items-start justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-white/20 bg-black/40 shadow-2xl sm:h-24 sm:w-24">
                  <Image src={view.portraitUrl} alt={`${view.champion.name} portrait`} fill sizes="96px" className="object-cover" />
                  <span className="pointer-events-none absolute inset-1 border border-white/10" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-1 w-8" style={{ background: view.accent }} />
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.24em] text-white/30">Champion dossier</div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em]" style={{ color: view.accent }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: view.accent, boxShadow: `0 0 14px ${view.accent}` }} />{view.champion.class} class</div>
                  {view.champion.shortName && view.champion.shortName !== view.champion.name && <div className="mt-2 text-xs font-bold text-white/40">{view.champion.shortName}</div>}
                </div>
              </div>
              <div className="hidden text-right sm:block"><div className="font-mono text-[9px] font-bold uppercase tracking-[.18em] text-white/25">Current build</div><div className="mt-1 font-mono text-xs font-black uppercase tracking-[.12em] text-white/55">{view.selectedRarity}★ · R{view.selectedRank} · Sig {view.sigLevel}</div></div>
            </div>

            <div className="my-auto py-10 sm:py-14">
              <ChampionHeroWordmark name={view.champion.name} accent={view.accent} />
              <div className="mt-7 h-1 w-24" style={{ background: view.accent }} />
            </div>

            <div className="grid max-w-3xl grid-cols-3 border-y border-white/15 bg-black/20 py-5 backdrop-blur-sm sm:py-6">
              <DossierPrestigeMetric view={view} />
              <DossierMetric label="Health" value={format(view.health)} />
              <DossierMetric label="Attack" value={format(view.attack)} />
            </div>
          </div>
        </section>

        <DossierTraits view={view} />
        <DossierBuildBar view={view} />
        <DossierAdvancedStats view={view} />

        <section className="grid items-start gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className={cn("grid gap-8", immunities.length > 0 && "md:grid-cols-2")}>
            <EditorialAbilityList title="Core abilities" items={abilities} view={view} />
            {immunities.length > 0 && <EditorialAbilityList title="Immunities" items={immunities} view={view} />}
          </div>
          <div className="lg:sticky lg:top-[178px]">
            <DossierDuelTargets view={view} />
          </div>
        </section>
        <DossierCombatTelemetry view={view} />
        <FullChampionDescription view={view} tone="dossier" />
      </div>
    </main>
  )
}

function ChampionHeroWordmark({ name, accent }: { name: string; accent: string }) {
  const variantMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  const primaryName = (variantMatch?.[1] ?? name).trim()
  const variantName = variantMatch?.[2]?.trim()
  const sizeClass = primaryName.length <= 8
    ? "text-[clamp(5rem,13vw,12rem)]"
    : primaryName.length <= 16
      ? "text-[clamp(4rem,10vw,9rem)]"
      : "text-[clamp(3.1rem,7.6vw,6.75rem)]"
  const wordmarkClass = cn("block max-w-5xl text-balance break-words font-black uppercase leading-[.74] tracking-[-.075em]", sizeClass)

  return (
    <div className="relative w-fit max-w-full">
      <span aria-hidden className={cn("pointer-events-none absolute left-1.5 top-[-6px] w-full text-transparent opacity-45", wordmarkClass)} style={{ WebkitTextStroke: "1px rgba(255,255,255,.38)" }}>{primaryName}</span>
      <h1 className="relative w-full max-w-5xl">
        <span className={cn("text-white [text-shadow:0_12px_50px_rgba(0,0,0,.55)]", wordmarkClass)} style={{ maskImage: "linear-gradient(90deg,#000 0%,#000 88%,rgba(0,0,0,.48) 100%)", WebkitMaskImage: "linear-gradient(90deg,#000 0%,#000 88%,rgba(0,0,0,.48) 100%)" }}>{primaryName}</span>
        {variantName && <span className="mt-4 block max-w-3xl text-balance text-[clamp(1rem,2.4vw,2rem)] font-black uppercase leading-tight tracking-[.12em]" style={{ color: accent }}>{variantName}</span>}
      </h1>
    </div>
  )
}

function WarRoomConcept({ view }: { view: PrototypeView }) {
  const secondaryStats = [
    ["Armor", view.selectedStat?.armorRating],
    ["Crit rate", view.selectedStat?.criticalRating],
    ["Crit damage", view.selectedStat?.criticalDamageRating],
    ["Block", view.selectedStat?.blockProficiency],
    ["Energy resist", view.selectedStat?.energyResistance],
    ["Physical resist", view.selectedStat?.physicalResistance],
  ] as const

  return (
    <main className="min-h-screen bg-[#071014] pb-32 text-slate-100">
      <header className="border-b border-cyan-400/15 bg-[#09161b] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/champions/${view.champion.slug}`} className="grid h-9 w-9 place-items-center border border-cyan-400/20 text-cyan-100 hover:bg-cyan-400/10"><ArrowLeft className="h-4 w-4" /></Link>
            <PrototypeEyebrow number="02" label="War-room console" light />
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-200/50 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live champion data
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-8">
        <section className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_repeat(3,.55fr)]">
          <div className="flex min-h-28 items-center gap-5 border border-cyan-400/15 bg-[#0a1a20] p-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-cyan-300/25 bg-black">
              <Image src={view.portraitUrl} alt={view.champion.name} fill sizes="80px" className="object-contain object-center p-1" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[.24em] text-cyan-300/60">{view.champion.class} / Intelligence file</div>
              <h1 className="truncate text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">{view.champion.name}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {view.champion.tags.slice(0, 4).map(tag => <span key={tag.id} className="border border-slate-700 bg-slate-950/50 px-2 py-1 text-[10px] uppercase text-slate-400">{tag.name}</span>)}
              </div>
            </div>
          </div>
          <ConsoleMetric icon={<Gauge />} label="Prestige" value={format(view.prestige)} accent={view.accent} />
          <ConsoleMetric icon={<HeartPulse />} label="Health pool" value={format(view.health)} accent="#22d3ee" />
          <ConsoleMetric icon={<Swords />} label="Attack rating" value={format(view.attack)} accent="#fb7185" />
        </section>

        <ControlPanel view={view} tone="console" horizontal />

        <section className="mt-4 grid items-start gap-4 xl:grid-cols-[.75fr_1.4fr_.85fr]">
          <div className="space-y-4">
            <ConsolePanel title="Combat telemetry" icon={<Activity className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-px bg-cyan-400/10">
                {secondaryStats.map(([label, value]) => (
                  <div key={label} className="bg-[#09161b] p-3">
                    <div className="font-mono text-[9px] uppercase tracking-[.18em] text-slate-500">{label}</div>
                    <div className="mt-1 font-mono text-lg font-bold text-cyan-100">{format(value)}</div>
                  </div>
                ))}
              </div>
            </ConsolePanel>
            <ConsolePanel title="Target directory" icon={<Crosshair className="h-4 w-4" />}>
              <CompactDuels view={view} />
            </ConsolePanel>
          </div>

          <ConsolePanel title="Ability response matrix" icon={<Database className="h-4 w-4" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...view.abilities, ...view.immunities].map((item, index) => (
                <AbilityDataRow key={item.id} item={item} view={view} index={index + 1} />
              ))}
            </div>
          </ConsolePanel>

          <div className="space-y-4">
            <ConsolePanel title="Readiness profile" icon={<Target className="h-4 w-4" />}>
              <StatBars view={view} mode="console" />
            </ConsolePanel>
            <ConsolePanel title="Classification" icon={<Layers3 className="h-4 w-4" />}>
              <div className="flex flex-wrap gap-2">
                {view.champion.tags.map(tag => (
                  <span key={tag.id} className="border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 font-mono text-[10px] uppercase text-cyan-100/65">{tag.name}</span>
                ))}
              </div>
            </ConsolePanel>
          </div>
        </section>
        <FullChampionDescription view={view} tone="console" />
      </div>
    </main>
  )
}

function FieldGuideConcept({ view }: { view: PrototypeView }) {
  return (
    <main className="min-h-screen bg-[#f0ece2] pb-32 text-[#252a2a]">
      <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between border-b border-[#252a2a]/20 pb-5">
          <PrototypeEyebrow number="03" label="The field guide" />
          <Link href={`/champions/${view.champion.slug}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#252a2a]/55 hover:text-[#252a2a]">
            Index <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <section className="grid gap-10 border-b border-[#252a2a]/20 py-10 lg:grid-cols-[1.35fr_.65fr] lg:py-16">
          <div>
            <div className="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[.24em]" style={{ color: view.accent }}>
              <span>{view.champion.class} specimen</span><span className="h-px w-16 bg-current" />
            </div>
            <h1 className="max-w-4xl font-serif text-[clamp(4rem,9vw,8.5rem)] leading-[.82] tracking-[-.065em] text-[#18201f]">
              {view.champion.name}
            </h1>
            <p className="mt-8 max-w-2xl font-serif text-xl leading-8 text-[#3f4745]">
              A practical field reference for match-up planning, roster investment, and knowing exactly what this champion brings into a fight.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[.12em] text-[#252a2a]/55">
              {view.champion.tags.slice(0, 6).map(tag => <span key={tag.id}>#{tag.name}</span>)}
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden border border-[#252a2a]/20 bg-[#ded7c7]">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#252a2a 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
            <Image src={view.portraitUrl} alt={view.champion.name} fill priority sizes="(max-width: 1024px) 90vw, 420px" className="object-contain object-bottom grayscale-[.15] drop-shadow-[0_20px_18px_rgba(37,42,42,.25)]" />
            <span className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[.2em] text-[#252a2a]/45">Fig. {String(view.champion.id).padStart(3, "0")}</span>
          </div>
        </section>

        <section className="grid items-start gap-10 py-10 lg:grid-cols-[240px_1fr_280px]">
          <aside className="space-y-8 lg:sticky lg:top-6">
            <ControlPanel view={view} tone="paper" />
          </aside>

          <article className="min-w-0">
            <section className="grid grid-cols-3 border-y border-[#252a2a]/20">
              <GuideMetric label="Prestige" value={format(view.prestige)} />
              <GuideMetric label="Health" value={format(view.health)} />
              <GuideMetric label="Attack" value={format(view.attack)} />
            </section>
            <GuideSection number="I" title="What it does" intro="A quick vocabulary of the effects that define this champion.">
              <div className="grid gap-3 sm:grid-cols-2">
                {view.abilities.map(item => <GuideAbility key={item.id} item={item} view={view} />)}
              </div>
            </GuideSection>
            <GuideSection number="II" title="What it ignores" intro="Defensive coverage and matchup safety at a glance.">
              <div className="flex flex-wrap gap-2">
                {view.immunities.map(item => <span key={item.id} className="rounded-full border border-[#252a2a]/25 px-4 py-2 text-sm font-semibold">{item.ability.name}</span>)}
                {!view.immunities.length && <p className="text-sm text-[#252a2a]/55">No immunities recorded.</p>}
              </div>
            </GuideSection>
            <FullChampionDescription view={view} tone="paper" />
          </article>

          <aside className="space-y-8 border-l border-[#252a2a]/20 pl-6">
            <div>
              <h2 className="font-serif text-2xl">Stat profile</h2>
              <div className="mt-5"><StatBars view={view} mode="paper" /></div>
            </div>
            <div>
              <h2 className="font-serif text-2xl">Duel index</h2>
              <div className="mt-4"><CompactDuels view={view} paper /></div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function MatrixConcept({ view }: { view: PrototypeView }) {
  const allAbilities = [...view.immunities, ...view.abilities]
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020607] pb-32 text-emerald-50">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(52,211,153,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,153,.12) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,.14),transparent_42%)]" />

      <div className="relative mx-auto max-w-[1500px] px-5 py-7 md:px-10">
        <div className="flex items-center justify-between">
          <PrototypeEyebrow number="04" label="Neural matrix" light />
          <Link href={`/champions/${view.champion.slug}`} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-emerald-300/50 hover:text-emerald-200">
            <LockKeyhole className="h-3.5 w-3.5" /> Exit matrix
          </Link>
        </div>

        <section className="grid min-h-[660px] items-center gap-8 py-8 lg:grid-cols-[1fr_1.15fr_1fr]">
          <div className="order-2 space-y-4 lg:order-1">
            <MatrixLabel index="A" label="Combat identity" />
            {view.abilities.slice(0, 5).map((item, index) => (
              <MatrixAbility key={item.id} item={item} view={view} side="left" index={index} />
            ))}
          </div>

          <div className="order-1 flex flex-col items-center lg:order-2">
            <div className="relative aspect-square w-full max-w-[510px]">
              <div className="absolute inset-[6%] rounded-full border border-emerald-300/20" />
              <div className="absolute inset-[13%] animate-[spin_32s_linear_infinite] rounded-full border border-dashed border-emerald-300/25" />
              <div className="absolute inset-[20%] rounded-full border border-emerald-300/15 shadow-[0_0_90px_rgba(52,211,153,.15)]" />
              <Orbit className="absolute inset-0 h-full w-full animate-[spin_48s_linear_infinite] stroke-emerald-300/10 stroke-[.3]" />
              <Image src={view.portraitUrl} alt={view.champion.name} fill priority sizes="(max-width: 1024px) 90vw, 510px" className="z-10 object-contain object-bottom drop-shadow-[0_0_28px_rgba(52,211,153,.2)]" />
              <div className="absolute inset-x-8 bottom-0 z-20 bg-gradient-to-t from-[#020607] via-[#020607]/85 to-transparent pt-24 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[.32em] text-emerald-300">{view.champion.class} entity</div>
                <h1 className="mt-2 text-5xl font-black uppercase tracking-[-.055em] text-white sm:text-6xl">{view.champion.name}</h1>
              </div>
            </div>
            <div className="mt-2 grid w-full max-w-md grid-cols-3 gap-px bg-emerald-400/20">
              <MatrixMetric label="PWR" value={format(view.prestige)} />
              <MatrixMetric label="HP" value={compact(view.health)} />
              <MatrixMetric label="ATK" value={compact(view.attack)} />
            </div>
          </div>

          <div className="order-3 space-y-4">
            <MatrixLabel index="B" label="Defensive layers" />
            {view.immunities.slice(0, 5).map((item, index) => (
              <MatrixAbility key={item.id} item={item} view={view} side="right" index={index} />
            ))}
            {!view.immunities.length && <div className="border border-dashed border-emerald-400/20 p-5 font-mono text-xs text-emerald-100/40">No immunity nodes indexed.</div>}
          </div>
        </section>

        <section className="grid gap-4 border-t border-emerald-400/15 pt-5 lg:grid-cols-[1fr_1.6fr]">
          <ControlPanel view={view} tone="matrix" horizontal />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-emerald-400/15 bg-emerald-400/[.025] p-4">
              <MatrixLabel index="C" label="Signal strength" />
              <div className="mt-4"><StatBars view={view} mode="matrix" /></div>
            </div>
            <div className="border border-emerald-400/15 bg-emerald-400/[.025] p-4">
              <MatrixLabel index="D" label={`${allAbilities.length} indexed nodes`} />
              <div className="mt-4 flex flex-wrap gap-2">
                {view.champion.tags.map(tag => <span key={tag.id} className="border border-emerald-400/20 px-2 py-1 font-mono text-[9px] uppercase text-emerald-100/60">{tag.name}</span>)}
              </div>
            </div>
          </div>
        </section>
        <FullChampionDescription view={view} tone="matrix" />
      </div>
    </main>
  )
}

function VaultConcept({ view }: { view: PrototypeView }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#100b18] pb-32 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(168,85,247,.28),transparent_35%),radial-gradient(circle_at_82%_15%,rgba(236,72,153,.2),transparent_34%),radial-gradient(circle_at_60%_90%,rgba(14,165,233,.15),transparent_40%)]" />
      <div className="relative mx-auto max-w-[1450px] px-5 py-7 md:px-10">
        <div className="flex items-center justify-between">
          <PrototypeEyebrow number="05" label="Champion vault" light />
          <Link href={`/champions/${view.champion.slug}`} className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white">Close showcase</Link>
        </div>

        <section className="grid min-h-[760px] items-center gap-10 py-10 lg:grid-cols-[.82fr_1.18fr]">
          <div className="relative mx-auto w-full max-w-[480px]">
            <div className="absolute -inset-8 rounded-[4rem] opacity-40 blur-3xl" style={{ background: `linear-gradient(135deg,${view.accent},#a855f7,#ec4899)` }} />
            <div className="relative aspect-[.72] overflow-hidden rounded-[2rem] border border-white/25 bg-[#160f23] p-2 shadow-[0_45px_100px_rgba(0,0,0,.55)]">
              <div className="relative h-full overflow-hidden rounded-[1.55rem] border border-white/15 bg-black">
                <Image src={view.heroUrl} alt="" fill sizes="480px" className="object-cover opacity-35 blur-sm scale-110" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0917]" />
                <Image src={view.portraitUrl} alt={view.champion.name} fill priority sizes="480px" className="object-contain object-bottom p-4 drop-shadow-[0_20px_22px_rgba(0,0,0,.65)]" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                  <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[.22em] backdrop-blur">{view.champion.class}</span>
                  <Hexagon className="h-8 w-8 fill-white/10" style={{ color: view.accent }} />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="text-xs font-bold uppercase tracking-[.25em] text-white/50">CereBro collection</div>
                  <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-[-.055em]">{view.champion.name}</h1>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <CardMetric label="PWR" value={compact(view.prestige)} />
                    <CardMetric label="HP" value={compact(view.health)} />
                    <CardMetric label="ATK" value={compact(view.attack)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 text-center text-xs text-white/35">#{String(view.champion.id).padStart(4, "0")} · Dynamic champion profile</div>
          </div>

          <div>
            <div className="mb-8">
              <div className="text-sm font-bold uppercase tracking-[.2em]" style={{ color: view.accent }}>Build the version you own</div>
              <h2 className="mt-3 max-w-2xl text-5xl font-black leading-[.95] tracking-[-.05em] sm:text-6xl">One champion. Every meaningful configuration.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/55">A showcase-first direction that makes progression feel collectible while keeping tactical detail close at hand.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[.055] p-5 backdrop-blur-xl">
              <ControlPanel view={view} tone="vault" horizontal />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <VaultPanel icon={<Zap />} title="Power set" count={view.abilities.length} accent={view.accent}>
                <div className="flex flex-wrap gap-2">{view.abilities.map(item => <AbilityPill key={item.id} item={item} view={view} />)}</div>
              </VaultPanel>
              <VaultPanel icon={<Shield />} title="Immunities" count={view.immunities.length} accent={view.accent}>
                <div className="flex flex-wrap gap-2">{view.immunities.map(item => <AbilityPill key={item.id} item={item} view={view} />)}</div>
              </VaultPanel>
              <VaultPanel icon={<Sparkles />} title="Traits" count={view.champion.tags.length} accent={view.accent}>
                <div className="flex flex-wrap gap-2">{view.champion.tags.map(tag => <span key={tag.id} className="rounded-full bg-white/[.07] px-3 py-1.5 text-xs text-white/60">{tag.name}</span>)}</div>
              </VaultPanel>
              <VaultPanel icon={<Target />} title="Duel targets" count={view.champion.duels.length} accent={view.accent}>
                <CompactDuels view={view} />
              </VaultPanel>
            </div>
          </div>
        </section>
        <FullChampionDescription view={view} tone="vault" />
      </div>
    </main>
  )
}

type DescriptionTone = "dossier" | "console" | "paper" | "matrix" | "vault"

const DESCRIPTION_THEMES = {
  dossier: {
    shell: "mt-16 border-t border-white/10 pt-10",
    kicker: "text-white/35",
    heading: "text-white",
    intro: "text-white/45",
    bio: "border-white/10 bg-white/[.025]",
    panel: "border-white/10 bg-white/[.025]",
    group: "border-white/10 bg-black/20",
    title: "text-white",
    body: "text-white/60",
    muted: "text-white/35",
    value: "bg-white/10 text-white",
    glossary: "text-sky-300 decoration-sky-300/35",
    warning: "border-amber-400/20 bg-amber-400/[.06] text-amber-100/65",
  },
  console: {
    shell: "mt-5 border border-cyan-400/15 bg-[#0a171c] p-4 md:p-6",
    kicker: "text-cyan-300/45",
    heading: "text-cyan-50",
    intro: "text-slate-500",
    bio: "border-cyan-400/10 bg-black/20",
    panel: "border-cyan-400/10 bg-black/15",
    group: "border-cyan-400/10 bg-[#071216]",
    title: "text-cyan-50",
    body: "text-slate-400",
    muted: "text-cyan-100/30",
    value: "bg-cyan-300/10 text-cyan-100",
    glossary: "text-cyan-300 decoration-cyan-300/35",
    warning: "border-amber-400/20 bg-amber-400/[.05] text-amber-100/60",
  },
  paper: {
    shell: "mt-10 border-y border-[#252a2a]/20 py-10",
    kicker: "text-[#252a2a]/45",
    heading: "font-serif text-[#18201f]",
    intro: "text-[#252a2a]/55",
    bio: "border-[#252a2a]/15 bg-[#e8e2d5]",
    panel: "border-[#252a2a]/15 bg-transparent",
    group: "border-[#252a2a]/15 bg-[#e8e2d5]",
    title: "font-serif text-[#18201f]",
    body: "text-[#3f4745]",
    muted: "text-[#252a2a]/45",
    value: "bg-[#252a2a] text-white",
    glossary: "text-[#156b62] decoration-[#156b62]/35",
    warning: "border-amber-800/20 bg-amber-700/[.06] text-amber-950/65",
  },
  matrix: {
    shell: "mt-5 border-t border-emerald-400/15 pt-8",
    kicker: "text-emerald-300/40",
    heading: "text-emerald-50",
    intro: "text-emerald-50/35",
    bio: "border-emerald-400/15 bg-emerald-400/[.025]",
    panel: "border-emerald-400/15 bg-emerald-400/[.02]",
    group: "border-emerald-400/10 bg-black/20",
    title: "text-emerald-50",
    body: "text-emerald-50/55",
    muted: "text-emerald-100/30",
    value: "bg-emerald-300/10 text-emerald-100",
    glossary: "text-emerald-300 decoration-emerald-300/35",
    warning: "border-amber-400/20 bg-amber-400/[.05] text-amber-100/60",
  },
  vault: {
    shell: "mt-2 rounded-[2rem] border border-white/10 bg-white/[.045] p-5 backdrop-blur-xl md:p-8",
    kicker: "text-white/35",
    heading: "text-white",
    intro: "text-white/45",
    bio: "border-white/10 bg-white/[.04]",
    panel: "border-white/10 bg-black/10",
    group: "border-white/10 bg-white/[.035]",
    title: "text-white",
    body: "text-white/60",
    muted: "text-white/35",
    value: "bg-white/10 text-white",
    glossary: "text-fuchsia-300 decoration-fuchsia-300/35",
    warning: "border-amber-400/20 bg-amber-400/[.06] text-amber-100/65",
  },
} satisfies Record<DescriptionTone, Record<string, string>>

function FullChampionDescription({ view, tone }: { view: PrototypeView; tone: DescriptionTone }) {
  const panels = [view.descriptionView.signaturePanel, ...view.descriptionView.descriptionPanels]
  const hasContent = view.descriptionView.bioRecords.length > 0 || panels.some(panel => panel.introRecord || panel.recordGroups.length)

  if (!hasContent) return <EmptyDescriptionState tone={tone} />
  if (tone === "dossier") return <DossierDescriptions view={view} panels={panels} />
  if (tone === "console") return <WarRoomDescriptions view={view} panels={panels} />
  if (tone === "paper") return <FieldGuideDescriptions view={view} panels={panels} />
  if (tone === "matrix") return <MatrixDescriptions view={view} panels={panels} />
  return <VaultDescriptions view={view} panels={panels} />
}

type DescriptionPanelData = PreparedChampionAbilityTextPanel<ChampionAbilityTextRecord>
type DescriptionTheme = (typeof DESCRIPTION_THEMES)[DescriptionTone]

function EmptyDescriptionState({ tone }: { tone: DescriptionTone }) {
  const theme = DESCRIPTION_THEMES[tone]
  return (
    <section className={theme.shell}>
      <DescriptionHeading view={null} theme={theme} kicker="Complete champion record" title="Biography & full descriptions" />
      <div className={cn("border border-dashed p-6 text-sm", theme.panel, theme.muted)}>
        No full champion descriptions have been imported for this champion yet.
      </div>
    </section>
  )
}

function DossierDescriptions({ view, panels }: { view: PrototypeView; panels: DescriptionPanelData[] }) {
  const theme = DESCRIPTION_THEMES.dossier
  const hasBiography = view.descriptionView.bioRecords.length > 0
  const [activeChapter, setActiveChapter] = useState("all")
  const readerRef = useRef<HTMLDivElement>(null)
  const showBiography = hasBiography && (activeChapter === "all" || activeChapter === "biography")

  const selectChapter = (chapter: string) => {
    setActiveChapter(chapter)
    window.requestAnimationFrame(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <section className={theme.shell}>
      <div className="mb-8 grid gap-5 md:grid-cols-[1fr_.65fr] md:items-end">
        <h2 className="text-4xl font-black tracking-[-.04em] text-white md:text-5xl">Full ability descriptions</h2>
        <div>
          <p className="max-w-xl text-sm leading-6 text-white/45">Complete signature, base ability, and special attack details, plus the champion biography.</p>
          <BuildReadout view={view} className="mt-3 text-white/30" />
        </div>
      </div>
      <DescriptionWarning theme={theme} />
      <div ref={readerRef} className="scroll-mt-20 border border-white/10 bg-white/[.012] lg:scroll-mt-44">
        <DossierChapterNav hasBiography={hasBiography} panels={panels} activeChapter={activeChapter} onSelect={selectChapter} />
        <div className="min-h-[360px] px-4 sm:px-6">
        {showBiography && (
          <article id="dossier-biography" className="grid scroll-mt-52 gap-5 border-b border-white/10 py-10 md:grid-cols-[minmax(210px,280px)_1fr]">
            <div>
              <h3 className="text-3xl font-black text-white">Biography</h3>
              <div className="relative mt-6 hidden aspect-square w-36 overflow-hidden border border-white/10 bg-white/[.025] md:block">
                <Image src={view.secondaryUrl} alt={`${view.champion.name} alternate portrait`} fill sizes="144px" className="object-contain object-bottom p-2 opacity-75" />
                <span className="pointer-events-none absolute inset-2 border border-white/[.06]" />
              </div>
            </div>
            <div className="max-w-3xl space-y-4 text-lg leading-8">{view.descriptionView.bioRecords.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
          </article>
        )}
        {panels.filter(panel => activeChapter === "all" || panel.group === activeChapter).map(panel => (
          <article key={panel.group} id={dossierAnchor(panel.title)} className="grid scroll-mt-52 gap-6 border-b border-white/10 py-10 last:border-0 md:grid-cols-[minmax(210px,280px)_1fr]">
            <h3 className="text-3xl font-black leading-tight text-white">{panel.title}</h3>
            <div>
              {panel.introRecord && <div className="mb-7 border-l-2 pl-4 italic text-white/55" style={{ borderColor: view.accent }}><RenderedDescriptionTemplate prepared={panel.introRecord.prepared} glossaryById={view.glossaryById} theme={theme} /></div>}
              <div className="divide-y divide-white/10">
                {panel.recordGroups.map(group => (
                  <section key={group.id} className="grid gap-3 py-5 first:pt-0 sm:grid-cols-[190px_1fr]">
                    <h4 className="text-sm font-black text-white/75">{group.title || "Details"}</h4>
                    <div className="space-y-3">{group.records.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
                  </section>
                ))}
              </div>
              {panel.group === "signature" && <DossierCombinedSignatureChart view={view} />}
            </div>
          </article>
        ))}
        </div>
      </div>
    </section>
  )
}

function DossierChapterNav({ hasBiography, panels, activeChapter, onSelect }: { hasBiography: boolean; panels: DescriptionPanelData[]; activeChapter: string; onSelect: (chapter: string) => void }) {
  const chapters = [
    ...(hasBiography ? [{ key: "biography", label: "Biography" }] : []),
    ...panels.map(panel => ({ key: panel.group, label: chapterLabel(panel.title) })),
  ]

  return (
    <div className="sticky top-16 z-30 border-b border-white/10 bg-[#080b10]/95 backdrop-blur-xl lg:top-[158px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-3 py-2 sm:px-4">
        <div className="text-[9px] font-black uppercase tracking-[.16em] text-white/30">Dossier chapters</div>
        <div className="text-[9px] font-bold text-white/25">{activeChapter === "all" ? `${chapters.length} sections visible` : "Focused reading"}</div>
      </div>
      <nav aria-label="Champion description chapters" className="flex gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" aria-pressed={activeChapter === "all"} onClick={() => onSelect("all")} className={cn("shrink-0 rounded-md px-3 py-2 text-xs font-bold transition-colors", activeChapter === "all" ? "bg-white text-[#080b10]" : "text-white/45 hover:bg-white/[.06] hover:text-white")}>All</button>
        {chapters.map(chapter => (
          <button key={chapter.key} type="button" aria-pressed={activeChapter === chapter.key} onClick={() => onSelect(chapter.key)} className={cn("shrink-0 rounded-md px-3 py-2 text-xs font-bold transition-colors", activeChapter === chapter.key ? "bg-white text-[#080b10]" : "text-white/45 hover:bg-white/[.06] hover:text-white")}>{chapter.label}</button>
        ))}
      </nav>
    </div>
  )
}

function dossierAnchor(title: string) {
  return `dossier-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
}

function chapterLabel(title: string) {
  if (title.startsWith("Special Attack 1")) return "Special 1"
  if (title.startsWith("Special Attack 2")) return "Special 2"
  if (title.startsWith("Special Attack 3")) return "Special 3"
  return title
}

function WarRoomDescriptions({ view, panels }: { view: PrototypeView; panels: DescriptionPanelData[] }) {
  const theme = DESCRIPTION_THEMES.console
  return (
    <section className={theme.shell}>
      <div className="mb-4 flex flex-col gap-3 border-b border-cyan-400/10 pb-4 md:flex-row md:items-end md:justify-between">
        <div><div className="font-mono text-[9px] uppercase tracking-[.25em] text-cyan-300/40">Data bank / full output</div><h2 className="mt-2 font-mono text-2xl font-bold uppercase tracking-tight text-cyan-50">Description command table</h2></div>
        <BuildReadout view={view} className="text-cyan-100/45" />
      </div>
      <DescriptionWarning theme={theme} />
      {view.descriptionView.bioRecords.length > 0 && (
        <div className="mb-4 grid border border-cyan-400/10 bg-black/20 md:grid-cols-[180px_1fr]">
          <div className="border-b border-cyan-400/10 p-4 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300/55 md:border-b-0 md:border-r">BIO / IDENTITY</div>
          <div className="space-y-3 p-4">{view.descriptionView.bioRecords.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
        </div>
      )}
      <div className="space-y-4">
        {panels.map((panel, panelIndex) => (
          <section key={panel.group} className="border border-cyan-400/15 bg-[#071216]">
            <div className="grid border-b border-cyan-400/10 md:grid-cols-[180px_1fr]">
              <div className="border-b border-cyan-400/10 p-4 font-mono text-[10px] text-cyan-300/45 md:border-b-0 md:border-r">MODULE {String(panelIndex + 1).padStart(2, "0")}</div>
              <div className="p-4"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-slate-600">{panel.group.replaceAll("_", " ")}</div><h3 className="mt-1 text-lg font-black text-cyan-50">{panel.title}</h3></div>
            </div>
            {panel.introRecord && <div className="grid border-b border-cyan-400/10 md:grid-cols-[180px_1fr]"><div className="border-b border-cyan-400/10 p-4 font-mono text-[9px] uppercase text-slate-600 md:border-b-0 md:border-r">Overview</div><div className="p-4 italic"><RenderedDescriptionTemplate prepared={panel.introRecord.prepared} glossaryById={view.glossaryById} theme={theme} /></div></div>}
            <div>
              {panel.recordGroups.map((group, groupIndex) => (
                <div key={group.id} className="grid border-b border-cyan-400/10 last:border-0 md:grid-cols-[180px_1fr]">
                  <div className="border-b border-cyan-400/10 p-4 md:border-b-0 md:border-r"><div className="font-mono text-[8px] text-cyan-300/30">ROW {String(groupIndex + 1).padStart(2, "0")}</div><h4 className="mt-1 text-xs font-bold uppercase text-cyan-50/65">{group.title || "Details"}</h4></div>
                  <div className="space-y-3 p-4">{group.records.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function FieldGuideDescriptions({ view, panels }: { view: PrototypeView; panels: DescriptionPanelData[] }) {
  const theme = DESCRIPTION_THEMES.paper
  return (
    <section className={theme.shell}>
      <div className="mx-auto max-w-3xl text-center">
        <div className="font-serif text-sm italic text-[#252a2a]/45">Part III</div>
        <h2 className="mt-3 font-serif text-5xl leading-none tracking-[-.05em] text-[#18201f]">The complete field notes</h2>
        <p className="mx-auto mt-5 max-w-2xl font-serif text-lg leading-7 text-[#252a2a]/55">An uninterrupted reading edition, with every mechanic arranged as chapters instead of interface panels.</p>
        <div className="mx-auto my-7 h-px w-24 bg-[#252a2a]/25" />
        <BuildReadout view={view} className="justify-center text-[#252a2a]/45" />
      </div>
      <DescriptionWarning theme={theme} />
      {view.descriptionView.bioRecords.length > 0 && (
        <article className="mx-auto max-w-3xl py-10">
          <div className="mb-4 font-serif text-sm italic text-[#252a2a]/40">Preface</div>
          <h3 className="font-serif text-4xl text-[#18201f]">Biography</h3>
          <div className="mt-6 space-y-4 font-serif text-lg leading-8 first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:leading-[.8]">
            {view.descriptionView.bioRecords.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}
          </div>
        </article>
      )}
      <div className="mx-auto max-w-4xl">
        {panels.map((panel, panelIndex) => (
          <article key={panel.group} className="grid gap-6 border-t border-[#252a2a]/20 py-12 md:grid-cols-[120px_1fr]">
            <div className="font-serif text-sm italic text-[#252a2a]/40">Chapter {roman(panelIndex + 1)}</div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[.22em] text-[#252a2a]/40">{panel.group.replaceAll("_", " ")}</div>
              <h3 className="mt-2 font-serif text-4xl tracking-tight text-[#18201f]">{panel.title}</h3>
              {panel.introRecord && <div className="mt-5 border-l border-[#252a2a]/30 pl-5 font-serif text-lg italic leading-8"><RenderedDescriptionTemplate prepared={panel.introRecord.prepared} glossaryById={view.glossaryById} theme={theme} /></div>}
              <div className="mt-8 space-y-9">
                {panel.recordGroups.map(group => (
                  <section key={group.id}>
                    {group.title && <h4 className="font-serif text-2xl text-[#18201f]">{group.title}</h4>}
                    <div className="mt-3 space-y-4 font-serif text-[15px] leading-7">{group.records.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
                  </section>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MatrixDescriptions({ view, panels }: { view: PrototypeView; panels: DescriptionPanelData[] }) {
  const theme = DESCRIPTION_THEMES.matrix
  const signature = panels.find(panel => panel.group === "signature")
  const base = panels.find(panel => panel.group === "base")
  const branches = panels.filter(panel => panel !== signature && panel !== base)
  return (
    <section className={theme.shell}>
      <div className="flex flex-col gap-4 border-b border-emerald-400/15 pb-5 md:flex-row md:items-end md:justify-between">
        <div><div className="font-mono text-[9px] uppercase tracking-[.24em] text-emerald-300/40">Ability topology / expanded</div><h2 className="mt-2 text-4xl font-black tracking-[-.04em] text-emerald-50">Description node map</h2></div>
        <BuildReadout view={view} className="text-emerald-100/40" />
      </div>
      <DescriptionWarning theme={theme} />
      {view.descriptionView.bioRecords.length > 0 && (
        <div className="mx-auto mb-5 max-w-3xl border border-emerald-400/15 bg-emerald-400/[.025] p-5 text-center">
          <MatrixLabel index="00" label="Identity source" />
          <div className="mt-4 space-y-3">{view.descriptionView.bioRecords.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        {signature && <div className="mx-auto max-w-2xl"><MatrixDescriptionNode panel={signature} view={view} theme={theme} label="ROOT" /></div>}
        {signature && <div className="mx-auto h-10 w-px bg-emerald-400/25" />}
        {base && <MatrixDescriptionNode panel={base} view={view} theme={theme} label="CORE" wide />}
        {branches.length > 0 && <><div className="mx-auto h-10 w-px bg-emerald-400/25" /><div className="mx-auto hidden h-px w-2/3 bg-emerald-400/25 lg:block" /></>}
        <div className="grid gap-4 pt-4 lg:grid-cols-3">
          {branches.map((panel, index) => <MatrixDescriptionNode key={panel.group} panel={panel} view={view} theme={theme} label={`BRANCH ${String(index + 1).padStart(2, "0")}`} />)}
        </div>
      </div>
    </section>
  )
}

function MatrixDescriptionNode({ panel, view, theme, label, wide = false }: { panel: DescriptionPanelData; view: PrototypeView; theme: DescriptionTheme; label: string; wide?: boolean }) {
  return (
    <article className={cn("relative border border-emerald-400/15 bg-emerald-400/[.02] p-4 md:p-5", wide && "w-full")}>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-emerald-400/10 pb-4">
        <div><div className="font-mono text-[8px] uppercase tracking-[.22em] text-emerald-300/35">{label}</div><h3 className="mt-1 text-xl font-black text-emerald-50">{panel.title}</h3></div>
        <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_#6ee7b7]" />
      </div>
      {panel.introRecord && <div className="mb-4 italic"><RenderedDescriptionTemplate prepared={panel.introRecord.prepared} glossaryById={view.glossaryById} theme={theme} /></div>}
      <div className={cn("grid gap-3", wide && "md:grid-cols-2")}>
        {panel.recordGroups.map(group => (
          <div key={group.id} className="border-l border-emerald-400/20 pl-3">
            {group.title && <h4 className="mb-2 font-mono text-[10px] font-bold uppercase text-emerald-100/65">{group.title}</h4>}
            <div className="space-y-3">{group.records.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
          </div>
        ))}
      </div>
    </article>
  )
}

function VaultDescriptions({ view, panels }: { view: PrototypeView; panels: DescriptionPanelData[] }) {
  const theme = DESCRIPTION_THEMES.vault
  const [activeGroup, setActiveGroup] = useState(panels[0]?.group ?? "")
  const activePanel = panels.find(panel => panel.group === activeGroup) ?? panels[0]
  return (
    <section className={theme.shell}>
      <div className="grid gap-5 border-b border-white/10 pb-6 md:grid-cols-[1fr_.65fr] md:items-end">
        <div><div className="text-xs font-bold uppercase tracking-[.22em] text-fuchsia-300/55">Vault archive</div><h2 className="mt-2 text-4xl font-black tracking-[-.045em] text-white md:text-5xl">Open one power file at a time.</h2></div>
        <div><p className="text-sm leading-6 text-white/45">A focused reading mode: biography stays pinned while the selected ability file opens in full.</p><BuildReadout view={view} className="mt-3 text-white/35" /></div>
      </div>
      <DescriptionWarning theme={theme} />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {panels.map((panel, index) => (
          <button
            key={panel.group}
            type="button"
            onClick={() => setActiveGroup(panel.group)}
            className={cn("shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors", activePanel?.group === panel.group ? "border-white bg-white text-[#100b18]" : "border-white/10 bg-white/[.04] text-white/45 hover:border-white/25 hover:text-white")}
          >
            {String(index + 1).padStart(2, "0")} · {panel.title}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[.38fr_.62fr]">
        <aside className="rounded-3xl border border-white/10 bg-white/[.04] p-5 lg:sticky lg:top-6">
          <div className="mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4" style={{ color: view.accent }} /><h3 className="font-bold text-white">Biography</h3></div>
          <div className="space-y-4">{view.descriptionView.bioRecords.length ? view.descriptionView.bioRecords.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />) : <p className="text-sm text-white/35">No biography imported.</p>}</div>
        </aside>
        {activePanel && (
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-black/15">
            <div className="border-b border-white/10 bg-white/[.035] p-5 md:p-7"><div className="text-[9px] font-bold uppercase tracking-[.22em] text-fuchsia-300/45">{activePanel.group.replaceAll("_", " ")}</div><h3 className="mt-2 text-3xl font-black text-white">{activePanel.title}</h3>{activePanel.introRecord && <div className="mt-4 italic"><RenderedDescriptionTemplate prepared={activePanel.introRecord.prepared} glossaryById={view.glossaryById} theme={theme} /></div>}</div>
            <div className="divide-y divide-white/10">
              {activePanel.recordGroups.map(group => (
                <section key={group.id} className="grid gap-3 p-5 md:grid-cols-[180px_1fr] md:p-7">
                  <h4 className="text-sm font-black text-white/70">{group.title || "Details"}</h4>
                  <div className="space-y-3">{group.records.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={theme} />)}</div>
                </section>
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

function DescriptionHeading({ view, theme, kicker, title }: { view: PrototypeView | null; theme: DescriptionTheme; kicker: string; title: string }) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_.65fr] md:items-end">
      <div><div className={cn("font-mono text-[9px] font-bold uppercase tracking-[.24em]", theme.kicker)}>{kicker}</div><h2 className={cn("mt-3 text-4xl font-black tracking-[-.04em] md:text-5xl", theme.heading)}>{title}</h2></div>
      {view && <p className={cn("max-w-xl text-sm leading-6", theme.intro)}>Every imported description group is included. Highlighted values resolve against the selected build.</p>}
    </div>
  )
}

function DescriptionWarning({ theme }: { theme: DescriptionTheme }) {
  return <div className={cn("mb-6 border px-4 py-3 text-xs leading-5", theme.warning)}>Imported descriptions are still being refined. Exact numeric values can change as the game-data parser and curve resolution improve.</div>
}

function BuildReadout({ view, className }: { view: PrototypeView; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[.16em]", className)}><span>{view.selectedRarity}★</span><span>R{view.selectedRank}</span><span>Sig {view.sigLevel}</span>{view.ascensionLevel > 0 && <span>A{view.ascensionLevel}</span>}</div>
}

function roman(value: number) {
  const values = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
  return values[value - 1] ?? String(value)
}

function RenderedDescriptionTemplate({
  prepared,
  glossaryById,
  theme,
}: {
  prepared: PreparedChampionAbilityText
  glossaryById: Map<string, GlossaryTerm>
  theme: (typeof DESCRIPTION_THEMES)[DescriptionTone]
}) {
  if (prepared.status === "error") {
    return <div className={cn("border px-3 py-2 text-xs", theme.warning)}>{prepared.error.message}</div>
  }

  return (
    <div className={cn("space-y-2 text-sm leading-6", theme.body)}>
      {prepared.blocks.map((block, blockIndex) => (
        <div key={blockIndex}>{block.children.map((node, nodeIndex) => renderDescriptionNode(node, nodeIndex, glossaryById, theme))}</div>
      ))}
    </div>
  )
}

function renderDescriptionNode(
  node: PreparedChampionAbilityTextNode,
  index: number,
  glossaryById: Map<string, GlossaryTerm>,
  theme: (typeof DESCRIPTION_THEMES)[DescriptionTone]
): ReactNode {
  if (node.type === "text") return <span key={index}>{node.value}</span>
  if (node.type === "value") {
    return <ResolvedValueTooltip key={index} node={node} theme={theme} />
  }
  if (node.type === "glossary") {
    const term = glossaryById.get(node.id)
    const description = term?.description?.trim() || rawDescription(term?.raw) || "This effect is referenced by the game data, but its standalone definition is not included in the imported glossary."
    return <GlossaryEffectTooltip key={index} label={node.label} term={term} description={description} theme={theme} />
  }
  if (node.type === "color") {
    return <span key={index} style={{ color: safeColor(node.color) }}>{node.children.map((child, childIndex) => renderDescriptionNode(child, childIndex, glossaryById, theme))}</span>
  }
  return null
}

function ResolvedValueTooltip({ node, theme }: { node: Extract<PreparedChampionAbilityTextNode, { type: "value" }>; theme: DescriptionTheme }) {
  const tooltipId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [active, setActive] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const visible = active || pinned
  const resolved = node.resolution.status === "resolved"
  const displayValue = node.resolution.status === "resolved" ? node.resolution.displayValue : `Unresolved ${node.placeholderIndex}`

  useEffect(() => {
    if (!visible) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 16
      const cardWidth = Math.min(310, window.innerWidth - margin * 2)
      const left = Math.min(window.innerWidth - margin - cardWidth, Math.max(margin, rect.left + rect.width / 2 - cardWidth / 2))
      const above = rect.top > 230
      setPosition({ left, top: above ? rect.top - 10 : rect.bottom + 10, above })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [visible])

  return (
    <span className="relative inline-block" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={visible}
        aria-describedby={visible ? tooltipId : undefined}
        onClick={() => setPinned(current => !current)}
        onFocus={() => setActive(true)}
        onBlur={() => { setActive(false); setPinned(false) }}
        onKeyDown={event => {
          if (event.key !== "Escape") return
          setActive(false)
          setPinned(false)
          event.currentTarget.blur()
        }}
        className={cn("mx-0.5 inline-flex cursor-help rounded px-1.5 py-0.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60", theme.value)}
      >
        {displayValue}
      </button>
      {visible && position && (
        <span id={tooltipId} role="tooltip" className="fixed z-[100] block w-[min(310px,calc(100vw-2rem))] border border-white/15 bg-[#0b0f15]/98 p-3 text-left not-italic text-white shadow-2xl shadow-black/60 backdrop-blur-xl" style={{ left: position.left, top: position.top, transform: position.above ? "translateY(-100%)" : undefined }}>
          <span className="block text-[9px] font-black uppercase tracking-[.18em] text-white/35">{resolved ? "Resolved value" : "Resolution issue"}</span>
          <span className="mt-1 block text-lg font-black" style={{ color: resolved ? "#f8fafc" : "#fbbf24" }}>{displayValue}</span>
          <span className="mt-2 block text-xs leading-5 text-white/55">{node.resolution.detail}</span>
          <span className="mt-2 block text-[9px] font-bold uppercase tracking-[.12em] text-white/25">Tap to pin · Esc to close</span>
        </span>
      )}
    </span>
  )
}

function GlossaryEffectTooltip({ label, term, description, theme }: { label: string; term: GlossaryTerm | undefined; description: string; theme: DescriptionTheme }) {
  const tooltipId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [active, setActive] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const visible = active || pinned
  const raw = term?.raw as Record<string, unknown> | undefined
  const importedColor = typeof raw?.color_primary === "string" ? safeColor(raw.color_primary) : "#7dd3fc"

  useEffect(() => {
    if (!visible) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 16
      const cardWidth = Math.min(290, window.innerWidth - margin * 2)
      const left = Math.min(window.innerWidth - margin - cardWidth, Math.max(margin, rect.left + rect.width / 2 - cardWidth / 2))
      const above = rect.top > 230
      setPosition({ left, top: above ? rect.top - 10 : rect.bottom + 10, above })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [visible])

  return (
    <span className="relative inline-block" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={visible}
        aria-describedby={visible ? tooltipId : undefined}
        onClick={() => setPinned(current => !current)}
        onFocus={() => setActive(true)}
        onBlur={() => { setActive(false); setPinned(false) }}
        onKeyDown={event => {
          if (event.key !== "Escape") return
          setActive(false)
          setPinned(false)
          event.currentTarget.blur()
        }}
        className={cn("cursor-help rounded-sm font-semibold underline decoration-dotted underline-offset-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-300/60", theme.glossary)}
      >
        {label}
      </button>
      {visible && position && (
        <span id={tooltipId} role="tooltip" className="fixed z-[100] block w-[min(290px,calc(100vw-2rem))] border border-white/15 bg-[#0b0f15]/98 p-3 text-left not-italic text-white shadow-2xl shadow-black/60 backdrop-blur-xl" style={{ left: position.left, top: position.top, transform: position.above ? "translateY(-100%)" : undefined }}>
          <span className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10" style={{ backgroundColor: `${importedColor}18` }}>
              {term?.iconUrl ? <span className="h-5 w-5" style={{ backgroundColor: importedColor, maskImage: `url(${term.iconUrl})`, maskPosition: "center", maskRepeat: "no-repeat", maskSize: "contain", WebkitMaskImage: `url(${term.iconUrl})`, WebkitMaskPosition: "center", WebkitMaskRepeat: "no-repeat", WebkitMaskSize: "contain" }} /> : <Sparkles className="h-4 w-4" style={{ color: importedColor }} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[8px] font-black uppercase tracking-[.16em] text-white/30">{term?.category || "Effect glossary"}</span>
              <span className="mt-0.5 block text-sm font-black text-white">{term?.name || label}</span>
            </span>
          </span>
          <span className="mt-2.5 block text-xs font-normal leading-5 text-white/60">{description}</span>
          <span className="mt-2 block text-[8px] font-bold uppercase tracking-[.12em] text-white/25">Tap to pin · Esc to close</span>
        </span>
      )}
    </span>
  )
}

function PrototypeSwitcher({ concept, slug }: { concept: PrototypeConcept; slug: string }) {
  const currentIndex = PROTOTYPE_CONCEPTS.findIndex(item => item.key === concept)
  const previous = PROTOTYPE_CONCEPTS[(currentIndex - 1 + PROTOTYPE_CONCEPTS.length) % PROTOTYPE_CONCEPTS.length]
  const next = PROTOTYPE_CONCEPTS[(currentIndex + 1) % PROTOTYPE_CONCEPTS.length]

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return
      if (target?.closest("[data-prototype-arrow-keys]")) return
      if (event.key === "ArrowLeft") window.location.href = `/champions/${slug}/prototype/${previous.key}`
      if (event.key === "ArrowRight") window.location.href = `/champions/${slug}/prototype/${next.key}`
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [next.key, previous.key, slug])

  return (
    <nav aria-label="Prototype concepts" className="fixed inset-x-3 bottom-4 z-[100] mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-2xl border border-white/15 bg-[#080b10]/95 p-1.5 text-white shadow-2xl shadow-black/60 backdrop-blur-xl">
      <Link href={`/champions/${slug}/prototype/${previous.key}`} aria-label={`Previous concept: ${previous.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-5 w-5" /></Link>
      <div className="flex max-w-[70vw] gap-1 overflow-x-auto">
        {PROTOTYPE_CONCEPTS.map(item => (
          <Link
            key={item.key}
            href={`/champions/${slug}/prototype/${item.key}`}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 transition-colors",
              item.key === concept ? "bg-white text-slate-950" : "text-white/50 hover:bg-white/10 hover:text-white"
            )}
          >
            <span className="font-mono text-[10px]">{item.short}</span>
            <span className="text-xs font-bold">{item.name}</span>
          </Link>
        ))}
      </div>
      <Link href={`/champions/${slug}/prototype/${next.key}`} aria-label={`Next concept: ${next.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white"><ChevronRight className="h-5 w-5" /></Link>
    </nav>
  )
}

function DossierBuildBar({ view }: { view: PrototypeView }) {
  return (
    <section className="relative z-40 border-y border-white/10 bg-[#080b10]/95 py-4 backdrop-blur-xl lg:sticky lg:top-16">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-white"><Gauge className="h-4 w-4" style={{ color: view.accent }} />Configure build</h2>
        <BuildReadout view={view} className="text-white/35" />
      </div>
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:items-center lg:gap-6", view.selectedStat?.rarity === 7 ? "lg:grid-cols-[auto_auto_auto_minmax(240px,1fr)_auto]" : "lg:grid-cols-[auto_auto_auto_minmax(260px,1fr)]")}>
        <div className="hidden items-center gap-2 border-r border-white/10 pr-6 lg:flex">
          <Gauge className="h-4 w-4" style={{ color: view.accent }} />
          <div><div className="text-xs font-black uppercase tracking-[.16em] text-white">Build</div><div className="mt-0.5 text-[9px] text-white/30">Live values</div></div>
        </div>
        <div>
          <span className="mb-2 block font-mono text-[9px] font-bold uppercase tracking-[.2em] text-white/35">Rarity</span>
          <div className="flex flex-wrap gap-1.5">
            {view.rarityOptions.map(rarity => <button key={rarity} type="button" onClick={() => view.setRarity(String(rarity))} className={controlButton(String(rarity) === view.selectedRarity, "dark")}>{rarity}<Star className="h-3 w-3 fill-current" /></button>)}
          </div>
        </div>
        <div className="lg:border-l lg:border-white/10 lg:pl-6">
          <span className="mb-2 block font-mono text-[9px] font-bold uppercase tracking-[.2em] text-white/35">Rank</span>
          <div className="flex flex-wrap gap-1.5">
            {view.rankOptions.map(rank => <button key={rank} type="button" onClick={() => view.setRank(String(rank))} className={controlButton(String(rank) === view.selectedRank, "dark")}>R{rank}</button>)}
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-1 lg:border-l lg:border-white/10 lg:pl-6">
          <span className="mb-2 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[.2em] text-white/35"><span>Signature</span><span className="text-white/70">{view.sigLevel}</span></span>
          <input aria-label="Signature level" type="range" min={0} max={view.maxSig} value={view.sigLevel} onChange={event => view.setSigLevel(Number(event.target.value))} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white" />
        </div>
        {view.selectedStat?.rarity === 7 && (
          <div className="sm:col-span-2 lg:col-span-1 lg:border-l lg:border-white/10 lg:pl-6">
            <span className="mb-2 block font-mono text-[9px] font-bold uppercase tracking-[.2em] text-white/35">Ascension · A{view.ascensionLevel}</span>
            <div className="flex gap-1.5">{[0, 1, 2, 3, 4, 5].map(level => <button key={level} type="button" onClick={() => view.setAscensionLevel(level)} className={controlButton(level === view.ascensionLevel, "dark")}>{level}</button>)}</div>
          </div>
        )}
      </div>
    </section>
  )
}

function DossierTraits({ view }: { view: PrototypeView }) {
  if (!view.champion.tags.length) return null

  return (
    <section aria-label="Champion tags" className="overflow-x-auto border-b border-white/10 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-2">
        {view.champion.tags.map(tag => (
          <span key={tag.id} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-[10px] font-bold text-white/55">
            <span aria-hidden="true" style={{ color: view.accent }}>#</span>
            {tag.name}
          </span>
        ))}
      </div>
    </section>
  )
}

function DossierAdvancedStats({ view }: { view: PrototypeView }) {
  const stats = [
    ["Armor rating", view.selectedStat?.armorRating, view.maxStats.armorRating, false],
    ["Armor penetration", view.selectedStat?.armorPenetration, view.maxStats.armorPenetration, false],
    ["Critical rating", view.selectedStat?.criticalRating, view.maxStats.criticalRating, false],
    ["Critical resistance", view.selectedStat?.criticalResistance, view.maxStats.criticalResistance, false],
    ["Critical damage", view.selectedStat?.criticalDamageRating, view.maxStats.criticalDamageRating, false],
    ["Block proficiency", view.selectedStat?.blockProficiency, view.maxStats.blockProficiency, false],
    ["Block penetration", view.selectedStat?.blockPenetration, view.maxStats.blockPenetration, false],
    ["Special damage", view.selectedStat?.specialDamageMultiplier, view.maxStats.specialDamageMultiplier, true],
    ["Energy resistance", view.selectedStat?.energyResistance, view.maxStats.energyResistance, false],
    ["Physical resistance", view.selectedStat?.physicalResistance, view.maxStats.physicalResistance, false],
  ] as const

  return (
    <details className="group border-b border-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 marker:content-none">
        <div className="flex min-w-0 items-center gap-3">
          <Activity className="h-4 w-4 shrink-0" style={{ color: view.accent }} />
          <div>
            <div className="text-xs font-black uppercase tracking-[.16em] text-white">Combat profile</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] font-bold uppercase tracking-[.12em] text-white/30">
              <span>Level {view.selectedStat?.level ?? "—"}</span>
              <span>Challenge rating {format(view.selectedStat?.challengeRating)}</span>
              <span>{stats.length} advanced ratings</span>
            </div>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-white/30">
          Details <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="grid gap-x-8 gap-y-5 pb-6 pt-2 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, value, max, multiplier]) => {
          const ratio = value != null && max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
          return (
            <div key={label}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[9px] font-bold uppercase tracking-[.12em] text-white/30">{label}</span>
                <span className="font-mono text-xs font-black text-white/70">{multiplier && value != null ? `${value.toFixed(2)}x` : format(value)}</span>
              </div>
              <div className="h-1 overflow-hidden bg-white/[.07]">
                <div className="h-full" style={{ width: `${ratio}%`, backgroundColor: view.accent }} />
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}

function ControlPanel({ view, tone, horizontal = false }: { view: PrototypeView; tone: "dark" | "console" | "paper" | "matrix" | "vault"; horizontal?: boolean }) {
  const isPaper = tone === "paper"
  const isMatrix = tone === "matrix"
  return (
    <div className={cn(horizontal ? "grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]" : "space-y-5")}>
      <SelectorBlock label="Rarity" tone={tone}>
        <div className="flex flex-wrap gap-1.5">
          {view.rarityOptions.map(rarity => (
            <button key={rarity} type="button" onClick={() => view.setRarity(String(rarity))} className={controlButton(String(rarity) === view.selectedRarity, tone)}>
              {rarity}<Star className="h-3 w-3 fill-current" />
            </button>
          ))}
        </div>
      </SelectorBlock>
      <SelectorBlock label="Rank" tone={tone}>
        <div className="flex flex-wrap gap-1.5">
          {view.rankOptions.map(rank => (
            <button key={rank} type="button" onClick={() => view.setRank(String(rank))} className={controlButton(String(rank) === view.selectedRank, tone)}>R{rank}</button>
          ))}
        </div>
      </SelectorBlock>
      <SelectorBlock label={`Signature · ${view.sigLevel}`} tone={tone}>
        <input
          aria-label="Signature level"
          type="range"
          min={0}
          max={view.maxSig}
          value={view.sigLevel}
          onChange={event => view.setSigLevel(Number(event.target.value))}
          className={cn("h-1.5 w-full cursor-pointer appearance-none rounded-full", isPaper ? "accent-[#252a2a] bg-[#252a2a]/15" : isMatrix ? "accent-emerald-400 bg-emerald-400/15" : "accent-white bg-white/10")}
        />
      </SelectorBlock>
      {view.selectedStat?.rarity === 7 && (
        <SelectorBlock label={`Ascension · A${view.ascensionLevel}`} tone={tone}>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5].map(level => <button key={level} type="button" onClick={() => view.setAscensionLevel(level)} className={controlButton(level === view.ascensionLevel, tone)}>{level}</button>)}
          </div>
        </SelectorBlock>
      )}
    </div>
  )
}

function SelectorBlock({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  const dark = tone !== "paper"
  return (
    <div className="block">
      <span className={cn("mb-2 block font-mono text-[9px] font-bold uppercase tracking-[.2em]", dark ? "text-white/35" : "text-[#252a2a]/50")}>{label}</span>
      {children}
    </div>
  )
}

function controlButton(active: boolean, tone: string) {
  if (tone === "paper") return cn("inline-flex h-8 items-center gap-1 border px-2.5 text-xs font-bold", active ? "border-[#252a2a] bg-[#252a2a] text-white" : "border-[#252a2a]/20 text-[#252a2a]/55 hover:border-[#252a2a]/50")
  if (tone === "matrix") return cn("inline-flex h-8 items-center gap-1 border px-2.5 font-mono text-xs", active ? "border-emerald-300 bg-emerald-300 text-[#03100c]" : "border-emerald-300/15 text-emerald-100/45 hover:border-emerald-300/40")
  if (tone === "console") return cn("inline-flex h-8 items-center gap-1 border px-2.5 font-mono text-xs", active ? "border-cyan-300 bg-cyan-300 text-[#041014]" : "border-cyan-300/15 text-cyan-50/45 hover:border-cyan-300/40")
  return cn("inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold", active ? "border-white bg-white text-slate-950" : "border-white/10 bg-white/[.03] text-white/45 hover:border-white/30")
}

function EditorialAbilityList({ title, items, view }: { title: string; items: ChampionDetailsPayload["abilities"]; view: PrototypeView }) {
  const isImmunityList = items[0]?.type === "IMMUNITY"
  const grouped = groupDossierAbilities(items)
  return (
    <section>
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[.2em]">
          {isImmunityList ? <Shield className="h-4 w-4" style={{ color: view.accent }} /> : <Zap className="h-4 w-4" style={{ color: view.accent }} />}
          {title}
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-[.12em] text-white/30">{grouped.length} recorded</span>
      </div>
      <div className="divide-y divide-white/10">
        {grouped.map(group => {
          const item = group.item
          const description = abilityDescription(item, view)
          return (
            <div key={group.name} className="relative flex gap-3.5 py-4">
              <DossierAbilityIcon item={item} view={view} />
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-white">{item.ability.name}</div>
                  {description && <DossierAbilityDescriptionPopover name={item.ability.name} description={description} />}
                </div>
                {group.sources.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {group.sources.map(source => (
                      <div key={`${group.name}-${source.label}`} className="flex min-w-0 items-start gap-2 text-[11px] font-bold leading-4 text-white/55">
                        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: view.accent }} />
                        <div className="min-w-0 flex-1">
                          <span>{source.label}</span>
                          {source.synergyChampions.length > 0 && (
                            <span className="ml-2 inline-flex -space-x-1 align-middle">
                              {source.synergyChampions.slice(0, 4).map(champion => {
                                const avatar = (
                                  <span className="relative block h-5 w-5 overflow-hidden rounded-full border border-[#080b10] ring-1 ring-white/15" title={champion.name}>
                                    <Image src={getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "64")} alt={champion.name} fill sizes="20px" className="object-cover" />
                                  </span>
                                )
                                return champion.slug ? <Link key={champion.slug} href={`/champions/${champion.slug}`} aria-label={`Open ${champion.name}`}>{avatar}</Link> : <span key={champion.name}>{avatar}</span>
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {!grouped.length && <p className="py-5 text-sm text-white/35">No records available.</p>}
      </div>
    </section>
  )
}

function DossierAbilityDescriptionPopover({ name, description }: { name: string; description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${name}`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/30 transition-colors hover:bg-white/[.06] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-2rem))] border-white/15 bg-[#0d1017] p-4 text-white shadow-2xl"
      >
        <div className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Effect</div>
        <div className="mt-1 font-bold text-white">{name}</div>
        <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
      </PopoverContent>
    </Popover>
  )
}

type DossierAbilityGroup = {
  name: string
  item: ChampionDetailsPayload["abilities"][number]
  sources: Array<{
    label: string
    synergyChampions: Array<{ name: string; slug: string | null; images: unknown }>
  }>
}

function groupDossierAbilities(items: ChampionDetailsPayload["abilities"]): DossierAbilityGroup[] {
  const groups = new Map<string, DossierAbilityGroup>()

  for (const item of items) {
    const name = item.ability.name
    const existing = groups.get(name) ?? { name, item, sources: [] }
    const label = formatAbilitySource(item.source)
    const champions = dedupeDossierSynergyChampions(item.synergyChampions.map(link => link.champion))

    if (label) {
      const source = existing.sources.find(candidate => candidate.label === label)
      if (source) source.synergyChampions = dedupeDossierSynergyChampions([...source.synergyChampions, ...champions])
      else existing.sources.push({ label, synergyChampions: champions })
    }

    groups.set(name, existing)
  }

  return Array.from(groups.values()).map(group => ({ ...group, sources: group.sources.sort((a, b) => a.label.localeCompare(b.label)) }))
}

function dedupeDossierSynergyChampions(champions: Array<{ name: string; slug: string | null; images: unknown }>) {
  const unique = new Map<string, { name: string; slug: string | null; images: unknown }>()
  for (const champion of champions) unique.set(champion.slug ?? champion.name, champion)
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function formatAbilitySource(source: string | null) {
  const words = source?.trim().replaceAll("_", " ").replace(/\s+/g, " ").toLowerCase()
  if (!words) return null
  return words
    .split(" ")
    .map(word => word.replace(/^([^a-z0-9]*)([a-z0-9])/, (_match, prefix: string, first: string) => `${prefix}${first.toUpperCase()}`))
    .join(" ")
    .replace(/\/([a-z])/g, (_match, first: string) => `/${first.toUpperCase()}`)
    .replace(/\bSp(?=\d|s\b|\b)/g, "SP")
    .replace(/\bSpider-seals\b/g, "Spider-Seals")
}

function DossierAbilityIcon({ item, view }: { item: ChampionDetailsPayload["abilities"][number]; view: PrototypeView }) {
  const term = item.ability.gameGlossaryTermId ? view.glossaryById.get(item.ability.gameGlossaryTermId) : undefined
  const raw = term?.raw as Record<string, unknown> | undefined
  const importedColor = typeof raw?.color_primary === "string" ? safeColor(raw.color_primary) : undefined
  const color = importedColor ?? view.accent

  return (
    <div
      className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15"
      style={{
        backgroundColor: `${color}22`,
        boxShadow: `inset 0 0 0 1px ${color}18, 0 0 24px ${color}12`,
      }}
    >
      <span className="absolute inset-1 rounded-full opacity-15" style={{ background: color }} />
      {item.ability.iconUrl ? (
        <span
          className="relative h-7 w-7"
          style={{
            backgroundColor: color,
            maskImage: `url(${item.ability.iconUrl})`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskImage: `url(${item.ability.iconUrl})`,
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
          }}
        />
      ) : item.type === "IMMUNITY" ? (
        <Shield className="relative h-5 w-5" style={{ color }} />
      ) : (
        <Zap className="relative h-5 w-5" style={{ color }} />
      )}
    </div>
  )
}

function DossierMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-white/10 px-4 first:pl-0 last:border-0"><div className="text-2xl font-black sm:text-3xl">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">{label}</div></div>
}

function DossierPrestigeMetric({ view }: { view: PrototypeView }) {
  const points = view.champion.prestigeData
    .filter(point => String(point.rarity) === view.selectedRarity && String(point.rank) === view.selectedRank)
    .map(point => ({ sig: point.sig, value: point.prestige }))
    .filter(point => Number.isFinite(point.sig) && Number.isFinite(point.value))
    .sort((a, b) => a.sig - b.sig)

  if (points.length < 2) {
    return <DossierMetric label="Prestige" value={format(view.prestige)} />
  }

  const width = 88
  const height = 32
  const padding = 3
  const sigValues = points.map(point => point.sig)
  const curveValues = points.map(point => point.value)
  const minSig = Math.min(...sigValues)
  const maxSig = Math.max(...sigValues)
  const minValue = Math.min(...curveValues)
  const maxValue = Math.max(...curveValues)
  const x = (sig: number) => padding + ((sig - minSig) / Math.max(1, maxSig - minSig)) * (width - padding * 2)
  const y = (value: number) => height - padding - ((value - minValue) / Math.max(1, maxValue - minValue)) * (height - padding * 2)
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.sig).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ")
  const selectedPoint = points.reduce((nearest, point) => Math.abs(point.sig - view.sigLevel) < Math.abs(nearest.sig - view.sigLevel) ? point : nearest)

  return (
    <div className="border-r border-white/10 pr-3 sm:pr-4">
      <div className="sm:flex sm:items-end sm:justify-between sm:gap-2">
        <div className="text-2xl font-black sm:text-3xl">{format(view.prestige)}</div>
        <svg role="img" aria-label="Prestige by signature level" viewBox={`0 0 ${width} ${height}`} className="mt-1 h-3 w-[76px] overflow-visible sm:mb-1 sm:mt-0 sm:h-8 sm:w-[88px]">
          <path d={path} fill="none" stroke={view.accent} strokeWidth="1.6" vectorEffect="non-scaling-stroke" opacity=".55" />
          <circle cx={x(selectedPoint.sig)} cy={y(selectedPoint.value)} r="3" fill={view.accent} />
        </svg>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">
        <span>Prestige</span>
        <span className="hidden truncate text-right text-[8px] tracking-[.1em] text-white/20 sm:block">Sig curve</span>
      </div>
    </div>
  )
}

const DOSSIER_CURVE_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa"]
const DOSSIER_CURVE_DASHES = [undefined, "8 4", "3 3", "12 4 2 4", "2 4"]
const ATTACK_ORDER = ["L1", "L2", "L3", "L4", "M1", "M2", "H", "S1", "S2"] as const

function DossierCombatTelemetry({ view }: { view: PrototypeView }) {
  if (!view.champion.attacks.length) return null
  return <div className="mt-16"><DossierAttackProfile view={view} /></div>
}

function DossierCombinedSignatureChart({ view }: { view: PrototypeView }) {
  const curveView = view.descriptionView.curveView
  const candidates = curveView.series.map(series => {
    const points = curveView.data
      .map(row => ({ sig: row.sig, value: normalizeDossierCurveValue(series, row[series.dataKey]) }))
      .filter(point => Number.isFinite(point.sig) && Number.isFinite(point.value))
    const selected = points.length
      ? points.reduce((nearest, point) => Math.abs(point.sig - view.sigLevel) < Math.abs(nearest.sig - view.sigLevel) ? point : nearest, points[0])
      : undefined
    return {
      series,
      points,
      selected,
      presentation: dossierCurvePresentation(series),
    }
  }).filter(curve => curve.points.length && curve.selected)
  const unique = new Map<string, (typeof candidates)[number]>()
  for (const curve of candidates) {
    const valueFingerprint = curve.points.map(point => point.value.toFixed(4)).join(",")
    const key = `${curve.presentation.label}|${curve.presentation.unit}|${valueFingerprint}`
    if (!unique.has(key)) unique.set(key, curve)
  }
  const curves: DossierCurve[] = Array.from(unique.values()).map((curve, index) => ({
    ...curve,
    color: DOSSIER_CURVE_COLORS[index % DOSSIER_CURVE_COLORS.length] ?? view.accent,
  }))

  if (!curves.length) return null

  return (
    <details className="group/curves mt-8 border-y border-white/10 bg-white/[.018]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[.05]"><Sparkles className="h-4 w-4" style={{ color: view.accent }} /></span>
          <div><div className="text-sm font-black text-white/80">Signature curves</div><div className="mt-0.5 text-[9px] font-bold uppercase tracking-[.13em] text-white/25">{curves.length} effects · Combined view</div></div>
        </div>
        <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-open/curves:rotate-90" />
      </summary>
      <div className="border-t border-white/10 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
          {curves.map(curve => <span key={curve.series.id} className="flex items-center gap-2 text-[9px] font-bold text-white/45"><span className="h-2 w-2 rounded-full" style={{ background: curve.color }} />{curve.presentation.label}<span className="font-mono" style={{ color: curve.color }}>{formatCurveValue(curve.selected?.value ?? 0, curve.presentation.unit)}</span></span>)}
        </div>
        <DossierCombinedCurveStage curves={curves} sigLevel={view.sigLevel} />
      </div>
    </details>
  )
}

type DossierCurve = {
  series: PreparedChampionAbilityCurveSeries
  points: Array<{ sig: number; value: number }>
  selected: { sig: number; value: number } | undefined
  presentation: { label: string; unit: string }
  color: string
}

function DossierCombinedCurveStage({ curves, sigLevel }: { curves: DossierCurve[]; sigLevel: number }) {
  const [inspectionIndex, setInspectionIndex] = useState<number | null>(null)
  const referenceCurve = curves[0]
  const points = referenceCurve?.points ?? []
  if (!points.length || !referenceCurve?.selected) return null
  const width = 700
  const height = 210
  const plotLeft = 58
  const plotRight = 18
  const plotTop = 12
  const plotBottom = 28
  const minSig = Math.min(...points.map(point => point.sig))
  const maxSig = Math.max(...points.map(point => point.sig))
  const x = (sig: number) => plotLeft + ((sig - minSig) / Math.max(1, maxSig - minSig)) * (width - plotLeft - plotRight)
  const y = (normalized: number) => height - plotBottom - (normalized / 100) * (height - plotTop - plotBottom)
  const selectedIndex = Math.max(0, points.reduce((nearest, point, index) => Math.abs(point.sig - sigLevel) < Math.abs(points[nearest]?.sig - sigLevel) ? index : nearest, 0))
  const activeIndex = inspectionIndex == null ? selectedIndex : Math.min(inspectionIndex, points.length - 1)
  const activeSig = points[activeIndex]?.sig ?? sigLevel
  const isInspecting = inspectionIndex != null
  const tickSigs = Array.from(new Set([minSig, Math.round(maxSig * .25), Math.round(maxSig * .5), Math.round(maxSig * .75), maxSig]))
  const yTicks = [100, 75, 50, 25, 0]
  const inspectedValues = curves.map(curve => ({ curve, point: nearestCurvePoint(curve.points, activeSig) }))

  const inspectAt = (clientX: number, left: number, renderedWidth: number) => {
    const viewBoxX = ((clientX - left) / Math.max(1, renderedWidth)) * width
    const ratio = Math.max(0, Math.min(1, (viewBoxX - plotLeft) / (width - plotLeft - plotRight)))
    const targetSig = minSig + ratio * (maxSig - minSig)
    const nearestIndex = points.reduce((nearest, point, index) => Math.abs(point.sig - targetSig) < Math.abs(points[nearest]?.sig - targetSig) ? index : nearest, 0)
    setInspectionIndex(nearestIndex)
  }

  return (
    <figure className="relative min-w-0">
      <p className="mb-3 text-[10px] leading-relaxed text-white/35">Mixed units share a normalized range. Hover, tap, or focus the chart to see actual values.</p>
      <div
        role="application"
        tabIndex={0}
        data-prototype-arrow-keys
        aria-label="Interactive combined signature effect chart. Use left and right arrow keys to inspect signature levels."
        className="relative touch-pan-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        onPointerMove={event => inspectAt(event.clientX, event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().width)}
        onPointerDown={event => inspectAt(event.clientX, event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().width)}
        onPointerLeave={() => setInspectionIndex(null)}
        onBlur={() => setInspectionIndex(null)}
        onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
          event.preventDefault()
          setInspectionIndex(current => {
            const start = current ?? selectedIndex
            return event.key === "ArrowLeft" ? Math.max(0, start - 1) : Math.min(points.length - 1, start + 1)
          })
        }}
      >
        <svg role="img" aria-label={`Combined signature curves from signature ${minSig} to ${maxSig}`} viewBox={`0 0 ${width} ${height}`} className="block aspect-[2.4/1] w-full sm:aspect-[3.4/1]">
          <line x1={plotLeft} x2={plotLeft} y1={plotTop} y2={height - plotBottom} stroke="rgba(255,255,255,.18)" />
          <line x1={plotLeft} x2={width - plotRight} y1={height - plotBottom} y2={height - plotBottom} stroke="rgba(255,255,255,.18)" />
          {yTicks.map(tick => {
            const tickY = y(tick)
            return <g key={tick}><line x1={plotLeft} x2={width - plotRight} y1={tickY} y2={tickY} stroke="rgba(255,255,255,.07)" strokeDasharray="3 7" /><text x={plotLeft - 9} y={tickY} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,.35)" fontFamily="monospace" fontSize="10">{tick}%</text></g>
          })}
          <text x="13" y={height / 2} transform={`rotate(-90 13 ${height / 2})`} textAnchor="middle" fill="rgba(255,255,255,.25)" fontFamily="monospace" fontSize="9">EFFECT RANGE</text>
          {curves.map((curve, index) => {
            const path = curve.points.map((point, index) => `${index ? "L" : "M"}${x(point.sig)} ${y(normalizeCurvePoint(curve, point.value))}`).join(" ")
            const selectedPoint = nearestCurvePoint(curve.points, sigLevel)
            const inspectedPoint = nearestCurvePoint(curve.points, activeSig)
            return (
              <g key={curve.series.id}>
                <path d={path} fill="none" stroke={curve.color} strokeWidth="2.25" strokeDasharray={DOSSIER_CURVE_DASHES[index % DOSSIER_CURVE_DASHES.length]} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {selectedPoint && <circle cx={x(selectedPoint.sig)} cy={y(normalizeCurvePoint(curve, selectedPoint.value))} r="3.5" fill={curve.color} stroke="#080b10" strokeWidth="2.5" vectorEffect="non-scaling-stroke" opacity={isInspecting && activeSig !== selectedPoint.sig ? .45 : 1} />}
                {isInspecting && inspectedPoint && <circle cx={x(inspectedPoint.sig)} cy={y(normalizeCurvePoint(curve, inspectedPoint.value))} r="4.5" fill={curve.color} stroke="#080b10" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
              </g>
            )
          })}
          <line x1={x(sigLevel)} x2={x(sigLevel)} y1={plotTop} y2={height - plotBottom} stroke="rgba(255,255,255,.3)" strokeDasharray="4 5" />
          {isInspecting && <line x1={x(activeSig)} x2={x(activeSig)} y1={plotTop} y2={height - plotBottom} stroke="rgba(255,255,255,.55)" />}
          {tickSigs.map(sig => <text key={sig} x={x(sig)} y={height - 8} textAnchor={sig === minSig ? "start" : sig === maxSig ? "end" : "middle"} fill="rgba(255,255,255,.35)" fontFamily="monospace" fontSize="10">{sig}</text>)}
        </svg>
        {isInspecting && (
          <div className="pointer-events-none absolute z-10 min-w-44 border border-white/15 bg-[#080b10]/95 px-3 py-2.5 shadow-xl backdrop-blur" style={{ left: `${(x(activeSig) / width) * 100}%`, top: "8px", transform: activeSig > (minSig + maxSig) / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
            <div className="font-mono text-[9px] uppercase tracking-[.14em] text-white/40">Sig {activeSig}</div>
            <div className="mt-2 space-y-1.5">
              {inspectedValues.map(({ curve, point }) => point && <div key={curve.series.id} className="flex items-center justify-between gap-4 text-[9px]"><span className="flex items-center gap-1.5 text-white/45"><span className="h-1.5 w-1.5 rounded-full" style={{ background: curve.color }} />{curve.presentation.label}</span><span className="font-mono font-black" style={{ color: curve.color }}>{formatCurveValue(point.value, curve.presentation.unit)}</span></div>)}
            </div>
          </div>
        )}
        <span className="sr-only" aria-live="polite">Sig {activeSig}: {inspectedValues.map(({ curve, point }) => point ? `${curve.presentation.label} ${formatCurveValue(point.value, curve.presentation.unit)}` : "").filter(Boolean).join(", ")}</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-[.12em] text-white/25"><span>Y-axis · Effect range</span><span>Actual values in legend and tooltip</span><span>X-axis · Signature level</span></figcaption>
    </figure>
  )
}

function nearestCurvePoint(points: Array<{ sig: number; value: number }>, sig: number) {
  if (!points.length) return undefined
  return points.reduce((nearest, point) => Math.abs(point.sig - sig) < Math.abs(nearest.sig - sig) ? point : nearest)
}

function normalizeCurvePoint(curve: DossierCurve, value: number) {
  const values = curve.points.map(point => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  return ((value - minimum) / Math.max(Number.EPSILON, maximum - minimum)) * 100
}

function DossierAttackProfile({ view }: { view: PrototypeView }) {
  const attacks = [...view.champion.attacks].sort((a, b) => ATTACK_ORDER.indexOf(a.type) - ATTACK_ORDER.indexOf(b.type))
  const basics = attacks.filter(attack => !attack.type.startsWith("S"))
  const specials = attacks.filter(attack => attack.type.startsWith("S"))
  const lightAttacks = basics.filter(attack => attack.type.startsWith("L"))
  const mediumAttacks = basics.filter(attack => attack.type.startsWith("M"))
  const heavyAttacks = basics.filter(attack => attack.type === "H")
  const totalHits = attacks.reduce((sum, attack) => sum + attack.hits.length, 0)
  const properties = Array.from(new Set(attacks.flatMap(attack => attack.hits.flatMap(hit => hit.properties))))

  return (
    <section className="border-y border-white/10">
      <div className="flex flex-col gap-4 border-b border-white/10 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-white"><Swords className="h-4 w-4" style={{ color: view.accent }} />Attack anatomy</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {properties.map(property => <span key={property} className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-white/35"><span className="h-1.5 w-1.5 rounded-full" style={{ background: attackPropertyColor(property, view.accent) }} />{property}</span>)}
          <span className="font-mono text-[9px] text-white/25">{attacks.length} moves · {totalHits} hits</span>
        </div>
      </div>

      {attacks.length ? (
        <div>
          <DossierAttackLane label="Light chain" attacks={lightAttacks} accent={view.accent} />
          <DossierAttackLane label="Medium chain" attacks={mediumAttacks} accent={view.accent} />
          <DossierAttackLane label="Heavy attack" attacks={heavyAttacks} accent={view.accent} />
          {!!specials.length && (
            <div className="grid border-t border-white/10 lg:grid-cols-[180px_1fr]">
              <div className="px-4 py-6 lg:border-r lg:border-white/10 lg:px-5"><div className="text-sm font-black text-white/75">Special attacks</div></div>
              <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                {specials.map(attack => <DossierSpecialAttack key={attack.id} attack={attack} accent={view.accent} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-dashed border-white/10 p-5 text-sm text-white/35">No attack hit data has been imported for this champion yet.</div>
      )}
    </section>
  )
}

function DossierAttackLane({ label, attacks, accent }: { label: string; attacks: ChampionDetailsPayload["attacks"]; accent: string }) {
  if (!attacks.length) return null
  return (
    <div className="grid border-t border-white/10 first:border-t-0 lg:grid-cols-[180px_1fr]">
      <div className="px-4 py-5 lg:border-r lg:border-white/10 lg:px-5"><div className="text-sm font-black text-white/75">{label}</div></div>
      <div className="overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5">
        <div className="flex min-w-max items-center">
          {attacks.map((attack, index) => (
            <div key={attack.id} className="flex items-center">
              {index > 0 && <div className="flex w-10 items-center px-1"><span className="h-px flex-1 bg-white/15" /><ArrowRight className="-ml-1 h-3.5 w-3.5 text-white/20" /></div>}
              <DossierAttackNode attack={attack} accent={accent} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DossierAttackNode({ attack, accent }: { attack: ChampionDetailsPayload["attacks"][number]; accent: string }) {
  const properties = Array.from(new Set(attack.hits.flatMap(hit => hit.properties)))
  return (
    <article className="min-w-[150px] border-b border-white/10 px-1 pb-3 pt-1">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center border font-mono text-xs font-black" style={{ borderColor: `${accent}66`, color: accent }}>{attack.type}</span><div><div className="text-xs font-bold text-white/75">{attackTypeLabel(attack.type)}</div><div className="mt-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-white/25">{attack.hits.length} {attack.hits.length === 1 ? "impact" : "impacts"}</div></div></div>
      <div className="mt-3 flex flex-wrap gap-1">{properties.map(property => <DossierAttackProperty key={property} property={property} accent={accent} />)}</div>
    </article>
  )
}

function DossierSpecialAttack({ attack, accent }: { attack: ChampionDetailsPayload["attacks"][number]; accent: string }) {
  return (
    <article className="bg-[#080b10] p-5">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border font-mono text-sm font-black" style={{ borderColor: `${accent}66`, color: accent }}>{attack.type}</span><div><div className="text-sm font-black text-white/80">{attackTypeLabel(attack.type)}</div><div className="mt-1 text-[8px] font-bold uppercase tracking-[.12em] text-white/25">{attack.hits.length} {attack.hits.length === 1 ? "hit" : "hit sequence"}</div></div></div>
      <ol aria-label={`${attackTypeLabel(attack.type)} hit sequence`} className="relative mt-5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="absolute left-3 right-3 top-3 h-px bg-white/10" />
        {attack.hits.map((hit, index) => (
          <li key={hit.id} className="relative min-w-[130px] flex-1 pt-8">
            <span className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-[#080b10] font-mono text-[8px] text-white/45">{index + 1}</span>
            <div className="flex flex-wrap gap-1">{hit.properties.map(property => <DossierAttackProperty key={property} property={property} accent={accent} />)}</div>
          </li>
        ))}
      </ol>
    </article>
  )
}

function DossierAttackProperty({ property, accent }: { property: string; accent: string }) {
  return <span className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.08em]" style={attackPropertyStyle(property, accent)}>{property}</span>
}

function dossierCurvePresentation(series: PreparedChampionAbilityCurveSeries) {
  const label = series.label
  const params = series.curve.params as Record<string, unknown> | null
  const source = params && typeof params.source === "object" && params.source ? params.source as Record<string, unknown> : null
  const ability = source && typeof source.ability === "object" && source.ability ? source.ability as Record<string, unknown> : null
  const buffType = typeof ability?.buffType === "string" ? ability.buffType : ""

  if (label === "Unstoppable") return { label: "Unstoppable duration", unit: "s" }
  if (label === "Crit Resist") return { label: "Critical resistance", unit: "" }
  if (label === "Physical Resist" || label === "Resist Physical") return { label: "Physical resistance", unit: "" }
  if (label === "Dummy Ui") return { label: "Resistance potency", unit: "%" }
  if (buffType === "set_var") return { label: "Duration reduction", unit: "%" }
  if (buffType === "pvitr_pause") return { label: "Energy Vulnerability pause", unit: "s" }
  return { label, unit: "" }
}

function normalizeDossierCurveValue(series: PreparedChampionAbilityCurveSeries, value: number) {
  const params = series.curve.params as Record<string, unknown> | null
  const source = params && typeof params.source === "object" && params.source ? params.source as Record<string, unknown> : null
  const ability = source && typeof source.ability === "object" && source.ability ? source.ability as Record<string, unknown> : null
  const display = params && typeof params.display === "object" && params.display ? params.display as Record<string, unknown> : null
  const baseField = typeof display?.baseField === "string" ? display.baseField : null
  const multiplier = typeof display?.multiplier === "number" ? display.multiplier : 1

  if (ability?.buffType === "set_var" && typeof ability.baseVal === "number") {
    const displayBase = baseField && typeof ability[baseField] === "number" ? ability[baseField] : 0
    return value + (ability.baseVal - displayBase) * multiplier
  }

  if (ability?.paramName !== "duration") return value

  const displayBase = baseField && typeof ability[baseField] === "number" ? ability[baseField] : 0
  const durationBase = typeof ability.duration === "number" ? ability.duration : displayBase
  return durationBase + value / multiplier - displayBase
}

function formatCurveValue(value: number, unit = "") {
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 })
  return unit ? `${formatted}${unit}` : formatted
}

function attackTypeLabel(type: ChampionDetailsPayload["attacks"][number]["type"]) {
  if (type.startsWith("L")) return `Light ${type.slice(1)}`
  if (type.startsWith("M")) return `Medium ${type.slice(1)}`
  if (type === "H") return "Heavy"
  return `Special ${type.slice(1)}`
}

function attackPropertyStyle(property: string, accent: string) {
  const color = attackPropertyColor(property, accent)
  return { backgroundColor: `${color}16`, color }
}

function attackPropertyColor(property: string, accent: string) {
  return property === "Energy" ? "#38bdf8" : property === "Projectile" ? "#f472b6" : property === "Physical" ? "#f59e0b" : property === "Contact" ? accent : "#a78bfa"
}

function ConsoleMetric({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent: string }) {
  return <div className="border border-cyan-400/15 bg-[#0a1a20] p-4"><div className="flex items-center gap-2 text-xs" style={{ color: accent }}>{icon}<span className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-500">{label}</span></div><div className="mt-4 font-mono text-2xl font-bold text-white">{value}</div></div>
}

function ConsolePanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="border border-cyan-400/15 bg-[#0a171c]"><div className="flex items-center justify-between border-b border-cyan-400/10 px-4 py-3"><h2 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-cyan-100/65">{icon}{title}</h2><span className="h-1.5 w-1.5 rounded-full bg-cyan-300/70" /></div><div className="p-4">{children}</div></section>
}

function AbilityDataRow({ item, view, index }: { item: ChampionDetailsPayload["abilities"][number]; view: PrototypeView; index: number }) {
  const description = abilityDescription(item, view)
  return (
    <div className="group border border-cyan-400/10 bg-black/20 p-3 hover:border-cyan-300/30">
      <div className="flex items-start gap-3">
        <span className="font-mono text-[9px] text-cyan-300/35">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="font-bold text-white">{item.ability.name}</span>{item.type === "IMMUNITY" && <Shield className="h-3.5 w-3.5 text-cyan-300" />}</div>
          {description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
      </div>
    </div>
  )
}

function GuideMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-[#252a2a]/20 py-5 text-center last:border-0"><div className="font-serif text-2xl sm:text-3xl">{value}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[.2em] text-[#252a2a]/45">{label}</div></div>
}

function GuideSection({ number, title, intro, children }: { number: string; title: string; intro: string; children: ReactNode }) {
  return <section className="border-b border-[#252a2a]/20 py-9"><div className="grid gap-4 sm:grid-cols-[45px_1fr]"><span className="font-serif text-sm italic text-[#252a2a]/40">{number}.</span><div><h2 className="font-serif text-4xl tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-[#252a2a]/55">{intro}</p><div className="mt-6">{children}</div></div></div></section>
}

function GuideAbility({ item, view }: { item: ChampionDetailsPayload["abilities"][number]; view: PrototypeView }) {
  const description = abilityDescription(item, view)
  return <div className="border-l-2 bg-[#e8e2d5] p-4" style={{ borderColor: view.accent }}><div className="font-serif text-lg font-bold">{item.ability.name}</div>{description && <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#252a2a]/60">{description}</p>}</div>
}

function MatrixLabel({ index, label }: { index: string; label: string }) {
  return <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[.22em] text-emerald-300/45"><span className="grid h-5 w-5 place-items-center border border-emerald-300/25">{index}</span>{label}<span className="h-px flex-1 bg-emerald-300/10" /></div>
}

function MatrixAbility({ item, view, side, index }: { item: ChampionDetailsPayload["abilities"][number]; view: PrototypeView; side: "left" | "right"; index: number }) {
  const description = abilityDescription(item, view)
  return (
    <div className={cn("relative border border-emerald-400/15 bg-emerald-400/[.025] p-4", side === "left" ? "lg:text-right" : "lg:text-left")}>
      <div className={cn("absolute top-1/2 hidden h-px w-8 bg-emerald-300/20 lg:block", side === "left" ? "-right-8" : "-left-8")} />
      <div className="font-mono text-[9px] text-emerald-300/30">NODE {String(index + 1).padStart(2, "0")}</div>
      <div className="mt-1 font-bold text-emerald-50">{item.ability.name}</div>
      {description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-emerald-50/35">{description}</p>}
    </div>
  )
}

function MatrixMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#06100f] p-3 text-center"><div className="font-mono text-lg font-bold text-emerald-100">{value}</div><div className="mt-1 font-mono text-[8px] tracking-[.2em] text-emerald-300/35">{label}</div></div>
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-2 text-center backdrop-blur"><div className="font-mono text-lg font-bold">{value}</div><div className="text-[8px] font-bold tracking-[.2em] text-white/40">{label}</div></div>
}

function VaultPanel({ icon, title, count, accent, children }: { icon: ReactNode; title: string; count: number; accent: string; children: ReactNode }) {
  return <section className="min-h-44 rounded-3xl border border-white/10 bg-white/[.045] p-5 backdrop-blur"><div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><span style={{ color: accent }}>{icon}</span>{title}</h3><span className="rounded-full bg-white/10 px-2 py-1 font-mono text-[10px] text-white/40">{String(count).padStart(2, "0")}</span></div>{children}</section>
}

function AbilityPill({ item, view }: { item: ChampionDetailsPayload["abilities"][number]; view: PrototypeView }) {
  return <span title={abilityDescription(item, view) ?? undefined} className="rounded-full border border-white/10 bg-white/[.065] px-3 py-1.5 text-xs text-white/70">{item.ability.name}</span>
}

function StatBars({ view, mode }: { view: PrototypeView; mode: "console" | "paper" | "matrix" }) {
  const stats = [
    ["Health", view.health, view.maxStats.health],
    ["Attack", view.attack, view.maxStats.attack],
    ["Armor", view.selectedStat?.armorRating, view.maxStats.armorRating],
    ["Critical", view.selectedStat?.criticalRating, view.maxStats.criticalRating],
    ["Block", view.selectedStat?.blockProficiency, view.maxStats.blockProficiency],
  ] as const
  const track = mode === "paper" ? "bg-[#252a2a]/10" : mode === "matrix" ? "bg-emerald-400/10" : "bg-cyan-400/10"
  const text = mode === "paper" ? "text-[#252a2a]/55" : mode === "matrix" ? "text-emerald-100/45" : "text-slate-500"
  return (
    <div className="space-y-4">
      {stats.map(([label, value, max]) => {
        const ratio = value && max ? Math.min(100, (value / max) * 100) : 0
        return <div key={label}><div className={cn("mb-1.5 flex justify-between font-mono text-[9px] uppercase tracking-[.12em]", text)}><span>{label}</span><span>{format(value)}</span></div><div className={cn("h-1.5 overflow-hidden", track)}><div className="h-full" style={{ width: `${ratio}%`, background: mode === "paper" ? "#252a2a" : mode === "matrix" ? "#34d399" : view.accent }} /></div></div>
      })}
    </div>
  )
}

function DossierDuelTargets({ view }: { view: PrototypeView }) {
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const credits = useMemo(() => getExternalDuelSourceCredits(view.champion.duels), [view.champion.duels])
  if (!view.champion.duels.length) return null
  const featuredId = view.champion.duels.find(duel => duel.status === "ACTIVE")?.id ?? view.champion.duels[0]?.id

  const copyTarget = async (id: number, playerName: string) => {
    await navigator.clipboard.writeText(playerName)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(current => current === id ? null : current), 1600)
  }

  return (
    <section className="border-t border-white/10 pt-6 lg:border-t-0 lg:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-white"><Crosshair className="h-4 w-4" style={{ color: view.accent }} />Duel targets</h2>
          <p className="mt-2 text-xs leading-5 text-white/35">Copy a player name and search for it in-game.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[9px] text-white/35">{view.champion.duels.length}</span>
      </div>
      <div className="mt-5 max-h-[520px] overflow-y-auto border-y border-white/10">
        {view.champion.duels.map(duel => (
          <div key={duel.id} className={cn("group relative flex items-center gap-3 border-b border-white/10 px-2 py-3.5 last:border-0", duel.id === featuredId && "bg-white/[.035]")}>
            {duel.id === featuredId ? <Target className="h-4 w-4 shrink-0" style={{ color: view.accent }} /> : <span className={cn("ml-1 h-2 w-2 shrink-0 rounded-full", duel.status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-400")} />}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-bold text-white/80 group-hover:text-white">{duel.playerName}</span>{duel.id === featuredId && <span className="shrink-0 text-[8px] font-black uppercase tracking-[.12em]" style={{ color: view.accent }}>Recommended</span>}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-bold uppercase tracking-[.1em] text-white/25"><span>{duel.source.replaceAll("_", " ")}</span><span>{formatDuelDate(duel.updatedAt)}</span>{duel.status === "OUTDATED" && <span className="text-amber-300/70">Outdated</span>}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] text-white/40">{duel.rank ?? "—"}</span>
              <button type="button" onClick={() => copyTarget(duel.id, duel.playerName)} aria-label={`Copy ${duel.playerName}`} className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-white/35 transition-colors hover:border-white/25 hover:bg-white/[.06] hover:text-white">
                {copiedId === duel.id ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
      {credits.length > 0 && (
        <p className="mt-3 text-[10px] leading-5 text-white/30">
          Sources: {credits.map((credit, index) => (
            <span key={credit.source}>
              {index > 0 && <span aria-hidden> · </span>}
              <a href={credit.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/70">{credit.label}</a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

function formatDuelDate(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unknown"
  return `Updated ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
}

function CompactDuels({ view, paper = false }: { view: PrototypeView; paper?: boolean }) {
  if (!view.champion.duels.length) return <p className={cn("text-xs", paper ? "text-[#252a2a]/45" : "text-white/35")}>No active targets.</p>
  return <div className={cn("divide-y", paper ? "divide-[#252a2a]/15" : "divide-white/10")}>{view.champion.duels.slice(0, 5).map(duel => <div key={duel.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0"><div className="min-w-0"><div className={cn("truncate text-xs font-bold", paper ? "text-[#252a2a]" : "text-white/75")}>{duel.playerName}</div><div className={cn("mt-0.5 font-mono text-[8px] uppercase", paper ? "text-[#252a2a]/40" : "text-white/30")}>{duel.source.replaceAll("_", " ")}</div></div><span className={cn("font-mono text-[10px]", paper ? "text-[#252a2a]/45" : "text-white/35")}>{duel.rank ?? "—"}</span></div>)}</div>
}

function PrototypeEyebrow({ number, label, light = false }: { number: string; label: string; light?: boolean }) {
  return <div className={cn("flex items-center gap-3 text-[10px] font-black uppercase tracking-[.24em]", light ? "text-white/45" : "text-[#252a2a]/55")}><span className={cn("grid h-7 w-7 place-items-center border font-mono", light ? "border-white/20 text-white" : "border-[#252a2a]/30 text-[#252a2a]")}>{number}</span>{label}</div>
}

function dedupeAbilities(items: ChampionDetailsPayload["abilities"]) {
  const unique = new Map<string, ChampionDetailsPayload["abilities"][number]>()
  for (const item of items) if (!unique.has(item.ability.name)) unique.set(item.ability.name, item)
  return Array.from(unique.values())
}

function abilityDescription(item: ChampionDetailsPayload["abilities"][number], view: PrototypeView) {
  if (!item.ability.gameGlossaryTermId) return null
  const term = view.glossaryById.get(item.ability.gameGlossaryTermId)
  if (term?.description?.trim()) return formatGameText(term.description.trim())
  if (!term?.raw || typeof term.raw !== "object") return null
  const description = (term.raw as { description?: unknown }).description
  return typeof description === "string" ? formatGameText(description) : null
}

function rawDescription(raw: unknown) {
  if (!raw || typeof raw !== "object") return null
  const description = (raw as { description?: unknown }).description
  return typeof description === "string" && description.trim() ? formatGameText(description.trim()) : null
}

function safeColor(color: string) {
  if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`
  if (/^[0-9a-fA-F]{8}$/.test(color)) return `#${color.slice(0, 6)}`
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return undefined
}

function format(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("en-US")
}

function compact(value: number | null | undefined) {
  if (value == null) return "—"
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

"use client"

import { useEffect, useState } from "react"
import type { ChampionAscensionRules } from "@cerebro/core/domain/champion-ascension"
import type { ChampionAcquisition } from "@cerebro/core/domain/champion-acquisition"
import type { ChampionAscensionSourcePayload } from "@/lib/champion-ascension-source-payload"
import { ChampionAscensionSourceContent } from "@/components/champion-ascension-source-content"

type Props = { championName: string; championSlug?: string | null; selectedRarity: string; ascensionRules?: ChampionAscensionRules | null; championAcquisition?: ChampionAcquisition; crystalPoolObservedAt?: string }

export function ChampionAscensionSources(props: Props) {
  // Rules, rather than a rarity-wide cap or token name, establish a recorded path.
  if (props.selectedRarity !== "7" || !props.championSlug || !props.ascensionRules || props.ascensionRules.rarity !== 7 || props.ascensionRules.maxLevel === 0) return null
  return <SourceSection key={`${props.championSlug}:${props.selectedRarity}`} {...props} championSlug={props.championSlug} />
}

function SourceSection({ championSlug, championName, selectedRarity, championAcquisition, crystalPoolObservedAt }: Props & { championSlug: string }) {
  const [data, setData] = useState<ChampionAscensionSourcePayload | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/champions/${encodeURIComponent(championSlug)}/ascension-sources?rarity=${selectedRarity}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Could not load ascension sources")
        const result: ChampionAscensionSourcePayload = await response.json()
        if (!Array.isArray(result.crystals) || !Number.isFinite(Date.parse(result.observedAt))
          || !result.acquisition || !Array.isArray(result.acquisition.paths) || !Array.isArray(result.acquisition.routes)
          || !Array.isArray(result.acquisition.definitions)) throw new Error("Invalid ascension source response")
        if (!controller.signal.aborted) setData(result)
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [championSlug, selectedRarity, attempt])

  return <ChampionAscensionSourceContent data={data} championName={championName} championAcquisition={championAcquisition} crystalPoolObservedAt={crystalPoolObservedAt}
    returnTo={`/champions/${encodeURIComponent(championSlug)}?rarity=${selectedRarity}&tab=crystals`}
    error={error} onRetry={() => { setError(false); setAttempt(value => value + 1) }} />
}

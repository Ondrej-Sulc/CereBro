export type DuelTargetStatus = "ACTIVE" | "OUTDATED"
export type DuelTargetSource = "USER_SUGGESTION" | "GUIA_MTC" | "COCPIT" | "MCOCHUB"

export type DuelTargetInput = {
  id: number
  playerName: string
  rank: string | null
  status: DuelTargetStatus
  source: DuelTargetSource
  updatedAt: Date | string
}

export type PreparedDuelTarget = DuelTargetInput & {
  sourceLabel: string
}

export type DuelSourceCredit = {
  source: Exclude<DuelTargetSource, "USER_SUGGESTION">
  label: string
  url: string
}

const sourceLabels: Record<DuelTargetSource, string> = {
  USER_SUGGESTION: "User",
  GUIA_MTC: "GuiaMTC",
  COCPIT: "CoCPit",
  MCOCHUB: "MCOCHUB",
}

const externalSourceCredits: DuelSourceCredit[] = [
  { source: "GUIA_MTC", label: "GuiaMTC", url: "https://www.guiamtc.com/" },
  { source: "COCPIT", label: "CoCPit", url: "https://cocpit.org" },
  { source: "MCOCHUB", label: "MCOCHUB", url: "https://mcochub.insaneskull.com" },
]

const statusSortOrder: Record<DuelTargetStatus, number> = {
  ACTIVE: 0,
  OUTDATED: 1,
}

export function getDuelSourceLabel(source: DuelTargetSource) {
  return sourceLabels[source]
}

export function prepareDuelTargets(duels: DuelTargetInput[]) {
  const targets = duels
    .map((duel) => ({
      ...duel,
      sourceLabel: getDuelSourceLabel(duel.source),
    }))
    .sort((a, b) => {
      const statusCompare = statusSortOrder[a.status] - statusSortOrder[b.status]
      if (statusCompare !== 0) return statusCompare
      return a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" })
    })

  const activeTargets = targets.filter((duel) => duel.status === "ACTIVE")
  const outdatedTargets = targets.filter((duel) => duel.status === "OUTDATED")

  return {
    targets,
    activeTargets,
    outdatedTargets,
    totalCount: targets.length,
    outdatedCount: outdatedTargets.length,
  }
}

export function getExternalDuelSourceCredits(duels: Pick<DuelTargetInput, "source">[]) {
  const presentSources = new Set(duels.map((duel) => duel.source))
  return externalSourceCredits.filter((credit) => presentSources.has(credit.source))
}

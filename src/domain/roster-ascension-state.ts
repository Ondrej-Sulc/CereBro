export type RosterAscensionState = { isAscended: boolean; ascensionLevel: number }
export type OwnedAscensionInput = { isAscended?: boolean | null; ascensionLevel?: number | null }
export type RosterAscensionUpdate = { isAscended?: boolean; ascensionLevel?: number }

/** Owned observations can outlive a rule snapshot. Reading must not erase them. */
export function normalizeRosterAscensionState(input: OwnedAscensionInput = {}): RosterAscensionState {
  const level = input.ascensionLevel
  const ascensionLevel = typeof level === "number" && Number.isSafeInteger(level) && level > 0 ? level : input.isAscended ? 1 : 0
  return { isAscended: ascensionLevel > 0, ascensionLevel }
}

export function getRosterAscensionLevel(input: OwnedAscensionInput): number {
  return normalizeRosterAscensionState(input).ascensionLevel
}

/** Manual updates validate known eligibility only for newly recorded/increased levels.
 * Unknown game rules do not invalidate a user's structurally valid observation. */
export function resolveRosterAscensionUpdate(update: RosterAscensionUpdate, options: { current?: OwnedAscensionInput; maxLevel?: number | null } = {}):
  { ok: true; value: RosterAscensionState } | { ok: false; message: string } {
  const current = normalizeRosterAscensionState(options.current)
  const level = update.ascensionLevel
  if (level !== undefined && (!Number.isSafeInteger(level) || level < 0 || level > 2147483647)) return { ok: false, message: "Ascension level must be a nonnegative integer." }
  if (update.isAscended === false && level !== undefined && level > 0) return { ok: false, message: "A positive ascension level cannot be marked unascended." }
  const next = level !== undefined
    ? normalizeRosterAscensionState({ ascensionLevel: level, isAscended: update.isAscended === true })
    : update.isAscended === false ? normalizeRosterAscensionState()
    : update.isAscended === true ? normalizeRosterAscensionState({ ascensionLevel: current.ascensionLevel, isAscended: true }) : current
  if (next.ascensionLevel > current.ascensionLevel && options.maxLevel != null && next.ascensionLevel > options.maxLevel) {
    return { ok: false, message: `Ascension level exceeds this champion's recorded maximum (${options.maxLevel}).` }
  }
  return { ok: true, value: next }
}

/** Display known choices and retain an owned historical level as a distinct option. */
export function rosterAscensionLevels(maxLevel: number | null | undefined, ownedLevel = 0): number[] {
  const maximum = maxLevel != null && Number.isInteger(maxLevel) && maxLevel >= 0 ? maxLevel : 0
  const levels = Array.from({ length: maximum + 1 }, (_, index) => index)
  if (ownedLevel > maximum && Number.isSafeInteger(ownedLevel)) levels.push(ownedLevel)
  return levels
}

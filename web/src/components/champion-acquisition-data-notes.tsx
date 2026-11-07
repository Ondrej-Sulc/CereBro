import type { ChampionAcquisition } from "@cerebro/core/domain/champion-acquisition"
import type { ChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition-types"
import styles from "./champion-acquisition-data-notes.module.css"

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** Hosts assemble one disclosure for normal acquisition and optional Ascension. */
export function ChampionAcquisitionDataNotes({ acquisition, crystalPoolObservedAt, ascension, ascensionObservedAt, eligibilityObservedAt }: {
  acquisition?: ChampionAcquisition | null
  crystalPoolObservedAt?: string
  ascension?: ChampionAscensionAcquisitionSources | null
  ascensionObservedAt?: string
  eligibilityObservedAt?: string
}) {
  const pathDate = eligibilityObservedAt ?? ascension?.paths.find(path => path.rarity === 7)?.observedAt
  const dates = [
    ["Champion acquisition reviewed", acquisition?.reviewedAt],
    ["Crystal pools", crystalPoolObservedAt],
    ["Ascension sources reviewed", ascension?.reviewedAt],
    ["Ascension crystal rewards", ascensionObservedAt],
    ["Ascension eligibility & costs", pathDate],
  ].filter((row): row is [string, string] => !!row[1])
  return <details className={styles.notes} aria-label="About this data">
    <summary>About this data</summary>
    <p>Recorded sources may be historical. Personal access, current stock and claimability are unverified. Crystal records describe possible rewards, without drop rates.</p>
    {acquisition?.methods.some(method => method.sources.some(source => source.kind === "game_data")) && <p>In-game item descriptions establish piece collections; linked announcements and community records identify individual piece sources.</p>}
    <dl>{dates.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><time dateTime={value}>{date.format(new Date(value))}</time></dd></div>)}</dl>
  </details>
}

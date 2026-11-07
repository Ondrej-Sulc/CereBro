"use client"

import Image from "next/image"
import { Gem } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { finderArtworkForSelection, type CrystalFinderArtwork } from "@/lib/crystal-finder-artwork"
import styles from "./crystal-finder-artwork.module.css"

export function CrystalFinderArtwork({ artwork, selectedId }: { artwork: CrystalFinderArtwork; selectedId: string }) {
  const composition = finderArtworkForSelection(artwork, selectedId)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const fail = (url: string) => setFailed(previous => new Set(previous).add(url))
  const portraits = composition.portraits.filter(portrait => portrait.url && !failed.has(portrait.url))
  // The handle's embedded star row reads as a stray fragment behind the default
  // portraits. Reserve personal pieces for their exact champion selection.
  const motifs = Object.entries(composition.motifs).filter((entry): entry is [string, string] =>
    !!entry[1] && !failed.has(entry[1]) && (entry[0] !== "piece" || composition.mode === "selected"))
  const mode = portraits.length ? composition.mode : "fallback"
  return <div className={styles.artwork} data-finder-artwork={mode} data-artwork-identity={selectedId || undefined} aria-hidden="true">
    <div className={styles.orbit} />
    {motifs.map(([kind, url]) => <div key={kind} className={styles.motif} data-finder-motif={kind}>
      <Image src={url} alt="" width={256} height={256} sizes="(max-width: 639px) 72px, 168px" onError={() => fail(url)} />
    </div>)}
    <div className={styles.portraits}>
      {portraits.map((portrait, index) => <div className={styles.card} key={portrait.gameId} data-finder-portrait={portrait.gameId} data-portrait-slot={index}
        style={{ "--class-accent": getChampionClassColors(portrait.championClass ?? undefined).color } as CSSProperties}>
        {portrait.url && <Image src={portrait.url} alt="" width={256} height={256} sizes="(max-width: 639px) 88px, (max-width: 999px) 112px, 176px" priority={composition.mode === "selected" || index === 2} onError={() => fail(portrait.url!)} />}
      </div>)}
    </div>
    {!portraits.length && !motifs.some(([kind]) => kind === "crystal") && <Gem className={styles.placeholder} />}
  </div>
}

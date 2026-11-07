import Image from "next/image"
import { UserRound } from "lucide-react"
import type { CrystalChampionPreview as Preview } from "@/lib/crystal-pool-preview"
import styles from "./crystals.module.css"

export function CrystalChampionPreview({ champion }: { champion: Preview }) {
  return <div className={styles.poolChampionPreview} data-single-champion={champion.gameId}>
    <span>{champion.portraitUrl ? <Image src={champion.portraitUrl} alt="" width={36} height={36} loading="lazy" /> : <UserRound aria-hidden="true" />}</span>
    <div><span>Pool champion</span><strong>{champion.name}</strong></div>
  </div>
}

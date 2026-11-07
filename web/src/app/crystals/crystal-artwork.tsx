import Image from "next/image"
import { Gem } from "lucide-react"
import styles from "./crystals.module.css"

export function CrystalArtwork({ primary }: { primary?: string | null }) {
  return <div className={styles.detailArt}>
    {primary ? <Image src={primary} alt="" width={160} height={160} sizes="(max-width: 767px) 84px, 152px" priority /> : <Gem aria-hidden="true" />}
  </div>
}

export function CrystalBanner({ src, name }: { src?: string | null; name: string }) {
  if (!src) return null
  return <figure className={styles.detailBanner}>
    <Image data-crystal-artwork-role="banner" src={src} alt={`In-game banner for ${name}`} width={512} height={128} sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 47vw, 680px" priority />
    <figcaption className={styles.srOnly}>In-game promotional artwork. Recorded contents are listed below.</figcaption>
  </figure>
}

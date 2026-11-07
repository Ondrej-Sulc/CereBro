import Image from "next/image"
import { Gem } from "lucide-react"
import type { CrystalCatalogArtworkItem } from "@/lib/crystal-catalog-artwork"
import styles from "./crystal-catalog-artwork.module.css"

export function CrystalCatalogArtwork({ artwork }: { artwork: readonly CrystalCatalogArtworkItem[] }) {
  return <div className={styles.artwork} data-catalog-artwork={artwork.length === 5 ? "composition" : "fallback"} aria-hidden="true">
    <svg className={styles.facets} viewBox="0 0 600 260" fill="none" focusable="false">
      <path className={styles.facetSurface} d="M82 126 188 30 412 22 546 120 422 238 198 228Z" />
      <path d="m82 126 106-96 224-8 134 98-124 118-224-10ZM188 30l60 98-50 100m214-206-54 106 64 110M82 126l166 2 110 0 188-8M188 30l170 98-160 100m214-206L248 128l174 110" />
    </svg>
    {artwork.length ? artwork.map(crystal => <div key={crystal.id} className={styles.crystal} data-crystal-slot={crystal.slot}>
      <Image data-catalog-crystal-artwork src={crystal.url} alt="" width={256} height={256}
        sizes="(max-width: 479px) 30vw, (max-width: 749px) 144px, (max-width: 1199px) 15vw, 180px"
        priority={crystal.slot === "hero"} />
    </div>) : <Gem className={styles.placeholder} />}
  </div>
}

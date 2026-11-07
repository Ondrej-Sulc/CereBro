import { CrystalIntentLink } from "./crystal-intent-link"
import { Info } from "lucide-react"
import type { CrystalAvailabilityReview } from "@cerebro/core/data/game-crystals/availability"
import styles from "./crystals.module.css"

export function CrystalAvailabilityNotice({ review, id }: { review: Readonly<CrystalAvailabilityReview>; id: string }) {
  return <aside className={styles.availabilityNotice} aria-label={review.title}>
    <Info aria-hidden="true" /><div><strong>{review.title}</strong><p>{review.description}</p>
      <p>Recorded ID: <code>{id}</code>. <CrystalIntentLink href={`/crystals/${encodeURIComponent(review.standardCrystalId)}`}>View the standard pool</CrystalIntentLink></p>
    </div>
  </aside>
}

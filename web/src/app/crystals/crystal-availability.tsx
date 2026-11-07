import { ArrowUpRight, CalendarClock, ChevronDown, CircleHelp, Repeat2 } from "lucide-react"
import { crystalAvailabilityLabel } from "@cerebro/core/domain/crystal-availability-labels"
import type { CrystalAvailability } from "@cerebro/core/domain/crystal-availability"
import styles from "./crystal-availability.module.css"

const date = (day: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))

export function CrystalAvailabilityBadge({ availability }: { availability: CrystalAvailability }) {
  return <span className={styles.badge} data-status={availability.status} title={availability.description}><span aria-hidden="true" />{crystalAvailabilityLabel[availability.status]}</span>
}

export function CrystalAvailabilitySummary({ availability, compact = false }: { availability: CrystalAvailability; compact?: boolean }) {
  const Icon = availability.status === "recurring" ? Repeat2 : availability.status === "unverified" ? CircleHelp : CalendarClock
  if (compact) return <details className={styles.compact} data-status={availability.status} aria-label="Crystal availability">
    <summary><Icon aria-hidden="true" /><strong>{crystalAvailabilityLabel[availability.status]}</strong><ChevronDown aria-hidden="true" /></summary>
    <div>{availability.startsOn && availability.endsOn && <p className={styles.eventDates}>{date(availability.startsOn)} – {date(availability.endsOn)}</p>}<p>{availability.description}</p>
      <div className={styles.evidence}>{availability.source?.url && <a href={availability.source.url} target="_blank" rel="noopener noreferrer" title={availability.source.title}>Official announcement <ArrowUpRight aria-hidden="true" /></a>}{availability.reviewedAt && <span>Reviewed <time dateTime={availability.reviewedAt}>{date(availability.reviewedAt)}</time></span>}</div>
    </div>
  </details>
  return <aside className={styles.summary} data-status={availability.status} aria-label="Crystal availability">
    <Icon aria-hidden="true" /><div className={styles.copy}>
      <div className={styles.heading}><strong>{crystalAvailabilityLabel[availability.status]}</strong>{availability.startsOn && availability.endsOn && <span>{date(availability.startsOn)} – {date(availability.endsOn)}</span>}</div>
      <p>{availability.description}</p>
      <div className={styles.evidence}>{availability.source?.url && <a href={availability.source.url} target="_blank" rel="noopener noreferrer" title={availability.source.title}>Official announcement <ArrowUpRight aria-hidden="true" /></a>}{availability.reviewedAt && <span>Reviewed <time dateTime={availability.reviewedAt}>{date(availability.reviewedAt)}</time></span>}</div>
    </div>
  </aside>
}

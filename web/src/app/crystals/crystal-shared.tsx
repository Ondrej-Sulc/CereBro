import Link from "next/link"
import { Fragment } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react"
import styles from "./crystals.module.css"
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value))

export function SourceNote({ observedAt, contentObservations, ratesObservedAt, firstRecordedAt, description = "Includes historical crystal pools. Recorded contents do not confirm what is currently on sale." }: {
  observedAt: string | null; contentObservations?: ReadonlyArray<{ label: string; observedAt: string }>; description?: string; ratesObservedAt?: string | null; firstRecordedAt?: string | null
}) {
  return <details className={styles.sourceNote} aria-label="About this data">
    <summary><Info aria-hidden="true" /><span>About this data</span>{observedAt && <time dateTime={observedAt}>{date(observedAt)}</time>}<ChevronDown className={styles.dataChevron} aria-hidden="true" /></summary>
    <div className={styles.dataNotesBody}>
      <dl>{observedAt && <><dt>Contents captured</dt><dd><time dateTime={observedAt}>{date(observedAt)}</time></dd></>}
        {!observedAt && contentObservations?.map(observation => <Fragment key={`${observation.label}:${observation.observedAt}`}><dt>{observation.label}</dt><dd><time dateTime={observation.observedAt}>{date(observation.observedAt)}</time></dd></Fragment>)}
        {ratesObservedAt && <><dt>Rates captured</dt><dd><time dateTime={ratesObservedAt}>{date(ratesObservedAt)}</time></dd></>}
        {firstRecordedAt && <><dt>First recorded</dt><dd><time dateTime={firstRecordedAt}>{date(firstRecordedAt)}</time></dd></>}
      </dl>
      <p>{description}</p><p>Named edition dates are not verified release dates.</p>
      {ratesObservedAt && <p>Rates were recorded in one game session. Personal box and Grace progress are not included.</p>}
    </div>
  </details>
}

export function Pagination({ page, pages, total, pageSize, href, onNavigate }: { page: number; pages: number; total: number; pageSize: number; href: (page: number) => string; onNavigate?: (page: number) => void }) {
  if (pages <= 1) return null
  return <nav className={styles.pagination} aria-label="Pagination"><p>Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total.toLocaleString("en")}</p>
    <div>{page > 1 && <Link href={href(page - 1)} onNavigate={onNavigate ? event => { event.preventDefault(); onNavigate(page - 1) } : undefined}><ChevronLeft aria-hidden="true" />Previous</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={href(page + 1)} onNavigate={onNavigate ? event => { event.preventDefault(); onNavigate(page + 1) } : undefined}>Next<ChevronRight aria-hidden="true" /></Link>}</div></nav>
}

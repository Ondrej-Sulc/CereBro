"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type SearchState = { q: string; page: number }

/** Keep drafts responsive while the server supplies the matching, paginated pool. */
export function useCrystalFilters<T extends SearchState>(committed: T, href: (state: T) => string) {
  const router = useRouter()
  const [draft, setDraft] = useState(committed)
  const [pending, startTransition] = useTransition()
  const current = useRef(draft)
  const revision = useRef(0)
  const requests = useRef(new Map<string, number>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composing = useRef(false)
  const url = (state: T) => href({ ...state, q: state.q.trim().slice(0, 100) })
  const committedUrl = url(committed)
  const previousUrl = useRef(committedUrl)

  function cancelSearch() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (previousUrl.current === committedUrl) return
    previousUrl.current = committedUrl
    const submitted = requests.current.get(committedUrl)
    requests.current.delete(committedUrl)
    // An older response must not replace text typed while it was loading.
    if (submitted !== undefined && submitted !== revision.current) return
    cancelSearch()
    requests.current.clear()
    const next = submitted === undefined ? committed : { ...committed, q: current.current.q }
    current.current = next
    revision.current++
    setDraft(next)
  }, [committedUrl, committed])

  function commit(next: T, mode: "push" | "replace") {
    const destination = url(next)
    requests.current.set(destination, revision.current)
    startTransition(() => router[mode](destination, { scroll: false }))
  }
  function navigate(changes: Partial<T>, mode: "push" | "replace" = "push") {
    cancelSearch()
    const next = { ...current.current, ...changes, page: changes.page ?? 1 }
    current.current = next
    revision.current++
    setDraft(next)
    commit(next, mode)
  }
  function search(q: string, changes: Partial<T> = {}) {
    cancelSearch()
    const next = { ...current.current, ...changes, q, page: 1 }
    current.current = next
    revision.current++
    setDraft(next)
    if (!composing.current) timer.current = setTimeout(() => {
      timer.current = null
      commit(current.current, "replace")
    }, 300)
  }
  return {
    draft, navigate, search, href: url,
    updating: pending || url(draft) !== committedUrl,
    submit: () => { if (!composing.current) navigate({}, "replace") },
    compositionStart: () => { composing.current = true; cancelSearch() },
    compositionEnd: (q: string, changes: Partial<T> = {}) => { composing.current = false; search(q, changes) },
  }
}

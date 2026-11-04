export function scrollToChampionSection(target: HTMLElement | null, focus = false) {
  if (!target) return
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  target.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" })
  if (focus) target.focus({ preventScroll: true })
}

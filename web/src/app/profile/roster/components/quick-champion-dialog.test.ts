import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CompactEffectGrid } from "@/components/champions/compact-effect-grid"
import { buildRosterKitDetails } from "@/lib/roster-kit-details"
import { buildRosterKitSections, type RosterKitLink } from "@/lib/roster-kit"
import { QuickEffect } from "./quick-champion-dialog"

function renderEffect(source: string | null, options: { matched?: boolean; loading?: boolean; error?: boolean } = {}) {
  const entry: RosterKitLink = {
    id: 1, type: "IMMUNITY", source, synergyChampions: [],
    ability: { name: "Bleed", description: "Deals Physical Damage over time.", iconUrl: null, gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] },
  }
  const details = buildRosterKitDetails([entry], [])
  const filters = { abilities: [], categories: [], immunities: options.matched ? ["Bleed"] : [] }
  const effect = buildRosterKitSections(details.entries, filters)[0].effects[0]
  return renderToStaticMarkup(createElement(CompactEffectGrid, null,
    createElement(QuickEffect, {
      effect, groups: details.groups["IMMUNITY:Bleed"], loading: options.loading ?? false, error: options.error ?? false,
      onRetry: () => {}, abilityHref: () => "/champions/test?tab=abilities", synergiesHref: "/champions/test?tab=synergies",
    }),
  ))
}

describe("roster popup effect sources", () => {
  it.each([false, true])("keeps a source-less immunity static, including when matched by filters (%s)", matched => {
    const markup = renderEffect(null, { matched })
    expect(markup).toContain("Bleed")
    expect(markup).not.toContain("<details")
    expect(markup).not.toContain("<summary")
    expect(markup).not.toContain("Full abilities")
    expect(markup).not.toContain("lucide-chevron-down")
    expect(markup).toMatch(/tabindex="0" aria-label="About Bleed" data-state="closed"/)
  })

  it("expands and auto-opens a matched immunity with an actual condition", () => {
    const markup = renderEffect("While in Diamond Form, immune to Bleed.", { matched: true })
    expect(markup).toContain('aria-label="Bleed details"')
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain('role="region"')
    expect(markup).toContain('aria-label="Close Bleed details"')
    expect(markup).toContain("While in Diamond Form, immune to Bleed.")
  })

  it("does not turn unusable source prose into an expansion", () => {
    const markup = renderEffect("Legacy condition with {1} unresolved.")
    expect(markup).not.toContain("<details")
  })

  it("keeps loading and failed requests accessible until source availability is known", () => {
    expect(renderEffect(null, { matched: true, loading: true })).toContain('role="status"')
    const failed = renderEffect(null, { matched: true, error: true })
    expect(failed).toContain("Try again")
    expect(failed).toContain('aria-expanded="true"')
    expect(failed).toContain('role="region"')
  })
})

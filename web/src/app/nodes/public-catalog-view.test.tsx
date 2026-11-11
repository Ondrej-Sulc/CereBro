import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { CuratedNodeDetailView, PublicNodeCatalogView } from "./public-catalog-view"
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))

const rows = [{ id: 'stable-cuid', name: 'Curated name', description: 'Original wording '.repeat(100) }]
describe("public curated and game browsing", () => {
  it("shows real source counts, bounded pages and an accessible GET filter form", () => {
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={rows} game={[]} filters={{ q: 'Original', catalog: 'curated' }} coverage={{ permanentLayouts: 218, fullVersions: 3, recordedTileAssignments: 7 }} />)).window.document
    expect(doc.querySelector('form')?.getAttribute('action')).toBe('/nodes')
    expect(doc.querySelector('input[name=q]')?.getAttribute('value')).toBe('Original')
    expect(doc.querySelector('[data-modifier-origin=curated]')?.getAttribute('href')).toBe('/nodes/curated/stable-cuid')
    expect(doc.body.textContent).toContain('1 curated records')
    expect(doc.querySelector('a[href="/nodes"]')?.textContent).toBe('Clear filters')
  })
  it("keeps full curated text and identity while showing no invented game location or icon", () => {
    const doc = new JSDOM(renderToStaticMarkup(<CuratedNodeDetailView modifier={rows[0]} verified={[]} />)).window.document
    expect(doc.body.textContent).toContain(rows[0].description)
    expect(doc.body.textContent).toContain('A game-data association has not been verified')
    expect(doc.querySelector('[data-native-modifier-icon]')).toBeNull()
    expect(doc.querySelector('[data-quest-use]')).toBeNull()
    expect(doc.querySelector('#source-data')?.textContent).toContain('stable-cuid')
  })
  it("reports a failed catalog read as unavailable rather than a true zero-record count", () => {
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={[]} game={[]} curatedUnavailable filters={{}} coverage={{ permanentLayouts: 218, fullVersions: 0, recordedTileAssignments: 0 }} />)).window.document
    expect(doc.body.textContent).toContain('Curated catalog temporarily unavailable')
    expect(doc.body.textContent).not.toContain('0 curated records')
  })
  it("formats native line breaks without altering curated wording", () => {
    const curated = [{ ...rows[0], description: 'Original\\nwording' }]
    const game = [{ id: 'native-effect', name: 'Native effect', text: 'First condition.\\nSecond condition.', names: ['Native effect'], texts: ['First condition.\\nSecond condition.'], versionHashes: ['version'], sources: ['Local'], targets: ['defender'], assignmentContexts: [{ source: 'Local', target: 'defender' }], missing: false, questCount: 1 }]
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={curated} game={game} filters={{}} coverage={{ permanentLayouts: 218, fullVersions: 1, recordedTileAssignments: 1 }} />)).window.document
    expect(doc.querySelector('[data-modifier-origin=game] p')?.textContent).toBe('First condition.\nSecond condition.')
    expect(doc.querySelector('[data-modifier-origin=curated] p')?.textContent).toBe(curated[0].description)
  })
})

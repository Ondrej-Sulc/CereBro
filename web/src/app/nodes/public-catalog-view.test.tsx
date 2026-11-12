import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { CuratedNodeDetailView, PublicNodeCatalogView } from "./public-catalog-view"
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))

const rows = [{ id: 'stable-cuid', name: 'Curated name', description: 'Original wording '.repeat(100) }]
describe("public curated and game browsing", () => {
  it("shows real source counts, bounded pages and an accessible GET filter form", () => {
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={rows} game={[]} filters={{ q: 'Original', catalog: 'curated' }} />)).window.document
    expect(doc.querySelector('form')?.getAttribute('action')).toBe('/nodes')
    expect(doc.querySelector('input[name=q]')?.getAttribute('value')).toBe('Original')
    expect(doc.querySelector('[data-modifier-origin=curated]')?.getAttribute('href')).toBe('/nodes/curated/stable-cuid')
    expect(doc.body.textContent).toContain('1 CereBro modifier')
    expect(doc.querySelector('select[name=binding]')).toBeNull()
    expect(doc.body.textContent).not.toMatch(/full versions|tile assignments|supporting data|original IDs|historical samples/i)
    expect(doc.querySelector('a[href="/nodes"]')?.textContent).toBe('Clear filters')
  })
  it("keeps full curated text and identity while showing no invented game location or icon", () => {
    const doc = new JSDOM(renderToStaticMarkup(<CuratedNodeDetailView modifier={rows[0]} verified={[]} />)).window.document
    expect(doc.body.textContent).toContain(rows[0].description)
    expect(doc.body.textContent).toContain('Search game modifiers')
    expect(doc.querySelector('[data-native-modifier-icon]')).toBeNull()
    expect(doc.querySelector('[data-quest-use]')).toBeNull()
    expect(doc.querySelector('#source-data, pre, code')).toBeNull()
    expect(doc.body.textContent).not.toContain('stable-cuid')
    expect(doc.body.textContent).not.toMatch(/association|planning identity|original record ID/i)
  })
  it("reports a failed catalog read as unavailable rather than a true zero-record count", () => {
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={[]} game={[]} curatedUnavailable filters={{}} />)).window.document
    expect(doc.body.textContent).toContain('CereBro catalog temporarily unavailable')
    expect(doc.body.textContent).not.toContain('0 CereBro modifiers')
  })
  it("formats native line breaks without altering curated wording", () => {
    const curated = [{ ...rows[0], description: 'Original\\nwording' }]
    const game = [{ id: 'native-effect', name: 'Native effect', text: 'First condition.\\nSecond condition.', names: ['Native effect'], texts: ['First condition.\\nSecond condition.'], versionHashes: ['version'], sources: ['Local'], targets: ['defender'], assignmentContexts: [{ source: 'Local', target: 'defender' }], missing: false, questCount: 1 }]
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={curated} game={game} filters={{}} />)).window.document
    expect(doc.querySelector('[data-modifier-origin=game] p')?.textContent).toBe('First condition.\nSecond condition.')
    expect(doc.querySelector('[data-modifier-origin=curated] p')?.textContent).toBe(curated[0].description)
  })
  it("ignores retired completeness filters and hides raw names and unresolved templates", () => {
    const base = { names: [], texts: [], versionHashes: [], sources: [], targets: [], assignmentContexts: [], questCount: 0 }
    const game = [{ ...base, id: "internal_native_id", name: "internal_native_id", text: "Increased by {1:F2}%.", missing: true }, { ...base, id: "known", name: "Known modifier", text: "Readable wording.", missing: false }]
    const doc = new JSDOM(renderToStaticMarkup(<PublicNodeCatalogView curated={[]} game={game} filters={{ catalog: "game", binding: "complete" }}/>)).window.document
    expect(doc.querySelectorAll('[data-modifier-origin=game]')).toHaveLength(2)
    expect(doc.querySelector('select[name=binding]')).toBeNull()
    expect(doc.body.textContent).toContain('Unnamed modifier')
    expect(doc.body.textContent).toContain('Description unavailable')
    expect(doc.body.textContent).not.toMatch(/internal_native_id|\{1:F2\}/)
  })
})

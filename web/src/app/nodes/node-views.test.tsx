import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import Link from "next/link"
import { nodeModifierCatalog } from "@cerebro/core/data/game-node-modifiers"
import { NodeCatalogView, NodeDetailView } from "./node-views"
import NodeDetailPage, { generateMetadata } from "./[id]/page"
import { resolvedVariants } from "./node-presentation"
import { DefenderList } from "./node-locations"
import { ExpandedNodeDetailView } from "./expanded-detail-view"
import { expandedNodeIndex } from "@/lib/expanded-node-modifiers"
import { modifierUseProjection } from "@cerebro/core/data/game-node-modifiers/uses"

function visibleContent(doc: Document) {
  const copy = doc.body.cloneNode(true) as HTMLElement
  copy.querySelectorAll('details:not([open])').forEach(details => {
    const summary = details.querySelector('summary')?.cloneNode(true)
    details.replaceChildren(...(summary ? [summary] : []))
  })
  return copy.textContent ?? ""
}

describe("public node explorer", () => {
  it("renders a shareable GET search and exact independent definition destinations", () => {
    const html = renderToStaticMarkup(<NodeCatalogView catalog={nodeModifierCatalog} filters={{ q: "Health" }} />)
    const doc = new JSDOM(html).window.document
    expect(doc.querySelector('form')?.getAttribute("action")).toBe("/nodes")
    expect(doc.querySelector('input[name="q"]')?.getAttribute("value")).toBe("Health")
    expect(doc.querySelector('a[href="/nodes/avx_hp_pct200"]')).not.toBeNull()
    expect(doc.querySelector('a[href="/nodes/avx_hp_pct600"]')).not.toBeNull()
    expect(doc.querySelector('a[href^="/quests/"]')).toBeNull()
    expect(doc.querySelector('h1')?.textContent).toBe("Node modifiers")
    expect(doc.querySelector('a[href="/nodes/avx_hp_pct200"] code')).toBeNull()
    expect(doc.querySelector('a[href="/nodes/avx_hp_pct200"]')?.textContent).toContain("+200% Health")
    expect(doc.querySelector('pre,code,#source-data,select[name=binding]')).toBeNull()
    expect(doc.body.textContent).not.toMatch(/saved maps|BCG|SHA-256|Source data/)
  })
  it("provides a useful zero-result recovery", () => {
    const html = renderToStaticMarkup(<NodeCatalogView catalog={nodeModifierCatalog} filters={{ q: "not-real" }} />)
    expect(html).toContain("No modifiers match these filters")
    expect(html).toContain("Show all modifiers")
  })
  it("shows resolved effects without embedding internal templates, hashes or source dumps", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    const doc = new JSDOM(renderToStaticMarkup(<NodeDetailView catalog={nodeModifierCatalog} definition={definition} />)).window.document
    const text = doc.body.textContent
    expect(text).toContain("increased by 20%")
    expect(text).not.toContain("increased by {1}%")
    expect(text).not.toContain("0.20000000298023224")
    expect(text).not.toContain(nodeModifierCatalog.profile.inputs[0].sha256)
    expect(doc.querySelector('a[href="/nodes"]')).not.toBeNull()
    const visible = visibleContent(doc)
    expect(visible.match(/increased by 20%/g)).toHaveLength(1)
    expect(visible).not.toMatch(/\{1\}|BCG|ava_ea20|SHA-256|Quest-use navigation|At a glance/)
    expect(doc.querySelector('#source-data, pre, code')).toBeNull()
    expect(text).not.toMatch(/Source data|BCG|SHA-256|catalog revision|saved map samples/i)
  })
  it("shows incomplete component evidence without suppressing recorded game text", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "saga_boost_aspect_of_strength")!
    const html = renderToStaticMarkup(<NodeDetailView catalog={nodeModifierCatalog} definition={definition} />)
    expect(html).not.toContain("Some source data is missing")
    expect(html).not.toContain("saga_aspctstr_effct_ps1_seq1")
    expect(html).toContain("Where it appears")
  })
  it("shows Disarray wording once with all six distinct assignment identities", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "pve_disarray")!
    const doc = new JSDOM(renderToStaticMarkup(<NodeDetailView catalog={nodeModifierCatalog} definition={definition} />)).window.document
    expect(visibleContent(doc).match(/both Champions receive a random effect/g)).toHaveLength(1)
    expect(doc.querySelectorAll('[data-quest-use]')).toHaveLength(1)
    expect(visibleContent(doc)).toContain("4.4.6")
    expect(visibleContent(doc)).toContain("Culmination")
    expect(visibleContent(doc)).toContain("Story / Act 4 / Chapter 4")
    expect(visibleContent(doc)).toContain("Hulk")
    expect(visibleContent(doc)).not.toMatch(/Node 4|Local effect|Assigned to defenders/)
    expect(doc.querySelectorAll('[data-defender-placement]')).toHaveLength(6)
    expect(doc.querySelectorAll('[data-defender-placement] img')).toHaveLength(6)
    expect(doc.querySelector('a[aria-label="Hulk"]')?.getAttribute('href')).toBe('/champions/hulk')
    expect(doc.querySelector('a[aria-label="Magik"]')?.getAttribute('href')).toBe('/champions/magik')
    expect(doc.querySelector('[data-native-modifier-icon]')).not.toBeNull()
    expect(doc.querySelector('#source-data')).toBeNull()
    expect(visibleContent(doc)).not.toContain("Recorded assignments")
    expect(doc.querySelectorAll('[data-resolved-variant]')).toHaveLength(1)
    expect(definition.versions.flatMap(v => v.applications)).toHaveLength(6)
  })
  it("shows readable quest names for multiple uses and no unavailable quest links", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "pve_ai_sp3")!
    const doc = new JSDOM(renderToStaticMarkup(<NodeDetailView catalog={nodeModifierCatalog} definition={definition} />)).window.document
    const visible = visibleContent(doc)
    expect(visible).toContain("5.1.1")
    expect(visible).toContain("Fair Play")
    expect(visible).toContain("4.4.6")
    expect(visible).toContain("Culmination")
    expect(visible).toContain("Linked source")
    expect(visible).not.toContain("Assigned to defenders")
    expect(visible).toContain("Global source")
    expect(visible).toContain("Affected fights")
    expect(visible).not.toContain("a05_ch01_q01")
    expect(doc.querySelector('a[href^="/quests/"]')).toBeNull()
  })
  it("leads event uses with their verified collection and difficulty", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "saga_boost_aspect_of_strength")!
    const doc = new JSDOM(renderToStaticMarkup(<NodeDetailView catalog={nodeModifierCatalog} definition={definition} />)).window.document
    const group = doc.querySelector('[data-quest-use]')!
    expect(group.querySelector('h4')?.textContent).toBe('Event quests / DAWN OF DESTRUCTION')
    expect(group.textContent).toContain('DARKEST')
    expect(group.textContent).toContain('Quest 1')
    expect(group.textContent).toContain('Progression rank 4')
    expect(group.querySelector('h4')?.textContent).not.toContain('Crossed Wires')
  })
  it("does not name-match an unresolved defender and preserves repeated placements", () => {
    const node = { x: 1, y: 2, nodeNumber: 4, final: false, defenders: [{ name: 'Hulk', gameId: 'unresolved-npc', bossId: 'one', blueprintId: null }] }
    const doc = new JSDOM(renderToStaticMarkup(<DefenderList catalog={nodeModifierCatalog} nodes={[node, { ...node, x: 3 }]} />)).window.document
    expect(doc.querySelectorAll('[data-defender-placement]')).toHaveLength(2)
    expect(doc.querySelector('img')).toBeNull()
    expect(doc.querySelector('a')).toBeNull()
    expect(doc.querySelectorAll('[aria-label="Hulk"]')).toHaveLength(2)
    expect(doc.body.textContent).not.toContain('Node 4')
  })
  it("keeps location fallback honest when the source projection cannot bind the catalog", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    const doc = new JSDOM(renderToStaticMarkup(<NodeDetailView catalog={{ ...nodeModifierCatalog, contentHash: 'unrecognized-source' }} definition={definition} />)).window.document
    expect(visibleContent(doc)).toContain("Quest locations are unavailable")
    expect(visibleContent(doc)).not.toContain("Fair Play")
    expect(doc.querySelector('[data-quest-use]')).toBeNull()
    expect(doc.querySelector('#source-data')).toBeNull()
  })
  it("keeps expanded game wording and useful locations while removing all internal disclosures", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    const before = JSON.stringify(definition)
    const doc = new JSDOM(renderToStaticMarkup(<ExpandedNodeDetailView index={expandedNodeIndex} detail={{ contract: expandedNodeIndex.contract, catalogHash: expandedNodeIndex.catalogHash, definition, projection: modifierUseProjection }} portraits={{}} locations={<section><h2>Where it appears</h2><Link href="/quests/a05_ch01_q01?node=1%2C1">Fair Play</Link></section>} />)).window.document
    expect(doc.querySelector('h1')?.textContent).toContain('Gifted')
    expect(doc.body.textContent).toContain('increased by 20%')
    expect(doc.querySelector('a[href^="/quests/"]')).not.toBeNull()
    expect(doc.querySelector('pre, code, #source-data, a[href$="/source"]')).toBeNull()
    expect(doc.body.textContent).not.toMatch(/source data|SHA-256|BCG|catalog source|assignment evidence|recorded game data|full versions/i)
    expect(JSON.stringify(definition)).toBe(before)
  })
  it("uses a plain unavailable message instead of raw formatting tokens or unnamed native IDs", () => {
    const original = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    const definition = { ...original, versions: original.versions.map(v => ({ ...v, raw: { ...v.raw, localizedName: "" }, applications: v.applications.map(a => ({ ...a, text: "Increased by {1:F2}%." })) })) }
    const doc = new JSDOM(renderToStaticMarkup(<NodeDetailView catalog={nodeModifierCatalog} definition={definition}/>)).window.document
    expect(doc.querySelector('h1')?.textContent).toContain('Unnamed modifier')
    expect(doc.body.textContent).toContain('Description unavailable')
    expect(doc.body.textContent).not.toMatch(/\{1:F2\}|ava_ea20/)
  })
  it("groups wording only for display, retaining versions, parameter differences and missing text", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    const version = definition.versions[0], application = version.applications[0]
    const mixed = { ...definition, versions: [version, { ...version, hash: 'second-version', applications: [
      { ...application, hash: 'different-parameters', raw: { ...application.raw, buffAmount: 2 } },
      { ...application, hash: 'different-value', text: 'Increased by 40%.' },
      { ...application, hash: 'missing-text', text: null },
    ] }] }
    const before = JSON.stringify(mixed)
    const variants = resolvedVariants(mixed)
    expect(variants).toHaveLength(3)
    expect(variants[0].applications).toHaveLength(3)
    expect(variants[0].applications.at(-1)?.version.hash).toBe('second-version')
    expect(variants[0].applications.at(-1)?.application.raw.buffAmount).toBe(2)
    expect(variants[1].text).toBe('Increased by 40%.')
    expect(variants[2].text).toBeNull()
    expect(JSON.stringify(mixed)).toBe(before)
  })
  it("returns a 404 for an unknown exact ID and source-specific metadata for real IDs", async () => {
    await expect(NodeDetailPage({ params: Promise.resolve({ id: "gifted" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404")
    expect((await generateMetadata({ params: Promise.resolve({ id: "ava_ea20" }) })).title).toContain("Gifted")
  })
})

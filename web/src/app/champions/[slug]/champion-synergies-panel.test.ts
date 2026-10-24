import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChampionSynergiesPanel } from "./champion-synergies-panel"
import { buildChampionSynergyView, type ChampionSynergy } from "@/lib/champion-synergies"
import { TooltipProvider } from "@/components/ui/tooltip"

const hulk = { id: 581, name: "Hulk (Ragnarok)", slug: "hulk-ragnarok", images: null }
const widow = { id: 2, name: "Black Widow (Deadly Origin)", slug: "black-widow-deadly-origin", images: null }
const variants: Array<[string, number[]]> = [["comp_008", [4]], ["comp_009", [5]], ["comp_010", [6, 7]]]
const rows: ChampionSynergy[] = variants.map(([id, stars]) => ({
  id, name: "IT'S COMPLICATED Lv. 3", description: "All Champions gain +60 Armor Rating & +3% [k=glossary/combat_power_rate]Combat Power Rate[/k].",
  unique: false, enabled: true, requiredHeroGroups: false,
  members: [{ role: "REQUIRED" as const, rarity: 6, champion: hulk }, ...stars.map(rarity => ({ role: "OWNER" as const, rarity, champion: widow }))],
}))

const renderPanel = (props: Parameters<typeof ChampionSynergiesPanel>[0]) => renderToStaticMarkup(createElement(TooltipProvider, null, createElement(ChampionSynergiesPanel, props)))

describe("full synergy card display", () => {
  it("shows a leveled family once, with one partner header and each level's exact bonus and stars", () => {
    const leveledRows: ChampionSynergy[] = [
      ...rows,
      { ...rows[0], id: "comp_006", name: "IT'S COMPLICATED Lv. 1", description: rows[0].description.replace("+60", "+15"), members: [{ role: "REQUIRED", rarity: 6, champion: hulk }, { role: "OWNER", rarity: 2, champion: widow }] },
      { ...rows[0], id: "comp_007", name: "IT'S COMPLICATED Lv. 2", description: rows[0].description.replace("+60", "+35"), members: [{ role: "REQUIRED", rarity: 6, champion: hulk }, { role: "OWNER", rarity: 3, champion: widow }] },
    ]
    const html = renderPanel({ ...buildChampionSynergyView(leveledRows, hulk.id, 6), rarity: 6, glossaryById: new Map(), targetSynergyId: "comp_009" })
    expect(html.match(/<article\b/g)).toHaveLength(1)
    expect(html.match(/href="\/champions\/black-widow-deadly-origin"/g)).toHaveLength(1)
    expect(html).toMatch(/<h4[^>]*>IT&#x27;S COMPLICATED<\/h4>/)
    for (const level of [1, 2, 3]) expect(html).toMatch(new RegExp(`<h5[^>]*><span[^>]*>IT&#x27;S COMPLICATED </span>Lv\\. ${level}</h5>`))
    for (const amount of [15, 35, 60]) expect(html.match(new RegExp(`All Champions gain \\+${amount} Armor Rating`, "g"))).toHaveLength(1)
    for (const stars of ["2★", "3★", "4–7★"]) expect(html).toContain(stars)
    for (const id of ["comp_006", "comp_007", "comp_008", "comp_009", "comp_010"]) expect(html.match(new RegExp(`id="champion-synergy-${id}"`, "g"))).toHaveLength(1)
    expect(html.match(/data-selected="true"/g)).toHaveLength(1)
    expect(html).toMatch(/<section[^>]*id="champion-synergy-comp_008"[^>]*data-targeted="true"/)
  })

  it("renders the repeated bonus once with a clean partner badge and exact requirements on demand", () => {
    const view = buildChampionSynergyView(rows, hulk.id, 6)
    expect(view.incoming).toHaveLength(3)
    const html = renderPanel({ ...view, rarity: 6, glossaryById: new Map() })
    expect(html.match(/<article\b/g)).toHaveLength(1)
    expect(html.match(/All Champions gain \+60 Armor Rating/g)).toHaveLength(1)
    expect(html).toMatch(/<details\b/)
    expect(html).not.toMatch(/<details[^>]*\bopen/)
    expect(html).toContain("Star requirements")
    expect(html).toContain("4–7★")
    expect(html).not.toContain("4★/5★/6★/7★")
    const partnerLink = html.match(/<a\b[^>]*href="\/champions\/black-widow-deadly-origin"[^>]*>(.*?)<\/a>/)?.[1]
    expect(partnerLink).toBeDefined()
    expect(partnerLink).not.toContain("★")
    for (const id of ["comp_008", "comp_009", "comp_010"]) expect(html).toContain(`id="champion-synergy-${id}"`)
  })

  it("selects the combined card for every original synergy target", () => {
    const view = buildChampionSynergyView(rows, hulk.id, 6)
    for (const targetSynergyId of ["comp_008", "comp_009", "comp_010"]) {
      const html = renderPanel({ ...view, rarity: 6, glossaryById: new Map(), targetSynergyId })
      expect(html.match(/data-selected="true"/g)).toHaveLength(1)
    }
  })

  it("shows a shared uniqueness note once while keeping each level's complete bonus", () => {
    const view = buildChampionSynergyView(rows, hulk.id, 6)
    const first = { ...view.incoming[0], unique: true, description: "[b]Hulk (Ragnarok):[/b] Gain +10 Attack.\nUnique Synergy: Does not stack with duplicate synergies." }
    const second = { ...first, id: "higher", name: "IT'S COMPLICATED Lv. 4", description: first.description.replace("+10", "+20") }
    const html = renderPanel({ owned: [], incoming: [first, second], rarity: 6, glossaryById: new Map() })
    expect(html.match(/<article\b/g)).toHaveLength(1)
    expect(html.match(/Does not stack with duplicate synergies/g)).toHaveLength(1)
    expect(html).toContain("Gain +10 Attack.")
    expect(html).toContain("Gain +20 Attack.")
    expect(html.match(/Hulk \(Ragnarok\):/g)).toHaveLength(2)
  })

  it("preserves different level-specific uniqueness notes", () => {
    const view = buildChampionSynergyView(rows, hulk.id, 6)
    const first = { ...view.incoming[0], unique: true, description: "Gain +10 Attack.\nUnique Synergy: Does not stack with duplicate synergies." }
    const second = { ...first, id: "solo", name: "IT'S COMPLICATED Lv. 4", description: "Gain +20 Attack.\nSolo Synergy: Only affects this champion and does not stack." }
    const html = renderPanel({ owned: [], incoming: [first, second], rarity: 6, glossaryById: new Map() })
    expect(html.match(/<article\b/g)).toHaveLength(1)
    expect(html.match(/Does not stack with duplicate synergies/g)).toHaveLength(1)
    expect(html.match(/Only affects this champion and does not stack/g)).toHaveLength(1)
  })
})

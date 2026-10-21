import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CompactEffectGrid, CompactEffectTile } from "./compact-effect-grid"
import type { ChampionKitEffect } from "@/lib/champion-kit"

const effect: ChampionKitEffect = {
  name: "Fury", type: "ABILITY", iconUrl: null, color: "#ff8800", secondaryColor: "#ff8800",
  description: "Increases Attack Rating.", sources: [],
}
const render = (matched = false) => renderToStaticMarkup(createElement(CompactEffectGrid, null,
  createElement(CompactEffectTile, { effect, matched }, createElement("p", null, "Gain Fury while attacking.")),
))

describe("compact effect disclosure", () => {
  it("starts collapsed with an accessible native button and no visible source panel", () => {
    const markup = render()
    expect(markup).toMatch(/<button[^>]*aria-label="Fury details"[^>]*aria-expanded="false"/)
    expect(markup).not.toContain('role="region"')
    expect(markup).not.toContain("Gain Fury while attacking.")
  })

  it("renders open content in a separate labelled region instead of replacing the tile", () => {
    const markup = render(true)
    const controls = markup.match(/aria-controls="([^"]+)"/)![1]
    const trigger = markup.match(/<button[^>]*id="([^"]+)"/)![1]
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain(`id="${controls}" role="region" aria-labelledby="${trigger}"`)
    expect(markup.indexOf("</button>")).toBeLessThan(markup.indexOf('role="region"'))
    expect(markup).toContain("Gain Fury while attacking.")
    expect(markup).toContain('aria-label="Close Fury details"')
  })

  it("supports multiple filter-selected effects without discarding their source panels", () => {
    const markup = renderToStaticMarkup(createElement(CompactEffectGrid, null,
      [effect, { ...effect, name: "Precision" }].map(item => createElement(CompactEffectTile, {
        key: item.name, effect: item, matched: true,
      }, createElement("p", null, `${item.name} source`))),
    ))
    expect(markup.match(/role="region"/g)).toHaveLength(2)
    expect(markup).toContain("Fury source")
    expect(markup).toContain("Precision source")
  })
})

// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import { ChampionKitOverview } from "./champion-kit-overview"
import type { ChampionDetailsView } from "./champion-details-types"

const view: ChampionDetailsView = {
  champion: { id: 1, name: "Legacy", shortName: "Legacy", slug: "legacy", gameId: null, class: "SCIENCE", images: {}, gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [], stats: [], prestigeData: [], duels: [] },
  portraitUrl: "", heroUrl: "", secondaryUrl: "", accent: "#fff", selectedStat: undefined,
  selectedRarity: "", selectedRank: "", rarityOptions: [], rankOptions: [], sigLevel: 200, maxSig: 200, ascensionLevel: 0,
  prestige: null, health: null, attack: null, maxStats: {}, abilities: [], immunities: [], glossaryById: new Map(), descriptionView: prepareChampionAbilityTextView({ records: [] }),
  setRarity() {}, setRank() {}, setSigLevel() {}, setAscensionLevel() {},
}
const effect: ChampionDetailsView["abilities"][number] = { id: 1, type: "ABILITY", effectDirection: "GAIN", effectForm: "BUFF", source: "Base kit", ability: { name: "Fury", categories: [] }, synergyChampions: [] }
function render(data: ChampionDetailsView) {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(<TooltipProvider><ChampionKitOverview view={data} /></TooltipProvider>)
  return root
}
it("omits the whole overview when no effects are recorded", () => {
  expect(render(view).textContent).toBe("")
})
it("uses the full content width without an empty protection column", () => {
  const root = render({ ...view, abilities: [effect] })
  expect(root.textContent).toContain("Fury")
  expect(root.textContent).not.toContain("Immunities & resistances")
  expect(root.querySelector('nav[aria-label="Jump to kit section"]')?.textContent).not.toContain("0")
  expect(root.querySelector('[data-has-sidebar="false"]')).not.toBeNull()
})
it("retains protections without an empty ability section", () => {
  const root = render({ ...view, immunities: [{ ...effect, type: "IMMUNITY", ability: { name: "Bleed", categories: [] } }] })
  expect(root.textContent).toContain("Bleed")
  expect(root.textContent).not.toContain("No abilities")
  expect(root.querySelector('[data-has-effects="false"]')).not.toBeNull()
})

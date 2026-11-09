// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import { ChampionAttackProfile } from "./champion-attack-profile"
import type { ChampionDetailsView, ChampionDetailsPayload } from "./champion-details-types"

const view: ChampionDetailsView = {
  champion: { id: 1, name: "Test", shortName: "Test", slug: "test", gameId: null, class: "MYSTIC", images: {}, gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [], stats: [], prestigeData: [], duels: [] },
  portraitUrl: "", heroUrl: "", secondaryUrl: "", accent: "#9333ea", selectedStat: undefined,
  selectedRarity: "7", selectedRank: "6", rarityOptions: [7], rankOptions: [6], sigLevel: 200, maxSig: 200,
  ascensionLevel: 0, prestige: null, health: null, attack: null, maxStats: {}, abilities: [], immunities: [], glossaryById: new Map(),
  descriptionView: prepareChampionAbilityTextView({ records: [] }),
  setRarity: () => {}, setRank: () => {}, setSigLevel: () => {}, setAscensionLevel: () => {},
}
const attack = (type: ChampionDetailsPayload["attacks"][number]["type"], ...properties: string[][]) => ({
  id: ["L1", "L2", "L3", "L4", "M1", "M2", "H", "S1", "S2"].indexOf(type), type,
  hits: properties.map((properties, id) => ({ id, properties })),
})
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

async function render(attacks: ChampionDetailsPayload["attacks"], extra: Partial<ChampionDetailsView> = {}, onViewAbility = vi.fn()) {
  await act(async () => root.render(<ChampionAttackProfile view={{ ...view, ...extra, champion: { ...view.champion, attacks } }} onViewAbility={onViewAbility} />))
  return document.getElementById("champion-attacks")!
}

it("orders moves as separate variants and exposes mixed hit properties without interaction", async () => {
  const attacks = [attack("S2", ["Physical", "Contact"], ["Energy", "Projectile"], ["Energy", "Projectile"]), attack("M2", ["Physical", "Contact"]), attack("L1", ["Contact", "Energy"]), attack("H", ["Physical", "Projectile"], ["Physical", "Projectile"])]
  const original = structuredClone(attacks)
  const section = await render(attacks)
  expect([...section.querySelectorAll("[data-attack]")].map(n => n.getAttribute("data-attack"))).toEqual(["L1", "M2", "H", "S2"])
  const specialRows = [...section.querySelectorAll('[data-attack="S2"] tbody tr')]
  expect(specialRows.map(n => n.textContent)).toEqual(["1PhysicalContact", "2–3EnergyProjectile"])
  expect(section.querySelector('[data-attack="H"]')?.textContent).toBe("Heavy1–2PhysicalProjectile")
  expect(section.querySelector("details,[role=tooltip]")).toBeNull()
  expect(section.textContent).toContain("move variants")
  expect(attacks).toEqual(original)
})

it("preserves combined dimensions, extra tags and explicit missing fields on their exact hits", async () => {
  const section = await render([attack("S1", ["Energy", "Physical", "Projectile", "Contact", "Weapon"], ["Projectile"], ["Physical"], [""], ["Psychic"])])
  const rows = [...section.querySelectorAll("tbody tr")]
  expect(rows.map(n => n.textContent)).toEqual([
    "1PhysicalEnergyContactProjectile", "Other properties: Weapon",
    "2Not recordedProjectile", "3PhysicalNot recorded", "4Not recordedNot recorded",
    "5Not recordedNot recorded", "Other properties: Psychic",
  ])
  expect(section.querySelectorAll('[data-property="Physical"]')).toHaveLength(2)
  expect(section.querySelectorAll('[data-property="Contact"]')).toHaveLength(1)
})

it("keeps an empty move distinct from absent moves and never invents S3 or damage values", async () => {
  let section = await render([])
  expect(section.textContent).toContain("No attack hit data has been recorded")
  expect(section.querySelector("table")).toBeNull()
  section = await render([attack("H"), attack("S1")])
  expect(section.querySelector('[data-attack="H"]')?.textContent).toBe("HeavyHits not recorded")
  expect(section.querySelector('[data-attack="S1"]')?.textContent).toBe("Special 1Hits not recorded")
  expect(section.textContent).not.toMatch(/0 hits|Special 3|damage: 0/i)
})

it("uses the original ability chapter for shared special rules and retains long names", async () => {
  const longName = "An extraordinarily long recorded Special Attack name with several separate words"
  const descriptionView = prepareChampionAbilityTextView({ records: [
    { id: 1, group: "special", title: "First", template: { raw: "Intro." } },
    { id: 2, group: "special", title: longName, template: { raw: "Intro." } },
    { id: 3, group: "special2", title: null, template: { raw: "Shared rule.", display: { kind: "ability", section: { id: "ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_SPECIAL23", title: "Special Attacks 2 and 3" } } } },
  ] })
  const navigate = vi.fn()
  const section = await render([attack("S2", ["Energy", "Projectile"])], { descriptionView }, navigate)
  expect(section.textContent).toContain(longName)
  const button = section.querySelector<HTMLButtonElement>('[aria-label="Read Special 2 ability"]')!
  await act(async () => button.click())
  expect(navigate).toHaveBeenCalledExactlyOnceWith("special2")
  expect(section.querySelector('[data-attack="S3"]')).toBeNull()
})

it("does not offer ability navigation when no matching source exists", async () => {
  const section = await render([attack("S1", ["Physical", "Contact"])])
  expect(section.querySelector("button")).toBeNull()
})

it("keeps other properties associated with their basic move and exact hit range", async () => {
  const section = await render([attack("L1", ["Physical", "Contact", "Punch"], ["Physical", "Contact", "Punch"]), attack("M1", ["Physical", "Contact"])])
  const move = section.querySelector('[data-attack="L1"]')!
  expect(move.querySelector('[scope="rowgroup"]')?.getAttribute("rowspan")).toBe("2")
  expect(move.querySelector('[aria-label="Hits 1 to 2"]')).not.toBeNull()
  expect(move.textContent).toContain("Other properties: Punch")
  expect(section.querySelector('[data-attack="M1"]')?.textContent).not.toContain("Punch")
})

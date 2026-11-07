// @vitest-environment jsdom
import { act, useState, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ChampionClass } from "@prisma/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { Champion, ChampionImages } from "@/types/champion"
import type { ProfileRosterEntry } from "../../types"
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }))
import { AddChampionModal } from "./add-champion-modal"
import { EditChampionModal } from "./edit-champion-modal"
import { expandMcocPrestigeCurve } from "@/lib/mcoc-prestige"
import prestigeFixture from "../../../../../../../src/tests/fixtures/champion-prestige-ascension.json"

const images: ChampionImages = { hero: "/hero.png", full_primary: "/portrait.png", full_secondary: "", p_32: "", s_32: "", p_64: "", s_64: "", p_128: "", s_128: "" }
const champion: Champion = { id: 1, gameId: "gwenom", name: "Gwenom", shortName: "Gwenom", slug: "gwenom", class: ChampionClass.COSMIC, images, releaseDate: new Date(0), createdAt: new Date(0), updatedAt: new Date(0), obtainable: ["6", "7"], discordEmoji: null, fullAbilities: {}, isPlayable: true, ascensionMaxLevels: { "6": 1, "7": 2 } }
const entry: ProfileRosterEntry = { id: "entry", playerId: "player", championId: 1, stars: 7, rank: 3, isAwakened: false, sigLevel: 0, isAscended: true, ascensionLevel: 1, powerRating: null, reservedForAttack: false, createdAt: new Date(0), updatedAt: new Date(0), champion: { ...champion, tags: [], abilities: [] } }
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === label)!

it("resets both ascension fields when changing the added champion's rarity", async () => {
  const change = vi.fn()
  await act(async () => root.render(<AddChampionModal open onOpenChange={vi.fn()} allChampions={[champion]} onAdd={vi.fn()} newChampion={{ championId: 1, stars: 7, rank: 3, sigLevel: 0, isAwakened: false, isAscended: true, ascensionLevel: 2 }} onNewChampionChange={change} />))
  expect(document.querySelector('[role="group"]')?.textContent).toBe("NoneA1A2")
  await act(async () => button("6★").click())
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ stars: 6, isAscended: false, ascensionLevel: 0 }))
})

it("omits unchanged legacy ascension from an unrelated edit instead of rewriting owned state", async () => {
  const update = vi.fn()
  const legacy = { ...entry, stars: 6, isAscended: true, ascensionLevel: 0 }
  await act(async () => root.render(<EditChampionModal item={legacy} onClose={vi.fn()} onDelete={vi.fn()} onItemChange={vi.fn()} onUpdate={update} />))
  expect(document.querySelector('[role="group"] [aria-pressed="true"]')?.textContent).toBe("A1")
  await act(async () => button("Save Changes").click())
  expect(update).toHaveBeenCalledExactlyOnceWith({ id: "entry", rank: 3, isAwakened: false, sigLevel: 0 })
})

it("sends both fields for explicit ascension changes and clearing", async () => {
  const update = vi.fn()
  function Form() {
    const [item, setItem] = useState(entry)
    return <EditChampionModal item={item} onClose={vi.fn()} onDelete={vi.fn()} onItemChange={setItem} onUpdate={update} />
  }
  await act(async () => root.render(<Form />))
  await act(async () => button("A2").click())
  await act(async () => button("Save Changes").click())
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ isAscended: true, ascensionLevel: 2 }))
  await act(async () => button("None").click())
  await act(async () => button("Save Changes").click())
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ isAscended: false, ascensionLevel: 0 }))
})

it.each([[2, 39730], [0, 36780]])("projects fetched base prestige once while retaining owned/legacy ascension (%s)", async (ascensionLevel, expected) => {
  const curve = expandMcocPrestigeCurve({ prestigeData: prestigeFixture.baseEndpoints, stat: { rarity: 7, rank: 4, prestige: 25360 } })
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => curve } as Response)
  const item = { ...entry, rank: 4, sigLevel: 200, isAwakened: true, isAscended: true, ascensionLevel, champion: { ...entry.champion, gameId: prestigeFixture.gameId, name: "Infamous Iron Man" } }
  await act(async () => root.render(<EditChampionModal item={item} prestige={expected} onClose={vi.fn()} onDelete={vi.fn()} onItemChange={vi.fn()} onUpdate={vi.fn()} />))
  expect(document.body.textContent?.replace(/[,\u00a0\u202f]/g, "")).toContain(String(expected))
  expect(curve[200]).toEqual({ sig: 200, prestige: 34060 })
})

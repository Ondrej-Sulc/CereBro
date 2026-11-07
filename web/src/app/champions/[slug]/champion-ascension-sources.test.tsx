// @vitest-environment jsdom
import { act, type ComponentProps } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition"
import { getChampionAscension } from "@cerebro/core/data/game-ascension"
import type { ChampionCrystalAscensionSource } from "@/lib/data/champion-crystal-ascension-types"
import { ChampionAscensionSources } from "./champion-ascension-sources"

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
const response = (crystals: ChampionCrystalAscensionSource[] = [], rarity = 7, gameId = "adamwarlock") => new Response(JSON.stringify({ observedAt, crystals, acquisition: getChampionAscensionAcquisitionSources(gameId, rarity) }))
const observedAt = "2026-11-05T14:05:24Z"
const bonus: ChampionCrystalAscensionSource = {
  key: "exact-crystal:bonus:seven:0", id: "exact-crystal", name: "Empowered Crystal", artworkUrl: "https://storage.googleapis.com/champion-images/crystal.webp",
  rarities: [7], kind: "champion-bonus", autoAscend: true, categoryId: "seven", rewardIndex: 0,
  rewards: [
    { sourceIndex: 0, type: "inv", data: "ascension_token_champion_adamwarlock", displayName: "Adam Warlock Ascension Token", quantity: 1, imageUrl: null },
    { sourceIndex: 1, type: "inv", data: "ascension_token_class_cosmic", displayName: "Cosmic Ascension Token", minQuantity: 1, maxQuantity: 2, imageUrl: null },
  ],
}
const token: ChampionCrystalAscensionSource = { ...bonus, key: "token-crystal:token:0", id: "token-crystal", name: "Token Crystal", kind: "champion-token", autoAscend: false, rewards: [bonus.rewards[0]] }
let root: Root
const fetchSources = vi.fn<typeof fetch>()
const props = (rarity = "7"): ComponentProps<typeof ChampionAscensionSources> => ({ championName: "Adam Warlock", championSlug: "adam-warlock", selectedRarity: rarity, ascensionRules: getChampionAscension("adamwarlock", Number(rarity)) })
const render = async (overrides = props()) => act(async () => root.render(<ChampionAscensionSources {...overrides} />))
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("fetch", fetchSources)
  fetchSources.mockReset().mockResolvedValue(response([bonus, token]))
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("shows exact opening links, actual artwork, quantities and separate bonus/token semantics", async () => {
  await render()
  const section = document.querySelector('section[aria-labelledby]')!
  expect(document.getElementById(section.getAttribute("aria-labelledby")!)?.textContent).toContain("Ascension sources")
  for (const id of ["exact-crystal", "token-crystal"]) {
    const link = section.querySelector<HTMLAnchorElement>(`a[href^="/crystals/${id}?"]`)!
    const url = new URL(link.href)
    expect(url.searchParams.get("rarity")).toBe("7")
    expect(url.searchParams.get("returnTo")).toBe("/champions/adam-warlock?rarity=7&tab=crystals")
  }
  expect(section.querySelector('img[src="https://storage.googleapis.com/champion-images/crystal.webp"]')).not.toBeNull()
  expect(section.textContent).toContain("Champion outcome bonus")
  expect(section.textContent).toContain("Champion token reward")
  expect(section.textContent).toContain("Adam Warlock Ascension Token ×1")
  expect(section.textContent).toContain("Cosmic Ascension Token 1–2")
  expect(section.textContent).toContain("Automatic ascension when applicable")
  expect(section.textContent).toContain("If the 7★ Adam Warlock outcome is awarded")
  expect(section.querySelector(`time[datetime="${observedAt}"]`)).not.toBeNull()
  expect(fetchSources.mock.calls[0][0]).toBe("/api/champions/adam-warlock/ascension-sources?rarity=7")
})

it("omits lower-star ascension panels and requests while canonical lower rules remain intact", async () => {
  for (const rarity of ["4", "5", "6"]) {
    expect(props(rarity).ascensionRules?.maxLevel).toBeGreaterThan(0)
    await render(props(rarity))
    expect(document.body.textContent).toBe("")
  }
  expect(fetchSources).not.toHaveBeenCalled()
  await render()
  await render(props("6"))
  expect(document.body.textContent).toBe("")
  expect(fetchSources).toHaveBeenCalledTimes(1)
})

it("hides unsupported or missing paths without requesting sources", async () => {
  await render(props("3"))
  expect(document.body.textContent).toBe("")
  await render({ ...props(), ascensionRules: null })
  expect(document.querySelector("section")).toBeNull()
  expect(fetchSources).not.toHaveBeenCalled()
})

it("shows reviewed non-crystal methods even with zero crystal rewards", async () => {
  fetchSources.mockResolvedValue(response([], 7, "magik"))
  await render({ championName: "Magik", championSlug: "magik", selectedRarity: "7", ascensionRules: getChampionAscension("magik", 7) })
  expect(document.querySelector('[data-ascension-method]')?.textContent).toContain("Limbo")
  expect(document.body.textContent).toContain("Current stock unverified")
  expect(document.body.textContent).not.toContain("No champion-specific crystal source")
  expect(document.querySelector('a[href="https://playcontestofchampions.com/news/september-4th-livestream-summary/"]')).not.toBeNull()
})

it("keeps an unresolved positive path neutral and separate from static definitions", async () => {
  fetchSources.mockResolvedValue(response([], 7, "cable"))
  await render({ championName: "Cable", championSlug: "cable", selectedRarity: "7", ascensionRules: getChampionAscension("cable", 7) })
  expect(document.body.textContent).toContain("We have not verified an obtainable source")
  expect(document.querySelector('[data-ascension-section] h3 > span')).toBeNull()
  expect(document.body.textContent).not.toMatch(/unobtainable|guaranteed|available now|cannot ascend/i)
})

it("keeps identical opening IDs as distinct bindings and bounds the initial source list", async () => {
  fetchSources.mockResolvedValue(response(Array.from({ length: 9 }, (_, index) => ({ ...bonus, key: `binding:${index}`, rewardIndex: index }))))
  const error = vi.spyOn(console, "error")
  await render()
  expect(document.querySelectorAll("[data-ascension-source]")).toHaveLength(6)
  expect(document.querySelector('[data-ascension-section] h3')?.textContent).toContain("9 sources")
  const more = document.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!
  expect(more.textContent).toContain("3 more")
  await act(async () => more.click())
  expect(document.querySelectorAll("[data-ascension-source]")).toHaveLength(9)
  expect(error).not.toHaveBeenCalled()
})

it("reports a failed request as a load failure and supports retry", async () => {
  fetchSources.mockResolvedValueOnce(new Response("", { status: 503 }))
  await render()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not load ascension sources")
  expect(document.body.textContent).not.toContain("No champion-specific")
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  expect(document.body.textContent).toContain("Empowered Crystal")
})

it("aborts stale requests and cannot show the previous star while a new request is pending", async () => {
  let finish: (response: Response) => void = () => {}
  fetchSources.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await render()
  const signal = (fetchSources.mock.calls[0][1] as RequestInit).signal!
  fetchSources.mockResolvedValueOnce(response([], 6))
  await render(props("6"))
  expect(signal.aborted).toBe(true)
  await act(async () => finish(response([bonus])))
  expect(document.body.textContent).not.toContain("Empowered Crystal")
  expect(document.body.textContent).toBe("")
  expect(fetchSources).toHaveBeenCalledTimes(1)
})

it("keeps the latest same-star champion response when an earlier request settles last", async () => {
  let finishOld: (response: Response) => void = () => {}
  let finishNew: (response: Response) => void = () => {}
  fetchSources.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve }))
  await render()
  await render({ ...props(), championName: "Gwenom", championSlug: "gwenom" })
  expect((fetchSources.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
  expect(document.body.textContent).toContain("Loading ascension sources")
  await act(async () => finishNew(response([{ ...bonus, name: "Gwenom source" }], 7, "gwenom")))
  await act(async () => finishOld(response([bonus])))
  expect(document.body.textContent).toContain("Gwenom source")
  expect(document.body.textContent).not.toContain("Empowered Crystal")
})

it("ignores a late failure after switching champions and retries the current seven-star request", async () => {
  let failOld: (reason: Error) => void = () => {}
  fetchSources.mockImplementationOnce(() => new Promise((_resolve, reject) => { failOld = reject }))
    .mockRejectedValueOnce(new TypeError("network failure"))
  await render()
  await render({ ...props(), championSlug: "gwenom", championName: "Gwenom" })
  expect(document.querySelector('[role="alert"]')).not.toBeNull()
  fetchSources.mockResolvedValueOnce(response([], 7, "gwenom"))
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  await act(async () => failOld(new Error("stale failure")))
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(document.body.textContent).toContain("GWENOM ASCENSION TOKEN")
  expect(document.body.textContent).not.toContain("ADAM WARLOCK ASCENSION TOKEN")
  expect(fetchSources.mock.calls[2][0]).toBe("/api/champions/gwenom/ascension-sources?rarity=7")
})

it("removes sources immediately when a pending supported request switches to an unsupported star", async () => {
  let finish: (response: Response) => void = () => {}
  fetchSources.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await render()
  await render(props("3"))
  await act(async () => finish(response([bonus])))
  expect(document.querySelector("section")).toBeNull()
  expect(fetchSources).toHaveBeenCalledTimes(1)
  expect((fetchSources.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
})

it("retains recorded conditions and does not promise auto-ascension for a false flag", async () => {
  fetchSources.mockResolvedValue(response([{ ...bonus, autoAscend: false, rewards: [{ ...bonus.rewards[0], action: "qualifying_action", context: { sourceCondition: "exact-condition" } }] }]))
  await render()
  expect(document.body.textContent).not.toContain("Automatic ascension when applicable")
  expect(document.body.textContent).toContain("qualifying_action")
  expect(document.body.textContent).toContain("exact-condition")
})

it("renders mixed crystal and reviewed method sources without merging their reward contracts", async () => {
  fetchSources.mockResolvedValue(response([bonus], 7, "magik"))
  await render({ championName: "Magik", championSlug: "magik", selectedRarity: "7", ascensionRules: getChampionAscension("magik", 7) })
  expect(document.querySelectorAll('[data-ascension-source]')).toHaveLength(1)
  expect(document.querySelector('[data-ascension-method]')).not.toBeNull()
  expect(document.querySelector('[data-ascension-source]')?.textContent).toContain("×1")
  expect(document.body.textContent).toContain("Crystal bonuses & token rewards")
  expect(document.querySelector('[data-ascension-section] h3')?.textContent).toContain("2 sources")
  expect(document.body.textContent).not.toContain("Availability unverified")
})

it("treats a malformed source payload as a retryable error instead of an empty material source", async () => {
  fetchSources.mockResolvedValueOnce(new Response(JSON.stringify({ observedAt, crystals: [] })))
  await render()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not load")
  expect(document.body.textContent).not.toContain("not verified an obtainable source")
})

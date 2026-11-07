import { expect, it } from "vitest"
import { getChampionAcquisition } from "./index"
import snapshot from "./catalog.json"
import pieceArtwork from "./piece-artwork.json"
import { getRewardArtwork, rewardArtworkSource } from "../game-reward-artwork"
import { getChampionCrystals } from "../game-crystals"

it("keeps display separators intact when acquisition text is generated on Windows", () => {
  for (const title of [...snapshot.methods.map(method => method.title), ...snapshot.sources.map(source => source.title)]) {
    expect(title).not.toMatch(/ \? |\uFFFD/)
  }
})

it("covers the audited champions without assuming every imported star has a route", () => {
  const expected = ["phoenix_dark", "maestro_trophy", "carina_white", "guillotine_nameless", "groot_king_deathless", "vision_deathless", "shehulk_deathless", "thanos_deathless_trophy", "starlord_stellar", "blade_stellar", "green_goblin_stellar", "scarletwitch_current", "summoned_symbiote", "mrfantastic_victorious", "invisiblewoman_victorious", "humantorch_victorious", "thing_victorious", "vision", "wolverine_weaponx", "jessicajones_current", "thanos", "kang", "absorbingman", "kingpin", "masacre", "spiderman_movie", "spiderman_2099", "magik", "colossus_unstoppable"]
  expect([...new Set(snapshot.methods.map(method => method.gameId))].sort()).toEqual(expected.sort())
  expect(getChampionAcquisition("phoenix_dark").methods.map(method => method.rarities)).toEqual([[6], [7]])
  expect(getChampionAcquisition("maestro_trophy").methods.map(method => method.rarities)).toEqual([[6], [7]])
  expect(getChampionAcquisition("scarletwitch_current").methods.map(method => method.rarities)).toEqual([[4], [5], [6], [7]])
  expect(getChampionAcquisition("humantorch_victorious").methods.map(method => method.rarities)).toEqual([[7]])
  expect(getChampionAcquisition("phoenix").methods).toEqual([])
})

it("binds Deathless Thanos to full Mausoleum exploration at the matching difficulty", () => {
  const methods = getChampionAcquisition("thanos_deathless_trophy").methods
  expect(methods.map(method => [method.rarities, method.title, method.availability])).toEqual([
    [[6], "Deathless Mausoleum \u00b7 Normal exploration", "progression"],
    [[7], "Deathless Mausoleum \u00b7 Hard exploration", "progression"],
  ])
  expect(methods.every(method => /fully explore all four paths/i.test(method.description))).toBe(true)
  expect(methods[1].requirements).toContain("Only 7-star Deathless champions can enter Hard difficulty")
  expect(methods.every(method => method.sources.length > 0)).toBe(true)
})

it("records the 7-star Vision route independently of his lower-star crystal pools", () => {
  const vision = getChampionAcquisition("vision").methods
  const crystals = getChampionCrystals("vision").crystals
  expect(crystals.some(crystal => crystal.rarities.includes(6))).toBe(true)
  expect(crystals.some(crystal => crystal.rarities.includes(7))).toBe(false)
  expect(vision.some(method => method.rarities.includes(7) && method.sources.some(source => source.kind === "official_announcement"))).toBe(true)
  expect(vision.every(method => method.rarities.length === 1 && method.rarities[0] === 7)).toBe(true)
})

it("keeps the newly reviewed selectors and store purchases at their evidenced stars", () => {
  for (const gameId of ["absorbingman", "kingpin", "masacre", "magik", "wolverine_weaponx"]) {
    expect(getChampionAcquisition(gameId).methods.some(method => method.rarities.includes(7))).toBe(true)
  }
  expect(getChampionAcquisition("colossus_unstoppable").methods.map(method => method.rarities)).toEqual([[5], [6]])
  expect(getChampionAcquisition("masacre").methods[0]).toMatchObject({ kind: "quest", availability: "progression", requirements: ["Complete all six objectives in the original CCP challenge set"] })
  expect(getChampionAcquisition("vision").methods[0].periodStatus).toBe("past")
})

it("keeps exact game-item provenance on the server and sends bounded display evidence", () => {
  const methods = getChampionAcquisition("starlord_stellar").methods
  expect(methods.every(method => method.sources.some(source => source.kind === "game_data"))).toBe(true)
  expect(JSON.stringify(methods)).not.toMatch(/sha256|fileName|gameData/)
  expect(JSON.stringify(methods).length).toBeLessThan(14000)
  for (const source of snapshot.sources) if ("gameData" in source && source.gameData) {
    expect(source.gameData.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(source.gameData.items.every(item => item.id && item.description)).toBe(true)
  }
})

it("provides all five matching-star pieces with hosted game artwork for every existing collection", () => {
  const champions = ["guillotine_nameless", "groot_king_deathless", "vision_deathless", "shehulk_deathless", "starlord_stellar", "blade_stellar", "green_goblin_stellar"]
  for (const gameId of champions) {
    const methods = getChampionAcquisition(gameId).methods.filter(method => method.kind === "pieces")
    expect(methods.map(method => method.rarities)).toEqual([[6], [7]])
    for (const method of methods) {
      expect(method.pieces).toHaveLength(5)
      expect(new Set(method.pieces?.map(piece => piece.itemId)).size).toBe(5)
      for (const piece of method.pieces ?? []) expect(piece.artworkUrl).toMatch(/^https:\/\/storage.googleapis.com\/champion-images\/rewards\/full\/[a-f0-9]{64}\.webp$/)
    }
    expect(methods[0].pieces?.map(piece => piece.artworkUrl)).not.toEqual(methods[1].pieces?.map(piece => piece.artworkUrl))
  }
})

it("keeps the lightweight artwork projection identical to the shared game artwork registry", () => {
  expect(pieceArtwork.gameStoreSha256).toBe(rewardArtworkSource.registries.find(registry => registry.kind === "gameStore")?.sha256)
  expect(pieceArtwork.assets).toHaveLength(70)
  for (const piece of pieceArtwork.assets) expect(piece.artworkUrl).toBe(getRewardArtwork("inv", piece.itemId)?.url)
  const gwenom = getChampionAcquisition("gwenom")
  expect(JSON.stringify(gwenom)).not.toContain("artworkUrl")
})

it("uses original Kabam announcements for confirmed acquisitions and identifies community fallbacks", () => {
  const thanos = getChampionAcquisition("thanos_deathless_trophy").methods
  expect(thanos.every(method => method.sources.some(source => source.url === "https://playcontestofchampions.com/news/deathless-mausoleum/" && source.kind === "official_announcement"))).toBe(true)
  const goblin = getChampionAcquisition("green_goblin_stellar").methods.find(method => method.rarities.includes(7))!
  expect(goblin.pieces?.find(piece => piece.itemId === "sfgg_t7_pumpkin_bomb")?.origin?.source).toMatchObject({ url: "https://playcontestofchampions.com/news/revenge-of-legends/", kind: "official_announcement" })
  expect(goblin.pieces?.find(piece => piece.itemId === "sfgg_t7_hip_bag")?.origin?.source).toMatchObject({ url: "https://playcontestofchampions.com/news/battlegrounds-season-42/", kind: "official_announcement" })
  for (const source of snapshot.sources) if ("url" in source) {
    expect(source).toHaveProperty("category")
    expect(source.url).not.toMatch(/\/discussion\/comment\//)
  }
})

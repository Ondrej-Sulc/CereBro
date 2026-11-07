// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { createElement, type ImgHTMLAttributes } from "react"
import { expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props) }))
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"
import { CrystalOpeningRules } from "./crystal-reward-cards"

const opening = () => structuredClone(loadCrystalPageRewards("valiant_metamorphosis_crystal")!)
function render(data: ReturnType<typeof opening>) {
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(<CrystalOpeningRules opening={data} />)
  return container
}

it("shows all 30 conditional outcomes with their exact token art and quantities, sharing only class artwork", () => {
  const data = opening()
  const element = render(data)
  expect(element.querySelector("h2")?.textContent).toBe("Ascension bonuses 30")
  expect(element.querySelectorAll("[data-class-token]")).toHaveLength(6)
  expect(element.querySelectorAll("[data-bonus-outcome]")).toHaveLength(30)
  expect(element.querySelectorAll("img")).toHaveLength(36)
  expect(element.textContent?.match(/automatic ascension/g)).toHaveLength(1)
  expect(element.textContent).toContain("Other drops of the same champion may not include these bonuses")
  for (const bonus of data.conditionalBonuses) {
    const token = bonus.rewards.find(reward => reward.data.startsWith("ascension_token_champion_"))!
    const tile = element.querySelector(`[data-bonus-outcome="${bonus.key}"]`)!
    expect(tile.getAttribute("data-champion-token")).toBe(token.data)
    expect(tile.querySelector("img")?.getAttribute("src")).toBe(token.imageUrl)
    expect(tile.textContent).toContain("×1")
    expect(tile.textContent).not.toContain("%")
  }
  for (const panel of element.querySelectorAll("article")) {
    expect(panel.querySelector("header")?.textContent).toContain("7★")
    expect(panel.querySelector("header")?.textContent).toContain("5 champions")
    expect(panel.querySelector("header")?.textContent).toContain("Class token ×1per listed outcome")
    expect(panel.querySelector("header")?.textContent).not.toContain("×5")
  }
})

it("keeps unsupported bonuses visible exactly once alongside compact groups with separate section IDs", () => {
  const data = opening()
  data.conditionalBonuses[0].autoAscend = false
  const element = render(data)
  const outcomes = [...element.querySelectorAll("[data-bonus-outcome]")].map(row => row.getAttribute("data-bonus-outcome"))
  expect(outcomes).toHaveLength(30)
  expect(new Set(outcomes).size).toBe(30)
  expect(element.querySelectorAll("[data-champion-token]")).toHaveLength(29)
  expect(element.querySelector("#crystal-additional-bonuses-title")?.textContent).toBe("Other bonus rewards")
  const fallback = element.querySelector('[aria-labelledby="crystal-additional-bonuses-title"]')!
  expect(fallback.textContent).toContain("SANDMAN")
  expect(fallback.querySelectorAll("img")).toHaveLength(2)
  expect(fallback.textContent).not.toContain("automatic ascension")
  const ids = [...element.querySelectorAll("[id]")].map(row => row.id)
  expect(new Set(ids).size).toBe(ids.length)
})

it("retains the existing detailed presentation for small lists", () => {
  const data = opening()
  data.conditionalBonuses = data.conditionalBonuses.slice(0, 2)
  const element = render(data)
  expect(element.querySelector("h2")?.textContent).toBe("Bonus rewards")
  expect(element.querySelectorAll("[data-class-token]")).toHaveLength(0)
  expect(element.querySelectorAll("[data-bonus-outcome]")).toHaveLength(2)
  expect(element.querySelectorAll("img")).toHaveLength(4)
})

it("keeps changed class-token quantities separate and shows the recorded amount per outcome", () => {
  const data = opening()
  const token = data.conditionalBonuses[0].rewards.find(reward => reward.data.startsWith("ascension_token_class_"))!
  token.quantity = 2
  const element = render(data)
  const classRows = [...element.querySelectorAll('[data-class-token="ascension_token_class_chemical"]')]
  expect(classRows).toHaveLength(2)
  expect(classRows.map(row => row.textContent)).toEqual(["Class token ×2per listed outcome", "Class token ×1per listed outcome"])
  expect(classRows[0].closest("article")?.querySelectorAll("[data-bonus-outcome]")).toHaveLength(1)
})

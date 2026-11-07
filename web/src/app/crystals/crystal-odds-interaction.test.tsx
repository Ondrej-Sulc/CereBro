// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import { CrystalOddsDisclosure } from "./crystal-odds-disclosure"

let root: Root
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById("root")!) })
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const render = () => act(async () => root.render(<CrystalOddsDisclosure odds={getCrystalOdds("superior_banquet_crystal_dec25")} compact />))
const rows = () => [...document.querySelectorAll('[data-odds-row]')]

it("starts with all Banquet prizes visible in numeric reading order", async () => {
  await render()
  expect([...document.querySelectorAll("h3")].map(heading => heading.textContent)).toEqual(["Prize 1", "Prize 2", "Prize 3", "Prize 4", "Prize 5"])
  expect(rows()).toHaveLength(27)
  expect(document.querySelector('[aria-label="Show all prize groups"]')?.getAttribute("aria-pressed")).toBe("true")
})

it("filters rewards locally without renormalizing rates or combining prize groups", async () => {
  await render()
  const input = document.querySelector<HTMLInputElement>('[aria-label="Search drop-rate rewards"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "gold")
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(rows()).toHaveLength(1)
  expect(document.querySelector("h3")?.textContent).toBe("Prize 5")
  expect(document.querySelector("dd")?.textContent).toBe("50.20%")
  expect(document.body.textContent).not.toContain("100.00%")
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Clear reward search"]')!.click())
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Show Prize 3"]')!.click())
  expect(rows()).toHaveLength(6)
  expect(document.querySelector("h3")?.textContent).toBe("Prize 3")
  expect([...document.querySelectorAll("dd")].map(value => value.textContent)).toEqual(["3.00%", "3.60%", "3.00%", "30.20%", "30.00%", "30.20%"])
})

it("keeps short standard-crystal disclosures free of large-table controls", async () => {
  await act(async () => root.render(<CrystalOddsDisclosure odds={getCrystalOdds("paragon_crystal_v2")} compact />))
  expect(rows()).toHaveLength(6)
  expect(document.querySelector('input[type="search"]')).toBeNull()
  expect(document.querySelector('[aria-label="Prize groups"]')).toBeNull()
  expect(document.body.textContent).toContain("1.25%")
})

it("recovers from an empty search and prize combination without losing the full disclosure", async () => {
  await render()
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Show Prize 4"]')!.click())
  const input = document.querySelector<HTMLInputElement>('[aria-label="Search drop-rate rewards"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "no matching reward")
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(rows()).toHaveLength(0)
  expect(document.body.textContent).toContain("No rewards match these filters")
  const reset = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Show all rewards")!
  await act(async () => reset.click())
  expect(rows()).toHaveLength(27)
  expect(input.value).toBe("")
  expect(document.querySelector('[aria-label="Show all prize groups"]')?.getAttribute("aria-pressed")).toBe("true")
})

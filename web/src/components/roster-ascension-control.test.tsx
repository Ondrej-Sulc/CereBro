// @vitest-environment jsdom
import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { RosterAscensionControl } from "./roster-ascension-control"

let root: Root
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById("root")!) })
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

it("offers only recorded levels and writes both fields when selecting or clearing", async () => {
  const change = vi.fn()
  await act(async () => root.render(<RosterAscensionControl value={{ isAscended: false, ascensionLevel: 0 }} maxLevel={2} onChange={change} />))
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")]
  expect(buttons.map(button => button.textContent)).toEqual(["None", "A1", "A2"])
  await act(async () => buttons[2].click())
  expect(change).toHaveBeenLastCalledWith({ isAscended: true, ascensionLevel: 2 })
  await act(async () => buttons[0].click())
  expect(change).toHaveBeenLastCalledWith({ isAscended: false, ascensionLevel: 0 })
})

it("keeps a historical owned level without exposing unrecorded intermediate choices", async () => {
  await act(async () => root.render(<RosterAscensionControl value={{ isAscended: false, ascensionLevel: 5 }} maxLevel={2} onChange={vi.fn()} />))
  expect([...document.querySelectorAll("button")].map(button => button.textContent)).toEqual(["None", "A1", "A2", "A5 · owned"])
  expect(document.querySelector('[aria-pressed="true"]')?.textContent).toBe("A5 · owned")
})

it("uses the legacy boolean as A1 and shows an explicit zero cap without granting A1", async () => {
  await act(async () => root.render(<RosterAscensionControl value={{ isAscended: true, ascensionLevel: 0 }} maxLevel={1} onChange={vi.fn()} />))
  expect(document.querySelector('[aria-pressed="true"]')?.textContent).toBe("A1")
  await act(async () => root.render(<RosterAscensionControl value={{ isAscended: false, ascensionLevel: 0 }} maxLevel={0} onChange={vi.fn()} />))
  expect(document.querySelectorAll("button")).toHaveLength(1)
  expect(document.body.textContent).toContain("No ascension tiers recorded")
})

it("accepts a directly observed integer when rule data is unknown", async () => {
  const change = vi.fn()
  function Form() {
    const [value, setValue] = useState({ isAscended: false, ascensionLevel: 0 })
    return <RosterAscensionControl value={value} onChange={next => { setValue(next); change(next) }} />
  }
  await act(async () => root.render(<Form />))
  const input = document.querySelector<HTMLInputElement>('input[type="number"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "3")
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(change).toHaveBeenLastCalledWith({ isAscended: true, ascensionLevel: 3 })
  expect(input.value).toBe("3")
})

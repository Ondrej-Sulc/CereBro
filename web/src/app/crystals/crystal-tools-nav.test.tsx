// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it } from "vitest"
import { CrystalToolsNav } from "./crystal-tools-nav"

afterEach(() => { document.body.innerHTML = "" })

it.each([
  ["browse", "/crystals"],
  ["champions", "/crystals/champions"],
  ["compare", null],
] as const)("shows only the primary destinations with an honest active state on %s", (active, currentHref) => {
  document.body.innerHTML = renderToStaticMarkup(<CrystalToolsNav active={active} />)
  const nav = document.querySelector('nav[aria-label="Crystal tools"]')!
  const links = [...nav.querySelectorAll("a")]
  expect(links.map(link => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Browse crystals", "/crystals"],
    ["Find a champion", "/crystals/champions"],
  ])
  expect([...nav.querySelectorAll('[aria-current="page"]')].map(link => link.getAttribute("href")))
    .toEqual(currentHref ? [currentHref] : [])
})

import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { additionalNativeGameIcons } from "@cerebro/core/domain/node-modifiers/native-game-icons"
import { nativeModifierIcons } from "@cerebro/core/domain/node-modifiers/native-icons"
import { GameNodeModifierIcon } from "./GameNodeModifierIcon"
import { NodeModifierIcon } from "./NodeModifierIcon"

describe("decorative game-only modifier icon", () => {
  it("shows a registered additional native shape beside one accessible modifier name", () => {
    const doc = new JSDOM(renderToStaticMarkup(<a href="/nodes/exact"><GameNodeModifierIcon iconKey={additionalNativeGameIcons[0].key} size={25} />Exact modifier</a>)).window.document
    const icon = doc.querySelector('[data-game-modifier-icon]') as HTMLElement
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.style.width).toBe('25px'); expect(icon.style.height).toBe('25px')
    expect(icon.style.backgroundColor.toLowerCase()).toBe('currentcolor')
    expect(doc.querySelector('a')?.textContent).toBe('Exact modifier')
    expect(icon.hasAttribute('tabindex')).toBe(false)
    expect(icon.hasAttribute('title')).toBe(false)
  })
  it("retains the original shapes and quiet fallback while curated rendering rejects game-only keys", () => {
    expect(renderToStaticMarkup(<GameNodeModifierIcon iconKey={nativeModifierIcons[0].key} />)).toContain('data-native-modifier-icon')
    expect(renderToStaticMarkup(<GameNodeModifierIcon iconKey="unregistered" />)).toBe('')
    expect(renderToStaticMarkup(<NodeModifierIcon iconKey={additionalNativeGameIcons[0].key} />)).toBe('')
  })
})

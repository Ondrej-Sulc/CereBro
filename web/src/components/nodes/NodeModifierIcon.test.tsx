import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { nativeModifierIcons } from "@cerebro/core/domain/node-modifiers/native-icons"
import { NodeModifierIcon } from "./NodeModifierIcon"
import { MultiNodeModifierCombobox } from "../comboboxes/MultiNodeModifierCombobox"
import { ActiveModifiers } from "../war-planning/node-editor/active-modifiers"
import { EncounterNodeList } from "../planning/encounter-card/encounter-node-list"

const modifier = { id: 'curated', name: 'Reviewed modifier', description: 'Kept curated description', iconKey: nativeModifierIcons[0].key }
describe("shared decorative modifier icon", () => {
  it("inherits currentColor, reserves a stable size and never repeats adjacent accessible names", () => {
    const doc = new JSDOM(renderToStaticMarkup(<span><NodeModifierIcon iconKey={modifier.iconKey} size={14} />{modifier.name}</span>)).window.document
    const icon = doc.querySelector('[data-native-modifier-icon]')!
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.hasAttribute('aria-label')).toBe(false)
    expect(icon.getAttribute('style')).toContain('background-color:currentColor')
    expect(icon.getAttribute('style')).toContain('width:14px')
    expect(doc.body.textContent).toBe(modifier.name)
    expect(renderToStaticMarkup(<NodeModifierIcon iconKey="pve_disarray" />)).toBe('')
  })
  it("renders selected combobox chips and war badges using the same explicit curated choice", () => {
    const chip = new JSDOM(renderToStaticMarkup(<MultiNodeModifierCombobox modifiers={[modifier]} values={[modifier.id]} onSelect={() => {}} />)).window.document
    expect(chip.querySelectorAll('[data-native-modifier-icon]')).toHaveLength(1)
    expect(chip.querySelector('[aria-label="Remove Reviewed modifier"]')).not.toBeNull()
    const war = new JSDOM(renderToStaticMarkup(<ActiveModifiers modifiers={[modifier]} />)).window.document
    expect(war.querySelectorAll('[data-native-modifier-icon]')).toHaveLength(1)
    expect(war.body.textContent).toBe(modifier.name)
  })
  it("keeps importance stars separate from native icons in both encounter presentations", () => {
    const nodes = [{ id: 'link', questEncounterId: 'encounter', nodeModifierId: modifier.id, isHighlighted: true, nodeModifier: modifier }]
    for (const isCollapsed of [true, false]) {
      const doc = new JSDOM(renderToStaticMarkup(<EncounterNodeList nodes={nodes} isCollapsed={isCollapsed} setIsCollapsed={() => {}} />)).window.document
      expect(doc.querySelectorAll('[data-native-modifier-icon]')).toHaveLength(1)
      expect(doc.querySelectorAll('svg.lucide-star')).toHaveLength(1)
      expect(doc.body.textContent).toContain(modifier.name)
    }
  })
})

// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { GameNodeModifierIcon } from "../nodes/GameNodeModifierIcon";
import { additionalNativeGameIcons } from "@cerebro/core/domain/node-modifiers/native-game-icons";
it("renders the finite native shape decoratively beside its name with currentColor and bounded size",()=>{
 const icon=additionalNativeGameIcons[0],html=renderToStaticMarkup(createElement(GameNodeModifierIcon,{iconKey:icon.key,size:20}));
 const host=document.createElement('div');host.innerHTML=html;const span=host.firstElementChild as HTMLElement;
 expect(span.getAttribute('aria-hidden')).toBe('true');expect(span.hasAttribute('tabindex')).toBe(false);expect(span.hasAttribute('role')).toBe(false);
 expect(span.textContent).toBe('');expect(span.dataset.gameModifierIcon).toBe(icon.key);expect(span.style.width).toBe('20px');expect(span.style.height).toBe('20px');
 expect(span.style.backgroundColor).toBe('currentcolor');expect(html).toContain(icon.src);
 const oversized=renderToStaticMarkup(createElement(GameNodeModifierIcon,{iconKey:icon.key,size:Infinity}));expect(oversized).toContain('width:16px');
});
it("renders nothing for missing or unknown keys instead of constructing a URL",()=>{
 for(const iconKey of [undefined,null,'https://example.com/icon.svg','node-game-glyph-unknown'])expect(renderToStaticMarkup(createElement(GameNodeModifierIcon,{iconKey}))).toBe('');
});

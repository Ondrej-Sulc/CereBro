# Native icon delivery

Some public Google Storage glyphs load as ordinary images but reject cross-origin CSS-mask requests from beta. A mask can therefore render an empty colored circle even though its SVG exists. The glossary's direct images already work; masked champion effects, ability lines, roster filters and relic glyphs use same-origin delivery.

`gameIconMaskUrl` retains the exact bound filename and rewrites only the public `champion-images/mcoc/glossary-icons` and `game-effect-icons` collections to `/api/game-icons/[family]/[file]`. Local stat, synergy and node glyph paths stay unchanged. This is a presentation transport change; database URLs, icon identities, imported colors and original SVG bytes are unchanged.

The route fixes the upstream origin and collection allowlist, validates filenames, omits credentials, rejects redirects, bounds reads to 512 KiB and times out after seven seconds. Successful responses require SVG content type, retain the original bytes, and carry public browser-cache headers plus a sandboxed SVG policy. Failures are not cached or reflected to the caller.

The kit, full-ability reader, roster effect picker and legacy champion previews normalize mask URLs at rendering. Relic attribute/rune builders normalize once for their catalog, detail and picker consumers.

Regression checks cover both native icon families, unchanged local paths, unauthorized URLs/path traversal, exact response bytes, MIME and size failures, and multiple UI consumers. The new URL and route suites are registered alongside the existing champion UI coverage in CI. Live checks should load the actual masked SVGs and verify visible pixels, rather than relying only on an HTTP success.

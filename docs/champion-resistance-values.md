# Resistance values in Kit Overview

Verified resistance classifications remain separate from their displayed values.
A fixed `percent` describes one recorded mechanism; it cannot represent a signature
curve, a per-stack amount, a conditional extra reduction, or a flat duration change.

For classifications without a fixed percentage, champion pages and roster popups
now show additional numeric passages from current imported ability text or an exact
matching synergy card. Reviewed overview conditions and stored sources remain intact.
The recorded passage retains its recipients, scaling basis, limits and modifiers.
Unresolved passages are omitted rather than filled from legacy ranges or healing
amounts. Resistance still does not imply effect immunity.

Signature values use the selected Sig level. Owned roster popups send the actual
signature and rank; unowned/catalog previews explicitly label the preview signature.
Sig 0 is marked inactive. The shared Full Abilities resolver can select an exact
imported 99-Sig sibling of a 200-Sig binding only when its component family, curve
family, value slot/type and base match. Missing or ambiguous variants fail closed.
This uses recorded coefficients, without champion-specific overrides or curve
estimates from prose.

Synergy values require the existing name, unique/solo, partner and rarity bindings.
Recipient labels remain visible; a named teammate's modifier is not borrowed.
Catalog names, short names and normalized game IDs establish recipient aliases.
Collective recipient labels must be supported by the recorded source. Named recipient
blocks on a single line are separated using their explicit game formatting.

The October 23 catalog check covers 134 existing resistance applications across
83 champions: 40 fixed percentages and 94 contextual numeric passages. This checks
the existing resistance classifications, not discovery of every possible resistance
in the game. Representative tests cover signature curves, unawakened builds,
per-stack/capped values, elided Power-effect lists, unresolved parameters, recipient
isolation, fresh evidence guards, API build validation and shared rendering.

No database migration or champion data edit is required for this presentation fix.

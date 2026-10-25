# Discord champion data

Discord uses the same source identities, reviewed overview hashes, resistance evidence checks and imported ability-text renderer as the champion pages. No data migration is needed for these command changes; the reviewed data and schema must already be present.

- `/champion abilities` groups applications by Gains on self, Inflicts on opponent and unrecorded direction. Each source retains its form, activation condition and required teammates. Current reviewed summaries replace long source prose; a changed source or partner invalidates its summary.
- `/champion immunities` shows separate Immunities and Resistances sections. Resistance uses its verified target effect and recorded mechanism/percentage. Even 100% or greater reduction remains resistance. Changed source or imported evidence invalidates the classification.
- `/champion overview` uses the same effect projection and includes Immunities & resistances.
- `/champion info` prefers imported combat paragraphs, explicit localized sections and verified numeric bindings. HUD glossary help is omitted. Values use the highest obtainable rarity with imported stats, its highest rank and maximum signature, disclosed in the response. Missing stat-dependent values are marked unavailable. The old JSON descriptions remain a fallback only when no imported text exists.

Champion views retain all displayed text through pagination. Search results show bounded excerpts with a command for opening the full sources.

Synergy sources reuse the website's kit-source grouping and game-synergy catalog. Discord shows partner icons and omits synergy names and owner-rarity labels; a partner name is used only when its icon is unavailable. Reviewed effect descriptions remain intact. Matching level/rarity variants share copy while retaining partner activation requirements. Recorded protection bonuses are resolved for the current recipient from the same catalog as the website; another teammate's bonus is never borrowed. Partner star requirements stay visible in compact ranges.

## Search

`/search all` and `/search roster`, their autocomplete choices and glossary search buttons use validated projected effects before calculating totals and pages.

Existing ability, immunity, category, tag, class and attack expressions retain their `and`/`or` syntax. Classified protections are searched by target effect in immunities, rather than by their original resistance ability name. Form and direction qualify the same ability application. They do not constrain immunity sources.

New options on both search commands:

- `effect-form`: Buff, Debuff, Passive or Not recorded.
- `effect-direction`: Gains on self, Inflicts on opponent or Not recorded.
- `include-resistances`: defaults to true for immunity searches. Set false for full immunity only.
- `min-resistance`: minimum recorded potency reduction percentage. Full immunities also match. Unknown amounts and damage-only or duration-only reductions do not meet this filter. Values above 100 are supported.

Examples:

```text
/search all abilities:Bleed effect-form:DEBUFF effect-direction:INFLICT
/search all immunities:Bleed include-resistances:false
/search roster immunities:Bleed min-resistance:60
```

Build and register the updated slash-command definitions through the normal bot deployment workflow so Discord exposes the new options.

Regression checks:

```powershell
pnpm exec vitest run src/commands/champion src/commands/search web/src/lib/champion-ability-text.test.ts web/src/lib/champion-ability-game-binding.test.ts web/src/lib/champion-kit.test.ts
pnpm exec tsc --noEmit
pnpm --dir web exec tsc --noEmit
```

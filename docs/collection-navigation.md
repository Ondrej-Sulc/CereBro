# Catalog and personal collection views

The main menu has one Champions entry and one Relics entry. Each page's main heading doubles as view navigation: All Champions / My Roster and All Relics / My Relics. Both destinations share a framed header control with icons and a colored active panel; the active view is the single h1. All Champions and All Relics show public reference cards with no owned builds or personal management controls. My Roster defaults to owned champions and retains the optional unowned filter and prestige tools. My Relics exposes the active profile's saved items and the visual add editor.

On 28 October 2026, the user selected design A (Split header) over a title/shortcut layout and a title menu. It keeps both destinations visible and gives the active view a stronger visual distinction. The chosen design is integrated with the existing real navigation, guest prompts, saved preferences and responsive sizing. The temporary design variants, floating controls and development wrapper have been removed. The historical comparison remains outside the repo at `D:/CereBro-artifacts/player-relics-visual-20261027/switcher-designs-comparison.html`.

The integrated split header passed six navigation tests, web TypeScript and scoped ESLint. Browser checks confirmed real route links, guest sign-in, one h1, no preview controls (including old variant URLs), and no horizontal overflow at 320px on either page. The rendered header was also visually checked through an HTML preview. Logs use the `split-header-*` prefix in the same artifact directory.

## Routes and preference

- `/champions` and `/relics` use the browser's last explicitly selected view, independently per section. Without a valid saved preference, signed-in users with an active game profile default to My Roster / My Relics; guests and users without a profile default to All Champions / All Relics.
- `?view=catalog` and `?view=personal` override that preference. Guests always receive Catalog; the personal tab offers sign-in with a return URL. Signed-in users without a profile get a profile-selection prompt.
- `/profile/roster` redirects to `/champions?view=personal` and retains existing prestige query parameters. `/profile/relics` redirects to `/relics?view=personal`.
- Shared `/player/[id]/roster` pages remain explicit player views with no collection switch and no remembered-mode redirection.

Only the `catalog`/`personal` preference is persisted, in separate one-year SameSite=Lax cookies. This is a browser preference, not cross-device account synchronization. The server selects the correct view for the first render. Menu clicks resolve the latest preference rather than relying on a potentially stale client route cache. Following an explicit link does not overwrite the user's chosen default.

## Browsing state and privacy

A browser provider preserves each view's filters and scroll when switching views. Search and class are shared between the two views of a section; progression filters, sorting and prestige URLs remain specific to their view. State is partitioned by section and active profile, so switching profiles cannot reuse another profile's filters. This transient state resets on a full reload; no inventory data is written to localStorage or a shared cache.

Catalog rendering does not load private roster/inventory rows. Existing server authorization and profile ownership checks still guard all personal reads and mutations. Public game definitions remain cached separately. Roster mutations and profile switches invalidate the canonical collection routes as well as legacy paths.

## Verification

`web/src/lib/collection-view.test.ts` covers guest fallback, explicit-link precedence, section preferences, preserved query parameters, and state isolation. Browser checks cover authenticated/guest navigation, filter transfer, per-view restoration, profiles, shared/legacy URLs, and mobile tabs.

Local verification on 27 October 2026 passed: 130 targeted tests (112 relic, 18 navigation/roster), root/web TypeScript, scoped ESLint and the production build. Browser checks verified a restored 900px champion catalog position, independent section preferences, explicit catalog precedence, guest fallback, profile isolation, unchanged shared roster context, legacy insight URLs and mobile navigation. Disposable test profiles and owned rows were removed. Logs are under `D:/CereBro-artifacts/player-relics-visual-20261027/collection-*`.

The subsequent compact-header visual pass passed web TypeScript and scoped ESLint, plus browser checks of catalog/personal headers at desktop and 390px widths, 320px wrapping without overflow, and the guest sign-in prompt. At 1100px, the relic catalog filters start 90px higher than with the separate switch row. Temporary local profiles were removed after verification. Header check logs use the same artifact directory with `header-*` names.

The final heading-navigation revision replaces that compact toggle with All/My heading links. Six navigation tests pass, including the new signed-in default (confirmed failing before the implementation change), saved-preference precedence, explicit links, and guest fallback. Web TypeScript and scoped ESLint pass. Browser checks verified both signed-in defaults with no cookies, a saved All Relics choice after reload, independent Champions preferences, explicit All Champions navigation, one h1 per view, desktop/390px/320px layout without overflow, guest sign-in, and the unchanged shared-player heading. Temporary local profiles were removed. Logs use `heading-tabs-*` names.

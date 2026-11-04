# Champion pages — native stat icons

2026-11-04. Adds the game's original glyphs to the nine combat ratings and to Health and Attack in the champion header. [Open the before/after comparison](comparison.html).

## Evaluation

Hypothesis: familiar game silhouettes make the stats easier to recognize without replacing their visible names or changing their values.

The nine ratings use white glyphs on the corresponding native category color. Health and Attack use the heart with a cross and crossed swords, in the existing header-label color. Icons are decorative and hidden from assistive technology; the adjacent names remain visible and accessible. Badge sizes are 22px for ratings and 14px for header labels. No extra tooltip or interaction is introduced.

The retained offense/defense grouping, typography and number formatting remain in place. Zero and unavailable values remain distinct. The special damage multiplier stays textual because its native icon alias is unverified.

## Source verification

The icons are original vector outlines from the game's Marvel-Icons-Font, mapped through its stat UI and StatFocusTuning records. They were not cropped or traced from screenshots. [Source documentation](../../../stat-icons.md) gives the mappings and extraction commands; [the source manifest](../../../stat-icons-source.json) records hashes and native bindings.

A separate extraction reproduced all 11 SVG assets and both manifests byte for byte. The application imports only the compact icon metadata; the complete font and source bundles are not included.

## Matched screenshots

Eight real before/after pairs cover Absorbing Man at mobile, desktop and 320px widths, Star-Lord (Kitty Pryde) with a long name, and Ms. Marvel at six stars. Builds are Sig 200 with ascension 0; rarity and rank appear in each case's metadata.

The baseline uses the deployed HEAD `9d18348d800079468d900acd9ff6dfcc7b7e074a`. All three candidate UI files were restored byte for byte after capturing the baseline. The shared T3 preview browser captured both versions with the same session, DPR 1 and viewport. Its reported user agent is recorded in the evidence. Reduced-motion emulation was not enabled. Fonts, visible images and paint were awaited. Preliminary captures with incomplete compositor frames were replaced by the final packet.

Screenshots are not generated or retouched. The development indicator and native scrollbar are visible. [Before evidence](before/evidence.json) and [after evidence](after/evidence.json) compare all rendered rating labels/values, complete hero metrics, champion names and attack text. **Every semantic field matches in all eight cases.** The header heights also match. The badge rows add about 10px to the complete mobile stats section.

## Validation

- 23 tests passed across four suites: verified native assets (2), stats rendering (3), champion navigation/build behavior (14), and attack profiles (4).
- Root and web TypeScript checks passed. Changed UI files pass ESLint; it reports only the existing baseline-browser-mapping freshness notice.
- All 11 SVG requests return HTTP 200 with image/svg+xml.
- Browser layout checks at 320, 390, 768, 1024, 1280 and 1536px found no horizontal document overflow or clipped stat labels/values.
- Changing Ms. Marvel from 6★ R5 to R4 updates Health from 53,576 to 46,298 and Attack from 4,388 to 3,792; all 11 icon identities remain present. Escape closes the build popover and returns focus to Adjust build.
- Source inspection and the rendered previews confirm the glyph/label associations and retained accessible text.

[Check results](checks.json) supplement the screenshots. These changes are local and uncommitted; production has not been redeployed in this pass.

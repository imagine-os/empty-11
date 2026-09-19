<!-- GENERATED from packages/contracts/quality/src/rubrics/visual.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Visual rubric (`RUB-VIS-*`, v1)

Applied by: `vision`, `justin`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

Does the page look right at every width and theme the org supports, from a 360 px phone to a 3840 px TV read from ten feet? The vision inspector (PAP-84) applies these items to Gate 3 screenshots and DOM metrics; Justin uses them when he glances at the digest.

## Scope

Screenshots and DOM metrics at 360, 390, 768, 1280, 1920, 2560 and 3840 px in every theme; Storybook stories; contact sheets (PAP-248).

## Examples by severity

- **S0**
  - A modal renders behind the page at 360 px so the only way to dismiss it is hidden: the user is locked out of the flow (access to the product is blocked).
- **S1**
  - Horizontal overflow at 360 or 390 px (`scrollWidth > clientWidth`).
  - A status badge in dark theme at 2.1:1 contrast.
- **S2**
  - A 5 px misalignment between a label column and its inputs.
  - Theme leak: a hard-coded `#fff` background in dark theme on a secondary panel.
- **S3**
  - Intentional truncation of a long name with a tooltip present.

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | How to verify | False positives |
|---|---|---|---|---|---|
| `RUB-VIS-01` | Horizontal overflow | Can I find a width in the seven-width matrix where the page or a container scrolls horizontally or content escapes the viewport? | S1 | `reports/dom-metrics.json` `scrollWidth > clientWidth` per screenshot (confidence 0.9 when DOM-confirmed); the screenshot shows cut content; cite the width and theme. | Intentional horizontally scrolling regions (carousels, wide tables in a scroll container) with visible affordance. |
| `RUB-VIS-02` | Clipping and overlap | Can I find text or controls clipped by `overflow: hidden`, covered by a sticky header, a toast or another element, or drawn outside their card? | S1 | Elements outside viewport or overlapping in DOM metrics; bounding box in the screenshot; reproduce at the cited width. | Decorative bleeds and intentional stacking (avatars) with no lost information. |
| `RUB-VIS-03` | Truncation without a tooltip | Can I find text ending in an ellipsis whose full value is not available on hover, focus or tap (no `title`, tooltip or expand)? | S2 | DOM metrics list `text-overflow: ellipsis` hits with `title` presence; truncation with a tooltip is intentional and downgrades to S3; truncation of a primary value (amount, name in a row header) with no tooltip is S1. | Truncated secondary text with a details view one click away. |
| `RUB-VIS-04` | Misalignment | Can I find elements in one visual row or column whose edges differ by 4 px or more where the design system aligns them (labels to inputs, icons to text baselines, card edges)? | S2 | Measure bounding boxes in the screenshot or DOM metrics; cite the two elements and the offset. | Offsets under 4 px; intentional optical alignment in icon glyphs. |
| `RUB-VIS-05` | Contrast | Can I find text under 4.5:1 (3:1 for large text and UI components) against its actual background in any theme? | S1 | Sample the bbox with `sharp` and compute the ratio (PAP-84); below 3:1 keeps the severity, otherwise downgrade to `question`; state the ratio and theme. | Disabled controls (still S3 if illegible); decorative text. |
| `RUB-VIS-06` | Spacing and rhythm | Can I find spacing that is not a design token step, uneven gaps between siblings, or padding that collapses at a narrow width? | S2 | Compare computed margins and paddings with the `packages/tokens` scale; cite the element and the values. | One-off spacing documented in the component's story. |
| `RUB-VIS-07` | Target size | Can I find an interactive element whose hit area is under 44 by 44 px, or two targets closer than 8 px, at any width or input mode? | S1 | Bounding boxes of `button`, `a`, inputs and custom controls in DOM metrics; cite the element, its size and the width. | Inline text links inside a paragraph (WCAG exception) that also have an equivalent 44 px control nearby. |
| `RUB-VIS-08` | Theme leaks | Can I switch theme and find a hard-coded colour, a light image on a dark surface, an unstyled native control or a focus ring that vanishes? | S2 | Compare the same screenshot across themes; grep the diff for literal colours outside `packages/tokens`. | Brand marks that are intentionally theme-invariant. |
| `RUB-VIS-09` | Responsive matrix and 10-foot legibility | Can I find a width where the layout does not adapt (phone layout stretched to 3840 px, desktop layout squeezed to 360 px), or text under 16 px at 1920 px and above that a viewer three metres away cannot read? | S1 | Contact sheet across the seven widths; type scale at 1920, 2560 and 3840 uses the large-screen tokens; primary actions remain visible without scrolling on TV widths. | Dense data tables that intentionally keep a fixed density with a zoom control. |
| `RUB-VIS-10` | Images, icons and media | Can I find a stretched or blurry image, a missing icon, a media element without a poster or size, or layout shift when it loads? | S2 | Compare intrinsic and rendered sizes in DOM metrics; check `width`/`height` attributes; watch the video replay for shift (PAP-83). | Placeholders in dev mode that are labelled as such. |

## What this rubric does not cover

- Semantics, names and keyboard behaviour (accessibility rubric), even when the symptom is visible.
- Whether the layout matches the spec's declared components (spec-conformance rubric).
- Brand taste and copy tone: file as `question` or `praise`, not a defect.

<!-- GENERATED from packages/contracts/quality/src/rubrics/accessibility.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Accessibility rubric (`RUB-A11Y-*`, v1)

Applied by: `a11y-audit`, `vision`, `spec-conformance`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

Can every user operate the page with keyboard, mouse, trackpad, touch, pen, a screen reader, and soon a TV remote, gamepad or voice? The axe run and manual screen-reader audit (PAP-73), the vision inspector (PAP-84) and the spec-conformance reviewer apply these items; serious failures are S1 by taxonomy.

## Scope

Rendered pages and components: DOM semantics, focus behaviour, names and roles, input modes, motion, forms, language. Design-system components (PAP-66 to PAP-74) are checked once in Storybook; pages are checked for how they compose them.

## Examples by severity

- **S0**
  - The only way to confirm a payment is a drag gesture: the flow is impossible without a pointer (access-rule violation for keyboard and remote users).
- **S1**
  - An icon-only button has no accessible name.
  - Focus is trapped inside a closed dialog, or lost to `body` on close.
  - A hover-only menu with no keyboard or touch path.
- **S2**
  - A live region announces every keystroke of a search field.
  - Heading levels skip from h1 to h4.

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | How to verify | False positives |
|---|---|---|---|---|---|
| `RUB-A11Y-01` | Keyboard reachability and focus order | Can I reach and operate every control with Tab, Shift+Tab, arrows, Enter, Space and Escape in an order that matches the visual reading order, with no trap and no lost focus after an action? | S1 | Keyboard-only replay (PAP-976); `tabindex` greater than 0 or on non-interactive elements in the diff; focus lands on the dialog heading on open and returns to the trigger on close. | Focus intentionally moved to a result region after a search, announced by a live region. |
| `RUB-A11Y-02` | Name, role and value | Can I find an interactive element with no accessible name, a wrong role (clickable `div`), a state not exposed (`aria-expanded`, `aria-pressed`, `aria-selected`), or a name that differs from the visible label? | S1 | axe `button-name`, `link-name`, `aria-*` rules (PAP-73); read the accessibility tree for changed components; visible label must be contained in the accessible name for voice users. | Decorative icons with `aria-hidden` next to a labelled control. |
| `RUB-A11Y-03` | Visible focus | Can I tab to a control and not see where focus is, in any theme, including inside tables, canvases and custom controls? | S1 | Screenshots with focus on each control kind in each theme; grep for `outline: none` without a replacement `:focus-visible` style. | Focus styles hidden for mouse users only via `:focus-visible`. |
| `RUB-A11Y-04` | No hover-only or drag-only interaction | Can I find information or an action available only on hover (tooltips with actions, reveal-on-hover buttons) or only by dragging (reorder, resize, sliders) with no keyboard, touch or button equivalent? | S1 | Trigger each hover reveal by focus and by tap; every drag has a menu or keyboard alternative (move up/down, resize handles with arrow keys); org standard: nothing hover-only or drag-only. | Hover previews that duplicate information available on click. |
| `RUB-A11Y-05` | Pointer and touch input modes | Can I use the page with touch (no hover states, coarse pointer) and pen (pressure, hover without click) and find a control that needs a right click, a double click, a precise 1 px hit, or a scroll wheel? | S1 | Playwright touch emulation on the phone widths; `pointer: coarse` media query respected; context-menu actions have a visible button equivalent. | Power-user shortcuts that duplicate a visible control. |
| `RUB-A11Y-06` | Motion, timing and auto-updates | Can I find animation that ignores `prefers-reduced-motion`, content that moves or updates without a pause control, a timeout that logs out without warning, or a toast that disappears before it can be read? | S2 | Toggle reduced motion in the visual suite; toasts persist at least 5 s and are also logged in a notification list; session timeouts warn at least 60 s before. | Essential motion (progress indicators) that is also described in text. |
| `RUB-A11Y-07` | Status messages and live regions | Can I complete an action (save, error, loading finished, presence change) and get no announcement, or so many announcements that the reader is unusable? | S2 | `role=status` or `aria-live=polite` region receives one message per outcome; errors use `role=alert`; check the announcement text in the screen-reader transcript (PAP-73). | Silent background refreshes with no user-initiated action. |
| `RUB-A11Y-08` | Forms: labels, errors and autocomplete | Can I find an input without a programmatic label, an error message not associated with its field (`aria-describedby`), a required field not marked, or a common field without `autocomplete`? | S1 | axe form rules; submit an empty form and confirm focus moves to the first error and it is announced; `autocomplete` on name, email, address and card fields. | Search fields with a visible placeholder and an `aria-label`. |
| `RUB-A11Y-09` | Language, direction and text scaling | Can I switch to Spanish and find `lang` unchanged on the document or a passage, or zoom text to 200 percent and lose content or controls? | S2 | `html[lang]` follows the catalog locale; 200 percent zoom at 1280 px shows no overflow (visual RUB-VIS-01 at the equivalent width); RTL pseudo-locale run (PAP-688) where available. | Untranslated proper nouns. |
| `RUB-A11Y-10` | Structure: landmarks, headings and tables | Can I navigate the page by landmarks and headings and find no `main`, skipped heading levels, a data table without headers, or a list built from `div`s? | S2 | Accessibility tree of the page; one `h1`; `th` with `scope` on data tables produced by the table component; skip link to `main`. | Canvas and diagram surfaces that provide an equivalent list view. |

## What this rubric does not cover

- Colour contrast measurement (visual rubric RUB-VIS-05 owns the number; a11y cites it).
- Screen-reader testing on non-Linux platforms (PAP-156, blocked on runners).
- Copy readability and plain-language review (docs rubric for docs; `question` for UI copy).

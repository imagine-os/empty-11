# Primitive gaps and their fallbacks

* Issue: [PAP-212](https://linear.app/paperos/issue/PAP-212) · Decision: [ADR 0029](../adr/0029-ui-primitives-library.md)
* Date: 2026-09-19 · Owner: Iris (Component Crafter), with Scout on the sourcing
* Research: [`docs/research/ui-kits-and-headless-libraries.md`](../research/ui-kits-and-headless-libraries.md)

We build on **Base UI `@base-ui/react` 1.8.0**. It does not cover everything PaperOS needs. This
file is the standing list of what is missing, where each gap is filled from, and who owns it, so
that PAP-67's children and the pages downstream do not each invent their own answer.

## 1. Gaps and their sources

| Gap | Needed by | Source we use | Notes |
| -- | -- | -- | -- |
| Calendar, DatePicker, DateRangePicker, DateField, TimeField | PAP-233, PAP-659 | **`react-aria-components` 1.21.1** (`Calendar`, `RangeCalendar`, `DatePicker`, `DateField`, `TimeField`) | The named fallback in ADR 0029. Apache-2.0, adopted scoped: date and time only. Brings `@internationalized/date` with 13 calendar systems and locale-aware parsing, which is what makes the EN/ES toggle work for dates. |
| Data table / data grid | PAP-655, PAP-664, PAP-165 | PAP-213's decision (TanStack Table is the presumptive answer) | Not this issue. Base UI has no table primitive and should not grow one. |
| Rich text editing, canvas | PAP-127's scope | ADR 0006 (Tiptap, React Flow) | Already decided. |
| Virtualized long lists outside the combobox | PAP-655, PAP-664 | TanStack Virtual (confirm in PAP-213) | Base UI's virtualization is internal to Combobox; it is not a general list virtualizer. |
| Charts and micro-charts | PAP-665, PAP-170 | PAP-213 / the `dataviz` guidance | Out of scope here. |
| Command palette | PAP-338 and the assistant surfaces | Base UI `Autocomplete` in a `Dialog` | `cmdk` is not needed: Base UI ships both Autocomplete and Combobox. Do not introduce `cmdk` — it would be a second, unvirtualized list implementation. |
| Sonner-style toast stacking | PAP-237 | Base UI `Toast` | Base UI has a first-party Toast; do not add `sonner`. |
| Drawer / bottom sheet | PAP-70, mobile shells | Base UI `Drawer` (swipe-to-dismiss, first-party) | Do not add `vaul`. |
| Resizable split panes | PAP-950 | none yet — open | No candidate ships one. Decide in PAP-950; `react-resizable-panels` is the obvious candidate and needs its own scorecard. |
| Tree view | org chart (PAP-113), file surfaces | none yet — open | Ark UI and React Aria both have one; if we need it, score them against each other rather than defaulting. |

## 2. What the fallback costs

Taking React Aria for dates means two primitive libraries in `packages/ui`. That is a real cost and
it is bounded by three rules:

1. **Scope.** `react-aria-components` may only be imported by the date and time components
   (`packages/ui/src/components/{calendar,date-picker,date-range-picker,date-field,time-field}/`).
   Everything else imports Base UI. PAP-668's design lint is the place to enforce it.
2. **Our API, not theirs.** As with Base UI, the exported component is ours — `<DatePicker>` with
   PaperOS props, tokens and `meta.ts`. A future swap touches one folder.
3. **Weight.** React Aria's date stack is the heaviest thing in the UI package; it is lazily loaded
   at the route level wherever a page does not need a date control.

## 3. What Base UI covers that we would otherwise have hand-built

Recorded because it is why the gap list is this short: Combobox **with built-in virtualization**
(PAP-238's 5,000-option requirement), Autocomplete, NumberField, OTP Field, Drawer, Menubar,
NavigationMenu, ScrollArea, Toast, Field/Fieldset/Form, PreviewCard, Meter. On Radix, six of those
would have been ours to build or source.

## 4. Keeping this file honest

Add a row the moment a page spec references a `ui.*` id with no component behind it (Iris's
escalation rule). Remove a row only when the component exists in `packages/ui` with a story and a
test. If a gap is filled by a new dependency, it needs a scorecard in
`docs/libraries/scorecards/` first — no exceptions, however small the package.

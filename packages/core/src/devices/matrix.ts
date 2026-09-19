/**
 * PaperOS device / breakpoint matrix — PAP-14.
 *
 * Single source of truth for the seven viewport-width tiers PaperOS designs,
 * builds and tests against, plus the six device classes (phone, tablet,
 * laptop, desktop, TV/kiosk, foldable) mapped onto them.
 *
 * `ops/ci/breakpoints.json` is a *generated* projection of `BREAKPOINTS`
 * (via `toBreakpointsJson()` below and the `scripts/gen-breakpoints.ts` CLI)
 * so that PAP-82's Playwright projects and PAP-84's video replays can read
 * it without importing TypeScript. Do not hand-edit that file — the
 * generator's `--check` mode fails a hand-edited copy that has drifted from
 * this one.
 *
 * This file stays dependency-free (no `node:*` imports, no file I/O) so it
 * keeps `@paperos/core`'s "pure TypeScript, no database, no network" contract;
 * the file-writing part of the generator lives outside the package, in
 * `scripts/gen-breakpoints.ts`.
 *
 * Rationale, market data and sources: `docs/research/device-matrix.md`.
 * Decision record: `docs/adr/0022-device-matrix.md`.
 *
 * Bumping any `minWidth` (or adding/removing a breakpoint) is a breaking
 * change for every consumer's screenshot baselines (PAP-82) — bump
 * `MATRIX_VERSION` and note it in the ADR when you do.
 */

/** Exhaustive breakpoint name union — smallest to largest. */
export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

/** CSS `pointer` media-feature value, plus `'both'` for devices that ship both kinds. */
export type PointerKind = 'coarse' | 'fine' | 'both';

export type Orientation = 'portrait' | 'landscape' | 'any';

export interface Breakpoint {
  /** Ordered, exhaustive name. */
  readonly name: BreakpointName;
  /** Lower bound in CSS px; the tier applies at this width and up to (not including) the next tier's minWidth. */
  readonly minWidth: number;
  /** Real devices whose default viewport lands in this tier, for engineers picking a manual-test unit. */
  readonly exampleDevices: readonly string[];
  /** Device pixel ratios worth testing at this width. */
  readonly dpr: readonly number[];
  /** Dominant `pointer:` media feature at this tier. */
  readonly pointer: PointerKind;
  /** Whether `hover: hover` is a safe default assumption at this tier. */
  readonly hover: boolean;
  /** Orientation this tier is normally used in. `'any'` means both are common. */
  readonly orientation: Orientation;
  /** Whether `env(safe-area-inset-*)` (notches, punch-holes, TV overscan) commonly applies. */
  readonly safeArea: boolean;
}

export type DeviceClassId = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'tv-kiosk' | 'foldable';

export interface DeviceClass {
  readonly id: DeviceClassId;
  readonly label: string;
  /** The breakpoint tier this class is anchored at (its most common/representative width). */
  readonly breakpoint: BreakpointName;
  /** Overrides the anchor breakpoint's pointer/hover/orientation/safeArea defaults for this class specifically. */
  readonly pointer: PointerKind;
  readonly hover: boolean;
  readonly orientation: Orientation;
  readonly safeArea: boolean;
  readonly dpr: readonly number[];
  readonly exampleDevices: readonly string[];
  /** One-line guidance: input handling, legibility distance, anything class-specific the breakpoint table can't say. */
  readonly notes: string;
}

/**
 * Bump on any shape or value change to BREAKPOINTS. PAP-82 baselines are
 * keyed to this; a bump means "regenerate baselines", not "patch them".
 */
export const MATRIX_VERSION = 1;

/**
 * The seven widths. Confirms (with 2026 market data — see the research doc)
 * the org-wide standard already assumed elsewhere in the plan, and overturns
 * the issue's rougher starting point (320/375/1024/1536) which predates
 * current device data.
 */
export const BREAKPOINTS: readonly Breakpoint[] = [
  {
    name: 'xs',
    minWidth: 360,
    exampleDevices: ['Samsung Galaxy A/S series (360×800)', 'Pixel 8a'],
    dpr: [2, 2.6, 3],
    pointer: 'coarse',
    hover: false,
    orientation: 'portrait',
    safeArea: true,
  },
  {
    name: 'sm',
    minWidth: 390,
    exampleDevices: ['iPhone 12–17 (390×844 / 393×852)', 'Galaxy S24/S25'],
    dpr: [2, 3],
    pointer: 'coarse',
    hover: false,
    orientation: 'portrait',
    safeArea: true,
  },
  {
    name: 'md',
    minWidth: 768,
    exampleDevices: [
      'iPad (10th gen) portrait, 768×1024',
      'iPad Pro 13" portrait, ~1032 wide',
      'Galaxy Tab S9',
      'Galaxy Z Fold7 unfolded, 984×1092 (device-posture: continuous)',
    ],
    dpr: [2],
    pointer: 'both',
    hover: false,
    orientation: 'any',
    safeArea: true,
  },
  {
    name: 'lg',
    minWidth: 1280,
    exampleDevices: [
      '13"–14" laptops, 1280×800 / 1366×768',
      'Chromebooks',
      'iPad Pro 13" landscape',
    ],
    dpr: [1, 1.25, 1.5, 2],
    pointer: 'both',
    hover: true,
    orientation: 'landscape',
    safeArea: false,
  },
  {
    name: 'xl',
    minWidth: 1920,
    exampleDevices: ['1080p external/laptop displays (Steam HW Survey: ~50% of gaming PCs)'],
    dpr: [1, 1.25, 1.5],
    pointer: 'fine',
    hover: true,
    orientation: 'landscape',
    safeArea: false,
  },
  {
    name: '2xl',
    minWidth: 2560,
    exampleDevices: ['1440p / QHD monitors', '27"–32" ultrawide-adjacent desktops'],
    dpr: [1, 1.25],
    pointer: 'fine',
    hover: true,
    orientation: 'landscape',
    safeArea: false,
  },
  {
    name: '3xl',
    minWidth: 3840,
    exampleDevices: [
      '4K desktop monitors used as a workstation',
      '4K TVs / kiosk displays used from across a room',
    ],
    dpr: [1, 2],
    pointer: 'both',
    hover: false,
    orientation: 'landscape',
    safeArea: false,
  },
] as const;

/**
 * The six device classes the ticket asks for, mapped onto the seven
 * breakpoints. A class's `breakpoint` is its representative anchor, not its
 * only possible tier (a phone can be `sm` or `xs`; a foldable is `xs`/`sm`
 * folded and `md` unfolded).
 */
export const DEVICE_CLASSES: readonly DeviceClass[] = [
  {
    id: 'phone',
    label: 'Phone',
    breakpoint: 'sm',
    pointer: 'coarse',
    hover: false,
    orientation: 'portrait',
    safeArea: true,
    dpr: [2, 3],
    exampleDevices: ['iPhone 16/17', 'Galaxy S24/S25', 'Pixel 9'],
    notes:
      'Spans xs (360) and sm (390); design mobile-first at 360 and verify no clipping/overlap at 390. Touch targets ≥44×44 CSS px; nothing hover-only.',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    breakpoint: 'md',
    pointer: 'both',
    hover: false,
    orientation: 'any',
    safeArea: true,
    dpr: [2],
    exampleDevices: ['iPad (10th gen)', 'iPad Air', 'Galaxy Tab S9'],
    notes:
      'Portrait and landscape both common; treat as a distinct layout, not a stretched phone or shrunk laptop. Trackpad/mouse via iPadOS or a keyboard case means `(any-pointer: fine)` can be true even though the primary pointer is coarse.',
  },
  {
    id: 'laptop',
    label: 'Laptop',
    breakpoint: 'lg',
    pointer: 'both',
    hover: true,
    orientation: 'landscape',
    safeArea: false,
    dpr: [1, 1.25, 1.5, 2],
    exampleDevices: ['13"–14" MacBook/Windows laptops', 'Chromebooks', '2-in-1 convertibles'],
    notes:
      'Fractional Windows DPR (1.25/1.5) is the norm, not the edge case; test at those scale factors, not just 1x/2x. A meaningful minority are touchscreens — do not assume hover.',
  },
  {
    id: 'desktop',
    label: 'Desktop',
    breakpoint: 'xl',
    pointer: 'fine',
    hover: true,
    orientation: 'landscape',
    safeArea: false,
    dpr: [1, 1.25, 1.5],
    exampleDevices: [
      '1920×1080 monitors (still ~50% of gaming PCs, Steam HW Survey Aug 2026)',
      '2560×1440 monitors (~21%)',
    ],
    notes: 'Spans xl/2xl/3xl. Mouse + keyboard baseline; full hover affordances safe to rely on.',
  },
  {
    id: 'tv-kiosk',
    label: 'TV / kiosk',
    breakpoint: '3xl',
    pointer: 'coarse',
    hover: false,
    orientation: 'landscape',
    safeArea: true,
    dpr: [1, 2],
    exampleDevices: [
      '4K smart TVs (webOS/Tizen/Google TV/Android TV browsers)',
      'Public kiosk touchscreens',
    ],
    notes:
      '10-foot viewing: minimum 24px body text, high-contrast 3px+ focus rings, no reliance on hover, D-pad/remote focus order must be linear and visible. Older kiosk Chromium (~90) needs a documented minimum-browser-version fallback. safeArea:true here means overscan-safe margins, not a device notch.',
  },
  {
    id: 'foldable',
    label: 'Foldable',
    breakpoint: 'md',
    pointer: 'coarse',
    hover: false,
    orientation: 'any',
    safeArea: true,
    dpr: [2],
    exampleDevices: ['Galaxy Z Fold7 (folded 344×792-ish / unfolded 984×1092)', 'Galaxy Z Flip7'],
    notes:
      'Folded = phone-like (xs/sm); unfolded = treated as md per the ticket. Use the `device-posture` media feature (W3C Candidate Recommendation Draft, updated 2026-05-20; Chromium origin trial) to react to fold/unfold, not just width, since width alone cannot tell a folded phone from an unfolded one at the same CSS pixel width.',
  },
] as const;

/** Viewport height, DPR, touch and mobile-UA flags Playwright should use per tier, for PAP-82. */
export interface PlaywrightDeviceConfig {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  readonly hasTouch: boolean;
  readonly isMobile: boolean;
}

/**
 * Custom viewport configs rather than named Playwright device presets: a
 * named preset (`devices['iPhone 15']`) drifts with the Playwright version
 * installed and isn't guaranteed to hit exactly 360/390/768/1280/1920/2560/3840.
 * These are the canonical values `toBreakpointsJson()` below also writes into
 * `ops/ci/breakpoints.json` (via `scripts/gen-breakpoints.ts`).
 */
export const PLAYWRIGHT_DEVICES: Readonly<Record<BreakpointName, PlaywrightDeviceConfig>> = {
  xs: {
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  },
  sm: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  },
  md: {
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: false,
  },
  lg: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
  xl: {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
  '2xl': {
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
  '3xl': {
    viewport: { width: 3840, height: 2160 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
} as const;

/** Extra Playwright variants the DoD's test plan calls out beyond the seven canonical shots. */
export const PLAYWRIGHT_EXTRA_VARIANTS: Readonly<Record<string, PlaywrightDeviceConfig>> = {
  'sm@dpr3': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  },
  'xl@dpr1': {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
} as const;

/** Small runtime helper: which tier a raw CSS width falls into. Exhaustive over BreakpointName by construction. */
export function breakpointForWidth(width: number): BreakpointName {
  let current: BreakpointName = 'xs';
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) {
      current = bp.name;
    }
  }
  return current;
}

/** One row of the `ops/ci/breakpoints.json` schema — see `docs/research/device-matrix.md` §3. */
export interface BreakpointsJsonEntry {
  readonly name: BreakpointName;
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly hasTouch: boolean;
  readonly isMobile: boolean;
}

export interface BreakpointsJson {
  readonly version: number;
  readonly breakpoints: readonly BreakpointsJsonEntry[];
}

/**
 * Pure projection of `BREAKPOINTS`/`PLAYWRIGHT_DEVICES` into the
 * `ops/ci/breakpoints.json` shape — no file I/O, so this stays importable
 * from a plain-TypeScript, no-Node-APIs package like `@paperos/core`.
 * `scripts/gen-breakpoints.ts` is the thin Node CLI that calls this and
 * writes the file (that's where `pnpm gen:breakpoints` will point once it
 * is wired into a package.json, see the PAP-14 build report); `matrix.test.ts`
 * snapshot-tests this function directly.
 */
export function toBreakpointsJson(): BreakpointsJson {
  return {
    version: MATRIX_VERSION,
    breakpoints: BREAKPOINTS.map((bp) => {
      const pw = PLAYWRIGHT_DEVICES[bp.name];
      return {
        name: bp.name,
        width: bp.minWidth,
        height: pw.viewport.height,
        deviceScaleFactor: pw.deviceScaleFactor,
        hasTouch: pw.hasTouch,
        isMobile: pw.isMobile,
      };
    }),
  };
}

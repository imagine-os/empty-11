import { expect, type Page } from '@playwright/test';
import { DATA_ATTRIBUTES } from '../contract/modality.js';
import type { InputModality } from '../contract/primitives.js';
import { THRESHOLDS } from '../thresholds.js';
import { MissingContractError } from './errors.js';

/**
 * Assertions over the DOM contracts the input layer publishes:
 * `data-input-*` on `<html>` (PAP-150), the shared `LiveAnnouncer` region
 * (PAP-152) and the 44 px touch-target rule (PAP-154, every modality).
 */

/** `'pointer'` accepts mouse, touch or pen; anything else is one modality. */
export type ExpectedModality = InputModality | 'pointer';

const POINTER_MODALITIES: ReadonlySet<string> = new Set(['mouse', 'touch', 'pen']);

export interface ModalityOptions {
  /** `preferred` (default) is what affordances render against; `current` is the last event. */
  readonly which?: 'preferred' | 'current';
  readonly timeoutMs?: number;
}

/** Collapse a raw attribute value onto the expectation's vocabulary. Pure. */
export function normaliseModality(value: string | null, expected: ExpectedModality): string | null {
  if (value === null) return null;
  if (expected === 'pointer' && POINTER_MODALITIES.has(value)) return 'pointer';
  return value;
}

/**
 * Assert the modality the page reports on `<html>`. Polls, because the
 * detector updates after the event that switched it.
 */
export async function expectModality(
  page: Page,
  expected: ExpectedModality,
  options: ModalityOptions = {},
): Promise<void> {
  const attribute =
    options.which === 'current' ? DATA_ATTRIBUTES.modality : DATA_ATTRIBUTES.preferred;
  const read = () =>
    page.evaluate((name) => document.documentElement.getAttribute(name), attribute);
  await expect
    .poll(async () => normaliseModality(await read(), expected), {
      timeout: options.timeoutMs ?? 2000,
      message:
        `<html ${attribute}> should read "${expected}". ` +
        'A missing attribute means the modality detector is not mounted: call ' +
        '`createModalityDetector({ documentElement }).syncAttributes()` or render the ' +
        '`@paperos/input/react` provider (PAP-150).',
    })
    .toBe(expected);
}

/**
 * Where the shared announcer renders (PAP-152): a `data-live-announcer` root
 * holding one `aria-live` region per politeness. Plain `aria-live`, `status`
 * and `alert` regions are accepted as a fallback so a page can be tested
 * before it adopts the shared component.
 */
export const LIVE_REGION_SELECTOR = [
  '[data-live-announcer] [aria-live]',
  '[data-live-announcer][aria-live]',
  '[aria-live]',
  '[role="status"]',
  '[role="alert"]',
].join(', ');

export interface AnnouncementOptions {
  /** Restrict to one politeness level. Default: any. */
  readonly politeness?: 'polite' | 'assertive';
  readonly timeoutMs?: number;
}

/** Read the live regions' text, joined with newlines. Runs in the page. */
function readLiveRegions(args: { selector: string; politeness: 'polite' | 'assertive' | null }): {
  count: number;
  text: string;
} {
  const regions = Array.from(document.querySelectorAll<HTMLElement>(args.selector));
  const wanted = regions.filter((region) => {
    if (!args.politeness) return true;
    const live = region.getAttribute('aria-live');
    const role = region.getAttribute('role');
    if (args.politeness === 'assertive') return live === 'assertive' || role === 'alert';
    return live === 'polite' || role === 'status';
  });
  return {
    count: regions.length,
    text: wanted.map((region) => region.textContent?.trim() ?? '').join('\n'),
  };
}

/**
 * Assert the shared live region announces `matcher`. Fails with guidance when
 * no live region exists at all, because that is a missing `LiveAnnouncer`,
 * not a wrong announcement.
 */
export async function expectAnnouncement(
  page: Page,
  matcher: string | RegExp,
  options: AnnouncementOptions = {},
): Promise<void> {
  const args = { selector: LIVE_REGION_SELECTOR, politeness: options.politeness ?? null };
  const first = await page.evaluate(readLiveRegions, args);
  if (first.count === 0) {
    throw new MissingContractError(
      'No live region found. Mount the shared `LiveAnnouncer` (PAP-152) so announcements have ' +
        'somewhere to land: `<div data-live-announcer><div aria-live="polite"></div>' +
        '<div aria-live="assertive"></div></div>`.',
    );
  }
  const pattern = typeof matcher === 'string' ? matcher : matcher;
  await expect
    .poll(async () => (await page.evaluate(readLiveRegions, args)).text, {
      timeout: options.timeoutMs ?? 2000,
      message: `Live region should announce ${String(matcher)}`,
    })
    .toMatch(pattern);
}

export interface TouchTargetOptions {
  /** Minimum side in CSS px. Default `THRESHOLDS.minTargetPx` (44). */
  readonly minPx?: number;
  /** Limit the audit to elements inside this CSS selector. Default: the whole document. */
  readonly within?: string;
  /** Audit only when the page reports a coarse pointer. Default false: the rule is every modality. */
  readonly coarseOnly?: boolean;
}

export interface TouchTargetViolation {
  readonly selector: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export interface TouchTargetReport {
  readonly minPx: number;
  /** Interactive, visible elements that were measured. */
  readonly checked: number;
  /** Zero when the audit was skipped by `coarseOnly` on a fine-pointer page. */
  readonly violations: readonly TouchTargetViolation[];
  readonly skipped: boolean;
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="slider"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Measure every visible interactive element. Runs in the page, so it is
 * self-contained: no imports, no module-scope references.
 */
export function auditTouchTargets(args: {
  minPx: number;
  within: string | null;
  coarseOnly: boolean;
  selector: string;
}): TouchTargetReport {
  if (args.coarseOnly && !window.matchMedia('(pointer: coarse)').matches) {
    return { minPx: args.minPx, checked: 0, violations: [], skipped: true };
  }
  const root = args.within ? document.querySelector(args.within) : document;
  if (!root) return { minPx: args.minPx, checked: 0, violations: [], skipped: false };
  const elements = Array.from(root.querySelectorAll<HTMLElement>(args.selector));

  const describe = (element: HTMLElement): string => {
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}#${element.id}`;
    const testId = element.getAttribute('data-testid');
    if (testId) return `${tag}[data-testid="${testId}"]`;
    const parent = element.parentElement;
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName,
    );
    const index = siblings.indexOf(element) + 1;
    return `${describe(parent)} > ${tag}:nth-of-type(${index})`;
  };

  const labelOf = (element: HTMLElement): string =>
    (
      element.getAttribute('aria-label') ??
      element.getAttribute('title') ??
      element.textContent ??
      ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60);

  const violations: TouchTargetViolation[] = [];
  let checked = 0;
  for (const element of elements) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('disabled'))
      continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    checked += 1;
    if (rect.width + 0.5 < args.minPx || rect.height + 0.5 < args.minPx) {
      violations.push({
        selector: describe(element),
        label: labelOf(element),
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      });
    }
  }
  return { minPx: args.minPx, checked, violations, skipped: false };
}

/** Audit the page's interactive elements against the minimum target size. */
export function touchTargets(
  page: Page,
  options: TouchTargetOptions = {},
): Promise<TouchTargetReport> {
  return page.evaluate(auditTouchTargets, {
    minPx: options.minPx ?? THRESHOLDS.minTargetPx,
    within: options.within ?? null,
    coarseOnly: options.coarseOnly ?? false,
    selector: INTERACTIVE_SELECTOR,
  });
}

/** Format violations one per line, for assertion messages and gate reports. */
export function formatViolations(report: TouchTargetReport): string {
  return report.violations
    .map(
      (violation) =>
        `${violation.selector} (${violation.width}×${violation.height} px${violation.label ? `, "${violation.label}"` : ''})`,
    )
    .join('\n');
}

/** Assert no interactive element is under the minimum size. */
export async function expectTouchTargets(
  page: Page,
  options: TouchTargetOptions = {},
): Promise<TouchTargetReport> {
  const report = await touchTargets(page, options);
  expect(
    report.violations,
    `${report.violations.length} interactive element(s) under ${report.minPx}×${report.minPx} px:\n${formatViolations(report)}`,
  ).toEqual([]);
  return report;
}

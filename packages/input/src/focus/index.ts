import type { Direction } from '../contract/primitives.js';

/**
 * Spatial focus navigation for the d-pad.
 *
 * A TV remote has four keys and no cursor, so "next" has to mean *the thing
 * that looks next in that direction*, not the next node in the DOM. This is
 * the whole of that decision, kept as a pure function over rectangles so it can
 * be unit-tested without a browser and reused by the gamepad (PAP-158), roving
 * tabindex (PAP-152) and the canvas.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FocusCandidate<T = unknown> {
  /** Whatever the caller wants back: an element, an id, a row index. */
  readonly target: T;
  readonly rect: Rect;
  /** Skipped by navigation but still counted for grouping. */
  readonly disabled?: boolean;
  /**
   * Candidates in the same group are preferred over candidates outside it when
   * the scores are close, which keeps focus inside a toolbar or a grid row.
   */
  readonly group?: string;
}

export interface SpatialOptions {
  /**
   * How much a mis-aligned candidate is punished, relative to its distance
   * along the direction of travel. Higher keeps focus in straight lines.
   */
  readonly crossAxisWeight?: number;
  /** Same-group bonus, as a fraction of the score. */
  readonly groupBonus?: number;
  /**
   * Candidates that overlap the origin's cross-axis projection are always
   * preferred over ones that do not, however close the latter are. This is
   * what makes a grid feel like a grid.
   */
  readonly preferOverlap?: boolean;
  /**
   * Group of the origin, when the origin is not itself in `candidates` (the
   * navigator knows it; a bare call over rectangles usually does not).
   */
  readonly originGroup?: string;
}

const DEFAULTS = {
  crossAxisWeight: 2,
  groupBonus: 0.25,
  preferOverlap: true,
} as const;

function centre(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Near edge of `rect` along the direction of travel, measured from `origin`. */
function travelDistance(origin: Rect, rect: Rect, direction: Direction): number {
  switch (direction) {
    case 'up':
      return origin.y - (rect.y + rect.height);
    case 'down':
      return rect.y - (origin.y + origin.height);
    case 'left':
      return origin.x - (rect.x + rect.width);
    case 'right':
      return rect.x - (origin.x + origin.width);
  }
}

/** Do the two rects overlap on the axis perpendicular to the travel? */
function overlapsCrossAxis(origin: Rect, rect: Rect, direction: Direction): boolean {
  if (direction === 'up' || direction === 'down') {
    return rect.x < origin.x + origin.width && origin.x < rect.x + rect.width;
  }
  return rect.y < origin.y + origin.height && origin.y < rect.y + rect.height;
}

/** Centre-to-centre distance on the axis perpendicular to the travel. */
function crossAxisOffset(origin: Rect, rect: Rect, direction: Direction): number {
  const a = centre(origin);
  const b = centre(rect);
  return direction === 'up' || direction === 'down' ? Math.abs(a.x - b.x) : Math.abs(a.y - b.y);
}

/**
 * Pick the nearest focusable candidate in a direction.
 *
 * Scoring, in order: only candidates strictly ahead are eligible (a 1 px
 * tolerance lets touching edges count); overlapping the origin's projection
 * beats not overlapping; then the score is `travel + crossAxisWeight × offset`,
 * discounted for a candidate in the same group. Ties break on the smaller
 * travel distance, then on document order, so the result is deterministic and
 * a fixture can pin it.
 */
export function nearestInDirection<T>(
  origin: Rect,
  candidates: readonly FocusCandidate<T>[],
  direction: Direction,
  options: SpatialOptions = {},
): FocusCandidate<T> | null {
  const crossAxisWeight = options.crossAxisWeight ?? DEFAULTS.crossAxisWeight;
  const groupBonus = options.groupBonus ?? DEFAULTS.groupBonus;
  const preferOverlap = options.preferOverlap ?? DEFAULTS.preferOverlap;
  const originGroup =
    options.originGroup ?? candidates.find((candidate) => candidate.rect === origin)?.group;

  let best: FocusCandidate<T> | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestOverlap = false;
  let bestTravel = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.disabled === true) continue;
    if (candidate.rect === origin) continue;

    const travel = travelDistance(origin, candidate.rect, direction);
    // A 1 px tolerance: adjacent cells in a table share an edge exactly.
    if (travel < -1) continue;

    const overlap = overlapsCrossAxis(origin, candidate.rect, direction);
    const offset = crossAxisOffset(origin, candidate.rect, direction);
    const raw = Math.max(0, travel) + crossAxisWeight * offset;
    const sameGroup = originGroup !== undefined && candidate.group === originGroup;
    const score = sameGroup ? raw * (1 - groupBonus) : raw;

    const better =
      preferOverlap && overlap !== bestOverlap
        ? overlap
        : score < bestScore || (score === bestScore && travel < bestTravel);

    if (better) {
      best = candidate;
      bestScore = score;
      bestOverlap = overlap;
      bestTravel = travel;
    }
  }

  return best;
}

/**
 * A stateful navigator over a candidate set that may change between moves
 * (virtualised lists, a canvas that pans). `getCandidates` is called on every
 * move, so the caller never has to invalidate anything.
 */
export interface SpatialNavigator<T> {
  /** Move focus; returns the new target, or null when there is nowhere to go. */
  move(direction: Direction): T | null;
  /** Set focus without moving, e.g. after a pointer click. */
  focus(target: T | null): void;
  current(): T | null;
}

export function createSpatialNavigator<T>(
  getCandidates: () => readonly FocusCandidate<T>[],
  // A getter is accepted as well as a value so a caller whose options change
  // between moves (a React hook, a settings panel) needs no re-creation.
  options: SpatialOptions | (() => SpatialOptions) = {},
): SpatialNavigator<T> {
  const readOptions = (): SpatialOptions => (typeof options === 'function' ? options() : options);
  let current: T | null = null;

  return {
    move(direction) {
      const candidates = getCandidates();
      const active = candidates.find((candidate) => candidate.target === current);
      // Nothing focused yet: enter from the edge the direction comes from, so
      // pressing `down` first lands on the topmost candidate.
      const origin = active?.rect ?? entryRect(candidates, direction);
      if (origin === null) return null;

      const next = nearestInDirection(origin, candidates, direction, {
        ...readOptions(),
        ...(active?.group === undefined ? {} : { originGroup: active.group }),
      });
      if (next === null) return null;
      current = next.target;
      return current;
    },
    focus(target) {
      current = target;
    },
    current: () => current,
  };
}

/**
 * A zero-size rect just outside the candidate bounds, centred on that edge, so
 * the first press enters where the eye is: `down` lands on the top-middle
 * candidate, `right` on the left-middle one.
 */
function entryRect<T>(candidates: readonly FocusCandidate<T>[], direction: Direction): Rect | null {
  const live = candidates.filter((candidate) => candidate.disabled !== true);
  const first = live[0];
  if (first === undefined) return null;

  let minX = first.rect.x;
  let minY = first.rect.y;
  let maxX = first.rect.x + first.rect.width;
  let maxY = first.rect.y + first.rect.height;
  for (const { rect } of live) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  switch (direction) {
    case 'down':
      return { x: centreX, y: minY - 1, width: 0, height: 0 };
    case 'up':
      return { x: centreX, y: maxY + 1, width: 0, height: 0 };
    case 'right':
      return { x: minX - 1, y: centreY, width: 0, height: 0 };
    case 'left':
      return { x: maxX + 1, y: centreY, width: 0, height: 0 };
  }
}

/** Arrow-key codes → a direction, so keyboard and d-pad share one path. */
export const ARROW_DIRECTIONS: Readonly<Record<string, Direction>> = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
});

// smoke.json — the per-stack config that tells compose-smoke how to probe a
// compose file. Lives beside its `compose.yaml`/`compose.yml`. See ../README.md
// for the grammar. Hand-rolled validator, shaped like a Zod `safeParse` result
// ({ success, data } | { success, error: { issues } }) so a real `zod` schema
// can replace this module later without touching any caller (see README
// "Why not zod").

/** @typedef {{ healthcheck: string, warmupSeconds: number, load: string|null, ramBudgetMb: number|null, skipCi: string|null }} SmokeConfig */

const DEFAULT_WARMUP_SECONDS = 60;

function issue(path, message) {
  return { path, message };
}

/**
 * Validates a parsed `smoke.json` object and fills in defaults.
 * Mirrors zod's `safeParse`: never throws.
 * @param {unknown} input
 * @returns {{ success: true, data: SmokeConfig } | { success: false, error: { issues: {path: string, message: string}[] } }}
 */
export function validateSmokeConfig(input) {
  const issues = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, error: { issues: [issue('', 'expected an object')] } };
  }

  const obj = /** @type {Record<string, unknown>} */ (input);

  if (typeof obj.healthcheck !== 'string' || obj.healthcheck.trim() === '') {
    issues.push(issue('healthcheck', 'required, must be a non-empty string URL'));
  } else {
    try {
      // eslint-disable-next-line no-new
      new URL(obj.healthcheck);
    } catch {
      issues.push(
        issue(
          'healthcheck',
          `must be a valid absolute URL, got ${JSON.stringify(obj.healthcheck)}`,
        ),
      );
    }
  }

  let warmupSeconds = DEFAULT_WARMUP_SECONDS;
  if (obj.warmupSeconds !== undefined) {
    if (
      typeof obj.warmupSeconds !== 'number' ||
      !Number.isFinite(obj.warmupSeconds) ||
      obj.warmupSeconds < 0
    ) {
      issues.push(issue('warmupSeconds', 'must be a non-negative number of seconds'));
    } else {
      warmupSeconds = obj.warmupSeconds;
    }
  }

  let load = null;
  if (obj.load !== undefined) {
    if (typeof obj.load !== 'string' || obj.load.trim() === '') {
      issues.push(issue('load', 'must be a non-empty string path when present'));
    } else {
      load = obj.load;
    }
  }

  let ramBudgetMb = null;
  if (obj.ramBudgetMb !== undefined) {
    if (
      typeof obj.ramBudgetMb !== 'number' ||
      !Number.isFinite(obj.ramBudgetMb) ||
      obj.ramBudgetMb <= 0
    ) {
      issues.push(issue('ramBudgetMb', 'must be a positive number of megabytes when present'));
    } else {
      ramBudgetMb = obj.ramBudgetMb;
    }
  }

  let skipCi = null;
  if (obj.skipCi !== undefined) {
    if (typeof obj.skipCi !== 'string' || obj.skipCi.trim() === '') {
      issues.push(issue('skipCi', 'must be a non-empty reason string when present'));
    } else {
      skipCi = obj.skipCi;
    }
  }

  const knownKeys = new Set(['healthcheck', 'warmupSeconds', 'load', 'ramBudgetMb', 'skipCi']);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      issues.push(issue(key, `unknown field ${JSON.stringify(key)}`));
    }
  }

  if (issues.length > 0) {
    return { success: false, error: { issues } };
  }

  return {
    success: true,
    data: {
      healthcheck: /** @type {string} */ (obj.healthcheck),
      warmupSeconds,
      load,
      ramBudgetMb,
      skipCi,
    },
  };
}

/**
 * Parses raw `smoke.json` text and validates it in one step.
 * @param {string} text
 * @returns {ReturnType<typeof validateSmokeConfig>}
 */
export function parseSmokeConfig(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      success: false,
      error: {
        issues: [issue('', `invalid JSON: ${err instanceof Error ? err.message : String(err)}`)],
      },
    };
  }
  return validateSmokeConfig(parsed);
}

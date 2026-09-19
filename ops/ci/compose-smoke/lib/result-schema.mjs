// The per-stack result JSON compose-smoke uploads as an artefact
// (`compose-smoke/<name>.json`), and that PAP-296's budget-table script reads.
// Same hand-rolled-but-zod-shaped validator as smoke-config.mjs; see
// ../README.md "Why not zod".

/** @typedef {'ok'|'unhealthy'|'timeout'|'skipped'} SmokeStatus */
/** @typedef {{ name: string, startedMs: number, healthy: boolean, ramIdleMb: number|null, ramLoadedMb: number|null, cpuPct: number|null, imageSizeMb: number|null, status: SmokeStatus }} SmokeResult */

export const SMOKE_STATUSES = /** @type {const} */ (['ok', 'unhealthy', 'timeout', 'skipped']);

function issue(path, message) {
  return { path, message };
}

function isFiniteNumberOrNull(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * @param {unknown} input
 * @returns {{ success: true, data: SmokeResult } | { success: false, error: { issues: {path: string, message: string}[] } }}
 */
export function validateResult(input) {
  const issues = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, error: { issues: [issue('', 'expected an object')] } };
  }
  const obj = /** @type {Record<string, unknown>} */ (input);

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    issues.push(issue('name', 'required, must be a non-empty string'));
  }

  if (typeof obj.startedMs !== 'number' || !Number.isFinite(obj.startedMs) || obj.startedMs < 0) {
    issues.push(issue('startedMs', 'required, must be a non-negative number (epoch ms)'));
  }

  if (typeof obj.healthy !== 'boolean') {
    issues.push(issue('healthy', 'required, must be a boolean'));
  }

  for (const key of ['ramIdleMb', 'ramLoadedMb', 'cpuPct', 'imageSizeMb']) {
    if (!(key in obj)) {
      issues.push(issue(key, 'required (use null when not measured)'));
    } else if (!isFiniteNumberOrNull(obj[key])) {
      issues.push(issue(key, 'must be a finite number or null'));
    }
  }

  if (typeof obj.status !== 'string' || !SMOKE_STATUSES.includes(/** @type {any} */ (obj.status))) {
    issues.push(issue('status', `must be one of ${SMOKE_STATUSES.join(', ')}`));
  }

  const knownKeys = new Set([
    'name',
    'startedMs',
    'healthy',
    'ramIdleMb',
    'ramLoadedMb',
    'cpuPct',
    'imageSizeMb',
    'status',
  ]);
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
    data: /** @type {SmokeResult} */ ({
      name: obj.name,
      startedMs: obj.startedMs,
      healthy: obj.healthy,
      ramIdleMb: obj.ramIdleMb,
      ramLoadedMb: obj.ramLoadedMb,
      cpuPct: obj.cpuPct,
      imageSizeMb: obj.imageSizeMb,
      status: obj.status,
    }),
  };
}

/**
 * @param {string} text
 * @returns {ReturnType<typeof validateResult>}
 */
export function parseResult(text) {
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
  return validateResult(parsed);
}

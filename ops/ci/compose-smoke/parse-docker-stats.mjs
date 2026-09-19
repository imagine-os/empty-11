// Parses one line of `docker stats --no-stream --format '{{json .}}'` output
// into the numbers the result JSON needs. Docker's `MemUsage` field is a
// human string like "123.4MiB / 1.9GiB" and `CPUPerc` is "0.42%"; both are
// pure-string parsing, testable without a daemon.

const UNIT_TO_MB = {
  b: 1 / (1024 * 1024),
  kb: 1 / 1024,
  kib: 1 / 1024,
  mb: 1,
  mib: 1,
  gb: 1024,
  gib: 1024,
  tb: 1024 * 1024,
  tib: 1024 * 1024,
};

/**
 * @param {string} raw e.g. "123.4MiB"
 * @returns {number} megabytes
 */
export function parseMemAmountToMb(raw) {
  const match = raw.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) {
    throw new Error(`cannot parse memory amount: ${JSON.stringify(raw)}`);
  }
  const [, amountStr, unitRaw] = match;
  const unit = unitRaw.toLowerCase();
  if (!(unit in UNIT_TO_MB)) {
    throw new Error(`unknown memory unit: ${JSON.stringify(unitRaw)}`);
  }
  return Number(amountStr) * UNIT_TO_MB[unit];
}

/**
 * @param {string} raw e.g. "0.42%"
 * @returns {number}
 */
export function parsePercent(raw) {
  const match = raw.trim().match(/^([\d.]+)%?$/);
  if (!match) {
    throw new Error(`cannot parse percentage: ${JSON.stringify(raw)}`);
  }
  return Number(match[1]);
}

/**
 * @param {string} line one JSON object line from `docker stats --format '{{json .}}'`
 * @returns {{ name: string, memMb: number, cpuPct: number }}
 */
export function parseStatsLine(line) {
  const obj = JSON.parse(line);
  const [usedRaw] = String(obj.MemUsage).split('/');
  return {
    name: obj.Name ?? obj.Container ?? '',
    memMb: parseMemAmountToMb(usedRaw),
    cpuPct: parsePercent(String(obj.CPUPerc)),
  };
}

/**
 * Aggregates several containers' stats lines into one stack-level reading:
 * memory summed (every container's RSS counts toward the stack's footprint),
 * CPU summed (percent of a core, same convention as `docker stats`).
 * @param {string[]} lines newline-delimited JSON, one per container
 * @returns {{ memMb: number, cpuPct: number, perContainer: ReturnType<typeof parseStatsLine>[] }}
 */
export function aggregateStats(lines) {
  const perContainer = lines.filter((l) => l.trim() !== '').map(parseStatsLine);
  return {
    memMb: Math.round(perContainer.reduce((sum, c) => sum + c.memMb, 0) * 100) / 100,
    cpuPct: Math.round(perContainer.reduce((sum, c) => sum + c.cpuPct, 0) * 100) / 100,
    perContainer,
  };
}

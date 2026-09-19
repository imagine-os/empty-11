import type { Summary } from './schema.ts';

function fmt(n: number | null, digits = 1): string {
  return n === null ? 'n/m' : n.toFixed(digits);
}

function fmtBytes(n: number | null): string {
  return n === null ? 'n/m' : `${(n / 1024).toFixed(1)} KB`;
}

/** Renders `results.md`: one table, `n/m` (not measured) wherever a field is `null`. */
export function renderMarkdown(summary: Summary): string {
  const lines: string[] = [];
  lines.push(`# ${summary.spike} — spike results`);
  lines.push('');
  lines.push(`Measured ${summary.measuredAt}. ${summary.method}`);
  lines.push('');
  lines.push(
    '| Candidate | Version | Status | Bundle (own) | Bundle (baseline) | Wall time mean | Wall time p5 | Stable | Mean FPS | p5 FPS | Long frames |',
  );
  lines.push('| -- | -- | -- | --: | --: | --: | --: | -- | --: | --: | --: |');
  for (const c of summary.candidates) {
    lines.push(
      [
        c.lib,
        c.version,
        c.status,
        fmtBytes(c.bundle.gzipBytes),
        fmtBytes(c.bundle.sharedBaselineGzipBytes),
        `${fmt(c.runtime.wallTimeMeanMs)} ms`,
        `${fmt(c.runtime.wallTimeP5Ms)} ms`,
        c.runtime.stable === null ? 'n/m' : c.runtime.stable ? 'yes' : 'no',
        fmt(c.browser.meanFps),
        fmt(c.browser.p5Fps),
        c.browser.longFrames === null ? 'n/m' : String(c.browser.longFrames),
      ]
        .map((cell) => `| ${cell} `)
        .join('')
        .concat('|'),
    );
  }
  lines.push('');
  lines.push('`n/m` = not measured; see each candidate\'s `notMeasuredReason` fields in `results/summary.json`.');
  lines.push('');
  for (const c of summary.candidates) {
    if (c.notes.length === 0) continue;
    lines.push(`## ${c.lib} notes`);
    for (const note of c.notes) lines.push(`- ${note}`);
    lines.push('');
  }
  return lines.join('\n');
}

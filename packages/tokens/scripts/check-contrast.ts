#!/usr/bin/env tsx
/**
 * `tokens:check` -- WCAG 2.x contrast assertions over every theme's
 * resolved colour roles (DoD, PAP-66): `fg.default` on every `bg.*` at
 * 4.5:1 and `fg.muted` at 3:1, plus the status and on-accent pairs a
 * component actually renders (status text on its own tinted background,
 * and `fg.on-accent` on the accent button fill).
 */
import { writeFileSync } from 'node:fs';
import { parse, wcagContrast } from 'culori';
import type { ResolvedTheme } from '../src/lib/theme.js';
import { resolveAllThemes } from '../src/lib/theme.js';

interface Check {
  label: string;
  fg: string;
  bg: string;
  minRatio: number;
}

const BG_ROLES = ['color.bg.canvas', 'color.bg.surface', 'color.bg.raised'];

function buildChecks(): Check[] {
  const checks: Check[] = [];
  for (const bg of BG_ROLES) {
    checks.push({ label: `fg.default on ${bg}`, fg: 'color.fg.default', bg, minRatio: 4.5 });
    checks.push({ label: `fg.muted on ${bg}`, fg: 'color.fg.muted', bg, minRatio: 3.0 });
  }
  for (const status of ['success', 'warning', 'danger', 'info']) {
    checks.push({
      label: `${status}.fg on ${status}.bg`,
      fg: `color.${status}.fg`,
      bg: `color.${status}.bg`,
      minRatio: 4.5,
    });
  }
  checks.push({
    label: 'fg.on-accent on accent.default',
    fg: 'color.fg.on-accent',
    bg: 'color.accent.default',
    minRatio: 4.5,
  });
  return checks;
}

function ratioFor(theme: ResolvedTheme, check: Check): number {
  const fgToken = theme.byPath.get(check.fg);
  const bgToken = theme.byPath.get(check.bg);
  if (!fgToken || !bgToken) {
    throw new Error(
      `${theme.theme}: missing token for check "${check.label}" (${check.fg} / ${check.bg})`,
    );
  }
  const fgColor = parse(String(fgToken.value));
  const bgColor = parse(String(bgToken.value));
  if (!fgColor || !bgColor) {
    throw new Error(`${theme.theme}: could not parse colour for "${check.label}"`);
  }
  return wcagContrast(fgColor, bgColor);
}

interface ReportRow {
  theme: string;
  label: string;
  ratio: number;
  minRatio: number;
  pass: boolean;
}

function main(): number {
  const themes = resolveAllThemes();
  const checks = buildChecks();
  let failed = false;
  const rows: string[] = [];
  const report: ReportRow[] = [];

  for (const theme of Object.values(themes)) {
    for (const check of checks) {
      const ratio = ratioFor(theme, check);
      const ok = ratio >= check.minRatio;
      if (!ok) {
        failed = true;
      }
      rows.push(
        `${ok ? 'PASS' : 'FAIL'}  ${theme.theme.padEnd(5)} ${check.label.padEnd(32)} ${ratio.toFixed(2)}:1 (need ${check.minRatio}:1)`,
      );
      report.push({
        theme: theme.theme,
        label: check.label,
        ratio,
        minRatio: check.minRatio,
        pass: ok,
      });
    }
  }

  const reportPathIndex = process.argv.indexOf('--report');
  if (reportPathIndex !== -1) {
    const reportPath = process.argv[reportPathIndex + 1];
    if (reportPath) {
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`wrote ${reportPath}\n`);
    }
  }

  process.stdout.write(`${rows.join('\n')}\n`);
  if (failed) {
    process.stderr.write(
      '\ntokens:check failed: one or more contrast pairs are below the required ratio.\n',
    );
    return 1;
  }
  process.stdout.write(
    `\ntokens:check passed (${checks.length} pairs x ${Object.keys(themes).length} themes).\n`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

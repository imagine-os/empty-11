// pnpm --filter @paperos/contract-quality calibrate <output.json> [--json]
// Prints agreement and every disagreement; exit 1 under the threshold, 2 on bad input.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calibrate, formatReport, ReviewerOutputSchema } from '../src/calibrate.js';
import { loadCalibrationCases } from './load-calibration.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: calibrate <output.json> [--json]');
  process.exit(2);
}
const parsed = ReviewerOutputSchema.safeParse(
  JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')),
);
if (!parsed.success) {
  console.error('invalid reviewer output:');
  for (const issue of parsed.error.issues)
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(2);
}
const report = calibrate(loadCalibrationCases(), parsed.data);
console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
process.exit(report.pass ? 0 : 1);

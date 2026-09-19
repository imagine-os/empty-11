import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CalibrationCase, CalibrationCaseSchema } from '../src/calibrate.js';
import { CALIBRATION_DIR } from './paths.js';

export function loadCalibrationCases(dir = CALIBRATION_DIR): CalibrationCase[] {
  return readdirSync(dir)
    .filter((d) => statSync(resolve(dir, d)).isDirectory())
    .sort()
    .map((d) => {
      const expected = CalibrationCaseSchema.parse(
        JSON.parse(readFileSync(resolve(dir, d, 'expected.json'), 'utf8')),
      );
      if (expected.case !== d)
        throw new Error(`calibration/${d}/expected.json names case ${expected.case}`);
      statSync(resolve(dir, d, 'input.md'));
      return expected;
    });
}

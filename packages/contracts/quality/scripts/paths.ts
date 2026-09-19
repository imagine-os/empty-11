import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Monorepo root: packages/contracts/quality -> ../../.. */
export const REPO_ROOT = resolve(PKG_ROOT, '../../..');
export const DOCS_RUBRICS = resolve(REPO_ROOT, 'docs/quality/rubrics');
export const CALIBRATION_DIR = resolve(DOCS_RUBRICS, 'calibration');
export const SCHEMAS_DIR = resolve(PKG_ROOT, 'schemas');
export const DOCS_QUALITY = resolve(REPO_ROOT, 'docs/quality');
/** Hand-written page with one generated block (`generateGatesTables`). */
export const GATES_DOC = resolve(DOCS_QUALITY, 'gates.md');

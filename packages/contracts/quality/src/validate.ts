// `validateArtifact(kind, json)`: the one validation entry point every gate job, the
// orchestrator and the digest call (PAP-239 "Interface contract").
import type { z } from 'zod';
import {
  GATE_REPORT_SCHEMAS,
  type GateKind,
  type GateReportOf,
  isGateKind,
  kindFromFileName,
} from './gates/index.js';
import { SUPPORTED_REPORT_VERSIONS } from './gates/report.js';

export interface ValidationIssue {
  /** Dotted path into the document, `findings.0.severity`; empty for the root. */
  path: string;
  message: string;
}

export type ValidationResult<K extends GateKind = GateKind> =
  | { ok: true; kind: K; report: GateReportOf<K> }
  | { ok: false; kind: K | undefined; issues: ValidationIssue[] };

function issuesOf(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `kind` a document claims, when it is a registered one. */
export function detectKind(json: unknown): GateKind | undefined {
  if (!isRecord(json)) return undefined;
  return isGateKind(json.kind) ? json.kind : undefined;
}

/**
 * Validate one artifact. `kind` is the expected kind (from the file name, `kindFromFileName`)
 * or `'auto'` to trust the document's own `kind`. Never throws on bad input: the result
 * carries every issue with its path, which is what the CLI prints and CI annotates.
 */
export function validateArtifact<K extends GateKind>(
  kind: K | 'auto',
  json: unknown,
): ValidationResult<K> {
  const expected = kind === 'auto' ? (detectKind(json) as K | undefined) : kind;
  if (expected === undefined) {
    const claimed = isRecord(json) ? json.kind : undefined;
    return {
      ok: false,
      kind: undefined,
      issues: [
        {
          path: 'kind',
          message:
            claimed === undefined
              ? 'document has no kind'
              : `unknown artifact kind ${JSON.stringify(claimed)}`,
        },
      ],
    };
  }
  if (isRecord(json) && json.version !== undefined && !isSupportedVersion(json.version)) {
    return {
      ok: false,
      kind: expected,
      issues: [
        {
          path: 'version',
          message: `unsupported report version ${JSON.stringify(json.version)}; readers exist for ${SUPPORTED_REPORT_VERSIONS.join(', ')}`,
        },
      ],
    };
  }
  const result = GATE_REPORT_SCHEMAS[expected].safeParse(json);
  if (!result.success) return { ok: false, kind: expected, issues: issuesOf(result.error) };
  return { ok: true, kind: expected, report: result.data as GateReportOf<K> };
}

/** Throwing form for producers: returns the parsed report or throws with the issues listed. */
export function parseArtifact<K extends GateKind>(kind: K, json: unknown): GateReportOf<K> {
  const result = validateArtifact(kind, json);
  if (result.ok) return result.report;
  throw new Error(`invalid ${kind} artifact:\n${formatIssues(result.issues).join('\n')}`);
}

/**
 * Read a report from a file name and its contents: the kind comes from the name
 * (`reports/visual.json`), and an older `version` is upgraded by the reader kept for it.
 * Today only version 1 exists; a bump adds `upgraders[1]` here and keeps it for 30 days.
 */
export function readGateReport(fileName: string, json: unknown): ValidationResult {
  const kind = kindFromFileName(fileName);
  if (kind === undefined) {
    return {
      ok: false,
      kind: undefined,
      issues: [{ path: '', message: `file name ${fileName} is not a registered artifact` }],
    };
  }
  return validateArtifact(kind, upgrade(json));
}

/** Readers for previous versions, keyed by the version they read. Empty while v1 is current. */
const upgraders: Record<number, (json: Record<string, unknown>) => unknown> = {};

function upgrade(json: unknown): unknown {
  if (!isRecord(json) || typeof json.version !== 'number') return json;
  const up = upgraders[json.version];
  return up ? up(json) : json;
}

export function isSupportedVersion(version: unknown): boolean {
  return (SUPPORTED_REPORT_VERSIONS as readonly number[]).includes(version as number);
}

export function formatIssues(issues: readonly ValidationIssue[]): string[] {
  return issues.map((i) => `  ${i.path || '(root)'}: ${i.message}`);
}

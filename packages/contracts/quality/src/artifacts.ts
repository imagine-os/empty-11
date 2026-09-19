// Artifact references, path conventions and the URL form (PAP-239 "ArtifactRef").
// A gate writes everything under `reports/` in its run; a reference names a file by its
// path relative to that folder and, when the file was published, its URL.
import { z } from 'zod';

/** Folder every gate writes into, relative to the repository root of the run. */
export const REPORTS_DIR = 'reports';

export const ARTIFACT_KINDS = ['screenshot', 'video', 'report', 'log', 'sarif'] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export const ArtifactKindSchema = z.enum(ARTIFACT_KINDS);

/**
 * Path convention: relative to `reports/`, forward slashes, no leading slash, no `.`
 * or `..` segments, no whitespace or backslashes. `gate1.json`, `visual/sheets/home.png`,
 * `gate1/lint.log` are valid; `/tmp/x.png`, `../secrets`, `a b.png` are not.
 */
export function isArtifactPath(path: string): boolean {
  if (path.length === 0 || path.length > 512) return false;
  if (/[\s\\]/.test(path)) return false;
  if (path.startsWith('/')) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export const ArtifactPathSchema = z
  .string()
  .min(1)
  .refine(
    isArtifactPath,
    'artifact path is relative to reports/, forward slashes, no . or .. segments',
  );

export const ArtifactRefSchema = z
  .object({
    kind: ArtifactKindSchema,
    /** Relative to `reports/` in the run. */
    path: ArtifactPathSchema,
    /** Public URL when the file was published (Pages); omitted when it only exists in the run artifact. */
    url: z.url().optional(),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/, 'sha256 is 64 lowercase hex chars')
      .optional(),
    /** When the URL stops resolving (signed video URLs, MinIO lifecycle). */
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

/**
 * Where a run's artifacts are published. Contract packages never read the environment,
 * so the producer passes this in (from its workflow inputs).
 */
export type ArtifactHosting =
  /** GitHub Pages (PAP-15): `https://<pages>/pr/<n>/<path>`. */
  | { kind: 'pages'; base: string }
  /** Forgejo, or a run without Pages: every path resolves to the run artifact link. */
  | { kind: 'run-artifact'; url: string }
  /** Nothing published; `url` is omitted and `path` stays as the run-artifact reference. */
  | { kind: 'none' };

export function pagesHosting(base: string): ArtifactHosting {
  return { kind: 'pages', base: base.replace(/\/+$/, '') };
}

export function runArtifactHosting(url: string): ArtifactHosting {
  return { kind: 'run-artifact', url };
}

export const NO_HOSTING: ArtifactHosting = { kind: 'none' };

/**
 * The URL an artifact path resolves to for PR `pr`, or `undefined` when there is none
 * (no hosting, no PR number under Pages, or an invalid path). Pages form:
 * `https://<pages>/pr/<n>/<path>`; Forgejo and other run-artifact hosts return the run
 * artifact link itself, since the file lives inside the archive.
 */
export function artifactUrl(
  pr: number | undefined,
  path: string,
  hosting: ArtifactHosting,
): string | undefined {
  if (!isArtifactPath(path)) return undefined;
  switch (hosting.kind) {
    case 'pages': {
      if (pr === undefined || !Number.isInteger(pr) || pr <= 0) return undefined;
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      return `${hosting.base}/pr/${pr}/${encoded}`;
    }
    case 'run-artifact':
      return hosting.url;
    case 'none':
      return undefined;
  }
}

/**
 * GitHub Pages refuses files over 100 MB (and sites over 1 GB). A file over the limit is
 * not published: `url` is omitted and `path` remains the run-artifact reference.
 */
export const PAGES_MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Build an `ArtifactRef` with its URL filled in when the hosting and size allow it. */
export function artifactRef(
  kind: ArtifactKind,
  path: string,
  options: {
    pr?: number;
    hosting?: ArtifactHosting;
    sizeBytes?: number;
    sha256?: string;
    expiresAt?: string;
  } = {},
): ArtifactRef {
  const hosting = options.hosting ?? NO_HOSTING;
  const overPagesLimit =
    hosting.kind === 'pages' &&
    options.sizeBytes !== undefined &&
    options.sizeBytes > PAGES_MAX_FILE_BYTES;
  const url = overPagesLimit ? undefined : artifactUrl(options.pr, path, hosting);
  return ArtifactRefSchema.parse({
    kind,
    path,
    ...(url ? { url } : {}),
    ...(options.sha256 ? { sha256: options.sha256 } : {}),
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
  });
}

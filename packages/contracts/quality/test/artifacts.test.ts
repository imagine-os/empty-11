import { describe, expect, it } from 'vitest';
import {
  ArtifactRefSchema,
  artifactRef,
  artifactUrl,
  isArtifactPath,
  NO_HOSTING,
  PAGES_MAX_FILE_BYTES,
  pagesHosting,
  REPORTS_DIR,
  runArtifactHosting,
} from '../src/artifacts.js';

const pages = pagesHosting('https://imagine-os.github.io/paperos/');
const forgejo = runArtifactHosting(
  'https://git.paperos.dev/imagine-os/paperos/actions/runs/812/artifacts/reports',
);

describe('artifact paths', () => {
  it('accepts paths relative to reports/ and rejects escapes', () => {
    expect(REPORTS_DIR).toBe('reports');
    for (const ok of [
      'gate1.json',
      'visual/sheets/home.png',
      'gate1/lint.log',
      'security/gitleaks.sarif',
    ])
      expect(isArtifactPath(ok), ok).toBe(true);
    for (const bad of [
      '/tmp/x.png',
      '../secrets',
      'a/../b.png',
      './x.json',
      'a b.png',
      'a\\b.png',
      '',
      'a//b',
    ])
      expect(isArtifactPath(bad), bad).toBe(false);
  });
  it('ArtifactRef is strict and validates url, sha256 and expiresAt', () => {
    expect(ArtifactRefSchema.safeParse({ kind: 'report', path: 'gate1.json' }).success).toBe(true);
    expect(
      ArtifactRefSchema.safeParse({ kind: 'report', path: 'gate1.json', extra: 1 }).success,
    ).toBe(false);
    expect(ArtifactRefSchema.safeParse({ kind: 'sheet', path: 'x.png' }).success).toBe(false);
    expect(
      ArtifactRefSchema.safeParse({ kind: 'report', path: 'x.json', url: 'not a url' }).success,
    ).toBe(false);
    expect(
      ArtifactRefSchema.safeParse({ kind: 'report', path: 'x.json', sha256: 'abc' }).success,
    ).toBe(false);
    expect(
      ArtifactRefSchema.safeParse({
        kind: 'video',
        path: 'videos/sign-in/375-light.mp4',
        url: 'https://minio.paperos.dev/x.mp4',
        expiresAt: '2026-10-25T10:01:47.000Z',
        sha256: 'a'.repeat(64),
      }).success,
    ).toBe(true);
  });
});

describe('artifactUrl', () => {
  it('builds the GitHub Pages form https://<pages>/pr/<n>/<path>', () => {
    expect(artifactUrl(42, 'visual/sheets/customer-invoices.png', pages)).toBe(
      'https://imagine-os.github.io/paperos/pr/42/visual/sheets/customer-invoices.png',
    );
  });
  it('percent-encodes segments but keeps the slashes', () => {
    expect(
      artifactUrl(7, 'visual/staff settings/1280.png', { kind: 'pages', base: 'https://p.dev' }),
    ).toBeUndefined();
    expect(
      artifactUrl(7, 'visual/staff+settings/1280#1.png', { kind: 'pages', base: 'https://p.dev' }),
    ).toBe('https://p.dev/pr/7/visual/staff%2Bsettings/1280%231.png');
  });
  it('falls back to the run artifact link on a Forgejo-hosted PR', () => {
    expect(artifactUrl(42, 'visual/sheets/customer-invoices.png', forgejo)).toBe(
      'https://git.paperos.dev/imagine-os/paperos/actions/runs/812/artifacts/reports',
    );
  });
  it('returns undefined with no hosting, no PR number under Pages, or an invalid path', () => {
    expect(artifactUrl(42, 'gate1.json', NO_HOSTING)).toBeUndefined();
    expect(artifactUrl(undefined, 'gate1.json', pages)).toBeUndefined();
    expect(artifactUrl(0, 'gate1.json', pages)).toBeUndefined();
    expect(artifactUrl(42, '../gate1.json', pages)).toBeUndefined();
  });
});

describe('artifactRef', () => {
  it('fills the url when hosting allows and omits it over the Pages size limit', () => {
    const small = artifactRef('screenshot', 'visual/home/360-dark.png', {
      pr: 42,
      hosting: pages,
      sizeBytes: 120_000,
    });
    expect(small.url).toBe('https://imagine-os.github.io/paperos/pr/42/visual/home/360-dark.png');
    const huge = artifactRef('video', 'videos/tour/3840-light.mp4', {
      pr: 42,
      hosting: pages,
      sizeBytes: PAGES_MAX_FILE_BYTES + 1,
    });
    expect(huge.url).toBeUndefined();
    expect(huge.path).toBe('videos/tour/3840-light.mp4');
    const forge = artifactRef('video', 'videos/tour/3840-light.mp4', {
      pr: 42,
      hosting: forgejo,
      sizeBytes: PAGES_MAX_FILE_BYTES + 1,
    });
    expect(forge.url).toBe(forgejo.kind === 'run-artifact' ? forgejo.url : '');
  });
  it('throws on an invalid path', () => {
    expect(() => artifactRef('log', '/var/log/x.log')).toThrow();
  });
});

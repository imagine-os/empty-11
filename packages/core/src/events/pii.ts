/**
 * PII guard for event payloads (PAP-555, reviewed by Sentinel).
 *
 * Two layers, both driven by the static `pii.json` denylist:
 *
 * 1. **Static** — `defineTopic()` converts the payload schema to JSON Schema and rejects the
 *    topic at import time if any property name is denied. A bad topic never reaches production
 *    because the process fails to boot.
 * 2. **Runtime** — `publish()` walks the actual payload object. It catches keys that escape the
 *    schema (`z.record`, `.catchall()`, `.passthrough()`) and payloads over 64 KB.
 *
 * The denylist is static until PAP-559 derives it from Drizzle column annotations.
 */
import piiPolicy from './pii.json';

/** Hard ceiling on a serialised payload. Producers store a reference instead (Contracts section 3). */
export const MAX_PAYLOAD_BYTES = 64 * 1024;

const deniedKeys: ReadonlySet<string> = new Set(piiPolicy.deniedKeys);
const deniedSuffixes: readonly string[] = piiPolicy.deniedSuffixes;

export const piiPolicyVersion: number = piiPolicy.version;

/** Lower-case and drop separators so `first_name`, `firstName` and `First Name` all match. */
export function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-.]/g, '');
}

/** The reason a key is denied, or `undefined` when it is allowed. */
export function piiReasonFor(key: string): string | undefined {
  const normalised = normaliseKey(key);
  if (deniedKeys.has(normalised)) {
    return `'${key}' is on the PII denylist (pii.json v${piiPolicy.version})`;
  }
  for (const suffix of deniedSuffixes) {
    if (normalised.length > suffix.length && normalised.endsWith(suffix)) {
      return `'${key}' ends with the denied PII token '${suffix}' (pii.json v${piiPolicy.version})`;
    }
  }
  return undefined;
}

export function isPiiKey(key: string): boolean {
  return piiReasonFor(key) !== undefined;
}

/** Every denied key found under a JSON Schema, deepest-first, as `a.b.c` paths. */
export function findPiiInJsonSchema(schema: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) walk(child, path);
      return;
    }
    const record = node as Record<string, unknown>;
    const properties = record.properties;
    if (properties !== null && typeof properties === 'object' && !Array.isArray(properties)) {
      for (const [key, child] of Object.entries(properties as Record<string, unknown>)) {
        const childPath = path === '' ? key : `${path}.${key}`;
        const reason = piiReasonFor(key);
        if (reason !== undefined) found.push(`${childPath}: ${reason}`);
        walk(child, childPath);
      }
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'properties') continue;
      walk(child, path);
    }
  };

  walk(schema, '');
  return found;
}

/** Every denied key found in a concrete payload value, as `a.b.c` paths. */
export function findPiiInValue(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findPiiInValue(item, `${path}[${index}]`));
  }
  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path === '' ? key : `${path}.${key}`;
    const reason = piiReasonFor(key);
    if (reason !== undefined) found.push(`${childPath}: ${reason}`);
    found.push(...findPiiInValue(child, childPath));
  }
  return found;
}

/**
 * UTF-8 byte length without `TextEncoder` or `Buffer`: `@paperos/core` is pure TypeScript with
 * no DOM and no Node globals (packages/core/README.md).
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Serialised size of a payload in bytes. */
export function payloadByteLength(payload: unknown): number {
  return utf8ByteLength(JSON.stringify(payload) ?? '');
}

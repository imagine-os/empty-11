/**
 * The topic registry: `defineTopic()`, `topics()` and the `TopicMap` that gives `on()` and
 * `publish()` their payload types.
 *
 * A topic is registered at **import time**, so a duplicate, a malformed name, a payload schema
 * that cannot be expressed as JSON Schema, or a PII key in a payload all fail the process at
 * boot rather than in production (Contracts section 3: "publishing an unregistered topic fails
 * at boot").
 */
import { z } from 'zod';
import { TOPIC_NAME_MAX_LENGTH, topicNameProblem } from './envelope.js';
import {
  findPiiInJsonSchema,
  findPiiInValue,
  MAX_PAYLOAD_BYTES,
  payloadByteLength,
} from './pii.js';

/**
 * Payload types by topic name. Every catalogue module augments this interface, which is what
 * makes `on('invoice.paid', h)` infer its payload. A module that defines its own topics augments
 * it the same way:
 *
 * ```ts
 * declare module '@paperos/core/events' {
 *   interface TopicMap { 'quote.accepted': z.infer<typeof quoteAcceptedPayload> }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by the catalogue and by modules.
export interface TopicMap {}

export type TopicName = keyof TopicMap & string;
export type TopicPayload<T extends TopicName> = TopicMap[T];

export type TopicStatus = 'live' | 'placeholder';

export interface TopicOptions {
  /** Starts at 1; bumped on a breaking payload change (Contracts section 3). */
  readonly version?: number;
  /** One line, rendered into `docs/platform/events.md`. */
  readonly description: string;
  /** Issue or package that emits it. `placeholder` while that producer has not merged. */
  readonly producer: string;
  /** Issues known to subscribe, for the catalogue doc. */
  readonly consumers?: readonly string[];
  readonly status?: TopicStatus;
}

export interface TopicDefinition<N extends string = string, P = unknown> {
  readonly name: N;
  readonly version: number;
  readonly description: string;
  readonly producer: string;
  readonly consumers: readonly string[];
  readonly status: TopicStatus;
  /** Payload schema with the PII and 64 KB guards attached. */
  readonly schema: z.ZodType<P>;
  /** Generated, never hand-written (Contracts section 1). */
  readonly jsonSchema: Readonly<Record<string, unknown>>;
  /** Stable hash of `jsonSchema`; a change without a `version` bump is catalogue drift. */
  readonly schemaHash: string;
}

export class TopicRegistrationError extends Error {
  override readonly name = 'TopicRegistrationError';
}

export class UnknownTopicError extends Error {
  override readonly name = 'UnknownTopicError';
  constructor(readonly topic: string) {
    super(
      `topic '${topic}' is not registered — define it with defineTopic() in packages/core/src/events/catalogue/`,
    );
  }
}

const registry = new Map<string, TopicDefinition>();

/** Deterministic JSON: object keys sorted, so the hash only moves when the schema moves. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/** FNV-1a 64-bit over the canonical JSON — a drift fingerprint, not a security hash. */
export function schemaFingerprint(jsonSchema: unknown): string {
  const text = canonicalJson(jsonSchema);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash ^ BigInt(text.charCodeAt(i) & 0xff)) & mask;
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

function toJsonSchema(name: string, schema: z.ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  } catch (cause) {
    throw new TopicRegistrationError(
      `topic '${name}': the payload schema must be expressible as JSON Schema (payloads travel as jsonb and over the wire). ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
}

/**
 * Register a topic. Throws at import time on a bad name, a duplicate, a PII key or a schema that
 * is not JSON-representable.
 */
export function defineTopic<N extends string, S extends z.ZodType>(
  name: N,
  payloadSchema: S,
  options: TopicOptions,
): TopicDefinition<N, z.infer<S>> {
  const problem = topicNameProblem(name);
  if (problem !== undefined) throw new TopicRegistrationError(problem);

  const existing = registry.get(name);
  if (existing !== undefined) {
    throw new TopicRegistrationError(
      `topic '${name}' is already registered by ${existing.producer}; topic names are unique across the platform`,
    );
  }

  const version = options.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    throw new TopicRegistrationError(`topic '${name}': version must be a positive integer`);
  }

  const jsonSchema = toJsonSchema(name, payloadSchema);
  const piiFindings = findPiiInJsonSchema(jsonSchema);
  if (piiFindings.length > 0) {
    throw new TopicRegistrationError(
      `topic '${name}': event payloads carry ids and changed fields only — ${piiFindings.join('; ')}`,
    );
  }

  const guarded = payloadSchema.superRefine((value: unknown, ctx: z.RefinementCtx) => {
    const bytes = payloadByteLength(value);
    if (bytes > MAX_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: `payload is ${bytes} bytes, the limit is ${MAX_PAYLOAD_BYTES} — store a reference instead`,
      });
    }
    for (const finding of findPiiInValue(value)) {
      ctx.addIssue({ code: 'custom', message: finding });
    }
  }) as unknown as z.ZodType<z.infer<S>>;

  const definition: TopicDefinition<N, z.infer<S>> = Object.freeze({
    name,
    version,
    description: options.description,
    producer: options.producer,
    consumers: Object.freeze([...(options.consumers ?? [])]),
    status: options.status ?? 'placeholder',
    schema: guarded,
    jsonSchema: Object.freeze(jsonSchema),
    schemaHash: schemaFingerprint(jsonSchema),
  });

  registry.set(name, definition as TopicDefinition);
  return definition;
}

/** Every registered topic, sorted by name. */
export function topics(): readonly TopicDefinition[] {
  return [...registry.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function getTopic(name: string): TopicDefinition | undefined {
  return registry.get(name);
}

export function requireTopic(name: string): TopicDefinition {
  const topic = registry.get(name);
  if (topic === undefined) throw new UnknownTopicError(name);
  return topic;
}

export function isRegisteredTopic(name: string): boolean {
  return registry.has(name);
}

/** Test-only: drop a topic so a fixture can re-register it. Never call from production code. */
export function unregisterTopicForTests(name: string): boolean {
  return registry.delete(name);
}

export { MAX_PAYLOAD_BYTES, TOPIC_NAME_MAX_LENGTH };

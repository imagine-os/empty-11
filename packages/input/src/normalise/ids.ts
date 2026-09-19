/**
 * Event ids.
 *
 * Every InputEvent carries a UUID so it can be logged, replayed across a
 * window boundary and correlated with a telemetry row (multiplayer-ready data
 * rule). `crypto.randomUUID` is used where it exists; the fallback is a
 * counter-based UUIDv7-shaped id, which keeps ids sortable by time without
 * pulling in a dependency.
 */

let counter = 0;

/** A time-ordered, UUID-shaped event id. */
export function newEventId(now: number = Date.now()): string {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoObject?.randomUUID === 'function') return cryptoObject.randomUUID();

  counter = (counter + 1) % 0x1000;
  const timeHex = Math.floor(now).toString(16).padStart(12, '0').slice(-12);
  const seq = counter.toString(16).padStart(3, '0');
  const random = Math.floor(Math.random() * 0xffffffffffff)
    .toString(16)
    .padStart(12, '0');
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${seq}-8${random.slice(0, 3)}-${random.slice(3, 12)}${random.slice(0, 3)}`;
}

/** Deterministic ids for fixtures and tests. */
export function sequentialIds(prefix = 'evt'): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n.toString().padStart(4, '0')}`;
  };
}

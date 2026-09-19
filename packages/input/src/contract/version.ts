/**
 * Contract version of the input event abstraction.
 *
 * Bump on any shape change (Module System §3, ADR 0019). `InputEvent.contract`
 * carries it on every event so a recorded fixture, a telemetry row or a WebMCP
 * caller can tell which vocabulary produced it.
 */
export const INPUT_CONTRACT_VERSION = '0.1.0' as const;

export type InputContractVersion = typeof INPUT_CONTRACT_VERSION;

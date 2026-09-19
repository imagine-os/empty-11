import type { SpecIssue } from './issues.js';

/** Success: `value` plus the warnings raised while producing it. */
export interface Ok<T> {
  ok: true;
  value: T;
  /** Warnings only (no errors, or `ok` would be false). */
  issues: SpecIssue[];
}

/** Failure: `error` holds the errors; `issues` holds errors and warnings in source order. */
export interface Err<E> {
  ok: false;
  error: E;
  issues: SpecIssue[];
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T, issues: SpecIssue[] = []): Ok<T> {
  return { ok: true, value, issues };
}

export function err<E>(error: E, issues: SpecIssue[]): Err<E> {
  return { ok: false, error, issues };
}

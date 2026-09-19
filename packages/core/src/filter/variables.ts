import { FilterVariableError } from './errors.js';
import type { Variables, VarRef } from './schema.js';

/**
 * Resolves `{ $var: 'principal.id' }` against `variables` by dotted path.
 * An unresolved variable throws; there is no default (spec edge case).
 * `null` is a legal resolution and behaves as SQL NULL in both evaluators.
 */
export function resolveVariable(
  ref: VarRef,
  variables: Variables | undefined,
  path: string,
): unknown {
  if (variables === undefined) {
    throw new FilterVariableError(
      'FILTER_VARIABLE_UNRESOLVED',
      ref.$var,
      path,
      `variable "${ref.$var}" cannot be resolved: no variables were given`,
    );
  }
  let current: unknown = variables;
  for (const segment of ref.$var.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      throw new FilterVariableError(
        'FILTER_VARIABLE_UNRESOLVED',
        ref.$var,
        path,
        `variable "${ref.$var}" is not defined`,
      );
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === undefined) {
    throw new FilterVariableError(
      'FILTER_VARIABLE_UNRESOLVED',
      ref.$var,
      path,
      `variable "${ref.$var}" is not defined`,
    );
  }
  return current;
}

/**
 * Error types of the filter grammar. Every failure names the path of the node it
 * refers to (`children.0.children.2`), so a filter builder can highlight the
 * offending row and an API can return `details: { path, issue }[]` (Contracts §4).
 */

export type FilterErrorCode =
  | 'FILTER_INVALID'
  | 'FILTER_UNKNOWN_FIELD'
  | 'FILTER_UNKNOWN_COLUMN'
  | 'FILTER_VARIABLE_UNRESOLVED'
  | 'FILTER_VARIABLE_TYPE'
  | 'FILTER_ENCODING'
  | 'FILTER_VERSION';

export interface FilterIssue {
  /** Dotted path from the root of the tree, `''` for the root itself. */
  readonly path: string;
  readonly message: string;
  /** Closest known names when the issue is an unknown field. */
  readonly suggestions?: readonly string[] | undefined;
}

export class FilterError extends Error {
  readonly code: FilterErrorCode;

  constructor(code: FilterErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FilterError';
    this.code = code;
  }
}

/** Thrown by `parseFilter` and by both evaluators when a tree is not valid for a `FieldSchema`. */
export class FilterValidationError extends FilterError {
  readonly issues: readonly FilterIssue[];

  constructor(issues: readonly FilterIssue[]) {
    const first = issues[0];
    const summary = first
      ? `${first.path === '' ? 'filter' : `filter at ${first.path}`}: ${first.message}`
      : 'filter is invalid';
    const rest = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
    super('FILTER_INVALID', `${summary}${rest}`);
    this.name = 'FilterValidationError';
    this.issues = issues;
  }
}

/** Thrown when a `{ $var }` reference cannot be resolved or resolves to the wrong shape. Never defaults. */
export class FilterVariableError extends FilterError {
  readonly variable: string;
  readonly path: string;

  constructor(
    code: 'FILTER_VARIABLE_UNRESOLVED' | 'FILTER_VARIABLE_TYPE',
    variable: string,
    path: string,
    message: string,
  ) {
    super(code, message);
    this.name = 'FilterVariableError';
    this.variable = variable;
    this.path = path;
  }
}

export function joinPath(segments: readonly (string | number)[]): string {
  return segments.map(String).join('.');
}

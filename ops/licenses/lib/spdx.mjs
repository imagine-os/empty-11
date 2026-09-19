/**
 * A small SPDX licence-expression parser and tier evaluator (PAP-211).
 *
 * Grammar (SPDX 2.3, the part npm and crates.io actually use):
 *
 *   expression := compound
 *   compound   := or-expr
 *   or-expr    := and-expr ( "OR" and-expr )*
 *   and-expr   := unary ( "AND" unary )*
 *   unary      := "(" compound ")" | licence
 *   licence    := ID [ "+" ] [ "WITH" ID ]
 *
 * Written here rather than pulled from `spdx-expression-parse` on purpose: the
 * gate must run with no node_modules (see lib/yaml-lite.mjs) and adding a root
 * dependency would touch `package.json` and the lockfile, which belong to
 * PAP-13. The grammar is 40 lines; the dependency is not worth the collision.
 *
 * Two non-SPDX strings are normalised into ids the policy can tier, because npm
 * packages really do publish them:
 *   "SEE LICENSE IN <file>"  -> SEE-LICENSE-IN   (a bespoke text a human reads)
 *   "UNLICENSED" / missing   -> UNLICENSED / NONE
 */

export const TIER_ORDER = ['allow', 'review', 'deny'];

/** `allow` < `review` < `deny`. Higher rank is stricter. */
export function rank(tier) {
  const index = TIER_ORDER.indexOf(tier);
  return index === -1 ? TIER_ORDER.length : index;
}

export function strictest(a, b) {
  return rank(a) >= rank(b) ? a : b;
}

export function mostPermissive(a, b) {
  return rank(a) <= rank(b) ? a : b;
}

/** Fold the shapes npm and cargo publish into something SPDX-shaped. */
export function normalizeExpression(raw) {
  if (raw === null || raw === undefined) return 'NONE';
  const text = String(raw).trim();
  if (text === '') return 'NONE';
  if (/^see\s+licen[cs]e\s+in\b/i.test(text)) return 'SEE-LICENSE-IN';
  if (/^unlicensed$/i.test(text)) return 'UNLICENSED';
  if (/^unknown$/i.test(text)) return 'UNKNOWN';
  if (/^licenseref-/i.test(text)) return text;
  return text;
}

function tokenize(text) {
  const tokens = [];
  const pattern = /\(|\)|[A-Za-z0-9.\-+_]+/g;
  let match = pattern.exec(text);
  while (match !== null) {
    tokens.push(match[0]);
    match = pattern.exec(text);
  }
  return tokens;
}

class Parser {
  constructor(tokens, source) {
    this.tokens = tokens;
    this.index = 0;
    this.source = source;
  }

  peek() {
    return this.tokens[this.index];
  }

  next() {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  isKeyword(token, word) {
    return typeof token === 'string' && token.toUpperCase() === word;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.isKeyword(this.peek(), 'OR')) {
      this.next();
      left = { type: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseUnary();
    while (this.isKeyword(this.peek(), 'AND')) {
      this.next();
      left = { type: 'and', left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    const token = this.next();
    if (token === undefined) throw new Error(`incomplete SPDX expression: ${this.source}`);
    if (token === '(') {
      const inner = this.parseOr();
      if (this.next() !== ')') throw new Error(`unbalanced parentheses: ${this.source}`);
      return inner;
    }
    if (token === ')') throw new Error(`unexpected ")": ${this.source}`);
    let id = token;
    let plus = false;
    if (id.endsWith('+')) {
      id = id.slice(0, -1);
      plus = true;
    }
    let exception = null;
    if (this.isKeyword(this.peek(), 'WITH')) {
      this.next();
      exception = this.next();
      if (exception === undefined) throw new Error(`"WITH" with no exception: ${this.source}`);
    }
    return { type: 'license', id, plus, exception };
  }
}

/**
 * Parse an SPDX expression into an AST. Throws on a malformed expression; the
 * caller turns that into the policy's `unknownTier`, never into a pass.
 */
export function parseExpression(raw) {
  const normalized = normalizeExpression(raw);
  const tokens = tokenize(normalized);
  if (tokens.length === 0) return { type: 'license', id: 'NONE', plus: false, exception: null };
  const parser = new Parser(tokens, normalized);
  const ast = parser.parseOr();
  if (parser.index !== tokens.length)
    throw new Error(`trailing tokens in SPDX expression: ${normalized}`);
  return ast;
}

/** Every licence id mentioned in an expression, in source order. */
export function licenseIds(ast) {
  if (ast.type === 'license') return [ast.exception ? `${ast.id} WITH ${ast.exception}` : ast.id];
  return [...licenseIds(ast.left), ...licenseIds(ast.right)];
}

/**
 * Walk the AST, asking `tierOf(node)` for each leaf, and fold:
 *   OR  -> the most permissive branch wins  (`MIT OR GPL-3.0-only` is MIT)
 *   AND -> the strictest branch wins        (`GPL-3.0-only AND MIT` is the GPL)
 */
export function evaluate(ast, tierOf) {
  if (ast.type === 'license') return tierOf(ast);
  const left = evaluate(ast.left, tierOf);
  const right = evaluate(ast.right, tierOf);
  return ast.type === 'or' ? mostPermissive(left, right) : strictest(left, right);
}

/** Render an AST back to a canonical string, for the report. */
export function formatExpression(ast) {
  if (ast.type === 'license') {
    const base = ast.plus ? `${ast.id}+` : ast.id;
    return ast.exception ? `${base} WITH ${ast.exception}` : base;
  }
  const operator = ast.type === 'or' ? 'OR' : 'AND';
  return `(${formatExpression(ast.left)} ${operator} ${formatExpression(ast.right)})`;
}

/**
 * The one glob dialect the boundary map uses (PAP-305).
 *
 * `ownership.json` states its exemptions as globs because humans read them;
 * dependency-cruiser wants regular expressions. This converts one into the
 * other, and answers the same question directly for the repo tests. Supported:
 * `**` (any depth), `*` (one segment), `?` (one character). No brace expansion,
 * no character classes — if a glob needs more than this, the map is too clever.
 */

const SPECIAL = /[.+^${}()|[\]\\]/g;

/** Regular-expression source (anchored) for one glob. */
export function globToRegexSource(glob: string): string {
  let out = '';
  let index = 0;
  while (index < glob.length) {
    const rest = glob.slice(index);
    if (rest.startsWith('**/')) {
      // Alternation, not `(?:[^/]+/)*`: dependency-cruiser refuses a pattern
      // whose star height is above one (`safe-regex`), and this says the same
      // thing — nothing, or anything ending in a slash.
      out += '(?:|.*/)';
      index += 3;
    } else if (rest.startsWith('**')) {
      out += '.*';
      index += 2;
    } else if (rest.startsWith('*')) {
      out += '[^/]*';
      index += 1;
    } else if (rest.startsWith('?')) {
      out += '[^/]';
      index += 1;
    } else {
      out += (rest[0] as string).replace(SPECIAL, '\\$&');
      index += 1;
    }
  }
  return `^${out}$`;
}

/** Does `path` (repo-relative, `/` separators) match `glob`? */
export function matchesGlob(glob: string, path: string): boolean {
  return new RegExp(globToRegexSource(glob)).test(path);
}

/** Does `path` match any of `globs`? */
export function matchesAnyGlob(globs: readonly string[], path: string): boolean {
  return globs.some((glob) => matchesGlob(glob, path));
}

/**
 * yaml-lite — the deliberately small YAML subset the licence policy is written in.
 *
 * Dependency-free on purpose, for the same reason as `scripts/security-controls.ts`
 * (PAP-219): the licence gate has to run before `pnpm install` and inside a CI job
 * that may have no node_modules yet, so it cannot import a parser.
 *
 * Supported: block maps, block sequences of scalars, block sequences of maps,
 * two-space indentation, `#` comments, double-quoted and plain scalars, the empty
 * flow collections `[]` and `{}`, and the scalars `true`, `false`, `null`, `~`
 * and numbers. Everything else (anchors, aliases, non-empty flow collections,
 * multi-line scalars, multiple documents, tags) throws with a line number rather
 * than being silently misread.
 */

const INDENT = 2;

class YamlLiteError extends Error {
  constructor(line, message) {
    super(`ops/licenses yaml-lite: line ${line}: ${message}`);
    this.name = 'YamlLiteError';
    this.line = line;
  }
}

/** Strip a trailing `# comment`, respecting double quotes. */
function stripComment(raw) {
  let quoted = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === '#' && !quoted && (i === 0 || /\s/.test(raw[i - 1]))) return raw.slice(0, i);
  }
  return raw;
}

function scalar(raw, line) {
  const value = raw.trim();
  if (value === '') return null;
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2)
      throw new YamlLiteError(line, 'unterminated quote');
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  if (value.startsWith('[') || value.startsWith('{')) {
    throw new YamlLiteError(line, 'flow collections are not supported; use a block sequence');
  }
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/** Split `key: value` on the first `: ` (or a bare trailing `:`). */
function splitPair(content, line) {
  let quoted = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ':' && !quoted && (i + 1 === content.length || /\s/.test(content[i + 1]))) {
      return [content.slice(0, i).trim(), content.slice(i + 1).trim()];
    }
  }
  throw new YamlLiteError(line, `expected "key: value", got ${JSON.stringify(content)}`);
}

function readLines(text) {
  const out = [];
  text.split('\n').forEach((raw, index) => {
    const line = index + 1;
    if (raw.includes('\t')) throw new YamlLiteError(line, 'tabs are not valid indentation');
    const body = stripComment(raw);
    if (body.trim() === '') return;
    const indent = body.length - body.trimStart().length;
    if (indent % INDENT !== 0)
      throw new YamlLiteError(line, `indent ${indent} is not a multiple of ${INDENT}`);
    out.push({ indent, content: body.trim(), line });
  });
  return out;
}

function parseSequence(lines, start, indent) {
  const items = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent && lines[i].content.startsWith('-')) {
    const { content, line } = lines[i];
    const rest = content === '-' ? '' : content.slice(1).trim();
    if (content !== '-' && !content.startsWith('- ')) {
      throw new YamlLiteError(line, 'a sequence item needs a space after "-"');
    }
    i += 1;
    const childIndent = indent + INDENT;
    const hasChildren = i < lines.length && lines[i].indent >= childIndent;
    if (rest === '') {
      if (!hasChildren) throw new YamlLiteError(line, 'empty sequence item');
      const [value, next] = parseBlock(lines, i, lines[i].indent);
      items.push(value);
      i = next;
      continue;
    }
    // `- key: value` starts a map whose first key sits on the dash line.
    if (/^[^:]+:(\s|$)/.test(rest) || rest.includes(': ')) {
      let isMap = true;
      try {
        splitPair(rest, line);
      } catch {
        isMap = false;
      }
      if (isMap) {
        const synthetic = [{ indent: childIndent, content: rest, line }];
        let j = i;
        while (j < lines.length && lines[j].indent >= childIndent) {
          synthetic.push(lines[j]);
          j += 1;
        }
        const [value] = parseBlock(synthetic, 0, childIndent);
        items.push(value);
        i = j;
        continue;
      }
    }
    items.push(scalar(rest, line));
  }
  return [items, i];
}

function parseMap(lines, start, indent) {
  const map = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent) {
    if (lines[i].content.startsWith('-')) break;
    const { content, line } = lines[i];
    const [rawKey, rawValue] = splitPair(content, line);
    const key = rawKey.startsWith('"') ? rawKey.slice(1, -1) : rawKey;
    if (Object.hasOwn(map, key)) throw new YamlLiteError(line, `duplicate key "${key}"`);
    i += 1;
    if (rawValue !== '') {
      map[key] = scalar(rawValue, line);
      continue;
    }
    if (i < lines.length && lines[i].indent > indent) {
      const [value, next] = parseBlock(lines, i, lines[i].indent);
      map[key] = value;
      i = next;
    } else {
      map[key] = null;
    }
  }
  return [map, i];
}

function parseBlock(lines, start, indent) {
  if (start >= lines.length) return [null, start];
  return lines[start].content.startsWith('-')
    ? parseSequence(lines, start, indent)
    : parseMap(lines, start, indent);
}

/** Parse a yaml-lite document. Returns a plain object (or `{}` for an empty file). */
export function parseYaml(text) {
  const lines = readLines(text);
  if (lines.length === 0) return {};
  const [value, next] = parseBlock(lines, 0, lines[0].indent);
  if (next !== lines.length) {
    throw new YamlLiteError(lines[next].line, 'unexpected dedent or mixed block styles');
  }
  return value;
}

export { YamlLiteError };

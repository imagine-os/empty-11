/**
 * PaperOS commit-message rules (PAP-46).
 *
 * Contract: docs/platform/branching-and-commits.md sections 4, 4.1 and 9.
 * Consumers of the grammar: PAP-52 (release notes), PAP-133 (changelog),
 * PAP-97 (PR status back to Linear), PAP-114 (session attribution).
 *
 * Usage (once the root wiring follow-up lands):
 *   pnpm commitlint --config ops/forge/commitlint.config.cjs --edit $1   # commit-msg hook
 *   pnpm commitlint --config ops/forge/commitlint.config.cjs --from origin/main --to HEAD
 *
 * Two modes, selected by PAPEROS_COMMIT_MODE ("build-loop" | "target"):
 *   target     - the plan default. `Linear:` and `Character:` trailers are mandatory,
 *                the scope is a package or app name.
 *   build-loop - Justin's git-only autopilot mode (decision 0001). The scope may be the
 *                Linear issue key instead of the trailer, and the two session-attribution
 *                trailers the builder brief fixes are required.
 * Default: build-loop, because that is what is running. Flip it with the rulesets.
 *
 * CommonJS on purpose: this file must load before any build step or bundler exists.
 */

const MODE = process.env.PAPEROS_COMMIT_MODE === 'target' ? 'target' : 'build-loop';

/** The only nine types (Conventional Commits 1.0.0, PAP-46 spec). */
const TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'perf', 'ci', 'build'];

/** Roster lead names allowed in the `Character:` trailer. */
const CHARACTERS = [
  'Atlas',
  'Forge',
  'Iris',
  'Quill',
  'Sentinel',
  'Nova',
  'Ledger',
  'Beacon',
  'Scout',
];

/**
 * Scopes that are neither a package/app directory nor an issue key, but are legitimate:
 * `deps` (dependency bumps), `release`/`main` (release-please), `root` (root config),
 * `ops`, `docs`, `ci`.
 */
const EXTRA_SCOPES = ['deps', 'deps-dev', 'release', 'main', 'root', 'ops', 'docs', 'ci', 'forge'];

const ISSUE_KEY = /\bPAP-\d+\b/;
const SCOPE_SHAPE = /^[a-z][a-z0-9]*(?:[-/][a-z0-9]+)*$/;

/** Trailer lines of the last paragraph, as `{ key, value }`. */
function trailers(parsed) {
  const raw = String(parsed.raw || '').replace(/\r\n/g, '\n');
  const paragraphs = raw.trimEnd().split(/\n{2,}/);
  const last = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : '';
  return last
    .split('\n')
    .map((line) => /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(line.trim()))
    .filter(Boolean)
    .map((m) => ({ key: m[1], value: m[2].trim() }));
}

function trailer(parsed, key) {
  const hit = trailers(parsed).find((t) => t.key.toLowerCase() === key.toLowerCase());
  return hit ? hit.value : null;
}

const plugin = {
  rules: {
    /**
     * Every commit resolves to exactly one Linear issue: a `Linear: PAP-<n>` trailer,
     * a `PAP-<n>` scope, or a `Refs:` trailer - in that order of precedence.
     * This is the one invariant both modes share.
     */
    'paperos/linear-reference': (parsed) => {
      const fromTrailer = trailer(parsed, 'Linear');
      if (fromTrailer) {
        return [
          ISSUE_KEY.test(fromTrailer),
          `the "Linear:" trailer must be an issue key, e.g. "Linear: PAP-46" (got "${fromTrailer}")`,
        ];
      }
      const scope = parsed.scope || '';
      const refs = trailer(parsed, 'Refs') || '';
      if (ISSUE_KEY.test(scope) || ISSUE_KEY.test(refs)) return [true, ''];
      return [
        false,
        'no Linear issue: add a "Linear: PAP-<n>" trailer, or use the issue key as the scope, e.g. "docs(PAP-46): ..."',
      ];
    },

    /** `Character: <RosterName>` names the lead that owns the commit. */
    'paperos/character-trailer': (parsed) => {
      const value = trailer(parsed, 'Character');
      if (!value) {
        return [false, `add a "Character: <Name>" trailer (one of ${CHARACTERS.join(', ')})`];
      }
      return [
        CHARACTERS.includes(value),
        `"Character: ${value}" is not a roster lead (${CHARACTERS.join(', ')})`,
      ];
    },

    /** `Sub-Agent:` is optional but, when present, must not be empty. */
    'paperos/sub-agent-trailer': (parsed) => {
      const value = trailer(parsed, 'Sub-Agent');
      if (value === null) return [true, ''];
      return [value.length > 0, '"Sub-Agent:" is present but empty'];
    },

    /**
     * Build-loop mode: the builder brief fixes two session-attribution trailers on every
     * commit. Presence of the keys is checked here; their exact values are fixed by the
     * brief and are deliberately not duplicated in this repository.
     */
    'paperos/session-trailers': (parsed) => {
      const keys = trailers(parsed).map((t) => t.key.toLowerCase());
      const missing = ['co-authored-by', 'claude-session'].filter((k) => !keys.includes(k));
      return [
        missing.length === 0,
        `build-loop mode requires the session trailers fixed by the builder brief; missing: ${missing.join(', ')}`,
      ];
    },

    /** Scope is a package/app directory name, a known extra scope, or an issue key. */
    'paperos/scope-shape': (parsed) => {
      const scope = parsed.scope;
      if (!scope)
        return [false, 'a scope is required: a package or app name, or the issue key PAP-<n>'];
      if (ISSUE_KEY.test(scope)) {
        return [
          /^PAP-\d+$/.test(scope),
          `an issue-key scope must be exactly "PAP-<n>" (got "${scope}")`,
        ];
      }
      if (EXTRA_SCOPES.includes(scope)) return [true, ''];
      return [
        SCOPE_SHAPE.test(scope),
        `scope "${scope}" must be lowercase kebab-case (a package or app directory), or the issue key PAP-<n>`,
      ];
    },

    /**
     * A revert is committed as `fix(<scope>): revert ...` with a `Reverts: <sha>` trailer,
     * because `revert` is not one of the nine allowed types.
     */
    'paperos/revert-trailer': (parsed) => {
      const subject = String(parsed.subject || '');
      if (!/^revert\b/i.test(subject)) return [true, ''];
      const value = trailer(parsed, 'Reverts');
      return [
        Boolean(value) && /^[0-9a-f]{7,40}$/i.test(value),
        'a revert needs a "Reverts: <sha>" trailer (and type "fix", not "revert")',
      ];
    },
  },
};

const severity = { error: 2, warning: 1, off: 0 };

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [plugin],
  defaultIgnores: true,
  helpUrl: 'see docs/platform/branching-and-commits.md sections 4 and 9 (PAP-46)',
  rules: {
    // Conventional Commits shape (doc section 4).
    'type-enum': [severity.error, 'always', TYPES],
    'type-case': [severity.error, 'always', 'lower-case'],
    'type-empty': [severity.error, 'never'],
    'scope-empty': [severity.error, 'never'],
    'subject-empty': [severity.error, 'never'],
    'subject-full-stop': [severity.error, 'never', '.'],
    'subject-case': [severity.error, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [severity.error, 'always', 72],
    'header-max-length': [severity.error, 'always', 100],
    'body-leading-blank': [severity.error, 'always'],
    'body-max-line-length': [severity.warning, 'always', 100],
    'footer-leading-blank': [severity.error, 'always'],

    // PaperOS rules (doc sections 4 and 9).
    'paperos/linear-reference': [severity.error, 'always'],
    'paperos/scope-shape': [severity.error, 'always'],
    'paperos/sub-agent-trailer': [severity.error, 'always'],
    'paperos/revert-trailer': [severity.error, 'always'],
    'paperos/character-trailer': [MODE === 'target' ? severity.error : severity.warning, 'always'],
    'paperos/session-trailers': [MODE === 'build-loop' ? severity.error : severity.off, 'always'],
  },
};

module.exports.paperosMode = MODE;
module.exports.paperosTypes = TYPES;
module.exports.paperosCharacters = CHARACTERS;

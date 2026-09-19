export interface Candidate {
  /** Short id, used for filenames: `results/<id>.json`. */
  id: string;
  /** The library name as recorded on the scorecard (`docs/platform/library-rubric.md` section 9). */
  lib: string;
  version: string;
  /** HTML entry Vite builds/serves for bundle size and browser FPS measurement. Optional. */
  entryHtml?: string;
  /** Module exporting `runWorkload` (and optional `setup`) for Node-side wall-time/memory measurement. Optional. */
  workloadPath?: string;
  /**
   * Set when the candidate is known incompatible before measuring (e.g. a
   * React 19 peer conflict) — see PAP-753's edge case "Library incompatible
   * with React 19: candidate marked `failed: peer` in summary, not a kit
   * error." Skips measurement entirely.
   */
  expectedFailure?: 'peer';
}

export interface BenchConfig {
  /** `<PAP-n>-<slug>`, matches the spike's own directory name. */
  spike: string;
  /** One sentence, embedded verbatim in `results.md` and `results/summary.json`. */
  method: string;
  /** Shared baseline HTML entry (React + ReactDOM, nothing else) bundle size is subtracted against. */
  baselineEntryHtml: string;
  candidates: Candidate[];
}

export function defineBenchConfig(config: BenchConfig): BenchConfig {
  return config;
}

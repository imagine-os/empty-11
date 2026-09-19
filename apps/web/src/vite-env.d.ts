/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commit the bundle was built from; injected by `define` in vite.config.ts. */
  readonly VITE_GIT_SHA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * `vite-plugin-paperos-specs` (`../vite-plugin-paperos-specs.ts`) transforms
 * a `*.spec.yaml` import into its parsed, validated `PageSpec` (PAP-114).
 */
declare module '*.spec.yaml' {
  import type { PageSpec } from '@paperos/spec';

  const spec: PageSpec;
  export default spec;
}

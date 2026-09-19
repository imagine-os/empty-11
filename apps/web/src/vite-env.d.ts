/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commit the bundle was built from; injected by `define` in vite.config.ts. */
  readonly VITE_GIT_SHA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

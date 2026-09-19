import type { z } from 'zod';
import { CURRENT_SPEC_VERSION, PageSpecSchema } from '../schema/page.js';
import type { Codemod } from './codemod.js';

export { CURRENT_SPEC_VERSION };

export interface SpecVersion {
  version: number;
  schema: z.ZodType;
  /** Codemods that bring a document from `<key>` up to `version`, in order. */
  codemodsFrom: Record<number, Codemod[]>;
}

/** Version registry. v1.1 (PAP-740) appends `{ version: 1.1, codemodsFrom: { 1: [...] } }`. */
export const SPEC_VERSIONS: readonly SpecVersion[] = [
  { version: 1, schema: PageSpecSchema, codemodsFrom: {} },
];

export function findSpecVersion(version: number): SpecVersion | undefined {
  return SPEC_VERSIONS.find((entry) => entry.version === version);
}

import { z } from 'zod';
import { ActionDeclarationSchema, ActionRegistrySchema } from '../contract/action.js';
import { InputEventSchema } from '../contract/event.js';
import { InputCapabilitiesSchema, ModalityStateSchema } from '../contract/modality.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';

/**
 * JSON Schema generation.
 *
 * The Zod schemas are the single source of truth; the JSON Schema files next
 * to this module are generated from them and committed, because the consumers
 * that need them cannot run TypeScript: the WebMCP tool manifest, the voice
 * controller's vocabulary loader, the docs build and any external caller
 * validating a recorded event stream.
 *
 * Regenerate with `pnpm --filter @paperos/input gen:schemas`. The test beside
 * this file fails when a committed copy is stale, which is how the repo's
 * "never edit generated files" rule is enforced here.
 */

export interface GeneratedSchema {
  /** Path relative to `src/schema/`. */
  readonly file: string;
  readonly json: Record<string, unknown>;
}

function build(schema: z.ZodType, id: string, title: string): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'output' }) as Record<
    string,
    unknown
  >;
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://paperos.dev/schema/input/${id}.json`,
    title,
    'x-paperos-contract': INPUT_CONTRACT_VERSION,
    'x-paperos-issue': 'PAP-150',
    ...json,
  };
}

/** Every schema this package publishes as JSON Schema. */
export function generateSchemas(): GeneratedSchema[] {
  return [
    {
      file: 'input-event.schema.json',
      json: build(InputEventSchema, 'input-event', 'PaperOS InputEvent'),
    },
    {
      file: 'action.schema.json',
      json: build(ActionDeclarationSchema, 'action', 'PaperOS action declaration'),
    },
    {
      file: 'action-registry.schema.json',
      json: build(ActionRegistrySchema, 'action-registry', 'PaperOS actions registry'),
    },
    {
      file: 'input-capabilities.schema.json',
      json: build(InputCapabilitiesSchema, 'input-capabilities', 'PaperOS input capabilities'),
    },
    {
      file: 'modality-state.schema.json',
      json: build(ModalityStateSchema, 'modality-state', 'PaperOS modality state'),
    },
  ];
}

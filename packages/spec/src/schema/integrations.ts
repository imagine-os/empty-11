/**
 * `integrations` section — INTERIM shape. PAP-121 owns the connector registry,
 * mode narrowing and the `INT_*` rules; it extends this file in place.
 */
import { z } from 'zod';
import { KebabId } from './refs.js';

export const IntegrationSchema = z
  .strictObject({
    connector: KebabId.describe('Connector id from the registry: `stripe`, `linear`, `resend`.'),
    capabilities: z
      .array(
        z
          .string()
          .regex(/^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/, 'capability ids are `<area>.<verbNoun>`'),
      )
      .min(1)
      .describe('Capability ids used, `<area>.<verbNoun>`.'),
    mode: z
      .enum(['live', 'test', 'mock'])
      .default('mock')
      .describe(
        'A page may only narrow the app-level mode (`live` app allows `test` page, not the reverse).',
      ),
    onFailure: z
      .enum(['degrade', 'block', 'queue'])
      .default('degrade')
      .describe(
        '`degrade` renders `ui.integrationUnavailable`; `block` shows the error state; `queue` defers.',
      ),
  })
  .meta({ id: 'Integration', description: 'One external connector the page depends on.' });

export const IntegrationsSectionSchema = z.array(IntegrationSchema).meta({
  id: 'IntegrationsSection',
  description: 'External connectors (interim; final shape PAP-121).',
});

export type Integration = z.output<typeof IntegrationSchema>;
export type IntegrationsSection = z.output<typeof IntegrationsSectionSchema>;

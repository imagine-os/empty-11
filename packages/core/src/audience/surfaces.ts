/**
 * Surface → audience mapping. A *surface* is one of the hub's entry points (the Hub
 * pattern: website, customer app, staff and admin dashboards, docs, ops manual, dev tools,
 * testing hub, plus the agent and API surfaces). Each has a default audience — what a page
 * spec on that surface gets when its `access` section says nothing — and the audiences a
 * page there may be narrowed to. PAP-114's `PageSpec.surface` uses this enum.
 */
import { z } from 'zod';
import type { BuiltinAudienceId } from './builtin.js';

export const SURFACES = [
  'website',
  'app',
  'staff',
  'admin',
  'docs',
  'ops',
  'dev',
  'testing',
  'agent',
  'api',
] as const;

export type Surface = (typeof SURFACES)[number];

export const surfaceSchema = z.enum(SURFACES);

export type SurfaceAudience = {
  /** The audience a page on this surface is for unless its spec narrows it. */
  defaultAudience: BuiltinAudienceId;
  /** Built-in audiences a page on this surface may narrow to; apps may add their own on top. */
  allowed: readonly BuiltinAudienceId[];
  description: string;
};

export const SURFACE_AUDIENCES: Readonly<Record<Surface, SurfaceAudience>> = {
  website: {
    defaultAudience: 'everyone',
    allowed: ['everyone', 'anonymous', 'authenticated', 'customer', 'partner'],
    description: 'Public website and purchase flow.',
  },
  app: {
    defaultAudience: 'authenticated',
    allowed: [
      'authenticated',
      'customer',
      'customer-free',
      'customer-pro',
      'customer-enterprise',
      'partner',
      'agent',
    ],
    description: 'Customer app: signed-in customers and the agents acting for them.',
  },
  staff: {
    defaultAudience: 'staff',
    allowed: ['staff', 'staff-support', 'staff-finance', 'admin', 'owner', 'agent'],
    description: 'Staff dashboard.',
  },
  admin: {
    defaultAudience: 'admin',
    allowed: ['admin', 'owner'],
    description: 'Tenant administration: billing, members, roles, settings.',
  },
  docs: {
    defaultAudience: 'everyone',
    allowed: ['everyone', 'authenticated', 'customer', 'staff', 'developer'],
    description: 'Documentation.',
  },
  ops: {
    defaultAudience: 'staff',
    allowed: ['staff', 'admin', 'owner', 'developer'],
    description: 'Operations manual and runbooks.',
  },
  dev: {
    defaultAudience: 'developer',
    allowed: ['developer'],
    description: 'Developer tools: dev mode, per-page specs, actions registry, canvas.',
  },
  testing: {
    defaultAudience: 'developer',
    allowed: ['developer', 'staff'],
    description: 'Testing hub: role switcher, demo simulator, fixtures.',
  },
  agent: {
    defaultAudience: 'agent',
    allowed: ['agent', 'developer'],
    description: 'MCP / WebMCP and CLI surface used by agent characters.',
  },
  api: {
    defaultAudience: 'authenticated',
    allowed: ['authenticated', 'customer', 'staff', 'admin', 'agent', 'partner'],
    description: 'Public REST / oRPC API with session or API-key bearer auth.',
  },
};

export function defaultAudienceForSurface(surface: Surface): BuiltinAudienceId {
  return SURFACE_AUDIENCES[surface].defaultAudience;
}

/** `true` when a page on `surface` may be narrowed to the built-in `audience`. */
export function isAudienceAllowedOnSurface(surface: Surface, audience: BuiltinAudienceId): boolean {
  return SURFACE_AUDIENCES[surface].allowed.includes(audience);
}

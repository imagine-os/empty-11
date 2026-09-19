import { describe, expect, it } from 'vitest';
import * as spec from './index.js';

describe('@paperos/spec', () => {
  it('declares its package id', () => {
    expect(spec.SPEC_PACKAGE_ID).toBe('@paperos/spec');
  });

  it('exports the interface contract of PAP-114', () => {
    expect(spec.PageSpecSchema).toBeDefined();
    expect(spec.ComponentRef).toBeDefined();
    expect(spec.RouteRef).toBeDefined();
    expect(spec.parseSpec).toBeTypeOf('function');
    expect(spec.validatePageSpec).toBeTypeOf('function');
    expect(spec.migrateSpec).toBeTypeOf('function');
    expect(spec.buildPageJsonSchema).toBeTypeOf('function');
    expect(spec.pageActions).toBeTypeOf('function');
    expect(spec.CURRENT_SPEC_VERSION).toBe(1);
    expect(spec.SPEC_CODES.SPEC_ACTION_UNBOUND.severity).toBe('error');
  });
});

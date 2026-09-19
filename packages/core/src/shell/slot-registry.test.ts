import { describe, expect, it, vi } from 'vitest';
import { createSlotRegistry } from './slot-registry.js';
import type { SlotGuardContext } from './types.js';

function Component() {
  return null;
}
function OtherComponent() {
  return null;
}

describe('slot registry', () => {
  it('resolves the highest-priority registration for a slot', () => {
    const registry = createSlotRegistry();
    registry.register('sidebar', Component, { priority: 0 });
    registry.register('sidebar', OtherComponent, { priority: 5 });

    expect(registry.resolve('sidebar')?.component).toBe(OtherComponent);
  });

  it('breaks a priority tie with last-registered-wins, and warns in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = createSlotRegistry();
    registry.register('nav', Component, { priority: 1 });
    registry.register('nav', OtherComponent, { priority: 1 });

    expect(registry.resolve('nav')?.component).toBe(OtherComponent);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nav'));
    warn.mockRestore();
  });

  it('excludes a registration whose `when` guard returns false', () => {
    const registry = createSlotRegistry();
    const ctx: SlotGuardContext = { can: () => false, flag: () => false };
    registry.register('inspector', Component, { when: (c) => c.can('records.read') });

    expect(registry.resolve('inspector', ctx)).toBeUndefined();
  });

  it('includes a registration whose `when` guard returns true', () => {
    const registry = createSlotRegistry();
    const ctx: SlotGuardContext = { can: () => true, flag: () => false };
    registry.register('inspector', Component, { when: (c) => c.can('records.read') });

    expect(registry.resolve('inspector', ctx)?.component).toBe(Component);
  });

  it('unregister removes the entry and notifies subscribers', () => {
    const registry = createSlotRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const unregister = registry.register('statusbar', Component);
    expect(listener).toHaveBeenCalledTimes(1);

    unregister();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(registry.resolve('statusbar')).toBeUndefined();
  });

  it('resolveAll returns every matching registration, highest priority first', () => {
    const registry = createSlotRegistry();
    registry.register('main', Component, { priority: 1, id: 'a' });
    registry.register('main', OtherComponent, { priority: 3, id: 'b' });

    const all = registry.resolveAll('main');
    expect(all.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('re-registering the same id replaces the entry instead of accumulating', () => {
    const registry = createSlotRegistry();
    registry.register('nav', Component, { id: 'stable' });
    registry.register('nav', OtherComponent, { id: 'stable' });

    expect(registry.resolveAll('nav')).toHaveLength(1);
    expect(registry.resolve('nav')?.component).toBe(OtherComponent);
  });
});

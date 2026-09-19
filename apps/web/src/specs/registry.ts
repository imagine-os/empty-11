/**
 * Boots `@paperos/core/shell`'s spec registry with every example page spec,
 * via `vite-plugin-paperos-specs`. Imported once, for side effects, from
 * `main.tsx` before the router renders — mirrors `components/registry.ts`.
 */
import { registerSpec } from '@paperos/core/shell';
import dashboardSpec from '../../../../specs/pages/dashboard.spec.yaml';
import homeSpec from '../../../../specs/pages/home.spec.yaml';
import settingsSpec from '../../../../specs/pages/settings.spec.yaml';

registerSpec(homeSpec.meta.id, homeSpec);
registerSpec(dashboardSpec.meta.id, dashboardSpec);
registerSpec(settingsSpec.meta.id, settingsSpec);

/**
 * Boots the interim component registry (`@paperos/core/shell`'s stand-in for
 * PAP-69's real `ui.<component>` registry) with every component a
 * `specs/pages/*.spec.yaml` `components[]` entry names by `id`. Imported
 * once, for side effects, from `main.tsx` before the router renders.
 *
 * Ids use the `app.<name>` namespace `@paperos/spec`'s `ComponentRef` grammar
 * reserves for this application's own components (as opposed to `ui.*`,
 * the design-system components PAP-74 will register).
 */
import { registerComponent } from '@paperos/core/shell';
import { AppNav } from './AppNav.js';
import { DashboardFilters } from './DashboardFilters.js';
import { DashboardInspector } from './DashboardInspector.js';
import { SettingsNav } from './SettingsNav.js';

registerComponent('app.appNav', AppNav);
registerComponent('app.dashboardFilters', DashboardFilters);
registerComponent('app.dashboardInspector', DashboardInspector);
registerComponent('app.settingsNav', SettingsNav);

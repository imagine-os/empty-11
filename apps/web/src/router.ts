import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.js';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent', // Link prefetches on hover/focus (round-4 amendment).
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

// Module augmentation TanStack Router needs for typed `Link to`/`useSearch`/etc.
// This is what makes `<Link to="/nope">` fail typecheck (Definition of done).
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

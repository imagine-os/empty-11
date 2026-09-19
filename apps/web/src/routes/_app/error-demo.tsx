/**
 * Test/demo-only route: its loader always throws, so there is a real route
 * to exercise the root error boundary and its retry button against (Test
 * plan: "route throwing in loader renders the error boundary with a retry
 * button"). Not one of the three example routes and not linked from `AppNav`
 * — reached directly at `/error-demo` by the integration test and the
 * Playwright evidence pass.
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/error-demo')({
  loader: () => {
    throw new Error('paperos-shell: demo loader failure (for the error boundary retry test)');
  },
  staticData: { title: 'error.title', audience: 'authenticated' },
});

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs with `globals: false`, so Testing Library's automatic cleanup
// does not register itself. Do it explicitly.
afterEach(cleanup);

// jsdom does not implement scrollTo; TanStack Router's scroll restoration
// calls it on every navigation. A no-op stub avoids a noisy "Not
// implemented" console error in every route test.
window.scrollTo = () => {};

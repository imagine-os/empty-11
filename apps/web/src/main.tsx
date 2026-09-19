import '@paperos/core/shell/shell.css';
import './styles.css';
// Side-effect boot: registers example components and page specs before the
// router's first render (both are read synchronously by route components).
import './components/registry.js';
import './specs/registry.js';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router.js';

const container = document.getElementById('root');
if (!container) throw new Error('missing #root element');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

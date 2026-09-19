import { createRoot } from 'react-dom/client';

// Shared baseline: React + ReactDOM mounted, nothing else. Every candidate
// build's gzip size is compared against this one, so the difference is the
// library's own weight (see src/bundle.ts and docs/platform/spike-harness.md
// "Bundle method").
createRoot(document.getElementById('root')!).render(<div>spike-kit baseline</div>);

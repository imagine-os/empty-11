import { BlockNoteViewRaw, useCreateBlockNote } from '@blocknote/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/react/style.css';

// Spike finding: @blocknote/react 0.54.x no longer exports a themed
// `BlockNoteView` directly -- that now lives in the separate `@blocknote/mantine`
// or `@blocknote/shadcn` packages. `BlockNoteViewRaw` (unstyled shell) is enough
// to measure mount and bundle size here; a real integration would add one of
// those theme packages on top, which this spike's gzip number does not include.
function App() {
  const editor = useCreateBlockNote();
  return <BlockNoteViewRaw editor={editor} />;
}

createRoot(document.getElementById('root')).render(<App />);

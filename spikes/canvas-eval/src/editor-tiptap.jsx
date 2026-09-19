import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import StarterKit from '@tiptap/starter-kit';
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';

function App() {
  const ref = useRef(null);
  useEffect(() => {
    const ydoc = new Y.Doc();
    const editor = new Editor({
      element: ref.current,
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
      ],
      content: '<p>Spike: Tiptap + y-prosemirror over a local Yjs doc.</p>',
    });
    return () => editor.destroy();
  }, []);
  return <div ref={ref} />;
}

createRoot(document.getElementById('root')).render(<App />);

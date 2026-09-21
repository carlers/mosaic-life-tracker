import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { BottomSheet } from '../../src/components/ui/BottomSheet';

export function Harness() {
  const [parentOpen, setParentOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#111111] text-white p-6">
      <button type="button" onClick={() => setParentOpen(true)}>
        Open parent sheet
      </button>

      <BottomSheet
        isOpen={parentOpen}
        onClose={() => {
          setDeepOpen(false);
          setNestedOpen(false);
          setParentOpen(false);
        }}
        suspendInteraction={nestedOpen}
        title="Parent sheet"
      >
        <p>Parent content</p>
        <button type="button" onClick={() => setNestedOpen(true)}>
          Open nested sheet
        </button>
      </BottomSheet>

      <BottomSheet
        isOpen={nestedOpen}
        onClose={() => {
          setDeepOpen(false);
          setNestedOpen(false);
        }}
        suspendInteraction={deepOpen}
        title="Nested sheet"
      >
        <p>Nested content</p>
        <button type="button" onClick={() => setDeepOpen(true)}>
          Open third sheet
        </button>
      </BottomSheet>

      <BottomSheet
        isOpen={deepOpen}
        onClose={() => setDeepOpen(false)}
        title="Third sheet"
      >
        <p>Third content</p>
      </BottomSheet>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing bottom-sheet history harness root');
createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>
);

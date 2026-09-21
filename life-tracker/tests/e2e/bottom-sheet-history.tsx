import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BottomSheet } from '../../src/components/ui/BottomSheet';

export function Harness() {
  const [parentOpen, setParentOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);

  return (
    <main>
      <button type="button" onClick={() => setParentOpen(true)}>
        Open parent sheet
      </button>

      <BottomSheet
        isOpen={parentOpen}
        onClose={() => {
          setNestedOpen(false);
          setParentOpen(false);
        }}
        suspendInteraction={nestedOpen}
      >
        <p>Parent sheet</p>
        <button type="button" onClick={() => setNestedOpen(true)}>
          Open nested sheet
        </button>
      </BottomSheet>

      <BottomSheet isOpen={nestedOpen} onClose={() => setNestedOpen(false)}>
        <p>Nested sheet</p>
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

import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { MemoSheet } from '../../src/components/home/views/MemoSheet';
import { MessageActionSheet } from '../../src/components/messages/MessageActionSheet';
import type { TaskDocument, MessageDocument } from '../../src/db/schema';


// Feature wrappers intentionally clear their entity as soon as they close:
// shared BottomSheet exit must still have enough data to animate.
const memoTask = {
  id: 'task_exit_regression',
  title: 'Memo exit regression',
  memo: 'Retained memo content',
  date: '2026-10-09',
  visibility: '',
} as TaskDocument;
const message = {
  id: 'message_exit_regression',
  content: 'Message exit regression',
  taskRefTitle: '',
  isUnsent: false,
} as MessageDocument;

export function Harness() {
  const [parentOpen, setParentOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [activeMemo, setActiveMemo] = useState<TaskDocument | null>(null);
  const [activeMessage, setActiveMessage] = useState<MessageDocument | null>(null);

  return (
    <main className="min-h-screen bg-[#111111] text-white p-6">
      <button type="button" onClick={() => setParentOpen(true)}>
        Open parent sheet
      </button>
      <button type="button" onClick={() => setLockedOpen(true)}>
        Open locked sheet
      </button>
      <button type="button" onClick={() => setActiveMemo(memoTask)}>
        Open data-clearing memo
      </button>
      <button type="button" onClick={() => setActiveMessage(message)}>
        Open data-clearing message actions
      </button>

      <BottomSheet
        isOpen={lockedOpen}
        onClose={() => setLockedOpen(false)}
        isLocked
        preventDismiss
        title="Locked sheet"
      >
        <p>Locked content</p>
        <button type="button" onClick={() => setLockedOpen(false)}>
          Finish locked work
        </button>
      </BottomSheet>

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

      <MemoSheet
        isOpen={!!activeMemo}
        task={activeMemo}
        onClose={() => setActiveMemo(null)}
        onSave={() => setActiveMemo(null)}
      />
      <MessageActionSheet
        isOpen={!!activeMessage}
        message={activeMessage}
        currentUserId="user_1"
        isOwn
        onClose={() => setActiveMessage(null)}
        onReply={() => setActiveMessage(null)}
        onCopy={() => setActiveMessage(null)}
        onUnsend={() => setActiveMessage(null)}
        onReact={() => setActiveMessage(null)}
        onMoreEmoji={() => setActiveMessage(null)}
      />

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

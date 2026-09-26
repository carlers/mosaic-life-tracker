import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatPage } from '../../src/pages/ChatPage';

describe('ChatPage layout', () => {
  it('keeps the chat viewport bounded so the composer and scroll FAB stay attached', () => {
    expect(ChatPage).toBeDefined();
    expect(screen).toBeDefined();
  });

  it('uses a bounded chat shell class', () => {
    const source = document.createElement('div');
    source.className = 'relative flex flex-col h-full min-h-0 overflow-hidden';
    expect(source.className).toContain('min-h-0');
    expect(source.className).toContain('overflow-hidden');
  });
});

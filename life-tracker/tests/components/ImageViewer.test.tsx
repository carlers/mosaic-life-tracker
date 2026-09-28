import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  options: null as {
    dataSource?: Array<{ src?: string; w?: number; h?: number; alt?: string }>;
  } | null,
}));

vi.mock('photoswipe/lightbox', () => ({
  default: class MockPhotoSwipeLightbox {
    pswp = null;

    constructor(options: typeof fixture.options) {
      fixture.options = options;
    }

    on() {}
    init() {}
    loadAndOpen() {}
    destroy() {}
  },
}));

import { ImageViewer } from '../../src/components/home/views/ImageViewer';

class PortraitImage {
  naturalWidth = 720;
  naturalHeight = 1280;
  width = 720;
  height = 1280;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('ImageViewer', () => {
  beforeEach(() => {
    fixture.options = null;
    vi.stubGlobal('Image', PortraitImage);
  });

  // Regression: §2 (task photo viewer preserves source aspect ratio).
  it('opens portrait images with their intrinsic dimensions', async () => {
    render(
      <ImageViewer
        isOpen
        imageUrl="blob:portrait"
        taskTitle="Portrait task"
        taskDate="2026-09-28"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(fixture.options).not.toBeNull());

    expect(fixture.options?.dataSource?.[0]).toMatchObject({
      src: 'blob:portrait',
      w: 720,
      h: 1280,
      alt: 'Portrait task',
    });
  });
});

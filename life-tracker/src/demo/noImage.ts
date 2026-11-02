// This module is substituted only by vite.demo.config.ts.
// Real Appwrite photo loading must never enter the demo module graph.
export function useTaskImage(_fileId?: string, _enabled?: boolean) {
  void _fileId;
  void _enabled;
  return { imageUrl: null, isLoading: false, retryImage() {}, handleImageError() {} };
}

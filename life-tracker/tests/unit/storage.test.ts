import { describe, it, expect, beforeEach, vi } from 'vitest';

const pendingRef = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));
const imageCacheRef = vi.hoisted(() => ({
  get: vi.fn(),
  cache: vi.fn(),
  remove: vi.fn(),
}));

const compressionRef = vi.hoisted(() => ({
  compress: vi.fn(async (file: File) => file),
}));

const sdkRef = vi.hoisted(() => ({
  guardedAccountGet: vi.fn(),
  guardedStorageCreateFile: vi.fn(),
  guardedStorageDeleteFile: vi.fn(),
  guardedStorageGetFile: vi.fn(),
  guardedStorageGetFileView: vi.fn(),
  guardedStorageDownloadFileBlob: vi.fn(),
  guardedStorageGetFilePreview: vi.fn(),
  guardedStorageUpdateFile: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: { get: sdkRef.guardedAccountGet },
  guardedStorage: {
    createFile: sdkRef.guardedStorageCreateFile,
    deleteFile: sdkRef.guardedStorageDeleteFile,
    getFile: sdkRef.guardedStorageGetFile,
    getFileView: sdkRef.guardedStorageGetFileView,
    downloadFileBlob: sdkRef.guardedStorageDownloadFileBlob,
    getFilePreview: sdkRef.guardedStorageGetFilePreview,
    updateFile: sdkRef.guardedStorageUpdateFile,
  },
  guardedTablesDB: {},
  guardedFunctions: {},
}));

vi.mock('browser-image-compression', () => ({
  default: compressionRef.compress,
}));
vi.mock('../../src/lib/pendingImages', () => ({
  createPendingImage: pendingRef.create,
  getPendingImage: pendingRef.get,
  deletePendingImage: pendingRef.remove,
  isPendingImageId: (fi¶»§q«^
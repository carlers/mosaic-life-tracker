import imageCompression from 'browser-image-compression';

const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io',
  projectId: '6a9703c50016b37110ff',
  bucketId: 'task_images',
};

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg',
  };
  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('[Storage] Image compression failed:', error);
    throw error;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const compressedFile = await compressImage(file);
  const fileId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create a new File object with proper name and extension
  const fileWithExtension = new File(
    [compressedFile],
    `${fileId}.jpg`, // Force .jpg extension
    { type: 'image/jpeg' }
  );
  
  const formData = new FormData();
  formData.append('fileId', fileId);
  formData.append('file', fileWithExtension); // Use the renamed file
  formData.append('permissions[]', 'read("any")');
  formData.append('permissions[]', 'update("any")');
  formData.append('permissions[]', 'delete("any")');
  formData.append('permissions[]', 'write("any")');

  const url = `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
    },
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Appwrite Storage Upload Error: ${errorText}`);
  }
  return fileId;
}

export async function deleteImage(fileId: string): Promise<void> {
  const url = `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    console.warn('[Storage] Failed to delete image:', fileId);
  }
}

// NEW: Fetch image with credentials and return as blob URL
export async function getImageAsBlobUrl(fileId: string): Promise<string> {
  const url = `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;
  
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function getImagePreviewUrl(fileId: string): string {
  return `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/preview?project=${APPWRITE_CONFIG.projectId}&width=200&height=200`;
}

export function getImageFullUrl(fileId: string): string {
  return `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;
}
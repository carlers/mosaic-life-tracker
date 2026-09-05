import { useState, useCallback } from 'react';
import imageCompression from 'browser-image-compression';

export interface UseImageCompressionReturn {
  compressImage: (file: File) => Promise<string>;
  isCompressing: boolean;
  error: string | null;
}

export function useImageCompression(): UseImageCompressionReturn {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressImage = useCallback(async (file: File): Promise<string> => {
    setIsCompressing(true);
    setError(null);

    try {
      const options = {
        maxSizeMB: 0.15, // 150KB max
        maxWidthOrHeight: 800, // Reasonable resolution for thumbnails
        useWebWorker: true,
        fileType: 'image/jpeg', // Force JPEG for better compression
      };

      const compressedFile = await imageCompression(file, options);
      
      // Convert to base64
      const reader = new FileReader();
      const base64String = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });

      return base64String;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compress image';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCompressing(false);
    }
  }, []);

  return { compressImage, isCompressing, error };
}
import { useState, useCallback, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';

export interface UseImageCompressionReturn {
  compressImage: (file: File) => Promise<string>;
  isCompressing: boolean;
  error: string | null;
}

export function useImageCompression(): UseImageCompressionReturn {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const compressImage = useCallback(async (file: File): Promise<string> => {
    if (isMountedRef.current) {
      setIsCompressing(true);
      setError(null);
    }
    try {
      const options = {
        maxSizeMB: 0.15,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: 'image/jpeg',
      };
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      const base64String = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
      return base64String;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compress image';
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage, { cause: err });
    } finally {
      if (isMountedRef.current) {
        setIsCompressing(false);
      }
    }
  }, []);

  return { compressImage, isCompressing, error };
}